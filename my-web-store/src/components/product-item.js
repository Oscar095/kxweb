import { formatMoney } from '../utils/format.js';

/**
 * V2 Product card template — lightweight, instant render.
 * Image fades in on load; inventory is checked in background.
 */
export function productItemTemplate(p) {
  const priceNum = (() => {
    const raw = p.price ?? p.precio ?? 0;
    const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    return Number.isFinite(num) ? num : 0;
  })();
  const cantidadNum = (() => {
    const raw = p.cantidad ?? p.Cantidad ?? p.cant ?? null;
    const n = raw == null ? null : (typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw));
    return Number.isFinite(n) ? n : null;
  })();
  const unitPrice = (() => {
    const uRaw = p.price_unit ?? p.precio_unitario ?? null;
    const u = uRaw == null ? null : (typeof uRaw === 'string' ? Number(uRaw.replace(/[^\d.-]/g, '')) : Number(uRaw));
    if (Number.isFinite(u)) return u;
    if (cantidadNum && priceNum) return priceNum / cantidadNum;
    return 0;
  })();
  const totalPerBox = cantidadNum ? (unitPrice * cantidadNum) : unitPrice;
  const totalConIva = Math.round(totalPerBox * 1.19);

  const imgs = Array.isArray(p.images) && p.images.length ? p.images : [];
  const imgSrc = imgs[0] || p.image || '/images/placeholder.svg';
  const skuAttr = p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '';
  const catName = p.category_name || '';
  const hasMulti = imgs.length > 1;

  // Image dots
  const dots = hasMulti
    ? `<div class="v2-img-dots">${imgs.map((_, i) => `<span class="v2-img-dot${i === 0 ? ' active' : ''}" data-i="${i}"></span>`).join('')}</div>`
    : '';

  return /* html */`
    <article class="v2-card" data-id="${p.id}" data-sku="${skuAttr}"
      onclick="if(!event.target.closest('button')&&!event.target.closest('input')){window.location.href='/product?id=${p.id}'}">
      <div class="v2-card-img-wrap" data-index="0">
        <span class="v2-oos-badge">No disponible</span>
        <img src="${imgSrc}" alt="${p.name}" loading="lazy" decoding="async"
          onload="this.classList.add('loaded')"
          onerror="this.onerror=null;this.src='/images/placeholder.svg';this.classList.add('loaded')">
        ${hasMulti ? `<button class="v2-img-nav prev" aria-label="Anterior">&#8249;</button><button class="v2-img-nav next" aria-label="Siguiente">&#8250;</button>` : ''}
        ${dots}
      </div>
      <div class="v2-card-body">
        ${catName ? `<span class="v2-card-category">${catName}</span>` : ''}
        <h3 class="v2-card-name">${p.name}</h3>
        <p class="v2-card-price" data-base-price="${unitPrice}" data-cantidad="${cantidadNum ?? ''}" data-codigo="${p.codigo || ''}">
          $${formatMoney(totalConIva)} <span class="v2-per-box">/ caja</span> <span class="v2-iva">IVA incluido</span>
        </p>
      </div>
      <div class="v2-card-actions">
        <input type="number" class="v2-qty-input" min="1" step="1" inputmode="numeric" pattern="[0-9]*" value="1"
          aria-label="Cantidad" data-dynamic-price="1" onclick="event.stopPropagation()">
        <button class="v2-add-btn add-to-cart" data-id="${p.id}" onclick="event.stopPropagation()">Agregar</button>
      </div>
    </article>
  `;
}

/**
 * Attach dynamic price recalculation + background inventory check.
 */
export function attachDynamicPriceBehavior(rootEl) {
  if (!rootEl) return;

  const skuAttr = rootEl.getAttribute('data-sku');
  if (skuAttr) {
    const productId = Number(rootEl.dataset.id);

    const applyOutOfStock = () => {
      const badge = rootEl.querySelector('.v2-oos-badge');
      const img = rootEl.querySelector('.v2-card-img-wrap img');
      const btn = rootEl.querySelector('.v2-add-btn');
      if (badge) badge.style.setProperty('display', 'block', 'important');
      if (img) {
        img.style.setProperty('filter', 'grayscale(1)', 'important');
        img.style.setProperty('opacity', '0.5', 'important');
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'No disponible';
        btn.title = 'No disponible';
      }
    };

    // Non-blocking stock check
    const checkStock = async () => {
      try {
        const cache = window._inventoryCache;
        let estado;
        if (cache && cache.has(productId)) {
          estado = cache.get(productId) === 'disponible' ? 'En Existencia' : 'Agotado';
        } else {
          estado = 'Agotado';
          const r = await fetch(`/api/inventario/${encodeURIComponent(skuAttr)}`);
          if (r.ok) {
            const data = await r.json();
            estado = (data && (data.estado || data.status || '')).toString();
          }
        }
        if (estado !== 'En Existencia') applyOutOfStock();
      } catch {
        applyOutOfStock();
      }
    };
    checkStock();
  }

  // Dynamic price recalc
  const qtyInput = rootEl.querySelector('.v2-qty-input[data-dynamic-price]');
  const priceEl = rootEl.querySelector('.v2-card-price[data-codigo]');
  if (!qtyInput || !priceEl) return;
  const codigo = priceEl.getAttribute('data-codigo');
  if (!codigo) return;

  let controller = null;
  const BOX_SIZE = 1000;
  const fmt = (n) => new Intl.NumberFormat('es-CO').format(Math.round(n));

  // Block decimals
  qtyInput.addEventListener('keydown', (e) => {
    if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
  });
  qtyInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    qtyInput.value = text.replace(/\D+/g, '') || '1';
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  function sanitizeToInteger() {
    let v = String(qtyInput.value || '').replace(/\D+/g, '');
    if (v === '' || v === '0') v = '1';
    qtyInput.value = v;
    return Number(v);
  }

  function renderUnitBoxPrice(data, fallbackBase) {
    let unitario = Number(data?.precioUnitario);
    if (!Number.isFinite(unitario) || unitario <= 0) {
      const totalEscalon = Number(data?.precio);
      const escalon = Number(data?.escalonUsado);
      if (Number.isFinite(totalEscalon) && Number.isFinite(escalon) && escalon > 0) {
        unitario = totalEscalon / escalon;
      } else {
        unitario = Number(fallbackBase) / BOX_SIZE;
      }
    }
    const precioCaja = unitario * BOX_SIZE;
    const precioConIva = Math.round(precioCaja * 1.19);
    priceEl.innerHTML = `$${fmt(precioConIva)} <span class="v2-per-box">/ caja</span> <span class="v2-iva">IVA incluido</span>`;
    priceEl.dataset.precioCaja = String(precioCaja);
    if (data?.escalonUsado) priceEl.dataset.dynamicEscalon = String(data.escalonUsado);
  }

  async function recalc() {
    const mult = sanitizeToInteger();
    if (!Number.isFinite(mult) || mult <= 0) return;
    try {
      if (controller) controller.abort();
      controller = new AbortController();
      priceEl.classList.add('loading');
      const r = await fetch(`/api/precio?codigo=${encodeURIComponent(codigo)}&n=${encodeURIComponent(mult)}`, {
        signal: controller.signal
      });
      const base = priceEl.getAttribute('data-base-price') || '0';
      if (!r.ok) {
        renderUnitBoxPrice(null, base);
        priceEl.classList.remove('loading');
        return;
      }
      const data = await r.json();
      renderUnitBoxPrice(data, base);
      priceEl.classList.remove('loading');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      const base = priceEl.getAttribute('data-base-price') || '0';
      renderUnitBoxPrice(null, base);
      priceEl.classList.remove('loading');
    }
  }

  qtyInput.addEventListener('input', () => {
    sanitizeToInteger();
    clearTimeout(qtyInput._t);
    qtyInput._t = setTimeout(recalc, 160);
  });

  recalc();
}
