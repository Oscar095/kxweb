import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { useCartStore } from '../../stores/useCartStore';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';

const IVA_RATE = 1.19;

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const changeQty = useCartStore((s) => s.changeQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);

  const subtotal = items.reduce((sum, item) => {
    const price = computePricePerBox(item);
    const qty = Number(item._qty) || 1;
    return sum + price * qty;
  }, 0);

  const totalConIva = Math.round(subtotal * IVA_RATE);

  return (
    <AnimatedPage>
      <Helmet>
        <title>Carrito de Compras | KosXpress</title>
      </Helmet>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Tu Carrito</h1>

        {items.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
              Tu carrito esta vacio.
            </p>
            <Link
              to="/products"
              className="btn-primary"
              style={{ display: 'inline-block', padding: '12px 32px', textDecoration: 'none' }}
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Producto</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Cantidad</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Precio / caja</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '0.75rem' }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const price = computePricePerBox(item);
                    const qty = Number(item._qty) || 1;
                    const lineTotal = Math.round(price * qty * IVA_RATE);
                    const imgSrc =
                      (Array.isArray(item.images) && item.images[0]) ||
                      item.image ||
                      '/images/placeholder.svg';

                    return (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <img
                            src={imgSrc}
                            alt={item.name}
                            style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/images/placeholder.svg';
                            }}
                          />
                          <span>{item.name}</span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => changeQty(item.id, -1)}
                              style={{
                                width: 32,
                                height: 32,
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 6,
                                background: 'transparent',
                                color: 'inherit',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                              }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: 28, textAlign: 'center' }}>{qty}</span>
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              style={{
                                width: 32,
                                height: 32,
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 6,
                                background: 'transparent',
                                color: 'inherit',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          ${formatMoney(Math.round(price * IVA_RATE))}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          ${formatMoney(lineTotal)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => remove(item.id)}
                            title="Eliminar"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                            }}
                          >
                            &#10005;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <button
                  onClick={clear}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    padding: '10px 20px',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Vaciar carrito
                </button>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                  Subtotal sin IVA: ${formatMoney(subtotal)}
                </p>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  Total (IVA incluido): ${formatMoney(totalConIva)}
                </p>
                <Link
                  to="/checkout"
                  className="btn-primary"
                  style={{
                    display: 'inline-block',
                    padding: '14px 40px',
                    marginTop: '1rem',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                  }}
                >
                  Ir a pagar
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
