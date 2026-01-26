import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from '../mikro-orm.config';
import { MetaModule } from './meta/meta.module';
import { CommonModule } from './common/common.module';
import { QueryModule } from './query/query.module';
import { RepositoryModule } from './repository/repository.module';
import { ServicesModule } from './services/services.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    MetaModule,
    CommonModule,
    QueryModule,
    RepositoryModule,
    ServicesModule,
    AuthModule,
    FilesModule,
    // Note: Reports is part of the app, usually would be in its own module
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class AppModule {}

