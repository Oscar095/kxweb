const IVA_RATE = 0.19;

function parseNum(val) {
  if (val == null || val === '') return null;
  const n = typeof val === 'string' ? Number(val.replace(/[^\d.-]/g, '')) : Number(val);
  return Number.isFinite(n) ? n : null;
}

export function computePricePerBox(prod) {
  if (!prod) return 0;

  const fromField = prod.precioCaja ?? prod.precio_caja ?? prod.price ?? prod.precio ?? null;
  const direct = parseNum(fromField);
  if (direct != null) return direct;

  const unit = parseNum(prod.price_unit ?? prod.precio_unitario ?? null);
  const cantidad = parseNum(prod.cantidad ?? prod.Cantidad ?? null);
  if (unit != null && cantidad != null) return unit * cantidad;

  const fallback = parseNum(prod.price ?? prod.precio ?? 0);
  return fallback ?? 0;
}

export function priceWithIVA(priceWithoutIVA) {
  return priceWithoutIVA * (1 + IVA_RATE);
}

export function priceWithoutIVA(priceWithIVA) {
  return priceWithIVA / (1 + IVA_RATE);
}

export function getCantidad(prod) {
  if (!prod) return 0;
  return parseNum(prod.cantidad ?? prod.Cantidad ?? 0) ?? 0;
}
