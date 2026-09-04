import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ManagementModule } from './management/management.module.js';
import { StorefrontModule } from './storefront/storefront.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    InventoryModule,
    DashboardModule,
    StorefrontModule,
    ManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
