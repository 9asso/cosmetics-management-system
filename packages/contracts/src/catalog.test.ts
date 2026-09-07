import { describe, expect, it } from 'vitest';
import { productMediaSchema } from './catalog.js';
describe('product media validation', () => {
  it('keeps the featured image first and supports one optional preview', () => {
    expect(productMediaSchema.parse({images:['/products/catalog/a.webp','https://example.test/b.webp'],videoUrl:'https://example.test/preview.mp4'}).images[0]).toBe('/products/catalog/a.webp');
  });
  it('rejects unsafe addresses, duplicate images, and oversized galleries', () => {
    for (const images of [['javascript:alert(1)'],['data:image/svg+xml,test'],['//evil.test/a'],['/\\evil.test/a'],['/a','/a'],Array.from({length:11},(_,i)=>`/image${i}`)]) expect(productMediaSchema.safeParse({images}).success).toBe(false);
  });
});
