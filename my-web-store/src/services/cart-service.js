export const cartService = {
  items: JSON.parse(localStorage.getItem('cart') || '[]'),
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
      // Guarda una sola línea con la cantidad
      this.items.push({ ...product, _qty: qty });
    }
    this._save();
    this._notify();
  },
  /** Cambia la cantidad total de un producto por delta (puede ser negativo). Consolida líneas duplicadas. */
  changeQty(productId, delta = 1) {
    const id = productId;
    // Totalizar cantidad actual de ese id (soporta estado legado con múltiples líneas)
    const same = this.items.filter(it => it.id === id);
    const others = this.items.filter(it => it.id !== id);
    const currentTotal = same.reduce((sum, it) => sum + (Number(it._qty) || 1), 0);
    const nextTotal = currentTotal + (Number(delta) || 0);
    if (nextTotal <= 0) {
      this.items = others;
    } else {
      // Mantener una sola línea consolidada con la nueva cantidad
      const base = same[0] || { id };
      this.items = [...others, { ...base, _qty: nextTotal }];
    }
    this._save();
    this._notify();
  },
  /** Fija la cantidad absoluta de un producto. Si qty<=0, elimina. */
  setQty(productId, qty) {
    const q = Math.floor(Number(qty) || 0);
    if (q <= 0) return this.remove(productId);
    const id = productId;
    const same = this.items.filter(it => it.id === id);
    const others = this.items.filter(it => it.id !== id);
    const base = same[0] || { id };
    this.items = [...others, { ...base, _qty: q }];
    this._save();
    this._notify();
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