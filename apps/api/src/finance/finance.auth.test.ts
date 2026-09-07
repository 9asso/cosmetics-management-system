import { describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { AuthService } from "../auth/auth.service.js";
import { FinanceController } from "./finance.controller.js";
describe("finance access control", () => {
  it.each(["STAFF", "WAREHOUSE", "CASHIER"])(
    "rejects %s for every finance endpoint",
    async (role) => {
      const auth = {
        authenticate: vi.fn().mockResolvedValue({ id: "user", role }),
      } as unknown as AuthService;
      const guard = new AuthGuard(new Reflector(), auth);
      for (const method of [
        "summary",
        "balances",
        "checks",
        "expenses",
        "payment",
        "check",
        "expense",
        "voidExpense",
      ] as const) {
        const context = {
          getHandler: () => FinanceController.prototype[method],
          getClass: () => FinanceController,
          switchToHttp: () => ({
            getRequest: () => ({ headers: { authorization: "Bearer token" } }),
          }),
        } as unknown as ExecutionContext;
        await expect(guard.canActivate(context)).rejects.toThrow("permissions");
      }
    },
  );
});
