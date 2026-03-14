import { formatMoney } from '../utils/format.js';

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
  const imgSrc = (Array.isArray(p.images) && p.images[0]) || p.image || '/images/placeholder.svg';
  const qtyInputId = `qty-${p.id}`;
  const skuAttr = p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '';
  return /* html */`
    <article class="product" data-id="${p.id}" data-sku="${skuAttr}" style="cursor: pointer; opacity: 1; transition: transform 0.2s ease, box-shadow 0.2s ease;" onclick="if(!event.target.closest('button') && !event.target.closest('input') && !event.target.closest('a') && !event.target.closest('.qty-label') && !event.target.closest('.qty-input') && !event.target.closest('.product-actions')) { window.location.href='/product?id=${p.id}'; }">
      <div class="product-media">
        <div class="product-img-wrap" data-index="0" style="position:relative;">
          <div class="out-of-stock-badge" style="display: none; position: absolute; top: 12px; left: 12px; background-color: var(--secondary, #f28c30); color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; letter-spacing: 1px; z-index: 2; pointer-events: none; text-transform: uppercase;">No disponible</div>
          <a href="/product?id=${p.id}" class="product-image-link" aria-label="Ver ${p.name}">
            <img class="product-img" src="${imgSrc}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/images/placeholder.svg'">
          </a>
          ${Array.isArray(p.images) && p.images.length > 1 ? `
            <button class="img-prev" aria-label="Imagen anterior">‹</button>
            <button class="img-next" aria-label="Imagen siguiente">›</button>
          ` : ''}
        </div>
      </div>
      <div>
        <a href="/product?id=${p.id}" class="product-link" style="color:inherit;text-decoration:none"><h3>${p.name}</h3></a>
  <p class="price" data-base-price="${unitPrice}" data-cantidad="${cantidadNum ?? ''}" data-codigo="${p.codigo || ''}">$${formatMoney(totalConIva)} <span style="font-size:0.7rem;color:#666;">/ caja</span> <span style="font-size:0.65rem;color:#4CAF50;font-weight:600;">IVA incluido</span></p>
      </div>
      <div class="product-actions" style="display:flex;gap:8px;align-items:center;">
        <label for="${qtyInputId}" class="qty-label" style="font-size:0.9rem;">Cantidad</label>
        <input id="${qtyInputId}" type="number" class="qty-input" min="1" step="1" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Cantidad" style="width:64px;padding:4px;" data-dynamic-price="1">
        <button class="add-to-cart btn-primary" data-id="${p.id}" style="padding: 8px 16px; font-size: 0.95rem;">Agregar</button>
      </div>
    </article>
  `;
}

export function attachDynamicPriceBehavior(rootEl) {
  if (!rootEl) return;
  const skuAttr = rootEl.getAttribute('data-sku');

  if (skuAttr) {
    const productId = Number(rootEl.dataset.id);

    const applyOutOfStock = () => {
      const badge = rootEl.querySelector('.out-of-stock-badge');
      const img = rootEl.querySelector('.product-img');
      const btn = rootEl.querySelector('.add-to-cart');
      if (badge) badge.style.setProperty('display', 'block', 'important');
      if (img) {
        img.style.setProperty('filter', 'grayscale(1)', 'important');
        img.style.setProperty('opacity', '0.5', 'important');
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'No disponible';
        btn.title = 'No disponible';
        btn.style.backgroundColor = '#ccc';
        btn.style.borderColor = '#ccc';
        btn.style.color = '#777';
        btn.style.cursor = 'not-allowed';
        btn.classList.add('disabled');
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
      } catch (e) {
        applyOutOfStock();
      }
    };
    checkStock();
  }

  const qtyInput = rootEl.querySelector('.qty-input[data-dynamic-price]');
  const priceEl = rootEl.querySelector('.price[data-codigo]');
  if (!qtyInput || !priceEl) return;
  const codigo = priceEl.getAttribute('data-codigo');
  if (!codigo) return;

  let controller = null;
  const BOX_SIZE = 1000;
  const fmt = (n) => new Intl.NumberFormat('es-CO').format(Math.round(n));

  qtyInput.addEventListener('keydown', (e) => {
    const blocked = ['.', ',', 'e', 'E', '+', '-'];
    if (blocked.includes(e.key)) e.preventDefault();
  });
  qtyInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    const digits = text.replace(/\D+/g, '');
    qtyInput.value = digits || '1';
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
        unitario = (totalEscalon / escalon);
      } else {
        unitario = Number(fallbackBase) / BOX_SIZE;
      }
    }
    const precioCaja = unitario * BOX_SIZE;
    const precioConIva = Math.round(precioCaja * 1.19);
    priceEl.innerHTML = '$' + fmt(precioConIva) + ' <span style="font-size:0.7rem;color:#666;">/ caja</span> <span style="font-size:0.65rem;color:#4CAF50;font-weight:600;">IVA incluido</span>';
    priceEl.dataset.precioCaja = String(precioCaja);
    if (data?.escalonUsado) {
      priceEl.dataset.dynamicEscalon = String(data.escalonUsado);
    }
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
        try { await r.json(); } catch { }
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
