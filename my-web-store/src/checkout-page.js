import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

// ── utilities ─────────────────────────────────────────────────────────────────

function readCart() {
  try {
    const raw = localStorage.getItem('cart');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function priceOf(item) {
  const raw = item?.price ?? item?.precio ?? 0;
  const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function computeTotal(items) {
  return items.reduce((s, i) => s + priceOf(i) * Math.max(1, Number(i._qty) || 1), 0);
}

function computeTotals(items) {
  const subtotal = computeTotal(items); // sin IVA
  // Calcular total con IVA por ítem para que coincida con precios mostrados en catálogo
  let totalConIva = 0;
  for (const i of items) {
    const price = priceOf(i);
    const qty = Math.max(1, Number(i._qty) || 1);
    totalConIva += Math.round(price * 1.19) * qty;
  }
  const iva = totalConIva - subtotal;
  return {
    subtotal,
    iva,
    total: totalConIva,
    totalInCents: Math.round(totalConIva * 100)
  };
}

function fmt(n) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
}

function showToast(msg, type = 'success') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  toast.className = type === 'error' ? 'toast-error' : 'toast-success';
  toast.textContent = msg;
  root.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('visible'), 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── order summary ─────────────────────────────────────────────────────────────

function renderOrderSummary() {
  const el = document.getElementById('order-summary');
  if (!el) return { items: [], amountInCents: 0 };

  const items = readCart();

  // Group by id
  const map = new Map();
  for (const it of items) {
    const qty = Math.max(1, Number(it._qty) || 1);
    const existing = map.get(it.id) || {
      id: it.id, name: it.name, price: priceOf(it), qty: 0,
      image: (Array.isArray(it.images) && it.images[0]) || it.image || '/images/placeholder.svg'
    };
    existing.qty += qty;
    map.set(it.id, existing);
  }
  const grouped = Array.from(map.values());
  const { subtotal, iva, total, totalInCents } = computeTotals(items);

  if (grouped.length === 0) {
    el.innerHTML = `
      <div class="co-summary-card glass-panel">
        <h3 class="co-summary-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          Resumen del pedido
        </h3>
        <p style="color:var(--muted);font-size:.9rem;text-align:center;padding:24px 0;line-height:1.6">
          Tu carrito está vacío.<br>
          <a href="/products" style="color:var(--primary);font-weight:600;">Explorar productos →</a>
        </p>
      </div>
    `;
    return { items, amountInCents: totalInCents, subtotal: 0, iva: 0, totalValue: 0 };
  }

  const rows = grouped.map(it => `
    <div class="co-summary-item">
      <a href="/product?id=${it.id}" style="position:relative;flex-shrink:0;display:block;">
        <img class="co-summary-img" src="${it.image}" alt="${it.name}"
          onerror="this.onerror=null;this.src='/images/placeholder.svg'">
        <span class="co-summary-qty-badge">${it.qty}</span>
      </a>
      <div style="flex:1;min-width:0;">
        <a href="/product?id=${it.id}" class="co-summary-item-name" style="color:inherit;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${it.name}</a>
        <div class="co-summary-item-sub">${fmt(Math.round(it.price * 1.19))} × ${it.qty} = <strong>${fmt(Math.round(it.price * 1.19) * it.qty)}</strong> <span style="font-size:0.7rem;color:#4CAF50;">IVA incl.</span></div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="co-summary-card glass-panel">
      <h3 class="co-summary-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        Resumen del pedido
        <span class="co-summary-count">${grouped.length} ${grouped.length === 1 ? 'producto' : 'productos'}</span>
      </h3>
      <div class="co-summary-items">${rows}</div>
      <div class="co-summary-totals">
        <div class="co-summary-line">
          <span>Subtotal (sin IVA)</span>
          <span>${fmt(subtotal)}</span>
        </div>
        <div class="co-summary-line">
          <span>IVA (19%)</span>
          <span>${fmt(iva)}</span>
        </div>
        <div class="co-summary-total">
          <span>Total a pagar</span>
          <span class="co-summary-total-amount">${fmt(total)}</span>
        </div>
      </div>
    </div>
  `;

  return { items, amountInCents: totalInCents, subtotal, iva, totalValue: total };
}

// ── related products ──────────────────────────────────────────────────────────

async function renderRelatedProducts() {
  const container = document.getElementById('related-products');
  const section = document.querySelector('.co-related');
  if (!container) return;

  try {
    const cartItems = readCart();
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('fetch failed');
    const allProducts = await res.json();

    const cartIds = new Set(cartItems.map(i => i.id));
    const cartCats = new Set(
      cartItems.map(i => String(i.category_name || i.category_nombre || i.category || '').trim()).filter(Boolean)
    );

    // Prefer same-category products not in cart
    let related = allProducts.filter(p => {
      if (cartIds.has(p.id)) return false;
      const pCat = String(p.category_name || p.category_nombre || p.category || '').trim();
      return cartCats.has(pCat);
    });

    // Fill up to 4 with shuffled random products
    if (related.length < 4) {
      const pool = allProducts.filter(p => !cartIds.has(p.id) && !related.find(r => r.id === p.id));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      related = [...related, ...pool.slice(0, 4 - related.length)];
    }

    related = related.slice(0, 4);

    if (related.length === 0) { section?.remove(); return; }

    container.innerHTML = related.map(p => {
      const img = (Array.isArray(p.images) && p.images[0]) || p.image || '/images/placeholder.svg';
      const price = priceOf(p);
      return `
        <div class="co-rel-card glass-panel">
          <a href="/product?id=${p.id}" class="co-rel-img-wrap">
            <img src="${img}" alt="${p.name}" loading="lazy"
              onerror="this.onerror=null;this.src='/images/placeholder.svg'">
          </a>
          <div class="co-rel-body">
            <h4 class="co-rel-name">${p.name}</h4>
            <p class="co-rel-price">${fmt(Math.round(price * 1.19))}<span style="font-size:.75rem;font-weight:400;"> / caja</span> <span style="font-size:.65rem;color:#4CAF50;font-weight:600;">IVA incl.</span></p>
            <button class="btn-primary co-rel-add" data-id="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Agregar
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add to cart delegate
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.co-rel-add');
      if (!btn || btn.disabled) return;
      const id = Number(btn.dataset.id);
      const product = related.find(p => p.id === id);
      if (!product) return;

      cartService.add(product, 1);
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Agregado
      `;
      btn.disabled = true;
      btn.style.background = '#10b981';
      btn.style.borderColor = '#10b981';
      showToast(`"${product.name}" agregado al carrito`);

      setTimeout(() => {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar
        `;
        btn.disabled = false;
        btn.style.background = '';
        btn.style.borderColor = '';
      }, 2500);
    });

  } catch (e) {
    console.warn('No se pudieron cargar productos relacionados:', e);
    section?.remove();
  }
}

// ── Wompi integration ─────────────────────────────────────────────────────────

function showReturnMessageFromWompi() {
  const msgEl = document.getElementById('checkout-message');
  const p = new URLSearchParams(location.search);
  const status = p.get('status');
  const id = p.get('id');
  if (status) {
    msgEl.textContent = `Estado del pago: ${status}${id ? ` (Transacción: ${id})` : ''}`;
  }
}

function loadScript(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = false;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true; s.remove();
      reject(new Error(`Timeout cargando ${url}`));
    }, timeout);
    s.onload = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    s.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`Error cargando ${url}`)); } };
    document.head.appendChild(s);
  });
}

async function ensureWompiWidgetLoaded() {
  if (window.WidgetCheckout) return;
  const candidates = [
    'https://checkout.wompi.co/widget.js',
    'https://cdn.wompi.co/libs/widget/v1.js'
  ];
  let lastErr;
  for (const url of candidates) {
    try {
      await loadScript(url);
      if (window.WidgetCheckout) { console.log('Wompi widget cargado desde', url); return; }
    } catch (e) { console.warn(e.message); lastErr = e; }
  }
  throw lastErr || new Error('No se pudo cargar el Widget de Wompi.');
}

async function openWompi(form, amountInCents, pedidoId) {
  const msgEl = document.getElementById('checkout-message');
  const reference = pedidoId ? `PED-${pedidoId}` : `KOSX-${Date.now()}`;
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const redirectPath = pedidoId ? `/confirmacion.html?pedidoId=${encodeURIComponent(pedidoId)}` : '/checkout.html';
  const redirectUrl = isLocalhost ? null : `${location.origin}${redirectPath}`;

  const resp = await fetch('/api/wompi/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference, amountInCents, currency: 'COP', redirectPath,
      ...(redirectUrl ? { redirectUrl } : {})
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`No se pudo obtener firma: ${txt}`);
  }
  const { publicKey, signature, currency, redirectUrl: finalRedirect } = await resp.json();

  try {
    await ensureWompiWidgetLoaded();
    const checkout = new WidgetCheckout({
      currency,
      amountInCents,
      reference,
      publicKey,
      'signature:integrity': signature.integrity,
      redirectUrl: finalRedirect,
      customerData: {
        email: form.email.value,
        fullName: form.name.value,
        phoneNumber: form.phone.value
      },
      shippingAddress: { addressLine1: form.address.value, city: form.city.value }
    });
    msgEl.textContent = 'Abriendo pasarela de pago...';
    msgEl.className = 'co-message';
    checkout.open(result => { if (result) console.log('Wompi result:', result); });
  } catch (e) {
    console.warn('No se pudo cargar el widget. Fallback a redirección:', e?.message);
    const url = new URL('https://checkout.wompi.co/p/');
    url.searchParams.set('public-key', publicKey);
    url.searchParams.set('currency', currency);
    url.searchParams.set('amount-in-cents', String(amountInCents));
    url.searchParams.set('reference', reference);
    url.searchParams.set('redirect-url', finalRedirect);
    url.searchParams.set('signature:integrity', signature.integrity);
    msgEl.textContent = 'Redirigiendo a Wompi...';
    window.location.href = url.toString();
  }
}

// ── field validation visual feedback ─────────────────────────────────────────

function setupFieldValidation() {
  document.querySelectorAll('.co-field input, .co-field textarea').forEach(input => {
    const syncState = () => {
      const hasValue = !!input.value.trim();
      input.classList.toggle('has-value', hasValue);
      if (hasValue && input.checkValidity()) {
        input.classList.add('valid');
      } else {
        input.classList.remove('valid');
      }
    };
    input.addEventListener('input', syncState);
    input.addEventListener('blur', syncState);
    // Init for pre-filled values
    if (input.value.trim()) syncState();
  });
}

// ── step progress helper ──────────────────────────────────────────────────────

function setStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById(`step-${i}`);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  });
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('checkout-form');
  const payBtn = document.getElementById('pay-btn');
  const nitInput = document.getElementById('nitId');
  const msgEl = document.getElementById('checkout-message');

  renderOrderSummary();
  showReturnMessageFromWompi();
  renderRelatedProducts();
  setupFieldValidation();

  // Keep summary in sync with cart changes
  cartService.subscribe(() => renderOrderSummary());
  window.addEventListener('storage', e => { if (e.key === 'cart') renderOrderSummary(); });

  // NIT: digits only
  nitInput?.addEventListener('input', () => {
    nitInput.value = String(nitInput.value || '').replace(/\D+/g, '');
  });

  // Form submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { amountInCents, subtotal, iva, totalValue } = renderOrderSummary();
    msgEl.className = 'co-message';
    msgEl.textContent = '';

    if (amountInCents <= 0) {
      msgEl.textContent = 'Tu carrito está vacío.';
      msgEl.className = 'co-message co-message-error';
      return;
    }

    const nitId = String(form?.nitId?.value || '').replace(/\D+/g, '').trim();
    if (!nitId) {
      msgEl.textContent = 'NIT / Cédula es obligatorio y debe ser numérico.';
      msgEl.className = 'co-message co-message-error';
      document.getElementById('nitId')?.focus();
      return;
    }

    // Advance to step 2
    setStep(2);
    payBtn.disabled = true;
    payBtn.innerHTML = `
      <svg class="co-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
        <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
      </svg>
      Procesando pedido...
    `;

    try {
      // Build items array from cart for server-side persistence
      const cartItems = readCart();
      const itemsMap = new Map();
      for (const ci of cartItems) {
        const qty = Math.max(1, Number(ci._qty) || 1);
        const existing = itemsMap.get(ci.id);
        if (existing) { existing.quantity += qty; }
        else {
          itemsMap.set(ci.id, {
            product_id: ci.id,
            product_name: ci.name || '',
            product_sku: ci.codigo_siesa || ci.sku || '',
            price_unit: priceOf(ci),
            quantity: qty
          });
        }
      }

      const payload = {
        nitId,
        name: String(form.name.value || '').trim(),
        email: String(form.email.value || '').trim(),
        phone: String(form.phone.value || '').trim(),
        address: String(form.address.value || '').trim(),
        city: String(form.city.value || '').trim(),
        notes: String(form.notes?.value || '').trim(),
        paymentMethod: String(form.paymentMethod?.value || '').trim(),
        subtotal,
        iva,
        total_value: totalValue,
        items: Array.from(itemsMap.values())
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
          } catch { errMsg = ''; }
        }
        if (!errMsg) { errMsg = await saveResp.text().catch(() => '') || String(saveResp.status); }
        throw new Error(`No se pudo registrar el pedido: ${errMsg}`);
      }

      const saved = await saveResp.json().catch(() => ({}));
      const pedidoId = saved?.id;
      if (!pedidoId) throw new Error('No se pudo obtener el id del pedido.');

      // Advance to step 3
      setStep(3);
      msgEl.textContent = '¡Pedido registrado! Abriendo pasarela de pago...';
      await openWompi(form, amountInCents, pedidoId);

    } catch (err) {
      console.error(err);
      setStep(1);
      msgEl.textContent = err.message || 'Error de pago, intenta de nuevo.';
      msgEl.className = 'co-message co-message-error';
      payBtn.disabled = false;
      payBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Realizar Pedido Seguro
      `;
    }
  });
});
