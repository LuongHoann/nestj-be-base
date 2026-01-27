import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilterParser } from './parser/filter.parser';
import { SortParser } from './parser/sort.parser';
import { PaginationParser } from './parser/pagination.parser';
import { FieldsParser } from './parser/fields.parser';
import { DeepParser } from './parser/deep.parser';
import { MetaParser } from './parser/meta.parser';
import { WhereCompiler } from './compiler/where.compiler';
import { OrderCompiler } from './compiler/order.compiler';
import { FieldsCompiler } from './compiler/fields.compiler';
import { QueryEngineService } from './query-engine.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, ConfigModule],
  providers: [
    FilterParser, SortParser, PaginationParser, FieldsParser, DeepParser, MetaParser,
    WhereCompiler, OrderCompiler, FieldsCompiler,
    QueryEngineService
  ],
  exports: [QueryEngineService],
})
export class QueryModule {}
