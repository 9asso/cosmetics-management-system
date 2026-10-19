import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { StoreSettingsController } from './store-settings.controller.js';
import { StoreSettingsService } from './store-settings.service.js';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [StorefrontController, StoreSettingsController],
  providers: [StorefrontService, StoreSettingsService],
})
export class StorefrontModule {}
