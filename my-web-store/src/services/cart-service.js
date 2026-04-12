// helper para calcular precio por caja desde un producto
function computePricePerBox(prod) {
  if (!prod) return 0;
  const fromField = prod.precioCaja ?? prod.precio_caja ?? prod.price ?? prod.precio ?? null;
  if (fromField != null && fromField !== '') {
    const n = typeof fromField === 'string' ? Number(fromField.replace(/[^\d.-]/g, '')) : Number(fromField);
    if (Number.isFinite(n)) return n;
  }
  const unit = prod.price_unit ?? prod.precio_unitario ?? null;
  const cantidad = prod.cantidad ?? prod.Cantidad ?? null;
  const u = unit != null ? (typeof unit === 'string' ? Number(unit.replace(/[^\d.-]/g, '')) : Number(unit)) : null;
  const c = cantidad != null ? (typeof cantidad === 'string' ? Number(cantidad.replace(/[^\d.-]/g, '')) : Number(cantidad)) : null;
  if (Number.isFinite(u) && Number.isFinite(c)) return u * c;
  // fallback: if prod.price looks like total per box
  const fallback = prod.price ?? prod.precio ?? 0;
  return Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
}

const _stored = JSON.parse(localStorage.getItem('cart') || '[]');
const normalizedStored = Array.isArray(_stored) ? _stored.map(it => ({ ...it, precioCaja: computePricePerBox(it), price: computePricePerBox(it) })) : [];
// Persist normalized stored cart so other pages reading localStorage get prices
try { localStorage.setItem('cart', JSON.stringify(normalizedStored)); } catch (e) { /* ignore */ }

export const cartService = {
  items: normalizedStored,
  _listeners: [],
  add(product, quantity = 1) {
    const qty = Math.max(1, Number(quantity) || 1);
    // Intenta fusionar con una línea existente
    const id = product.id;
    const idx = this.items.findIndex(it => it.id === id && it._merged !== false);
    if (idx >= 0) {
      const cur = this.items[idx];
      const curQty = Number(cur._qty) || 1;
      this.items[idx] = { ...cur, _qty: curQty + qty };
    } else {
      // Guarda una sola línea con la cantidad, incluyendo precio por caja
      const precioCaja = computePricePerBox(product);
      this.items.push({ ...product, _qty: qty, precioCaja, price: precioCaja });
    }
    this._save();
    this._notify();
  },
  /** Cambia la cantidad total de un producto por delta (puede ser negativo). Consolida líneas duplicadas. */
  changeQty(productId, delta = 1) {
    const idx = this.items.findIndex(it => it.id === productId);
    if (idx === -1) return;
    const nextTotal = (Number(this.items[idx]._qty) || 1) + (Number(delta) || 0);
    if (nextTotal <= 0) {
      this.items.splice(idx, 1);
    } else {
      this.items[idx] = { ...this.items[idx], _qty: nextTotal };
    }
    this._save();
    this._notify();
  },
  /** Fija la cantidad absoluta de un producto. Si qty<=0, elimina. */
  setQty(productId, qty) {
    const q = Math.floor(Number(qty) || 0);
    if (q <= 0) return this.remove(productId);
    const idx = this.items.findIndex(it => it.id === productId);
    if (idx !== -1) {
      this.items[idx] = { ...this.items[idx], _qty: q };
      this._save();
      this._notify();
    }
  },
  remove(productId) {
    this.items = this.items.filter(p => p.id !== productId);
    this._save();
    this._notify();
  },
  clear() {
    this.items = [];
    this._save();
    this._notify();
  },
  _save() {
    localStorage.setItem('cart', JSON.stringify(this.items));
  },
  // backwards-compatible single handler
  onChange: null,
  // add/remove listeners
  subscribe(fn) {
    if (typeof fn === 'function') this._listeners.push(fn);
  },
  unsubscribe(fn) {
    this._listeners = this._listeners.filter(f => f !== fn);
  },
  _notify() {
    if (typeof this.onChange === 'function') this.onChange(this.items);
    this._listeners.forEach(fn => {
      try { fn(this.items); } catch (e) { console.error('cartService listener error', e); }
    });
  }
};
