import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

// Utilidades
function readCart() {
  try {
    // Tu app guarda el carrito bajo la llave 'cart'
    const raw = localStorage.getItem('cart');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function priceOf(item) {
  const raw = item?.price ?? item?.precio ?? 0;
  const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
  return Number.isFinite(num) ? num : 0;
}
function computeTotal(items) {
  return items.reduce((s, i) => {
    const qty = Math.max(1, Number(i._qty) || 1);
    return s + priceOf(i) * qty;
  }, 0);
}
function computeTotalInCents(items) {
  return Math.round(computeTotal(items) * 100);
}

function renderOrderSummary() {
  const el = document.getElementById('order-summary');
  const items = readCart();

  // Agrupar por id con cantidades
  const map = new Map();
  for (const it of items) {
    const id = it.id;
    const qty = Math.max(1, Number(it._qty) || 1);
    const price = priceOf(it);
    const cover = (Array.isArray(it.images) && it.images[0]) ? it.images[0] : (it.image || '/images/placeholder.svg');
    const g = map.get(id) || { id, name: it.name, price, qty: 0, image: cover };
    g.qty += qty;
    g.image = g.image || cover;
    map.set(id, g);
  }
  const grouped = Array.from(map.values());

  const cents = computeTotalInCents(items);
  const amount = (cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });

  if (grouped.length === 0) {
    el.innerHTML = `
      <h3 style="color: black; font-size: 18px; font-weight: 500;">Resumen de la Orden</h3>
      <p>Tu carrito está vacío.</p>
    `;
    return { items, amountInCents: cents };
  }

  const rows = grouped.map(it => {
    const unit = it.price.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    const sub = (it.price * it.qty).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed #eee;">
        <img src="${it.image}" alt="${it.name}" onerror="this.onerror=null;this.src='/images/placeholder.svg'" style="width:56px;height:56px;object-fit:contain;background:#fff;border:1px solid #eee;border-radius:6px;flex-shrink:0;" />
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:black;white-space:normal;">${it.name}</div>
          <div style="color:#555;font-size:13px;">${unit} x ${it.qty} = <strong>${sub}</strong></div>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <h3 style="color: black; font-size: 18px; font-weight: 500;">Resumen de la Orden</h3>
    <div>${rows}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px;color:black;font-size:16px;">
      Total a pagar: <strong style="margin-left:6px;">${amount}</strong>
    </div>
  `;
  return { items, amountInCents: cents };
}

function showReturnMessageFromWompi() {
  const msgEl = document.getElementById('checkout-message');
  const p = new URLSearchParams(location.search);
  const status = p.get('status');
  const id = p.get('id');
  if (status) {
    msgEl.textContent = `Estado del pago: ${status}${id ? ` (Transacción: ${id})` : ''}`;
  }
}

// Cargar scripts con timeout
function loadScript(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = false;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      s.remove();
      reject(new Error(`Timeout cargando ${url}`));
    }, timeout);
    s.onload = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    s.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`Error cargando ${url}`)); } };
    document.head.appendChild(s);
  });
}

// Intentar varias URLs del CDN
async function ensureWompiWidgetLoaded() {
  if (window.WidgetCheckout) return;
  const candidates = [
    'https://cdn.wompi.co/libs/widget/v1.js',
    'https://cdn.wompi.co/libs/widget/v1.1.1.js',
    'https://cdn.wompi.co/libs/widget/v1.1.0.js'
  ];
  let lastErr;
  for (const url of candidates) {
    try {
      await loadScript(url);
      if (window.WidgetCheckout) {
        console.log('Wompi widget cargado desde', url);
        return;
      }
    } catch (e) {
      console.warn(e.message);
      lastErr = e;
    }
  }
  throw lastErr || new Error('No se pudo cargar el Widget de Wompi.');
}

async function openWompi(form, amountInCents) {
  const msgEl = document.getElementById('checkout-message');
  const reference = `KOSX-${Date.now()}`;
  // Nota: algunos gateways/CDNs bloquean redirect-url apuntando a localhost/http.
  // En local, omitimos redirectUrl para que el backend use PUBLIC_BASE_URL (si está configurado)
  // o su fallback.
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const redirectUrl = isLocalhost ? null : `${location.origin}/checkout.html`;

  // 1) Obtener firma desde el backend
  const resp = await fetch('/api/wompi/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, amountInCents, currency: 'COP', ...(redirectUrl ? { redirectUrl } : {}) })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`No se pudo obtener firma: ${txt}`);
  }
  const { publicKey, signature, currency, redirectUrl: finalRedirect } = await resp.json();

  // 2) Intentar cargar el widget; si falla, redirigir al checkout de Wompi
  try {
    await ensureWompiWidgetLoaded();

    const checkout = new WidgetCheckout({
      currency,
      amountInCents,
      reference,
      publicKey,
      signature, // { integrity: '...' }
      redirectUrl: finalRedirect,
      customerData: {
        email: form.email.value,
        fullName: form.name.value,
        phoneNumber: form.phone.value
      },
      shippingAddress: {
        addressLine1: form.address.value,
        city: form.city.value
      }
    });

    msgEl.textContent = 'Abriendo pasarela de pago...';
    checkout.open(function onResult(result) {
      if (result) console.log('Wompi result:', result);
    });
  } catch (e) {
    console.warn('No se pudo cargar el widget. Fallback a redirección:', e?.message);

    // 3) Fallback: redirección al Checkout Web de Wompi
    const url = new URL('https://checkout.wompi.co/p/');
    url.searchParams.set('public-key', publicKey);
    url.searchParams.set('currency', currency);
    url.searchParams.set('amount-in-cents', String(amountInCents));
    url.searchParams.set('reference', reference);
    url.searchParams.set('redirect-url', finalRedirect);
    url.searchParams.set('signature-integrity', signature.integrity);

    msgEl.textContent = 'Redirigiendo a Wompi...';
    window.location.href = url.toString();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('checkout-form');
  const payBtn = document.getElementById('pay-btn');
  const nitInput = document.getElementById('nitId');

  renderOrderSummary();
  showReturnMessageFromWompi();

  // Actualizar resumen cuando cambie el carrito (desde el drawer u otras páginas)
  cartService.subscribe(() => renderOrderSummary());
  window.addEventListener('storage', (e) => {
    if (e.key === 'cart') renderOrderSummary();
  });

  // Mantener NIT/ID solo numérico
  nitInput?.addEventListener('input', () => {
    nitInput.value = String(nitInput.value || '').replace(/\D+/g, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { amountInCents } = renderOrderSummary();
    const msg = document.getElementById('checkout-message');

    if (amountInCents <= 0) {
      msg.textContent = 'Tu carrito está vacío.';
      return;
    }

    const nitId = String(form?.nitId?.value || '').replace(/\D+/g, '').trim();
    if (!nitId) {
      msg.textContent = 'NIT/ID es obligatorio y debe ser numérico.';
      return;
    }

    payBtn.disabled = true;
    try {
      // Registrar pedido en base de datos (solo campos del formulario)
      const payload = {
        nitId,
        name: String(form.name.value || '').trim(),
        email: String(form.email.value || '').trim(),
        phone: String(form.phone.value || '').trim(),
        address: String(form.address.value || '').trim(),
        city: String(form.city.value || '').trim(),
        notes: String(form.notes?.value || '').trim(),
        paymentMethod: String(form.paymentMethod?.value || '').trim()
      };

      const saveResp = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!saveResp.ok) {
        const ct = (saveResp.headers.get('content-type') || '').toLowerCase();
        let errMsg = '';
        if (ct.includes('application/json')) {
          try {
            const j = await saveResp.json();
            errMsg = j?.detail ? `${j.message || 'Error'} (${j.detail})` : (j?.message || 'Error');
          } catch {
            errMsg = '';
          }
        }
        if (!errMsg) {
          const errTxt = await saveResp.text().catch(() => '');
          errMsg = errTxt || String(saveResp.status);
        }
        throw new Error(`No se pudo registrar el pedido: ${errMsg}`);
      }

      await openWompi(form, amountInCents);
    } catch (err) {
      console.error(err);
      msg.textContent = err.message || 'Error de pago, intenta de nuevo.';
      payBtn.disabled = false;
    }
  });
});