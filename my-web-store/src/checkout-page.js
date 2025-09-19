import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';

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

function computeTotal(items) {
  return items.reduce((s, i) => s + Number(i.price || 0), 0);
}
function computeTotalInCents(items) {
  return Math.round(computeTotal(items) * 100);
}

function renderOrderSummary() {
  const el = document.getElementById('order-summary');
  const items = readCart();
  const cents = computeTotalInCents(items);
  const amount = (cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });

  el.innerHTML = `
    <h3 style="color: black; font-size: 18px; font-weight: 500;">Resumen de la Orden</h3>
    <p style="color: black; font-size: 16px;">Total a pagar: <strong>${amount}</strong></p>
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
  const redirectUrl = `${location.origin}/checkout.html`;

  // 1) Obtener firma desde el backend
  const resp = await fetch('/api/wompi/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, amountInCents, currency: 'COP', redirectUrl })
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

  renderOrderSummary();
  showReturnMessageFromWompi();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { amountInCents } = renderOrderSummary();
    const msg = document.getElementById('checkout-message');

    if (amountInCents <= 0) {
      msg.textContent = 'Tu carrito está vacío.';
      return;
    }

    payBtn.disabled = true;
    try {
      await openWompi(form, amountInCents);
    } catch (err) {
      console.error(err);
      msg.textContent = err.message || 'Error de pago, intenta de nuevo.';
      payBtn.disabled = false;
    }
  });
});