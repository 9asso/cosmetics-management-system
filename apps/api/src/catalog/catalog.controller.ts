import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  createProductSchema,
  productListQuerySchema,
  type CreateProductInput,
  type ProductListQuery,
} from '@cosmetics/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';
import { Roles } from '../auth/auth.decorators.js';

@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery,
  ) {
    return this.catalog.list(query);
  }

  @Post()
  @Roles('OWNER', 'MANAGER', 'WAREHOUSE')
  create(
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
  ) {
    return this.catalog.create(input);
  }
}
