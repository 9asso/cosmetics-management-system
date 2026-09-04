import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { MediaController } from './media.controller.js';

@Module({
  controllers: [CatalogController, MediaController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
