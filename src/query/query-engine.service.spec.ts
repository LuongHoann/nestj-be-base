import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryEngineService } from './query-engine.service';
import { FilterParser } from './parser/filter.parser';
import { SortParser } from './parser/sort.parser';
import { PaginationParser } from './parser/pagination.parser';
import { FieldsParser } from './parser/fields.parser';
import { DeepParser } from './parser/deep.parser';
import { MetaParser } from './parser/meta.parser';
import { WhereCompiler } from './compiler/where.compiler';
import { OrderCompiler } from './compiler/order.compiler';
import { FieldsCompiler } from './compiler/fields.compiler';
import { PermissionService } from '../common/permissions/permission.service';

describe('QueryEngineService Limits', () => {
  let service: QueryEngineService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key, defaultValue) => {
        if (key === 'query.maxSortFields') return 2;
        if (key === 'query.maxConditions') return 3;
        if (key === 'query.allowRegex') return false;
        return defaultValue;
    }),
  };

  const mockPermissionService = {
      can: jest.fn().mockReturnValue({})
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryEngineService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PermissionService, useValue: mockPermissionService },
        // Mocks for dependencies not under test
        { provide: FilterParser, useValue: { parse: jest.fn(x => x) } },
        { provide: SortParser, useValue: { parse: jest.fn(x => x) } },
        { provide: PaginationParser, useValue: { parse: jest.fn(() => ({ limit: 10, offset: 0 })) } },
        { provide: FieldsParser, useValue: { parse: jest.fn() } },
        { provide: DeepParser, useValue: { parse: jest.fn() } },
        { provide: MetaParser, useValue: { parse: jest.fn() } },
        { provide: WhereCompiler, useValue: { compile: jest.fn(x => x) } }, // Passthrough for condition counting test
        { provide: OrderCompiler, useValue: { compile: jest.fn() } },
        { provide: FieldsCompiler, useValue: { compile: jest.fn() } },
      ],
    }).compile();

    service = module.get<QueryEngineService>(QueryEngineService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should throw if sort fields exceed limit', async () => {
    const context: any = {
        collection: 'users',
        query: {
            sort: { a: 'ASC', b: 'DESC', c: 'ASC' } // 3 fields, limit is 2
        }
    };

    await expect(service.parseAndCompile(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw if regex is used when disabled', async () => {
      const context: any = {
          collection: 'users',
          query: {
              filter: { name: { $regex: 'pattern' } }
          }
      };
      
      await expect(service.parseAndCompile(context)).rejects.toThrow(BadRequestException);
  });
});
