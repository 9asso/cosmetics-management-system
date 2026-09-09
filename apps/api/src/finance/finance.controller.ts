import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createExpenseSchema,
  createManualCheckSchema,
  financeQuerySchema,
  invoiceParamsSchema,
  orderParamsSchema,
  recordPaymentSchema,
  updateCheckSchema,
  voidExpenseSchema,
  type CreateExpenseInput,
  type CreateManualCheckInput,
  type FinanceQuery,
  type RecordPaymentInput,
  type UpdateCheckInput,
} from "@cosmetics/contracts";
import { CurrentUser, Roles } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { FinanceService } from "./finance.service.js";

@Controller("finance")
@Roles("OWNER", "MANAGER", "ACCOUNTANT")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get("summary") summary() {
    return this.finance.summary();
  }
  @Get("balances") balances(
    @Query(new ZodValidationPipe(financeQuerySchema)) query: FinanceQuery,
  ) {
    return this.finance.balances(query);
  }
  @Get("checks") checks(
    @Query(new ZodValidationPipe(financeQuerySchema)) query: FinanceQuery,
  ) {
    return this.finance.checks(query);
  }
  @Get("expenses") expenses(
    @Query(new ZodValidationPipe(financeQuerySchema)) query: FinanceQuery,
  ) {
    return this.finance.expenses(query);
  }
  @Post("checks") createCheck(
    @Body(new ZodValidationPipe(createManualCheckSchema))
    input: CreateManualCheckInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createManualCheck(input, user.id);
  }
  @Post("payments/:kind/:id") payment(
    @Param(new ZodValidationPipe(invoiceParamsSchema))
    params: { kind: "sale" | "purchase"; id: string },
    @Body(new ZodValidationPipe(recordPaymentSchema)) input: RecordPaymentInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.recordPayment(params.kind, params.id, input, user.id);
  }
  @Patch("checks/:id") check(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCheckSchema)) input: UpdateCheckInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.updateCheck(params.id, input, user.id);
  }
  @Post("expenses") expense(
    @Body(new ZodValidationPipe(createExpenseSchema)) input: CreateExpenseInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createExpense(input, user.id);
  }
  @Patch("expenses/:id/void") voidExpense(
    @Param(new ZodValidationPipe(orderParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(voidExpenseSchema)) input: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.voidExpense(params.id, input.reason, user.id);
  }
}
