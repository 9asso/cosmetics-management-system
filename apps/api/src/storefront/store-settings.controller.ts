import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  discountCodeSchema,
  storefrontSettingsSchema,
  type DiscountCodeInput,
  type StorefrontSettings,
} from '@cosmetics/contracts';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { StoreSettingsService } from './store-settings.service.js';

/** Online shop settings and discount codes, edited from the desktop Settings page. */
@Roles('OWNER')
@Controller('settings')
export class StoreSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get('storefront')
  storefront() {
    return this.settings.settings();
  }

  @Patch('storefront')
  updateStorefront(
    @Body(new ZodValidationPipe(storefrontSettingsSchema)) input: StorefrontSettings,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateSettings(input, user.id);
  }

  @Get('discount-codes')
  discountCodes() {
    return this.settings.discountCodes();
  }

  @Post('discount-codes')
  createDiscountCode(
    @Body(new ZodValidationPipe(discountCodeSchema)) input: DiscountCodeInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.createDiscountCode(input, user.id);
  }

  @Patch('discount-codes/:id')
  updateDiscountCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(discountCodeSchema)) input: DiscountCodeInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateDiscountCode(id, input, user.id);
  }

  @Delete('discount-codes/:id')
  deleteDiscountCode(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.settings.deleteDiscountCode(id, user.id);
  }
}
