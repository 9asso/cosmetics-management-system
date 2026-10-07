import { describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { AuthService } from "../auth/auth.service.js";
import { CatalogController } from "./catalog.controller.js";

function contextFor(role: string) {
  const auth = {
    authenticate: vi.fn().mockResolvedValue({ id: "user", role }),
  } as unknown as AuthService;
  const guard = new AuthGuard(new Reflector(), auth);
  const context = {
    getHandler: () => CatalogController.prototype.remove,
    getClass: () => CatalogController,
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: "Bearer token" } }),
    }),
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe("product deletion access control", () => {
  it.each([
    "MANAGER",
    "WAREHOUSE",
    "ACCOUNTANT",
    "CASHIER",
    "SALES_REP",
    "STAFF",
  ])("rejects %s", async (role) => {
    const { guard, context } = contextFor(role);
    await expect(guard.canActivate(context)).rejects.toThrow("permissions");
  });

  it("allows the owner", async () => {
    const { guard, context } = contextFor("OWNER");
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
