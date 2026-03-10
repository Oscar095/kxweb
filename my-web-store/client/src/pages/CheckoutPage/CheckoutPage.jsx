import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { useCartStore } from '../../stores/useCartStore';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';
import { apiPost } from '../../lib/api';

/* ── constants ──────────────────────────────────────────────────────────────── */

const IVA_RATE = 0.19;

const PERSON_TYPES = [
  { value: 'N', label: 'Persona Natural' },
  { value: 'J', label: 'Persona Juridica' },
];

const DOC_TYPES = [
  { value: 'CC', label: 'Cedula de Ciudadania' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE', label: 'Cedula de Extranjeria' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'PA', label: 'Pasaporte' },
];

const INITIAL_FORM = {
  tipoPersona: 'N',
  tipoDocumento: 'CC',
  nitId: '',
  digitoVerificacion: '',
  nombres: '',
  apellidos: '',
  email: '',
  phone: '',
  telefonoFijo: '',
  departamento: '',
  departamentoId: '',
  city: '',
  address: '',
  notes: '',
};

/* ── styles ─────────────────────────────────────────────────────────────────── */

const s = {
  page: {
    minHeight: '100vh',
    padding: '2rem 1rem',
  },
  container: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  /* step indicator */
  steps: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
    flexWrap: 'wrap',
  },
  stepItem: (active, done) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 1rem',
    borderRadius: 999,
    fontSize: '0.85rem',
    fontWeight: 600,
    background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
    color: done ? '#10b981' : active ? '#818cf8' : 'rgba(255,255,255,0.4)',
    border: `1.5px solid ${done ? '#10b981' : active ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
    transition: 'all .3s',
  }),
  stepCircle: (active, done) => ({
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    background: done ? '#10b981' : active ? '#818cf8' : 'transparent',
    color: done || active ? '#fff' : 'rgba(255,255,255,0.4)',
  }),
  connector: {
    width: 32,
    height: 2,
    background: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
    borderRadius: 1,
  },
  /* layout */
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2rem',
  },
  gridDesktop: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '2rem',
    alignItems: 'start',
  },
  /* glass panel */
  panel: {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  /* form fields */
  fieldGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
  },
  input: {
    padding: '0.6rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color .2s',
  },
  select: {
    padding: '0.6rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
  },
  /* order summary */
  summaryItem: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    padding: '0.6rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  summaryImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    objectFit: 'cover',
    flexShrink: 0,
    position: 'relative',
  },
  summaryName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  summarySub: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  totalLine: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.35rem 0',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.7)',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.75rem 0 0',
    marginTop: '0.5rem',
    borderTop: '2px solid rgba(255,255,255,0.12)',
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  /* buttons */
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg,#6366f1,#818cf8)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity .2s',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.65rem 1.25rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'background .2s',
  },
  navRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.5rem',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  message: (type) => ({
    padding: '0.75rem 1rem',
    borderRadius: 10,
    marginBottom: '1rem',
    fontSize: '0.88rem',
    fontWeight: 600,
    display: type ? 'block' : 'none',
    background: type === 'error' ? 'rgba(239,68,68,0.12)' : type === 'info' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
    color: type === 'error' ? '#f87171' : type === 'info' ? '#a5b4fc' : '#34d399',
    border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.2)' : type === 'info' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`,
  }),
  qtyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#6366f1',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCart: {
    textAlign: 'center',
    padding: '2rem 0',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
    lineHeight: 1.6,
  },
  ivaTag: {
    fontSize: '0.65rem',
    color: '#4CAF50',
    fontWeight: 600,
    marginLeft: 4,
  },
  fleteHint: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.35)',
  },
  reviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.4rem 0',
    fontSize: '0.88rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  reviewLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 500,
  },
  reviewValue: {
    fontWeight: 600,
  },
  spinner: {
    display: 'inline-block',
    width: 20,
    height: 20,
    border: '2.5px solid rgba(255,255,255,0.2)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'co-spin 0.7s linear infinite',
  },
};

