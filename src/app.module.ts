import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import queryConfig from './config/query.config';
import storageConfig from './config/storage.config';
import { MetaModule } from './meta/meta.module';
import { CommonModule } from './common/common.module';
import { QueryModule } from './query/query.module';
import { RepositoryModule } from './repository/repository.module';
import { ServicesModule } from './services/services.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { User } from './database/entities/user.entity';
import { Post } from './database/entities/post.entity';
import { Comment } from './database/entities/comment.entity';
import { Role } from './database/entities/role.entity';
import { Permission } from './database/entities/permission.entity';
import { RefreshToken } from './database/entities/refresh-token.entity';
import { ResetPasswordToken } from './database/entities/reset-password-token.entity';
import { File } from './database/entities/file.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, queryConfig, storageConfig],
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        entities: [User, Post, Comment, Role, Permission, RefreshToken, ResetPasswordToken, File],
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
    QueryModule,
    RepositoryModule,
    ServicesModule,
    AuthModule,
    FilesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class AppModule {}

