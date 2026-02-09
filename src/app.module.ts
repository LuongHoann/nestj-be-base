import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import queryConfig from './config/query.config';
import storageConfig from './config/storage.config';
import { MetaModule } from './meta/meta.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { User } from './database/entities/user.entity';
import { File } from './database/entities/file.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { AuditLogModule } from './audit/audit.module';
import { ExchangeModule } from './exchange/exchange.module';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, queryConfig, storageConfig],
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        driver: PostgreSqlDriver,
        entities: [User, File, AuditLog],
        dbName: configService.get<string>('database.name'),
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        user: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        debug: configService.get<string>('NODE_ENV') !== 'production',
        allowGlobalContext: configService.get<boolean>('database.allowGlobalContext'),
        migrations: {
            path: './src/database/migrations',
            pathTs: './src/database/migrations',
        },
      }),
      inject: [ConfigService],
    }),
    MetaModule,
    CommonModule,
    AuthModule,
    FilesModule,
    AuditLogModule,
    ExchangeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
