import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import {
  createRetailOrderSchema,
  productListQuerySchema,
  type CreateRetailOrderInput,
  type ProductListQuery,
  type PublicStorefrontSettings,
} from '@cosmetics/contracts';
import { CatalogService } from '../catalog/catalog.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { StoreSettingsService } from './store-settings.service.js';
import { StorefrontService } from './storefront.service.js';
import { Public } from '../auth/auth.decorators.js';

@Public()
@Controller('store')
export class StorefrontController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly storefront: StorefrontService,
    private readonly settings: StoreSettingsService,
  ) {}

  @Get('settings')
  async publicSettings(): Promise<PublicStorefrontSettings> {
    const { catalogSource, freeShippingThreshold, shippingFee, featured } = await this.settings.settings();
    return { catalogSource, freeShippingThreshold, shippingFee, featured };
  }

  @Get('products')
  async products(
    @Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery,
  ) {
    const { productScope } = await this.settings.settings();
    return this.catalog.list(query, productScope);
  }

  @Get('discount-codes/:code')
  async discountCode(@Param('code') code: string) {
    const discount = await this.settings.findUsableCode(code);
    if (!discount) throw new NotFoundException('Ce code de réduction n’est pas valide ou a expiré.');
    return discount;
  }

  @Post('orders')
  createOrder(
    @Body(new ZodValidationPipe(createRetailOrderSchema)) input: CreateRetailOrderInput,
  ) {
    return this.storefront.createOrder(input);
  }
}
