import { describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { AuthService } from "../auth/auth.service.js";
import { storefrontScopeFilter } from "../catalog/catalog.service.js";
import { StoreSettingsController } from "./store-settings.controller.js";
import { StorefrontController } from "./storefront.controller.js";
import { ManagementController } from "../management/management.controller.js";
import { CatalogController } from "../catalog/catalog.controller.js";

function contextFor(role: string | null, handler: object, controller: object) {
  const auth = {
    authenticate: vi.fn().mockResolvedValue(role ? { id: "user", role } : null),
  } as unknown as AuthService;
  const guard = new AuthGuard(new Reflector(), auth);
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ headers: role ? { authorization: "Bearer token" } : {} }),
    }),
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe("storefront settings access control", () => {
  it.each(["MANAGER", "CASHIER", "WAREHOUSE", "ACCOUNTANT", "SALES_REP", "STAFF"])(
    "rejects %s on discount codes",
    async (role) => {
      const { guard, context } = contextFor(role, StoreSettingsController.prototype.createDiscountCode, StoreSettingsController);
      await expect(guard.canActivate(context)).rejects.toThrow("permissions");
    },
  );

  it("allows the owner", async () => {
    const { guard, context } = contextFor("OWNER", StoreSettingsController.prototype.updateStorefront, StoreSettingsController);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("allows the storefront manager to edit shop settings and view retail orders", async () => {
    for (const [handler, controller] of [
      [StoreSettingsController.prototype.updateStorefront, StoreSettingsController],
      [ManagementController.prototype.orders, ManagementController],
      [CatalogController.prototype.list, CatalogController],
    ] as const) {
      const { guard, context } = contextFor("STOREFRONT_MANAGER", handler, controller);
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
  });

  it("blocks the storefront manager from stock editing and unrelated records", async () => {
    for (const [handler, controller] of [
      [CatalogController.prototype.update, CatalogController],
      [ManagementController.prototype.invoices, ManagementController],
      [ManagementController.prototype.purchase, ManagementController],
    ] as const) {
      const { guard, context } = contextFor("STOREFRONT_MANAGER", handler, controller);
      await expect(guard.canActivate(context)).rejects.toThrow("boutique en ligne");
    }
  });

  it("keeps shopper endpoints public", async () => {
    const { guard, context } = contextFor(null, StorefrontController.prototype.discountCode, StorefrontController);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

describe("storefrontScopeFilter", () => {
  it("lists switched-on products or every product in stock with a retail price", () => {
    expect(storefrontScopeFilter("VISIBLE")).toBe("p.retail_visible = true");
    expect(storefrontScopeFilter("IN_STOCK")).toContain("> 0 AND v.retail_price > 0");
  });
});
