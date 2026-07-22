import { renderHeader } from './components/header.js?v=999';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from '../services/cart-service.js';
import { SITE_CONFIG } from '../utils/config.js';

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
  const raw = item?.price ?? item?.price_unit ?? item?.precio ?? 0;
  const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function computeTotal(items) {
  return items.reduce((s, i) => s + priceOf(i) * Math.max(1, Number(i._qty) || 1), 0);
}

function computeTotals(items) {
  const subtotal = computeTotal(items); // without VAT
  // Calculate total with VAT per item to match prices shown in catalog
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
  return n.toLocaleString('en-US', { style: 'currency', currency: 'COP' });
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

// ── flete (shipping) state ────────────────────────────────────────────────────

let _fleteData = { fleteTotal: 0, fletePorCaja: 0, totalCajas: 0, tarifaKilo: 0, maxKilosLiquidar: 0 };

async function calcularFlete() {
  const citySelect = document.getElementById('city');
  const city = citySelect ? citySelect.value.trim() : '';
  const emptyFlete = { fleteTotal: 0, fletePorCaja: 0, totalCajas: 0, tarifaKilo: 0, maxKilosLiquidar: 0 };

  if (!city) { _fleteData = emptyFlete; renderOrderSummary(); return; }

  const cartItems = readCart();
  if (cartItems.length === 0) { _fleteData = emptyFlete; renderOrderSummary(); return; }

  const itemsMap = new Map();
  for (const ci of cartItems) {
    const qty = Math.max(1, Number(ci._qty) || 1);
    const existing = itemsMap.get(ci.id);
    if (existing) { existing.quantity += qty; }
    else { itemsMap.set(ci.id, { product_id: ci.id, quantity: qty }); }
  }

  try {
    const res = await fetch('/api/flete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, items: Array.from(itemsMap.values()) })
    });
    if (res.ok) {
      _fleteData = await res.json();
    } else {
      _fleteData = emptyFlete;
    }
  } catch (e) {
    console.warn('Error calculating shipping:', e);
    _fleteData = emptyFlete;
  }
  renderOrderSummary();
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
          Order Summary
        </h3>
        <p style="color:var(--muted);font-size:.9rem;text-align:center;padding:24px 0;line-height:1.6">
          Your cart is empty.<br>
          <a href="/en/products" style="color:var(--primary);font-weight:600;">Browse products →</a>
        </p>
      </div>
    `;
    return { items, amountInCents: totalInCents, subtotal: 0, iva: 0, flete: 0, totalValue: 0 };
  }

  const rows = grouped.map(it => `
    <div class="co-summary-item">
      <a href="/en/product?id=${it.id}" style="position:relative;flex-shrink:0;display:block;">
        <img class="co-summary-img" src="${it.image}" alt="${it.name}"
          onerror="this.onerror=null;this.src='/images/placeholder.svg'">
        <span class="co-summary-qty-badge">${it.qty}</span>
      </a>
      <div style="flex:1;min-width:0;">
        <a href="/en/product?id=${it.id}" class="co-summary-item-name" style="color:inherit;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${it.name}</a>
        <div class="co-summary-item-sub">${fmt(Math.round(it.price * 1.19))} × ${it.qty} = <strong>${fmt(Math.round(it.price * 1.19) * it.qty)}</strong> <span style="font-size:0.7rem;color:#4CAF50;">VAT incl.</span></div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="co-summary-card glass-panel">
      <h3 class="co-summary-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        Order Summary
        <span class="co-summary-count">${grouped.length} ${grouped.length === 1 ? 'product' : 'products'}</span>
      </h3>
      <div class="co-summary-items">${rows}</div>
      <div class="co-summary-totals">
        <div class="co-summary-line">
          <span>Subtotal (excluding VAT)</span>
          <span>${fmt(subtotal)}</span>
        </div>
        <div class="co-summary-line">
          <span>VAT (19%)</span>
          <span>${fmt(iva)}</span>
        </div>
        <div class="co-summary-line">
          <span>Shipping${_fleteData.fleteTotal > 0 ? ` (${fmt(_fleteData.fletePorCaja)} × ${_fleteData.totalCajas} ${_fleteData.totalCajas === 1 ? 'box' : 'boxes'})` : ''}</span>
          <span>${_fleteData.fleteTotal > 0 ? fmt(_fleteData.fleteTotal) : '<span style="color:var(--muted);font-size:.8rem;">Select city</span>'}</span>
        </div>
        <div class="co-summary-total">
          <span>Total amount</span>
          <span class="co-summary-total-amount">${fmt(total + _fleteData.fleteTotal)}</span>
        </div>
      </div>
    </div>
  `;

  const flete = _fleteData.fleteTotal || 0;
  const grandTotal = total + flete;
  return { items, amountInCents: Math.round(grandTotal * 100), subtotal, iva, flete, totalValue: grandTotal };
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
      const unitPrice = priceOf(p);
      const cantidad = Number(p.cantidad ?? p.Cantidad ?? p.cant ?? 0) || 1;
      const boxPrice = unitPrice * cantidad;
      return `
        <div class="co-rel-card glass-panel">
          <a href="/en/product?id=${p.id}" class="co-rel-img-wrap">
            <img src="${img}" alt="${p.name}" loading="lazy"
              onerror="this.onerror=null;this.src='/images/placeholder.svg'">
          </a>
          <div class="co-rel-body">
            <h4 class="co-rel-name">${p.name}</h4>
            <p class="co-rel-price">${fmt(Math.round(boxPrice * 1.19))}<span style="font-size:.75rem;font-weight:400;"> / box</span> <span style="font-size:.65rem;color:#4CAF50;font-weight:600;">VAT incl.</span></p>
            <button class="btn-primary co-rel-add" data-id="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add
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
        Added
      `;
      btn.disabled = true;
      btn.style.background = '#10b981';
      btn.style.borderColor = '#10b981';
      showToast(`"${product.name}" added to cart`);

      setTimeout(() => {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add
        `;
        btn.disabled = false;
        btn.style.background = '';
        btn.style.borderColor = '';
      }, 2500);
    });

  } catch (e) {
    console.warn('Could not load related products:', e);
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
    msgEl.textContent = `Payment status: ${status}${id ? ` (Transaction: ${id})` : ''}`;
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
      reject(new Error(`Timeout loading ${url}`));
    }, timeout);
    s.onload = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    s.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`Error loading ${url}`)); } };
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
      if (window.WidgetCheckout) { console.log('Wompi widget loaded from', url); return; }
    } catch (e) { console.warn(e.message); lastErr = e; }
  }
  throw lastErr || new Error('Could not load Wompi Widget.');
}

