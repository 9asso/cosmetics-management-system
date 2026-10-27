import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ManagementService } from "./management.service.js";
import type { DatabaseService } from "../database/database.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

const manager: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "store@example.test",
  displayName: "Store Manager",
  role: "STOREFRONT_MANAGER",
};

describe("storefront manager order boundary", () => {
  it("filters order lists to retail web even when all channels are requested", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const service = new ManagementService({ query } as unknown as DatabaseService);
    await service.orders({ channel: "all", status: "all", search: "" }, manager);
    expect(query.mock.calls[0]?.[0]).toContain("so.channel = 'RETAIL_WEB'");
  });

  it("rejects status changes to wholesale orders before changing stock", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "order", channel: "WHOLESALE_DESKTOP", status: "ORDERED" }] });
    const withTransaction = vi.fn(async (run) => run({ query }));
    const service = new ManagementService({ query, withTransaction } as unknown as DatabaseService);
    await expect(service.updateOrderStatus("order", "DELIVERED", manager.id, manager.role)).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("cannot open purchase or wholesale invoices", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const service = new ManagementService({ query } as unknown as DatabaseService);
    await expect(service.invoice("purchase", "document", manager)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.invoice("sale", "document", manager)).rejects.toBeInstanceOf(NotFoundException);
  });
});
