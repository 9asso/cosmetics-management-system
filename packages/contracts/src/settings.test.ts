import { describe, expect, it } from "vitest";
import { brandSettingsSchema, defaultBrandSettings } from "./settings.js";

describe("brand settings validation", () => {
  it("accepts the default invoice identity", () => {
    expect(brandSettingsSchema.parse(defaultBrandSettings)).toEqual(
      defaultBrandSettings,
    );
  });

  it("rejects empty invoice text", () => {
    expect(
      brandSettingsSchema.safeParse({
        ...defaultBrandSettings,
        thankYouText: "",
      }).success,
    ).toBe(false);
  });
});