/* ── helper: group cart items by id ─────────────────────────────────────────── */

function groupCartItems(items) {
  const map = new Map();
  for (const it of items) {
    const qty = Math.max(1, Number(it._qty) || 1);
    const existing = map.get(it.id);
    if (existing) {
      existing.qty += qty;
    } else {
      map.set(it.id, {
        id: it.id,
        name: it.name,
        price: computePricePerBox(it),
        qty,
        image: (Array.isArray(it.images) && it.images[0]) || it.image || '/images/placeholder.svg',
        codigo_siesa: it.codigo_siesa || it.sku || '',
      });
    }
  }
  return Array.from(map.values());
}

function computeTotals(items) {
  let subtotal = 0;
  let totalConIva = 0;
  for (const it of items) {
    const price = computePricePerBox(it);
    const qty = Math.max(1, Number(it._qty) || 1);
    subtotal += price * qty;
    totalConIva += Math.round(price * (1 + IVA_RATE)) * qty;
  }
  const iva = totalConIva - subtotal;
  return { subtotal, iva, total: totalConIva, totalInCents: Math.round(totalConIva * 100) };
}

/* ── Wompi integration ──────────────────────────────────────────────────────── */

async function openWompi(orderId, totalInCents, email) {
  try {
    const res = await fetch('/api/wompi/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInCents: totalInCents,
        currency: 'COP',
        reference: String(orderId),
      }),
    });
    const { signature, publicKey } = await res.json();
    const checkout = new window.WidgetCheckout({
      currency: 'COP',
      amountInCents: totalInCents,
      reference: String(orderId),
      publicKey,
      'signature:integrity': signature?.integrity ?? signature,
      redirectUrl: window.location.origin + '/confirmacion?pedidoId=' + orderId,
      customerData: { email },
    });
    checkout.open((result) => {
      if (result?.transaction) {
        window.location.href =
          '/confirmacion?pedidoId=' + orderId + '&id=' + result.transaction.id;
      }
    });
  } catch (err) {
    console.warn('Wompi widget error, redirecting:', err);
    window.location.href = '/confirmacion?pedidoId=' + orderId;
  }
}

/* ── component ──────────────────────────────────────────────────────────────── */

