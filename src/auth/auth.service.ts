import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../database/entities/user.entity';
import { AuditLogService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getMe(userId: string): Promise<User> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại !');
    }
    return user;
  }
}
