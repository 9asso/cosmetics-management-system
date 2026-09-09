// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveMediaUrl } from "./media";

describe("media URL resolution", () => {
  it("loads seeded catalog images from the local storefront", () => {
    expect(resolveMediaUrl("/products/catalog/cream.webp")).toBe(
      "http://localhost:3000/products/catalog/cream.webp",
    );
  });

  it("preserves uploaded and embedded media URLs", () => {
    expect(resolveMediaUrl("https://cdn.example.test/cream.webp")).toBe(
      "https://cdn.example.test/cream.webp",
    );
    expect(resolveMediaUrl("data:image/webp;base64,abc")).toBe(
      "data:image/webp;base64,abc",
    );
  });
});