export default function CheckoutPage() {
  const navigate = useNavigate();
  const cartItems = useCartStore((st) => st.items);
  const clearCart = useCartStore((st) => st.clear);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [departamentos, setDepartamentos] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [loadingCiudades, setLoadingCiudades] = useState(false);
  const [flete, setFlete] = useState({ fleteTotal: 0, fletePorCaja: 0, totalCajas: 0 });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);

  const grouped = groupCartItems(cartItems);
  const { subtotal, iva, total, totalInCents } = computeTotals(cartItems);
  const grandTotal = total + (flete.fleteTotal || 0);
  const grandTotalCents = Math.round(grandTotal * 100);

  const isJuridica = form.tipoPersona === 'J';
  const isNIT = form.tipoDocumento === 'NIT';
  const isAlphaDoc = form.tipoDocumento === 'CE' || form.tipoDocumento === 'PA';

  /* ── fetch departamentos on mount ─────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    fetch('/api/departamentos')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setDepartamentos(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* ── fetch ciudades when departamento changes ─────────────────────────────── */

  useEffect(() => {
    if (!form.departamentoId) {
      setCiudades([]);
      return;
    }
    let cancelled = false;
    setLoadingCiudades(true);
    fetch(`/api/ciudades?departamento_id=${form.departamentoId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) {
          setCiudades(Array.isArray(data) ? data : []);
          setLoadingCiudades(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingCiudades(false);
      });
    return () => { cancelled = true; };
  }, [form.departamentoId]);

  /* ── calculate flete when city or cart changes ────────────────────────────── */

  const calcularFlete = useCallback(async () => {
    const city = form.city.trim();
    const empty = { fleteTotal: 0, fletePorCaja: 0, totalCajas: 0 };
    if (!city || cartItems.length === 0) {
      setFlete(empty);
      return;
    }
    const itemsMap = new Map();
    for (const ci of cartItems) {
      const qty = Math.max(1, Number(ci._qty) || 1);
      const existing = itemsMap.get(ci.id);
      if (existing) existing.quantity += qty;
      else itemsMap.set(ci.id, { product_id: ci.id, quantity: qty });
    }
    try {
      const res = await fetch('/api/flete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, items: Array.from(itemsMap.values()) }),
      });
      if (res.ok) {
        const data = await res.json();
        setFlete(data);
      } else {
        setFlete(empty);
      }
    } catch {
      setFlete(empty);
    }
  }, [form.city, cartItems]);

  useEffect(() => {
    calcularFlete();
  }, [calcularFlete]);

  /* ── form helpers ─────────────────────────────────────────────────────────── */

  const set = (key) => (e) => {
    let val = e.target.value;
    // filter numeric-only doc types
    if (key === 'nitId' && !isAlphaDoc) {
      val = val.replace(/\D+/g, '');
    }
    // if changing departamento, also capture its id and reset city
    if (key === 'departamento') {
      const opt = e.target.selectedOptions?.[0];
      setForm((f) => ({
        ...f,
        departamento: val,
        departamentoId: opt?.dataset?.id || '',
        city: '',
      }));
      return;
    }
    setForm((f) => ({ ...f, [key]: val }));
  };

  // auto-set NIT when juridica
  useEffect(() => {
    if (isJuridica) {
      setForm((f) => ({ ...f, tipoDocumento: 'NIT' }));
    }
  }, [isJuridica]);

  /* ── validation ───────────────────────────────────────────────────────────── */

  const validateStep1 = () => {
    if (!form.tipoDocumento) return 'Selecciona un tipo de documento.';
    if (!form.nitId.trim()) return 'El numero de documento es obligatorio.';
    if (!form.nombres.trim()) return isJuridica ? 'La razon social es obligatoria.' : 'Los nombres son obligatorios.';
    if (!isJuridica && !form.apellidos.trim()) return 'Los apellidos son obligatorios.';
    if (!form.email.trim()) return 'El correo electronico es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'El correo electronico no es valido.';
    if (!form.phone.trim()) return 'El celular es obligatorio.';
    if (!form.departamento) return 'Selecciona un departamento.';
    if (!form.city) return 'Selecciona una ciudad.';
    if (!form.address.trim()) return 'La direccion es obligatoria.';
    return null;
  };

  const goNext = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) { setMsg({ text: err, type: 'error' }); return; }
      setMsg({ text: '', type: '' });
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const goBack = () => {
    setMsg({ text: '', type: '' });
    if (step > 1) setStep(step - 1);
  };

  /* ── submit order ─────────────────────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (grandTotalCents <= 0) {
      setMsg({ text: 'Tu carrito esta vacio.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMsg({ text: '', type: '' });

    try {
      const itemsMap = new Map();
      for (const ci of cartItems) {
        const qty = Math.max(1, Number(ci._qty) || 1);
        const existing = itemsMap.get(ci.id);
        if (existing) {
          existing.quantity += qty;
        } else {
          itemsMap.set(ci.id, {
            product_id: ci.id,
            product_name: ci.name || '',
            product_sku: ci.codigo_siesa || ci.sku || '',
            price_unit: computePricePerBox(ci),
            quantity: qty,
          });
        }
      }

      const nombreCompleto = isJuridica
        ? form.nombres.trim()
        : [form.nombres.trim(), form.apellidos.trim()].filter(Boolean).join(' ');

      const payload = {
        nitId: form.nitId.trim(),
        name: nombreCompleto,
        tipo_documento: form.tipoDocumento,
        digito_verificacion: isNIT ? form.digitoVerificacion.trim() : null,
        nombres: form.nombres.trim(),
        apellidos: isJuridica ? null : form.apellidos.trim(),
        nombre_completo: nombreCompleto,
        email: form.email.trim(),
        phone: form.phone.trim(),
        telefono_fijo: form.telefonoFijo.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        departamento: form.departamento || null,
        pais: 'CO',
        tipo_persona: form.tipoPersona,
        notes: form.notes.trim(),
        subtotal,
        iva,
        flete: flete.fleteTotal || 0,
        total_value: grandTotal,
        items: Array.from(itemsMap.values()),
      };

      const saved = await apiPost('/api/pedidos', payload);
      const pedidoId = saved?.id;
      if (!pedidoId) throw new Error('No se pudo obtener el id del pedido.');

      setMsg({ text: 'Pedido registrado. Abriendo pasarela de pago...', type: 'info' });

      await openWompi(pedidoId, grandTotalCents, form.email.trim());
    } catch (err) {
      console.error(err);
      setMsg({ text: err.message || 'Error al procesar el pedido.', type: 'error' });
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── step labels ──────────────────────────────────────────────────────────── */

  const stepLabels = ['Datos', 'Revision', 'Pago'];

  /* ── use desktop layout? ──────────────────────────────────────────────────── */

  const useDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;

  /* ── render: step indicator ───────────────────────────────────────────────── */

  const renderSteps = () => (
    <div style={s.steps}>
      {stepLabels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {i > 0 && <div style={s.connector} />}
            <div style={s.stepItem(active, done)}>
              <span style={s.stepCircle(active, done)}>
                {done ? '\u2713' : n}
              </span>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── render: order summary (sidebar) ──────────────────────────────────────── */

  const renderSummary = () => (
    <div style={s.panel}>
      <h3 style={s.sectionTitle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        Resumen del pedido
        {grouped.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: 'auto' }}>
            {grouped.length} {grouped.length === 1 ? 'producto' : 'productos'}
          </span>
        )}
      </h3>

      {grouped.length === 0 ? (
        <div style={s.emptyCart}>
          Tu carrito esta vacio.<br />
          <a href="/products" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
            Explorar productos &rarr;
          </a>
        </div>
      ) : (
        <>
          {grouped.map((it) => {
            const priceIva = Math.round(it.price * (1 + IVA_RATE));
            return (
              <div key={it.id} style={s.summaryItem}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={it.image}
                    alt={it.name}
                    style={s.summaryImg}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
                  />
                  <span style={s.qtyBadge}>{it.qty}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.summaryName}>{it.name}</div>
                  <div style={s.summarySub}>
                    ${formatMoney(priceIva)} x {it.qty} = <strong>${formatMoney(priceIva * it.qty)}</strong>
                    <span style={s.ivaTag}>IVA incl.</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: '1rem' }}>
            <div style={s.totalLine}>
              <span>Subtotal (sin IVA)</span>
              <span>${formatMoney(subtotal)}</span>
            </div>
            <div style={s.totalLine}>
              <span>IVA (19%)</span>
              <span>${formatMoney(iva)}</span>
            </div>
            <div style={s.totalLine}>
              <span>
                Flete
                {flete.fleteTotal > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                    {' '}(${formatMoney(flete.fletePorCaja)} x {flete.totalCajas} cajas)
                  </span>
                )}
              </span>
              <span>
                {flete.fleteTotal > 0
                  ? `$${formatMoney(flete.fleteTotal)}`
                  : <span style={s.fleteHint}>Selecciona ciudad</span>}
              </span>
            </div>
            <div style={s.grandTotal}>
              <span>Total a pagar</span>
              <span style={{ color: '#818cf8' }}>${formatMoney(grandTotal)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  /* ── render: step 1 - form ────────────────────────────────────────────────── */

  const renderStep1 = () => (
    <div style={s.panel}>
      {/* Identification */}
      <h3 style={s.sectionTitle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Identificacion
      </h3>
      <div style={s.fieldGroup}>
        <div style={s.field}>
          <label style={s.label}>Tipo de persona *</label>
          <select style={s.select} value={form.tipoPersona} onChange={set('tipoPersona')}>
            {PERSON_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Tipo de documento *</label>
          <select style={s.select} value={form.tipoDocumento} onChange={set('tipoDocumento')}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Numero de documento *</label>
          <input
            style={s.input}
            type="text"
            value={form.nitId}
            onChange={set('nitId')}
            inputMode={isAlphaDoc ? undefined : 'numeric'}
            placeholder="Ej: 1234567890"
          />
        </div>
        {isNIT && (
          <div style={{ ...s.field, maxWidth: 100 }}>
            <label style={s.label}>DV</label>
            <input
              style={s.input}
              type="text"
              maxLength={1}
              value={form.digitoVerificacion}
              onChange={set('digitoVerificacion')}
              placeholder="0"
            />
          </div>
        )}
        <div style={s.field}>
          <label style={s.label}>{isJuridica ? 'Razon social *' : 'Nombres *'}</label>
          <input
            style={s.input}
            type="text"
            value={form.nombres}
            onChange={set('nombres')}
            placeholder={isJuridica ? 'Razon social' : 'Nombres'}
          />
        </div>
        {!isJuridica && (
          <div style={s.field}>
            <label style={s.label}>Apellidos *</label>
            <input
              style={s.input}
              type="text"
              value={form.apellidos}
              onChange={set('apellidos')}
              placeholder="Apellidos"
            />
          </div>
        )}
      </div>

      {/* Contact */}
      <h3 style={{ ...s.sectionTitle, marginTop: '1.5rem' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
        Contacto
      </h3>
      <div style={s.fieldGroup}>
        <div style={s.field}>
          <label style={s.label}>Correo electronico *</label>
          <input
            style={s.input}
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div style={s.field}>
          <label style={s.label}>Celular *</label>
          <input
            style={s.input}
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="300 123 4567"
            inputMode="numeric"
          />
        </div>
        <div style={s.field}>
          <label style={s.label}>Telefono fijo</label>
          <input
            style={s.input}
            type="tel"
            value={form.telefonoFijo}
            onChange={set('telefonoFijo')}
            placeholder="(601) 234 5678"
          />
        </div>
      </div>

      {/* Shipping address */}
      <h3 style={{ ...s.sectionTitle, marginTop: '1.5rem' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Direccion de envio
      </h3>
      <div style={s.fieldGroup}>
        <div style={s.field}>
          <label style={s.label}>Departamento *</label>
          <select style={s.select} value={form.departamento} onChange={set('departamento')}>
            <option value="">Selecciona un departamento</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.nombre} data-id={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Ciudad *</label>
          <select
            style={s.select}
            value={form.city}
            onChange={set('city')}
            disabled={!form.departamentoId || loadingCiudades}
          >
            <option value="">
              {loadingCiudades
                ? 'Cargando ciudades...'
                : !form.departamentoId
                  ? 'Primero selecciona departamento'
                  : 'Selecciona una ciudad'}
            </option>
            {ciudades.map((c) => (
              <option key={c.id || c.nombre} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
          <label style={s.label}>Direccion *</label>
          <input
            style={s.input}
            type="text"
            value={form.address}
            onChange={set('address')}
            placeholder="Calle, carrera, numero..."
          />
        </div>
        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
          <label style={s.label}>Notas adicionales</label>
          <textarea
            style={{ ...s.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Instrucciones especiales de entrega..."
          />
        </div>
      </div>

      <div style={s.navRow}>
        <button type="button" style={s.btnSecondary} onClick={() => navigate('/cart')}>
          &larr; Volver al carrito
        </button>
        <button type="button" style={s.btnPrimary} onClick={goNext}>
          Continuar &rarr;
        </button>
      </div>
    </div>
  );

  /* ── render: step 2 - review ──────────────────────────────────────────────── */

  const renderStep2 = () => {
    const nombreCompleto = isJuridica
      ? form.nombres
      : [form.nombres, form.apellidos].filter(Boolean).join(' ');

    return (
      <div style={s.panel}>
        <h3 style={s.sectionTitle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Revisa tu pedido
        </h3>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Tipo persona</span>
            <span style={s.reviewValue}>{isJuridica ? 'Juridica' : 'Natural'}</span>
          </div>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Documento</span>
            <span style={s.reviewValue}>{form.tipoDocumento} {form.nitId}{isNIT && form.digitoVerificacion ? `-${form.digitoVerificacion}` : ''}</span>
          </div>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Nombre</span>
            <span style={s.reviewValue}>{nombreCompleto}</span>
          </div>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Email</span>
            <span style={s.reviewValue}>{form.email}</span>
          </div>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Celular</span>
            <span style={s.reviewValue}>{form.phone}</span>
          </div>
          {form.telefonoFijo && (
            <div style={s.reviewRow}>
              <span style={s.reviewLabel}>Telefono fijo</span>
              <span style={s.reviewValue}>{form.telefonoFijo}</span>
            </div>
          )}
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Departamento</span>
            <span style={s.reviewValue}>{form.departamento}</span>
          </div>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Ciudad</span>
            <span style={s.reviewValue}>{form.city}</span>
          </div>
          <div style={s.reviewRow}>
            <span style={s.reviewLabel}>Direccion</span>
            <span style={s.reviewValue}>{form.address}</span>
          </div>
          {form.notes && (
            <div style={s.reviewRow}>
              <span style={s.reviewLabel}>Notas</span>
              <span style={s.reviewValue}>{form.notes}</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
          <div style={s.totalLine}><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
          <div style={s.totalLine}><span>IVA (19%)</span><span>${formatMoney(iva)}</span></div>
          <div style={s.totalLine}>
            <span>Flete</span>
            <span>{flete.fleteTotal > 0 ? `$${formatMoney(flete.fleteTotal)}` : '$0'}</span>
          </div>
          <div style={s.grandTotal}>
            <span>Total</span>
            <span style={{ color: '#818cf8' }}>${formatMoney(grandTotal)}</span>
          </div>
        </div>

        <div style={s.navRow}>
          <button type="button" style={s.btnSecondary} onClick={goBack}>
            &larr; Editar datos
          </button>
          <button type="button" style={s.btnPrimary} onClick={goNext}>
            Confirmar y pagar &rarr;
          </button>
        </div>
      </div>
    );
  };

  /* ── render: step 3 - payment ─────────────────────────────────────────────── */

  const renderStep3 = () => (
    <div style={s.panel}>
      <h3 style={s.sectionTitle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        Pago seguro
      </h3>

      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
          Al hacer clic en <strong>"Realizar Pedido"</strong> se registrara tu pedido y se abrira
          la pasarela de pago segura de Wompi.
        </p>
        <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#818cf8', marginBottom: '1.5rem' }}>
          Total: ${formatMoney(grandTotal)} COP
        </p>
        <button
          type="button"
          style={{ ...s.btnPrimary, maxWidth: 360, margin: '0 auto', opacity: submitting ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span style={s.spinner} />
              Procesando pedido...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Realizar Pedido Seguro
            </>
          )}
        </button>
      </div>

      <div style={s.navRow}>
        <button type="button" style={s.btnSecondary} onClick={goBack}>
          &larr; Volver a revision
        </button>
      </div>
    </div>
  );

  /* ── main render ──────────────────────────────────────────────────────────── */

  return (
    <AnimatedPage>
      <Helmet>
        <title>Checkout | KosXpress</title>
        <meta name="description" content="Finaliza tu compra en KosXpress" />
      </Helmet>

      {/* Spinner keyframes */}
      <style>{`@keyframes co-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.page}>
        <div style={s.container}>
          <h1 style={s.title}>Checkout</h1>

          {renderSteps()}

          {/* Message */}
          {msg.text && (
            <div style={s.message(msg.type)}>
              {msg.text}
            </div>
          )}

          <div style={useDesktop ? s.gridDesktop : s.grid}>
            {/* Left: form */}
            <div>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </div>
            {/* Right: summary */}
            {renderSummary()}
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
