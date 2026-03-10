import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { computePricePerBox } from '../lib/price';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      add(product, quantity = 1) {
        const qty = Math.max(1, Number(quantity) || 1);
        const id = product.id;
        set((state) => {
          const idx = state.items.findIndex((it) => it.id === id);
          if (idx >= 0) {
            const updated = [...state.items];
            const cur = updated[idx];
            updated[idx] = { ...cur, _qty: (Number(cur._qty) || 1) + qty };
            return { items: updated };
          }
          const precioCaja = computePricePerBox(product);
          return {
            items: [
              ...state.items,
              { ...product, _qty: qty, precioCaja, price: precioCaja },
            ],
          };
        });
      },

      changeQty(productId, delta = 1) {
        set((state) => {
          const same = state.items.filter((it) => it.id === productId);
          const others = state.items.filter((it) => it.id !== productId);
          const currentTotal = same.reduce((sum, it) => sum + (Number(it._qty) || 1), 0);
          const nextTotal = currentTotal + (Number(delta) || 0);
          if (nextTotal <= 0) return { items: others };
          const base = same[0] || { id: productId };
          const precioCaja = computePricePerBox(base);
          return {
            items: [...others, { ...base, _qty: nextTotal, precioCaja, price: precioCaja }],
          };
        });
      },

      setQty(productId, qty) {
        const q = Math.floor(Number(qty) || 0);
        if (q <= 0) {
          get().remove(productId);
          return;
        }
        set((state) => {
          const same = state.items.filter((it) => it.id === productId);
          const others = state.items.filter((it) => it.id !== productId);
          const base = same[0] || { id: productId };
          const precioCaja = computePricePerBox(base);
          return {
            items: [...others, { ...base, _qty: q, precioCaja, price: precioCaja }],
          };
        });
      },

      remove(productId) {
        set((state) => ({
          items: state.items.filter((p) => p.id !== productId),
        }));
      },

      clear() {
        set({ items: [] });
      },

      totalItems() {
        return get().items.reduce((s, i) => s + (Number(i._qty) || 1), 0);
      },

      totalPrice() {
        return get().items.reduce((s, i) => {
          const price = computePricePerBox(i);
          const qty = Number(i._qty) || 1;
          return s + price * qty;
        }, 0);
      },
    }),
    {
      name: 'cart',
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            // Legacy format: bare array in localStorage
            if (Array.isArray(parsed)) {
              const normalized = parsed.map((it) => ({
                ...it,
                precioCaja: computePricePerBox(it),
                price: computePricePerBox(it),
              }));
              return { state: { items: normalized }, version: 0 };
            }
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
