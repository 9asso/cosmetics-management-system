import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Public } from '../auth/auth.decorators.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    await this.db.query('SELECT 1');
    return { status: 'ok', service: 'cosmetics-api', timestamp: new Date().toISOString() };
  }
}
