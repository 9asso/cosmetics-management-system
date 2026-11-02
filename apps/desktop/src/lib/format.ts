import type { ProductListItem } from '@cosmetics/contracts';

export const money = new Intl.NumberFormat('fr-MA', {
  style: 'currency',
  currency: 'MAD',
  minimumFractionDigits: 2,
});

export const integer = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 });

export const referenceLabel = (reference?: string | null) =>
  `Réf. ${reference?.trim() || '—'}`;

/** Identifiers shown for each product in the product search popups. */
export const productSearchDetail = (product: ProductListItem) =>
  `Marque : ${product.brand || '—'} · Réf. : ${product.reference || '—'} · Code-barres : ${product.barcode || '—'} · ${product.sku} · ${product.available} disponible(s)`;
