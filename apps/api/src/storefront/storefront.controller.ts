import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { createRetailOrderSchema, productListQuerySchema, type CreateRetailOrderInput, type ProductListQuery } from '@cosmetics/contracts';
import { CatalogService } from '../catalog/catalog.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { StorefrontService } from './storefront.service.js';

@Controller('store')
export class StorefrontController {
  constructor(private readonly catalog: CatalogService, private readonly storefront: StorefrontService) {}

  @Get('products')
  products(
    @Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery,
  ) {
    return this.catalog.list(query, true);
  }

  @Post('orders')
  createOrder(
    @Body(new ZodValidationPipe(createRetailOrderSchema)) input: CreateRetailOrderInput,
  ) {
    return this.storefront.createOrder(input);
  }
}
