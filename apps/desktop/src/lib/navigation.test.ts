import { describe, expect, it } from "vitest";
import { sectionFromPath, sectionPath } from "./navigation";

describe("page slugs", () => {
  it("maps every management page to a readable path", () => {
    expect(sectionFromPath("/vue-ensemble")).toBe("dashboard");
    expect(sectionFromPath("/vente-en-gros")).toBe("sales");
    expect(sectionFromPath("/finances-depenses")).toBe("finance");
    expect(sectionPath("inventory")).toMatch(/\/produits-stock$/);
  });
});
