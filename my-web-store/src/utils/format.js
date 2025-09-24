// Utilidades de formato

/**
 * Formatea un número a texto con separador de miles "." y decimales ",".
 * Ej: 1234567.8 -> "1.234.567,80"
 */
export function formatMoney(amount) {
  const n = Number(amount);
  const val = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(val);
}
