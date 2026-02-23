import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../database/entities/user.entity';
import { CommonModule } from '../common/common.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuditLogModule } from '../audit/audit.module';
import { ExchangeModule } from '../exchange/exchange.module';

@Module({
  imports: [
    CommonModule,
    AuditLogModule,
    ExchangeModule,
    PassportModule.register({defaultStrategy: 'jwt'}),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: {
          expiresIn: configService.get<any>('JWT_EXPIRES_IN') || '15m',
        },
      }),
    }),
    MikroOrmModule.forFeature([User]),
  ],
  providers: [AuthService, JwtStrategy,JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule,JwtModule,JwtAuthGuard],
})
export class AuthModule {}
