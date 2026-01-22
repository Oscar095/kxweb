import { formatMoney } from '../utils/format.js';
export function productItemTemplate(p) {
  // Normaliza precio desde price o precio (precio total del escalón o fallback)
  const priceNum = (() => {
    const raw = p.price ?? p.precio ?? 0;
    const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    return Number.isFinite(num) ? num : 0;
  })();
  // cantidad asociada al producto (escalón)
  const cantidadNum = (() => {
    const raw = p.cantidad ?? p.Cantidad ?? p.cant ?? null;
    const n = raw == null ? null : (typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw));
    return Number.isFinite(n) ? n : null;
  })();
  // precio unitario preferente: price_unit / precio_unitario, fallback a priceNum/cantidad
  const unitPrice = (() => {
    const uRaw = p.price_unit ?? p.precio_unitario ?? null;
    const u = uRaw == null ? null : (typeof uRaw === 'string' ? Number(uRaw.replace(/[^\d.-]/g, '')) : Number(uRaw));
    if (Number.isFinite(u)) return u;
    if (cantidadNum && priceNum) return priceNum / cantidadNum;
    return 0;
  })();
  const totalPerBox = cantidadNum ? (unitPrice * cantidadNum) : unitPrice;
  // Use placeholder.svg by default and fallback on image load error (use absolute path)
  const imgSrc = (Array.isArray(p.images) && p.images[0]) || p.image || '/images/placeholder.svg';
  const qtyInputId = `qty-${p.id}`;
  return /* html */`
    <article class="product" data-id="${p.id}">
      <div class="product-media">
        <div class="product-img-wrap" data-index="0" style="position:relative;">
          <div class="img-lens"></div>
          <a href="/product.html?id=${p.id}" class="product-image-link" aria-label="Ver ${p.name}">
            <img class="product-img" src="${imgSrc}" alt="${p.name}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
          </a>
          ${Array.isArray(p.images) && p.images.length > 1 ? `
            <button class="img-prev" aria-label="Imagen anterior">‹</button>
            <button class="img-next" aria-label="Imagen siguiente">›</button>
          ` : ''}
        </div>
      </div>
      <div>
        <a href="/product.html?id=${p.id}" class="product-link" style="color:inherit;text-decoration:none"><h3>${p.name}</h3></a>
  <p class="price" data-base-price="${unitPrice}" data-cantidad="${cantidadNum ?? ''}" data-codigo="${p.codigo || ''}">$${formatMoney(totalPerBox)} <span style="font-size:0.7rem;color:#666;">/ caja</span></p>
      </div>
      <div class="product-actions" style="display:flex;gap:8px;align-items:center;">
        <label for="${qtyInputId}" class="qty-label" style="font-size:0.9rem;">Cantidad</label>
        <input id="${qtyInputId}" type="number" class="qty-input" min="1" step="1" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Cantidad" style="width:64px;padding:4px;" data-dynamic-price="1">
        <button class="add-to-cart" data-id="${p.id}";">Agregar</button>
      </div>
    </article>
  `;
}

// Listener helper para ser llamado tras insertar en el DOM (desde product list renderer)
export function attachDynamicPriceBehavior(rootEl) {
  if (!rootEl) return;
  const qtyInput = rootEl.querySelector('.qty-input[data-dynamic-price]');
  const priceEl = rootEl.querySelector('.price[data-codigo]');
  if (!qtyInput || !priceEl) return;
  const codigo = priceEl.getAttribute('data-codigo');
  if (!codigo) return;

  let controller = null;
  const BOX_SIZE = 1000; // unidades por caja
  const fmt = (n) => new Intl.NumberFormat('es-CO').format(Math.round(n));

  // Bloquear decimales y notación científica
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
    // precioUnitario viene por unidad; convertir a precio por caja
    let unitario = Number(data?.precioUnitario);
    if (!Number.isFinite(unitario) || unitario <= 0) {
      // derivar de precio total del escalón si falta
      const totalEscalon = Number(data?.precio);
      const escalon = Number(data?.escalonUsado);
      if (Number.isFinite(totalEscalon) && Number.isFinite(escalon) && escalon > 0) {
        // precio por caja = (total escalón / escalón unidades) * BOX_SIZE
        unitario = (totalEscalon / escalon);
      } else {
        unitario = Number(fallbackBase) / BOX_SIZE;
      }
    }
    const precioCaja = unitario * BOX_SIZE;
  priceEl.textContent = '$' + fmt(precioCaja) + ' / caja';
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
        signal: controller.signal,
        cache: 'no-store'
      });
      const base = priceEl.getAttribute('data-base-price') || '0';
      if (!r.ok) {
        try { await r.json(); } catch {}
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

  // Recalcular con debounce al cambiar la cantidad (solo enteros)
  qtyInput.addEventListener('input', () => {
    sanitizeToInteger();
    clearTimeout(qtyInput._t);
    qtyInput._t = setTimeout(recalc, 160);
  });

  // Cálculo inicial
  recalc();
}