async function openWompi(form, amountInCents, pedidoId) {
  const msgEl = document.getElementById('checkout-message');
  const reference = pedidoId ? `PED-${pedidoId}` : `KOSX-${Date.now()}`;
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const redirectPath = pedidoId ? `/en/confirmation.html?pedidoId=${encodeURIComponent(pedidoId)}` : '/en/checkout.html';
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
    throw new Error(`Could not fetch signature: ${txt}`);
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
        fullName: [form.nombres?.value, form.apellidos?.value].filter(Boolean).join(' '),
        phoneNumber: form.phone.value
      },
      shippingAddress: { addressLine1: form.address.value, city: form.city.value }
    });
    msgEl.textContent = 'Opening payment gateway...';
    msgEl.className = 'co-message';
    checkout.open(result => { if (result) console.log('Wompi result:', result); });
  } catch (e) {
    console.warn('Could not load checkout widget. Falling back to redirect:', e?.message);
    const url = new URL('https://checkout.wompi.co/p/');
    url.searchParams.set('public-key', publicKey);
    url.searchParams.set('currency', currency);
    url.searchParams.set('amount-in-cents', String(amountInCents));
    url.searchParams.set('reference', reference);
    url.searchParams.set('redirect-url', finalRedirect);
    url.searchParams.set('signature:integrity', signature.integrity);
    msgEl.textContent = 'Redirecting to Wompi...';
    window.location.href = url.toString();
  }
}

