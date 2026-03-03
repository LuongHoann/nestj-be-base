import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, QueryOrder } from '@mikro-orm/core';
import { User } from '../database/entities/user.entity';
import { ScriptRunnerService } from './script-runner.service';
import { CreateMailboxDto, UpdateMailboxDto } from './mailbox.dto';

@Injectable()
export class MailboxService {
  constructor(
    private readonly em: EntityManager,
    private readonly scriptRunner: ScriptRunnerService,
  ) {}

  async list(page: number, pageSize: number, search?: string) {
    const limit = Math.max(1, Math.min(pageSize || 20, 100));
    const offset = Math.max(0, (page - 1) * limit);

    const where: any = {};
    if (search?.trim()) {
      where.$or = [
        { email: { $ilike: `%${search}%` } },
        { name: { $ilike: `%${search}%` } },
      ];
    }

    const [items, total] = await this.em.findAndCount(User, where, {
      limit,
      offset,
      orderBy: { createdAt: QueryOrder.DESC },
    });

    return { items, total, page, pageSize: limit };
  }

  async get(id: string) {
    const user = await this.em.findOne(User, { id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateMailboxDto) {
    const existing = await this.em.findOne(User, { email: dto.email });
    if (existing) throw new ConflictException('Email already exists');

    await this.scriptRunner.run('create', {
      action: 'create',
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });

    const now = new Date();
    const user = this.em.create(User, {
      email: dto.email,
      name: dto.name,
      isActive: true,
      mailboxInitialized: true,
      createdAt: now,
      updatedAt: now,
    });
    await this.em.persistAndFlush(user);

    return user;
  }

  async update(id: string, dto: UpdateMailboxDto) {
    const user = await this.em.findOne(User, { id });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.em.findOne(User, { email: dto.email });
      if (existing) throw new ConflictException('Email already exists');
    }

    const oldEmail = user.email;
    const nextName = dto.name ?? user.name;
    const nextEmail = dto.email ?? user.email;
    const nextIsActive = dto.isActive ?? user.isActive;

    await this.scriptRunner.run('update', {
      action: 'update',
      email: nextEmail,
      oldEmail,
      name: nextName,
      isActive: nextIsActive,
    });

    user.name = nextName;
    user.email = nextEmail;
    user.isActive = nextIsActive;
    await this.em.persistAndFlush(user);

    return user;
  }

  async remove(id: string) {
    const user = await this.em.findOne(User, { id });
    if (!user) throw new NotFoundException('User not found');

    await this.scriptRunner.run('disable', {
      action: 'disable',
      email: user.email,
    });

    user.isActive = false;
    await this.em.persistAndFlush(user);

    return { success: true };
  }

  async restore(id: string) {
    const user = await this.em.findOne(User, { id });
    if (!user) throw new NotFoundException('User not found');

    await this.scriptRunner.run('restore', {
      action: 'restore',
      email: user.email,
    });

    user.isActive = true;
    await this.em.persistAndFlush(user);

    return { success: true };
  }

  async destroy(id: string) {
    const user = await this.em.findOne(User, { id });
    if (!user) throw new NotFoundException('User not found');

    await this.scriptRunner.run('delete', {
      action: 'delete',
      email: user.email,
    });

    await this.em.removeAndFlush(user);

    return { success: true };
  }

  async importCsv(csv: string) {
    const records = this.parseCsv(csv);
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const record of records) {
      try {
        await this.create({
          email: record.email,
          name: record.name,
          password: record.password,
        });
        results.push({ email: record.email, success: true });
      } catch (error) {
        results.push({
          email: record.email,
          success: false,
          error: error.message,
        });
      }
    }

    return { results };
  }

  async sync(id: string, password?: string) {
    const user = await this.em.findOne(User, { id });
    if (!user) throw new NotFoundException('User not found');

    if (!user.isActive) {
      await this.scriptRunner.run('disable', {
        action: 'disable',
        email: user.email,
      });
      return { success: true, action: 'disable' };
    }

    if (!user.mailboxInitialized) {
      if (!password) {
        throw new BadRequestException('Password is required to create mailbox');
      }
      await this.scriptRunner.run('create', {
        action: 'create',
        email: user.email,
        name: user.name ?? '',
        password,
      });
      user.mailboxInitialized = true;
      await this.em.persistAndFlush(user);
      return { success: true, action: 'create' };
    }

    await this.scriptRunner.run('update', {
      action: 'update',
      email: user.email,
      name: user.name ?? '',
      isActive: user.isActive,
    });

    return { success: true, action: 'update' };
  }

  private parseCsv(
    csv: string,
  ): { email: string; name: string; password: string }[] {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];

    const header = this.parseCsvLine(lines[0]);
    const emailIndex = header.indexOf('email');
    const nameIndex = header.indexOf('name');
    const passwordIndex = header.indexOf('password');

    if (emailIndex < 0 || nameIndex < 0 || passwordIndex < 0) {
      throw new BadRequestException(
        'CSV must include headers: email,name,password',
      );
    }

    const records: { email: string; name: string; password: string }[] = [];
    for (const line of lines.slice(1)) {
      const cols = this.parseCsvLine(line);
      const email = cols[emailIndex]?.trim();
      const name = cols[nameIndex]?.trim();
      const password = cols[passwordIndex]?.trim();
      if (!email || !name || !password) continue;
      records.push({ email, name, password });
    }

    return records;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current);
    return result;
  }
}
