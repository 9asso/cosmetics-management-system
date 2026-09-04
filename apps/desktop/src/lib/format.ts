export const money = new Intl.NumberFormat('fr-MA', {
  style: 'currency',
  currency: 'MAD',
  minimumFractionDigits: 2,
});

export const integer = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 });
