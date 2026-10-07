import { describe, expect, it } from "vitest";
import { productMediaSchema, updateProductSchema } from "./catalog.js";
describe("product media validation", () => {
  it("keeps the featured image first and supports one optional preview", () => {
    expect(
      productMediaSchema.parse({
        images: ["/products/catalog/a.webp", "https://example.test/b.webp"],
        videoUrl: "https://example.test/preview.mp4",
      }).images[0],
    ).toBe("/products/catalog/a.webp");
  });
  it("rejects unsafe addresses, duplicate images, and oversized galleries", () => {
    for (const images of [
      ["javascript:alert(1)"],
      ["data:image/svg+xml,test"],
      ["//evil.test/a"],
      ["/\\evil.test/a"],
      ["/a", "/a"],
      Array.from({ length: 11 }, (_, i) => `/image${i}`),
    ])
      expect(productMediaSchema.safeParse({ images }).success).toBe(false);
  });
});

describe("product editing validation", () => {
  const product = {
    name: "Sérum vitamine C",
    brand: "ONight",
    category: "SKIN_CARE" as const,
    subcategory: "Sérums & traitements",
    description: "Description",
    sourceUrl: "",
    sku: "SERUM-C-001",
    barcode: "",
    reference: "30 ml",
    supplierId: null,
    purchasePrice: 80,
    wholesalePrice: 110,
    retailPrice: 140,
    compareAtPrice: null,
    lowStockThreshold: 5,
    retailVisible: false,
  };

  it("accepts all editable product details", () => {
    expect(updateProductSchema.parse(product)).toMatchObject(product);
  });

  it("rejects a subcategory from another category", () => {
    expect(
      updateProductSchema.safeParse({
        ...product,
        category: "FRAGRANCE",
      }).success,
    ).toBe(false);
  });
});
