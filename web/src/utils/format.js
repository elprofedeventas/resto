/* RESTO — utilidades de formato. */

export function formatCurrency(amount, currency = 'USD') {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '';
  try {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatQuantity(quantity, unit) {
  if (typeof quantity !== 'number') return '';
  const fixed =
    Math.abs(quantity) >= 1
      ? quantity.toFixed(2).replace(/\.?0+$/, '')
      : quantity.toString();
  return `${fixed} ${unit || ''}`.trim();
}
