import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('active-users')
  async getActiveUsers(@Query() query: any) {
    // Allows standard Directus filtering on top of custom logic
    return this.reportsService.getActiveUsers(query);
  }
}