// ── field validation visual feedback ─────────────────────────────────────────

function setupFieldValidation() {
  document.querySelectorAll('.co-field input, .co-field textarea, .co-field select').forEach(input => {
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
    input.addEventListener('change', syncState);
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

// ── delivery estimate by city ─────────────────────────────────────────────────

function normalizeCityForCompare(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();
}

function updateDeliveryEstimate() {
  const citySelect = document.getElementById('city');
  const el = document.getElementById('co-delivery-estimate');
  if (!citySelect || !el) return;
  const city = String(citySelect.value || '').trim();
  if (!city) {
    el.textContent = '';
    return;
  }
  const mainCities = SITE_CONFIG.MAIN_CITIES || [];
  const cityNorm = normalizeCityForCompare(city);
  const isMain = mainCities.some(c => normalizeCityForCompare(c) === cityNorm);
  el.textContent = isMain
    ? 'Estimated delivery: 1-3 days'
    : 'Other cities: variable shipping times depending on destination';
}

// ── departamento / ciudad cascading dropdowns ────────────────────────────────

async function loadDepartamentos() {
  const deptoSelect = document.getElementById('departamento');
  const citySelect = document.getElementById('city');
  if (!deptoSelect || !citySelect) return;

  try {
    const res = await fetch('/api/departamentos');
    if (!res.ok) throw new Error('fetch failed');
    const deptos = await res.json();

    deptoSelect.innerHTML = '<option value="">Select a state/department</option>';
    for (const d of deptos) {
      const opt = document.createElement('option');
      opt.value = d.nombre;
      opt.dataset.id = d.id;
      opt.textContent = d.nombre;
      deptoSelect.appendChild(opt);
    }

    deptoSelect.addEventListener('change', async () => {
      const selected = deptoSelect.options[deptoSelect.selectedIndex];
      const deptoId = selected?.dataset?.id;

      citySelect.innerHTML = '<option value="">Loading cities...</option>';
      citySelect.disabled = true;

      if (!deptoId) {
        citySelect.innerHTML = '<option value="">First select state/department</option>';
        citySelect.disabled = false;
        updateDeliveryEstimate();
        return;
      }

      try {
        const cRes = await fetch(`/api/ciudades?departamento_id=${deptoId}`);
        if (!cRes.ok) throw new Error('fetch failed');
        const ciudades = await cRes.json();

        citySelect.innerHTML = '<option value="">Select a city</option>';
        for (const c of ciudades) {
          const opt = document.createElement('option');
          opt.value = c.nombre;
          opt.textContent = c.nombre;
          citySelect.appendChild(opt);
        }
        citySelect.disabled = false;
        updateDeliveryEstimate();
      } catch (e) {
        console.error('Error loading cities:', e);
        citySelect.innerHTML = '<option value="">Error loading cities</option>';
        citySelect.disabled = false;
        updateDeliveryEstimate();
      }
    });
  } catch (e) {
    console.error('Error loading states/departments:', e);
    deptoSelect.innerHTML = '<option value="">Error loading states/departments</option>';
  }
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('checkout-form');
  const payBtn = document.getElementById('pay-btn');
  const nitInput = document.getElementById('nitId');
  const msgEl = document.getElementById('checkout-message');

  const tipoDocSelect = document.getElementById('tipoDocumento');
  const tipoPersonaSelect = document.getElementById('tipoPersona');
  const dvField = document.getElementById('dv-field');
  const apellidosField = document.getElementById('apellidos-field');
  const nombresLabel = document.getElementById('nombres-label');

  renderOrderSummary();
  showReturnMessageFromWompi();
  renderRelatedProducts();
  setupFieldValidation();
  loadDepartamentos();

  // Keep summary in sync with cart changes (recalculate flete too)
  cartService.subscribe(() => calcularFlete());
  window.addEventListener('storage', e => { if (e.key === 'cart') calcularFlete(); });

  // Recalculate flete and delivery estimate when city changes
  const citySelect = document.getElementById('city');
  citySelect?.addEventListener('change', () => {
    calcularFlete();
    updateDeliveryEstimate();
  });

  // Tipo documento: mostrar/ocultar DV y ajustar validación del número
  tipoDocSelect?.addEventListener('change', () => {
    const tipo = tipoDocSelect.value;
    // Mostrar DV solo para NIT
    if (dvField) dvField.style.display = tipo === 'NIT' ? '' : 'none';
    // Alfanumérico para CE y PA, solo dígitos para CC, NIT, TI
    if (nitInput) {
      if (tipo === 'CE' || tipo === 'PA') {
        nitInput.removeAttribute('inputmode');
        nitInput.removeAttribute('pattern');
      } else {
        nitInput.setAttribute('inputmode', 'numeric');
        nitInput.value = nitInput.value.replace(/\D+/g, '');
      }
    }
  });

  // Tipo persona: mostrar/ocultar apellidos, cambiar label nombres
  tipoPersonaSelect?.addEventListener('change', () => {
    const esJuridica = tipoPersonaSelect.value === 'J';
    if (apellidosField) apellidosField.style.display = esJuridica ? 'none' : '';
    if (nombresLabel) nombresLabel.textContent = esJuridica ? 'Company Name *' : 'First Name *';
    // Si es jurídica, auto-seleccionar NIT
    if (esJuridica && tipoDocSelect) {
      tipoDocSelect.value = 'NIT';
      tipoDocSelect.dispatchEvent(new Event('change'));
    }
  });

  // Número documento: filtrar según tipo
  nitInput?.addEventListener('input', () => {
    const tipo = tipoDocSelect?.value || 'CC';
    if (tipo !== 'CE' && tipo !== 'PA') {
      nitInput.value = String(nitInput.value || '').replace(/\D+/g, '');
    }
  });

  // Form submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { amountInCents, subtotal, iva, flete, totalValue } = renderOrderSummary();
    msgEl.className = 'co-message';
    msgEl.textContent = '';

    if (amountInCents <= 0) {
      msgEl.textContent = 'Your cart is empty.';
      msgEl.className = 'co-message co-message-error';
      return;
    }

    // --- Validate inventory for all cart items before processing ---
    {
      const cartItems = readCart();
      // Group by id to get total qty per product
      const qtyMap = new Map();
      const itemMap = new Map();
      for (const ci of cartItems) {
        const qty = Math.max(1, Number(ci._qty) || 1);
        qtyMap.set(ci.id, (qtyMap.get(ci.id) || 0) + qty);
        if (!itemMap.has(ci.id)) itemMap.set(ci.id, ci);
      }

      let hasStockIssue = false;
      const issues = [];

      for (const [id, totalQty] of qtyMap.entries()) {
        const item = itemMap.get(id);
        const sku = (item.codigo_siesa || item.sku || item.SKU || item.item_ext || '').toString().trim();
        if (!sku) continue;

        try {
          const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`);
          if (!r.ok) {
            hasStockIssue = true;
            issues.push(`${item.name || 'Product'}: not available`);
            cartService.remove(id);
            continue;
          }
          const data = await r.json();
          const estado = (data && (data.estado || data.status || '')).toString();
          if (estado !== 'En Existencia') {
            hasStockIssue = true;
            issues.push(`${item.name || 'Product'}: out of stock`);
            cartService.remove(id);
            continue;
          }
          const inventario = Number(data?.inventario);
          if (Number.isFinite(inventario)) {
            const rawUnits = item.cantidad ?? item.Cantidad ?? 1000;
            const unitsPerBox = (Number.isFinite(Number(rawUnits)) && Number(rawUnits) > 0) ? Number(rawUnits) : 1000;
            const maxBoxes = Math.floor(inventario / unitsPerBox);
            if (totalQty > maxBoxes) {
              hasStockIssue = true;
              if (maxBoxes > 0) {
                issues.push(`${item.name || 'Product'}: adjusted to ${maxBoxes} box${maxBoxes !== 1 ? 'es' : ''}`);
                cartService.setQty(id, maxBoxes);
              } else {
                issues.push(`${item.name || 'Product'}: out of stock`);
                cartService.remove(id);
              }
            }
          }
        } catch {
          // On error, block this item
          hasStockIssue = true;
          issues.push(`${item.name || 'Product'}: error checking stock`);
          cartService.remove(id);
        }
      }

      if (hasStockIssue) {
        msgEl.textContent = 'Some products exceeded inventory limits and were adjusted: ' + issues.join('; ') + '. Please check your cart and try again.';
        msgEl.className = 'co-message co-message-error';
        renderOrderSummary();
        return;
      }
    }

    const tipoDoc = String(form.tipoDocumento?.value || '').trim();
    const rawNit = String(form.nitId?.value || '').trim();
    const nitId = (tipoDoc === 'CE' || tipoDoc === 'PA') ? rawNit : rawNit.replace(/\D+/g, '');
    if (!tipoDoc) {
      msgEl.textContent = 'Please select a document type.';
      msgEl.className = 'co-message co-message-error';
      tipoDocSelect?.focus();
      return;
    }
    if (!nitId) {
      msgEl.textContent = 'Document number is required.';
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
      Processing order...
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

      const nombres = String(form.nombres?.value || '').trim();
      const apellidos = String(form.apellidos?.value || '').trim();
      const tipoPersonaVal = String(form.tipoPersona?.value || 'N').trim();
      const nombreCompleto = tipoPersonaVal === 'J' ? nombres : [nombres, apellidos].filter(Boolean).join(' ');

      const payload = {
        nitId,
        name: nombreCompleto,
        tipo_documento: tipoDoc,
        digito_verificacion: tipoDoc === 'NIT' ? String(form.digitoVerificacion?.value || '').trim() : null,
        nombres,
        apellidos: tipoPersonaVal === 'J' ? null : apellidos,
        nombre_completo: nombreCompleto,
        email: String(form.email.value || '').trim(),
        phone: String(form.phone.value || '').trim(),
        telefono_fijo: String(form.telefonoFijo?.value || '').trim() || null,
        address: String(form.address.value || '').trim(),
        city: String(form.city.value || '').trim(),
        departamento: String(form.departamento?.value || '').trim() || null,
        pais: String(form.pais?.value || 'CO').trim(),
        tipo_persona: tipoPersonaVal,
        regimen: String(form.regimen?.value || '').trim() || null,
        fecha_nacimiento: String(form.fechaNacimiento?.value || '').trim() || null,
        notes: String(form.notes?.value || '').trim(),
        paymentMethod: String(form.paymentMethod?.value || '').trim(),
        subtotal,
        iva,
        flete,
        total_value: totalValue,
        items: Array.from(itemsMap.values())
      };

      const saveResp = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!saveResp.ok) {
        // Don't surface the raw server message — the API responds in Spanish
        // regardless of storefront locale. Log it for debugging, show a
        // generic English message to the shopper instead.
        const ct = (saveResp.headers.get('content-type') || '').toLowerCase();
        let rawErr = '';
        if (ct.includes('application/json')) {
          try {
            const j = await saveResp.json();
            rawErr = j?.detail ? `${j.message || 'Error'} (${j.detail})` : (j?.message || 'Error');
          } catch { rawErr = ''; }
        }
        if (!rawErr) { rawErr = await saveResp.text().catch(() => '') || String(saveResp.status); }
        console.error('[checkout] order registration failed:', rawErr);
        throw new Error('Could not register your order. Please check your information and try again.');
      }

      const saved = await saveResp.json().catch(() => ({}));
      const pedidoId = saved?.id;
      if (!pedidoId) throw new Error('Could not retrieve order ID.');

      // Advance to step 3
      setStep(3);
      msgEl.textContent = 'Order registered! Opening payment gateway...';
      await openWompi(form, amountInCents, pedidoId);

    } catch (err) {
      console.error(err);
      setStep(1);
      msgEl.textContent = err.message || 'Payment error, please try again.';
      msgEl.className = 'co-message co-message-error';
      payBtn.disabled = false;
      payBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Place Secure Order
      `;
    }
  });
});
