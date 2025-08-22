export const cartService = {
  items: JSON.parse(localStorage.getItem('cart') || '[]'),
  _listeners: [],
  add(product) {
    this.items.push(product);
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