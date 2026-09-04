import { describe, expect, it } from "vitest";
import { updateUserSchema } from "./auth.js";

describe("user name validation", () => {
  it("trims names", () =>
    expect(updateUserSchema.parse({ displayName: "  ONight Admin  " })).toEqual(
      { displayName: "ONight Admin" },
    ));
  it.each(["", " ", "A", "A".repeat(161)])(
    "rejects invalid names: %s",
    (displayName) =>
      expect(updateUserSchema.safeParse({ displayName }).success).toBe(false),
  );
  it.each([
    {},
    { name: "Wrong field" },
    { displayName: "Valid", email: "changed@example.test" },
  ])("rejects unsupported/no-op changes: %j", (input) =>
    expect(updateUserSchema.safeParse(input).success).toBe(false),
  );
  it("preserves active account updates", () =>
    expect(updateUserSchema.parse({ active: false })).toEqual({
      active: false,
    }));
});
