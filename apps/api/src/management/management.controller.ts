import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createCustomerSchema,
  createPurchaseSchema,
  createSupplierSchema,
  createWholesaleSaleSchema,
  orderListQuerySchema,
  orderParamsSchema,
  updateOrderStatusSchema,
  type CreateCustomerInput,
  type CreatePurchaseInput,
  type CreateSupplierInput,
  type CreateWholesaleSaleInput,
  type OrderListQuery,
  type UpdateOrderStatusInput,
} from '@cosmetics/contracts';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ManagementService } from './management.service.js';

@Controller()
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get('suppliers')
  suppliers() {
    return this.management.suppliers();
  }

  @Roles('OWNER', 'MANAGER', 'WAREHOUSE')
  @Post('suppliers')
  createSupplier(
    @Body(new ZodValidationPipe(createSupplierSchema)) input: CreateSupplierInput,
  ) {
    return this.management.createSupplier(input);
  }

  @Get('customers')
  customers() {
    return this.management.customers();
  }

  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @Post('customers')
  createCustomer(
    @Body(new ZodValidationPipe(createCustomerSchema)) input: CreateCustomerInput,
  ) {
    return this.management.createCustomer(input);
  }

  @Roles('OWNER', 'MANAGER', 'WAREHOUSE', 'ACCOUNTANT')
  @Post('purchases')
  purchase(
    @Body(new ZodValidationPipe(createPurchaseSchema)) input: CreatePurchaseInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.createPurchase(input, user.id);
  }

  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @Post('wholesale-sales')
  wholesaleSale(
    @Body(new ZodValidationPipe(createWholesaleSaleSchema)) input: CreateWholesaleSaleInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.createWholesaleSale(input, user.id);
  }

  @Get('orders')
  orders(@Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQuery) {
    return this.management.orders(query);
  }

  @Roles('OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE')
  @Patch('orders/:id/status')
  updateOrder(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) input: UpdateOrderStatusInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.updateOrderStatus(params.id, input.status, user.id);
  }
}
