import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';

/* ── styles ─────────────────────────────────────────────────────────────────── */

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    maxWidth: 520,
    width: '100%',
    background: 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 20,
    padding: '2.5rem 2rem',
    textAlign: 'center',
  },
  iconWrap: (color) => ({
    width: 80,
    height: 80,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
    background: `${color}15`,
    border: `2px solid ${color}30`,
  }),
  title: (color) => ({
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    color,
  }),
  subtitle: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.6,
    marginBottom: '1.5rem',
    maxWidth: 400,
    margin: '0 auto 1.5rem',
  },
  orderBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1.25rem',
    borderRadius: 999,
    background: 'rgba(0,159,227,0.1)',
    border: '1px solid rgba(0,159,227,0.2)',
    color: '#009FE3',
    fontWeight: 700,
    fontSize: '0.95rem',
    marginBottom: '1.25rem',
  },
  detailsBox: {
    background: 'rgba(0,0,0,0.02)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.4rem 0',
    fontSize: '0.85rem',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  },
  detailLabel: {
    color: '#64748b',
    fontWeight: 500,
  },
  detailValue: {
    fontWeight: 600,
    color: '#1e293b',
  },
  statusChip: (type) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '0.2rem 0.65rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 700,
    background:
      type === 'success' ? 'rgba(16,185,129,0.12)' :
      type === 'pending' ? 'rgba(217,119,6,0.12)' :
      'rgba(220,38,38,0.12)',
    color:
      type === 'success' ? '#16a34a' :
      type === 'pending' ? '#d97706' :
      '#dc2626',
    border: `1px solid ${
      type === 'success' ? 'rgba(16,185,129,0.2)' :
      type === 'pending' ? 'rgba(217,119,6,0.2)' :
      'rgba(220,38,38,0.2)'
    }`,
  }),
  actions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '0.5rem',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 1.5rem',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg,#009FE3,#007bb5)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'opacity .2s',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 1.5rem',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'transparent',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background .2s',
  },
  note: {
    marginTop: '1.25rem',
    fontSize: '0.78rem',
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  spinner: {
    width: 44,
    height: 44,
    border: '3px solid rgba(0,159,227,0.15)',
    borderTopColor: '#009FE3',
    borderRadius: '50%',
    animation: 'conf-spin 0.8s linear infinite',
    margin: '0 auto 1.5rem',
  },
};

/* ── helpers ────────────────────────────────────────────────────────────────── */

function pickTransactionId(params) {
  return params.get('id') || params.get('transactionId') || params.get('transaction_id') || params.get('transaction');
}

function classifyStatus(estado) {
  const upper = String(estado || '').toUpperCase();
  if (upper === 'APPROVED' || upper === 'APPROVED_PARTIAL' || upper === 'APROBADA') return 'success';
  if (upper === 'PENDING') return 'pending';
  return 'failed';
}

function statusLabel(estado) {
  const upper = String(estado || '').toUpperCase();
  if (upper === 'APPROVED' || upper === 'APPROVED_PARTIAL' || upper === 'APROBADA') return 'Aprobado';
  if (upper === 'PENDING') return 'Pendiente';
  return estado || 'Rechazado';
}

/* ── SVG icons ──────────────────────────────────────────────────────────────── */

