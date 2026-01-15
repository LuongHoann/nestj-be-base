import { Injectable } from '@nestjs/common';
import { QueryEngineService } from '../query/query-engine.service';
import { GenericRepository } from '../repository/generic.repository';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class ReportsService {
  constructor(
      private readonly queryEngine: QueryEngineService,
      private readonly repository: GenericRepository,
      private readonly permissionService: PermissionService
  ) {}

  async getActiveUsers(query: any) {
    // 1. Assert custom permission for this specific report
    // This demonstrates arbitrary action strings beyond CRUD
    this.permissionService.assert('reports', 'generate');

    // 2. Force a filter for "active" users (assuming we have such a field, or logic)
    // For demo, let's say "active" means email contains "active" (just as a sample constraint)
    const customFilter = { email: { _contains: 'active' } };

    // 3. Reuse Query Engine to parse user provided query (sorting, fields, etc)
    // but inject our atomic custom filter.
    const options = await this.queryEngine.parseAndCompile({
        collection: 'user', // "user" maps to User entity
        query: query
    });

    // 4. Merge custom business logic into the generic options
    // Note: options.where comes from QueryEngine which already merged Permission Filters.
    // Now we merge Business Logic Filters.
    options.where = {
        '$and': [
            options.where,
            { email: { '$like': '%active%' } } // The compiled version of our custom logic
        ]
    };

    return this.repository.find('user', options);
  }
}
