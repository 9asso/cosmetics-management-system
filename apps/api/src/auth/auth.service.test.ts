import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthUser, TeamUser } from "@cosmetics/contracts";
import { AuthService } from "./auth.service.js";
import type { DatabaseService } from "../database/database.service.js";

const owner: AuthUser = {
  id: "owner",
  displayName: "Admin",
  email: "admin@example.test",
  role: "OWNER",
};
function setup(target: Partial<TeamUser> | null) {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: target ? [target] : [] })
    .mockResolvedValueOnce({ rows: [{ ...target, displayName: "New name" }] });
  const db = { withTransaction: vi.fn(async (work) => work({ query })) };
  return {
    service: new AuthService(db as unknown as DatabaseService),
    query,
    db,
  };
}

describe("administrator account editing", () => {
  it.each([
    { id: "owner", role: "OWNER" },
    { id: "staff", role: "STAFF" },
  ])("allows own name or non-admin name: $id", async (target) => {
    const { service, query } = setup(target as TeamUser);
    const saved = await service.updateUser(
      target.id,
      { displayName: "New name" },
      owner,
    );
    expect(saved.displayName).toBe("New name");
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1]?.[1]).toEqual(
      expect.arrayContaining(["New name"]),
    );
  });
  it.each([
    { displayName: "New name" },
    { displayName: "New name", role: "STAFF" as const },
    { role: "STAFF" as const },
    { password: "NewPassword123" },
    { active: false },
  ])(
    "protects peer admins, including role/password bypasses: %j",
    async (input) => {
      const { service, query } = setup({ id: "other-admin", role: "OWNER" });
      await expect(
        service.updateUser("other-admin", input, owner),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(query).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects a non-admin before accessing the database", async () => {
    const { service, db } = setup(owner);
    await expect(
      service.updateUser(
        owner.id,
        { displayName: "No" },
        { ...owner, role: "MANAGER" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
  it("returns not found for an unknown or cross-organization target", async () => {
    const { service } = setup(null);
    await expect(
      service.updateUser("unknown", { displayName: "No" }, owner),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([{ active: false }, { role: "STAFF" as const }])(
    "prevents admin self lockout: %j",
    async (input) => {
      const { service } = setup(owner);
      await expect(
        service.updateUser(owner.id, input, owner),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
});
