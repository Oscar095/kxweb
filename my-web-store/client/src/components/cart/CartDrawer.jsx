import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '../../stores/useCartStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';
import styles from './CartDrawer.module.css';

function CartItem({ item, onRemove, onChangeQty, onSetQty }) {
  const price = computePricePerBox(item);
  const qty = Number(item._qty) || 1;
  const subtotal = price * qty;
  const cover =
    (Array.isArray(item.images) && item.images[0]) ||
    item.image ||
    '/images/placeholder.svg';

  return (
    <motion.div
      className={styles.item}
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <img
        src={cover}
        alt={item.name}
        className={styles.itemImg}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/images/placeholder.svg';
        }}
      />
      <div className={styles.itemMeta}>
        <div className={styles.itemName}>{item.name}</div>
        <div className={styles.itemPrice}>
          ${formatMoney(Math.round(price * 1.19))}{' '}
          <span className={styles.ivaBadge}>IVA incl.</span>
        </div>
        <div className={styles.itemSubtotal}>
          Subtotal: <strong>${formatMoney(Math.round(subtotal * 1.19))}</strong>
        </div>
      </div>
      <div className={styles.itemActions}>
        <button className={styles.removeBtn} onClick={() => onRemove(item.id)}>
          Quitar
        </button>
        <div className={styles.qtyControls}>
          <button
            className={styles.decBtn}
            onClick={() => onChangeQty(item.id, -1)}
          >
            -
          </button>
          <input
            type="number"
            className={styles.qtyInput}
            min="1"
            value={qty}
            onChange={(e) => {
              const val = Math.max(1, Math.floor(Number(e.target.value) || 1));
              onSetQty(item.id, val);
            }}
          />
          <button
            className={styles.incBtn}
            onClick={() => onChangeQty(item.id, 1)}
          >
            +
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function CartDrawer() {
  const isOpen = useUIStore((s) => s.isCartOpen);
  const closeCart = useUIStore((s) => s.closeCart);
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.remove);
  const changeQty = useCartStore((s) => s.changeQty);
  const setQty = useCartStore((s) => s.setQty);
  const clear = useCartStore((s) => s.clear);
  const navigate = useNavigate();

  const [clearConfirm, setClearConfirm] = useState(false);

  // Group items by id
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const id = it.id;
      const price = computePricePerBox(it);
      const qty = Math.max(1, Number(it._qty) || 1);
      if (map.has(id)) {
        const g = map.get(id);
        g._qty += qty;
      } else {
        map.set(id, { ...it, precioCaja: price, price, _qty: qty });
      }
    });
    return Array.from(map.values());
  }, [items]);

  const total = useMemo(
    () =>
      grouped.reduce((s, it) => {
        const price = computePricePerBox(it);
        return s + Math.round(price * (Number(it._qty) || 1) * 1.19);
      }, 0),
    [grouped]
  );

  const handleClear = useCallback(() => {
    if (clearConfirm) {
      clear();
      closeCart();
      setClearConfirm(false);
    } else {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 4500);
    }
  }, [clearConfirm, clear, closeCart]);

  const handleCheckout = useCallback(() => {
    closeCart();
    navigate('/checkout');
  }, [closeCart, navigate]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />
          <motion.div
            className={styles.drawer}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className={styles.header}>
              <h2>Carrito</h2>
              <div className={styles.headerActions}>
                <button
                  className={`${styles.clearBtn} ${clearConfirm ? styles.confirm : ''}`}
                  onClick={handleClear}
                >
                  {clearConfirm ? 'Seguro?' : 'Vaciar'}
                </button>
                <button className={styles.closeBtn} onClick={closeCart}>
                  ✕
                </button>
              </div>
            </div>

            <div className={styles.body}>
              <AnimatePresence mode="popLayout">
                {grouped.length > 0 ? (
                  grouped.map((item) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      onRemove={remove}
                      onChangeQty={changeQty}
                      onSetQty={setQty}
                    />
                  ))
                ) : (
                  <motion.div
                    className={styles.emptyMsg}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Tu carrito esta vacio
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={styles.footer}>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total a Pagar:</span>
                <strong className={styles.totalAmount}>
                  ${formatMoney(total)}{' '}
                  <span className={styles.ivaBadge} style={{ fontSize: '0.7rem' }}>
                    IVA incluido
                  </span>
                </strong>
              </div>
              <button
                className={`btn-primary ${styles.checkoutBtn}`}
                onClick={handleCheckout}
                disabled={grouped.length === 0}
              >
                Procesar Pago
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
