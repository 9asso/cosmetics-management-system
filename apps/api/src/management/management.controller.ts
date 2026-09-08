import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createCustomerSchema,
  createPurchaseSchema,
  createSupplierSchema,
  createWholesaleSaleSchema,
  orderListQuerySchema,
  orderParamsSchema,
  updateOrderStatusSchema,
  invoiceQuerySchema,
  invoiceParamsSchema,
  type InvoiceQuery,
  createInvoiceReturnSchema,
  updateInvoiceSchema,
  type CreateCustomerInput,
  type CreatePurchaseInput,
  type CreateSupplierInput,
  type CreateWholesaleSaleInput,
  type OrderListQuery,
  type UpdateOrderStatusInput,
  type CreateInvoiceReturnInput,
  type UpdateInvoiceInput,
} from "@cosmetics/contracts";
import { CurrentUser, Roles } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ManagementService } from "./management.service.js";

@Controller()
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Roles("OWNER")
  @Patch("suppliers/:id")
  updateSupplier(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(createSupplierSchema))
    input: CreateSupplierInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.updatePartner(
      "suppliers",
      params.id,
      input,
      user.id,
    );
  }

  @Roles("OWNER")
  @Patch("customers/:id")
  updateCustomer(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(createCustomerSchema))
    input: CreateCustomerInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.updatePartner(
      "customers",
      params.id,
      input,
      user.id,
    );
  }

  @Roles("OWNER")
  @Delete("suppliers/:id")
  deleteSupplier(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.archivePartner("suppliers", params.id, user.id);
  }

  @Roles("OWNER")
  @Delete("customers/:id")
  deleteCustomer(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.archivePartner("customers", params.id, user.id);
  }

  @Get("invoices")
  invoices(
    @Query(new ZodValidationPipe(invoiceQuerySchema)) query: InvoiceQuery,
  ) {
    return this.management.invoices(query);
  }

  @Get("invoices/:kind/:id")
  invoice(
    @Param(new ZodValidationPipe(invoiceParamsSchema))
    params: {
      kind: "sale" | "purchase";
      id: string;
    },
  ) {
    return this.management.invoice(params.kind, params.id);
  }

  @Roles("OWNER", "MANAGER", "CASHIER", "WAREHOUSE", "ACCOUNTANT")
  @Patch("invoices/:kind/:id")
  updateInvoice(
    @Param(new ZodValidationPipe(invoiceParamsSchema))
    params: { kind: "sale" | "purchase"; id: string },
    @Body(new ZodValidationPipe(updateInvoiceSchema)) input: UpdateInvoiceInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.updateInvoice(
      params.kind,
      params.id,
      input,
      user.id,
    );
  }

  @Roles("OWNER", "MANAGER", "CASHIER")
  @Post("invoices/sale/:id/returns")
  createInvoiceReturn(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(createInvoiceReturnSchema))
    input: CreateInvoiceReturnInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.createInvoiceReturn(params.id, input, user.id);
  }

  @Post("invoices/:kind/:id/prints")
  recordInvoicePrint(
    @Param(new ZodValidationPipe(invoiceParamsSchema))
    params: { kind: "sale" | "purchase"; id: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.recordInvoicePrint(params.kind, params.id, user.id);
  }

  @Get("suppliers")
  suppliers() {
    return this.management.suppliers();
  }

  @Roles("OWNER", "MANAGER", "WAREHOUSE")
  @Post("suppliers")
  createSupplier(
    @Body(new ZodValidationPipe(createSupplierSchema))
    input: CreateSupplierInput,
  ) {
    return this.management.createSupplier(input);
  }

  @Get("customers")
  customers() {
    return this.management.customers();
  }

  @Roles("OWNER", "MANAGER", "CASHIER")
  @Post("customers")
  createCustomer(
    @Body(new ZodValidationPipe(createCustomerSchema))
    input: CreateCustomerInput,
  ) {
    return this.management.createCustomer(input);
  }

  @Roles("OWNER", "MANAGER", "WAREHOUSE", "ACCOUNTANT")
  @Post("purchases")
  purchase(
    @Body(new ZodValidationPipe(createPurchaseSchema))
    input: CreatePurchaseInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.createPurchase(input, user.id);
  }

  @Roles("OWNER", "MANAGER", "CASHIER")
  @Post("wholesale-sales")
  wholesaleSale(
    @Body(new ZodValidationPipe(createWholesaleSaleSchema))
    input: CreateWholesaleSaleInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.createWholesaleSale(input, user.id);
  }

  @Get("orders")
  orders(
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQuery,
  ) {
    return this.management.orders(query);
  }

  @Roles("OWNER", "MANAGER", "CASHIER", "WAREHOUSE")
  @Patch("orders/:id/status")
  updateOrder(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateOrderStatusSchema))
    input: UpdateOrderStatusInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.management.updateOrderStatus(params.id, input.status, user.id);
  }
}
