import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }

  @Get('analytics')
  analytics(@Query(new ZodValidationPipe(z.object({ range: z.enum(['year', 'month', 'week']).default('year') }))) query: { range: 'year' | 'month' | 'week' }) {
    return this.dashboard.analytics(query.range);
  }
}
