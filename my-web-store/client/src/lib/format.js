const formatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function formatMoney(amount) {
  const n = Number(amount);
  const val = Number.isFinite(n) ? n : 0;
  return formatter.format(val);
}