function SuccessIcon() {
  return (
    <svg viewBox="0 0 52 52" fill="none" width="48" height="48">
      <circle cx="26" cy="26" r="24" stroke="#16a34a" strokeWidth="2.5" />
      <path d="M15 27l8 8 14-16" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg viewBox="0 0 52 52" fill="none" width="48" height="48">
      <circle cx="26" cy="26" r="24" stroke="#d97706" strokeWidth="2.5" />
      <path d="M26 15v11l7 4" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FailedIcon() {
  return (
    <svg viewBox="0 0 52 52" fill="none" width="48" height="48">
      <circle cx="26" cy="26" r="24" stroke="#dc2626" strokeWidth="2.5" />
      <path d="M18 18l16 16M34 18L18 34" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── state config ───────────────────────────────────────────────────────────── */

const STATES = {
  success: {
    color: '#16a34a',
    Icon: SuccessIcon,
    title: '¡Pago confirmado!',
    subtitle: 'Tu pedido ha sido recibido y está siendo procesado.',
    clearCart: true,
  },
  pending: {
    color: '#d97706',
    Icon: PendingIcon,
    title: 'Pago en proceso',
    subtitle: 'Tu transacción está siendo verificada. Recibirás una notificación pronto.',
    clearCart: false,
  },
  failed: {
    color: '#dc2626',
    Icon: FailedIcon,
    title: 'Pago no completado',
    subtitle: 'No se pudo procesar el pago. Por favor intenta de nuevo o contáctanos.',
    clearCart: false,
  },
};

/* ── component ──────────────────────────────────────────────────────────────── */

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState({
    status: 'failed',
    pedidoId: null,
    transactionId: null,
    estado: null,
    reason: null,
    amount: null,
  });

  const pedidoId = searchParams.get('pedidoId') || searchParams.get('ref');
  const statusFromRedirect = searchParams.get('status');
  const transactionId = pickTransactionId(searchParams);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // No pedido id at all
      if (!pedidoId) {
        setResult({
          status: 'failed',
          pedidoId: null,
          transactionId: null,
          estado: null,
          reason: 'No se encontró el identificador del pedido en la URL.',
        });
        setLoading(false);
        return;
      }

      // No transaction id -- probably cancelled
      if (!transactionId) {
        const upper = String(statusFromRedirect || '').toUpperCase();
        const isBad = upper === 'DECLINED' || upper === 'ERROR' || upper === 'VOIDED';
        setResult({
          status: 'failed',
          pedidoId,
          transactionId: null,
          estado: upper || null,
          reason: isBad
            ? 'La transacción fue rechazada o cancelada.'
            : 'No se recibió el ID de transacción. Si realizaste el pago, contáctanos.',
        });
        setLoading(false);
        return;
      }

      // Verify with the server
      try {
        const resp = await fetch(`/api/pedidos/${encodeURIComponent(pedidoId)}/confirmar-pago`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId }),
        });

        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        const data = ct.includes('application/json')
          ? await resp.json().catch(() => ({}))
          : {};

        if (!resp.ok) {
          if (!cancelled) {
            setResult({
              status: 'failed',
              pedidoId,
              transactionId,
              estado: statusFromRedirect,
              reason: 'No se pudo verificar el pago con el servidor. Contáctanos si realizaste el pago.',
            });
          }
          setLoading(false);
          return;
        }

        const estado = String(data.payment_status || data.status || statusFromRedirect || '').toUpperCase();
        const txId = data.id_wompi || transactionId;
        const pid = data.pedidoId ?? pedidoId;
        const classification = classifyStatus(estado);
        const amt = data.amount || data.total_value || data.monto || null;

        if (!cancelled) {
          setResult({
            status: classification,
            pedidoId: pid,
            transactionId: txId,
            estado,
            reason: null,
            amount: amt,
          });

          // Clear cart on success
          if (classification === 'success') {
            try { localStorage.removeItem('cart'); } catch (_) { /* noop */ }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setResult({
            status: 'failed',
            pedidoId,
            transactionId,
            estado: statusFromRedirect,
            reason: `Error de conexión: ${err?.message || err}`,
          });
        }
      }

      if (!cancelled) setLoading(false);
    }

    verify();
    return () => { cancelled = true; };
  }, [pedidoId, transactionId, statusFromRedirect]);

  const cfg = STATES[result.status] || STATES.failed;
  const { Icon, color, title, subtitle: defaultSubtitle } = cfg;
  const displaySubtitle = result.reason || defaultSubtitle;
  const chipType = result.estado ? classifyStatus(result.estado) : result.status;

  return (
    <AnimatedPage>
      <Helmet>
        <title>Confirmación | KosXpress</title>
        <meta name="description" content="Estado de tu pedido en KosXpress" />
      </Helmet>

      <style>{`@keyframes conf-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.page}>
        <motion.div
          style={s.card}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {loading ? (
            <>
              <div style={s.spinner} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
                Verificando tu pago...
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Esto solo tomara un momento.
              </p>
            </>
          ) : (
            <>
              {/* Icon */}
              <motion.div
                style={s.iconWrap(color)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
              >
                <Icon />
              </motion.div>

              {/* Title */}
              <motion.h2
                style={s.title(color)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {title}
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                style={s.subtitle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {displaySubtitle}
              </motion.p>

              {/* Order badge */}
              {result.pedidoId && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div style={s.orderBadge}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                    </svg>
                    Pedido #{result.pedidoId}
                  </div>
                </motion.div>
              )}

              {/* Details */}
              {(result.transactionId || result.estado) && (
                <motion.div
                  style={s.detailsBox}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {result.transactionId && (
                    <div style={s.detailRow}>
                      <span style={s.detailLabel}>Transacción</span>
                      <span style={s.detailValue}>{result.transactionId}</span>
                    </div>
                  )}
                  {result.estado && (
                    <div style={{ ...s.detailRow, borderBottom: 'none' }}>
                      <span style={s.detailLabel}>Estado</span>
                      <span style={s.statusChip(chipType)}>
                        {chipType === 'success' ? '\u25CF' : chipType === 'pending' ? '\u25F7' : '\u2715'}{' '}
                        {statusLabel(result.estado)}
                      </span>
                    </div>
                  )}
                  {result.amount && (
                    <div style={{ ...s.detailRow, borderBottom: 'none' }}>
                      <span style={s.detailLabel}>Monto</span>
                      <span style={s.detailValue}>
                        ${Number(result.amount).toLocaleString('es-CO')} COP
                      </span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <motion.div
                style={s.actions}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link to="/" style={s.btnPrimary}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Seguir comprando
                </Link>
                <Link to="/contact" style={s.btnSecondary}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  Contactar soporte
                </Link>
              </motion.div>

              {/* Note */}
              {result.status !== 'failed' && (
                <motion.p
                  style={s.note}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  Recibirás un correo de confirmación con los detalles de tu pedido.
                  Si tienes alguna pregunta, no dudes en contactarnos.
                </motion.p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatedPage>
  );
}
