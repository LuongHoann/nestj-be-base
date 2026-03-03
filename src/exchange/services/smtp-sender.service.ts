import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type SmtpCredentials = {
  email: string;
  password: string;
};

type MailboxTransporter = {
  transporter: nodemailer.Transporter;
  password: string;
  lastUsedAt: number;
};

@Injectable()
export class SmtpSenderService implements OnModuleDestroy {
  private readonly logger = new Logger(SmtpSenderService.name);
  private readonly transporters = new Map<string, MailboxTransporter>();
  private readonly idleTtlMs: number;

  constructor(private readonly configService: ConfigService) {
    this.idleTtlMs = this.configService.get<number>(
      'SMTP_POOL_IDLE_TTL_MS',
      30 * 60 * 1000,
    );
  }

  async sendMail(
    credentials: SmtpCredentials,
    options: nodemailer.SendMailOptions,
  ): Promise<nodemailer.SentMessageInfo> {
    this.cleanupIdleTransporters();
    const entry = await this.getOrCreateTransporter(credentials);
    entry.lastUsedAt = Date.now();
    return entry.transporter.sendMail(options);
  }

  async onModuleDestroy(): Promise<void> {
    for (const [email, entry] of this.transporters.entries()) {
      try {
        entry.transporter.close();
      } catch (error) {
        this.logger.warn(
          `Failed to close SMTP transporter for ${email}: ${error.message}`,
        );
      }
    }
    this.transporters.clear();
  }

  private async getOrCreateTransporter(
    credentials: SmtpCredentials,
  ): Promise<MailboxTransporter> {
    const existing = this.transporters.get(credentials.email);

    if (existing && existing.password === credentials.password) {
      return existing;
    }

    if (existing) {
      try {
        existing.transporter.close();
      } catch (error) {
        this.logger.warn(
          `Failed to close old SMTP transporter for ${credentials.email}: ${error.message}`,
        );
      }
    }

    const transporter = nodemailer.createTransport(
      this.buildSmtpConfig(credentials) as any,
    );

    const entry: MailboxTransporter = {
      transporter,
      password: credentials.password,
      lastUsedAt: Date.now(),
    };

    this.transporters.set(credentials.email, entry);
    this.logger.log(`Initialized SMTP pool for ${credentials.email}`);
    return entry;
  }

  private buildSmtpConfig(credentials: SmtpCredentials) {
    const host = this.configService.get<string>(
      'SMTP_HOST',
      'smtp.office365.com',
    );
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const maxConnections = this.configService.get<number>(
      'SMTP_POOL_MAX_CONNECTIONS',
      2,
    );
    const maxMessages = this.configService.get<number>(
      'SMTP_POOL_MAX_MESSAGES',
      100,
    );
    const rateLimit = this.configService.get<number>('SMTP_RATE_LIMIT', 3);
    const rateDelta = this.configService.get<number>(
      'SMTP_RATE_DELTA_MS',
      1000,
    );

    return {
      host,
      port,
      secure,
      requireTLS: true,
      auth: {
        user: credentials.email,
        pass: credentials.password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      debug: true,
      logger: true,
      pool: true,
      maxConnections,
      maxMessages,
      rateLimit,
      rateDelta,
    };
  }

  private cleanupIdleTransporters(): void {
    const now = Date.now();

    for (const [email, entry] of this.transporters.entries()) {
      if (now - entry.lastUsedAt < this.idleTtlMs) {
        continue;
      }

      try {
        entry.transporter.close();
      } catch (error) {
        this.logger.warn(
          `Failed to close idle SMTP transporter for ${email}: ${error.message}`,
        );
      }
      this.transporters.delete(email);
    }
  }
}
