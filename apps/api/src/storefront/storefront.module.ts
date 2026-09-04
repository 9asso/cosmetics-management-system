import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';

@Module({ imports: [CatalogModule], controllers: [StorefrontController], providers: [StorefrontService] })
export class StorefrontModule {}
