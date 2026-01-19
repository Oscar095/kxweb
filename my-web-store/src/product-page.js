import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';
import { formatMoney } from './utils/format.js';

function getIdFromQuery(){
  const u = new URL(location.href);
  return Number(u.searchParams.get('id'));
}

async function loadProduct(id){
  // Intenta endpoint de detalle
  try {
    const r = await fetch(`/api/products/${id}`, { cache: 'no-store' });
    if (r.ok) return r.json();
  } catch (_) { /* fallback abajo */ }
  // Fallback: carga listado y busca por id (útil si el server no se reinició aún)
  const list = await fetch('/api/products', { cache: 'no-store' });
  if (!list.ok) throw new Error('No se pudo cargar el producto');
  const products = await list.json();
  const p = products.find(x => Number(x.id) === Number(id));
  if (!p) throw new Error('Producto no encontrado');
  return p;
}

function renderProduct(p){
  const main = document.getElementById('pd-main');
  const wrap = main.closest('.product-img-wrap');
  const lens = wrap?.querySelector('.img-lens');
  const prevBtn = wrap?.querySelector('.img-prev');
  const nextBtn = wrap?.querySelector('.img-next');
  const thumbs = document.getElementById('pd-thumbs');
  const name = document.getElementById('pd-name');
  const cat = document.getElementById('pd-category');
  const price = document.getElementById('pd-price');
  const stock = document.getElementById('pd-stock');
  const desc = document.getElementById('pd-desc');
  const addBtn = document.getElementById('pd-add');
  const qtyInput = document.getElementById('pd-qty');

  let upstreamEstado = null; // 'En Existencia' | 'Agotado' | null
  let inventarioExistencia = null; // number (unidades)

  const setCartEnabled = (enabled, reason) => {
    if (addBtn) {
      addBtn.disabled = !enabled;
      addBtn.title = enabled ? '' : (reason || 'No disponible');
    }
  };

  const getUnitsPerBox = () => {
    const raw = p.cantidad ?? p.Cantidad ?? 1000;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 1000;
  };

  const getRequestedBoxes = () => {
    const n = Number(qtyInput?.value);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.floor(n);
  };

  const exceedsInventory = () => {
    if (!Number.isFinite(inventarioExistencia)) return false;
    const boxes = getRequestedBoxes();
    const unitsPerBox = getUnitsPerBox();
    const requestedUnits = boxes * unitsPerBox;
    return requestedUnits > inventarioExistencia;
  };

  const renderStockAndCartState = () => {
    if (!stock) return;

    // Sin inventario consultado aún
    if (upstreamEstado == null) return;

    // Upstream dice agotado
    if (upstreamEstado !== 'En Existencia') {
      stock.textContent = 'Agotado';
      stock.className = 'pd-stock pd-stock--out';
      setCartEnabled(false, 'Agotado');
      return;
    }

    // Hay inventario: validar cantidad solicitada
    if (exceedsInventory()) {
      stock.textContent = 'Agotado';
      stock.className = 'pd-stock pd-stock--out';
      setCartEnabled(false, 'Agotado');
      return;
    }

    stock.textContent = 'En Existencia';
    stock.className = 'pd-stock pd-stock--ok';
    setCartEnabled(true);
  };

  name.textContent = p.name || '';
  // Mostrar el nombre de la categoría si está disponible
  let categoriaNombre = '';
  if (typeof p.category === 'object' && p.category !== null) {
    categoriaNombre = p.category.name || p.category.nombre || p.category.id || '';
  } else {
    categoriaNombre = p.category_name || p.category_nombre || p.category || '';
  }
  cat.textContent = categoriaNombre ? `Categoría: ${categoriaNombre}` : '';
  // Mostrar precio por caja = precio unitario * cantidad (si está disponible)
  const cantidadNum = (p.cantidad ?? p.Cantidad) ? Number(p.cantidad ?? p.Cantidad) : null;
  const unitarioRaw = p.price_unit ?? p.precio_unitario ?? null;
  const unitario = unitarioRaw != null ? Number(unitarioRaw) : (cantidadNum && p.price ? Number(p.price) / cantidadNum : null);
  const precioCajaInicial = (Number.isFinite(unitario) && cantidadNum) ? (unitario * cantidadNum) : Number(p.price || 0);
  price.textContent = '$' + formatMoney(precioCajaInicial) + ' / caja';
  price.dataset.codigo = p.codigo || '';
  desc.textContent = p.description || '';

  // Inventario por SKU (codigo_siesa)
  if (stock) {
    const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || '').toString().trim();
    if (!sku) {
      stock.textContent = '';
      stock.className = 'pd-stock';
      upstreamEstado = null;
      inventarioExistencia = null;
      setCartEnabled(true);
    } else {
      stock.textContent = 'Consultando inventario...';
      stock.className = 'pd-stock pd-stock--loading';
      upstreamEstado = null;
      inventarioExistencia = null;
      setCartEnabled(false, 'Consultando inventario...');
      fetch(`/api/inventario/${encodeURIComponent(sku)}`, { cache: 'no-store' })
        .then(async (r) => {
          if (!r.ok) throw new Error('inventario_error');
          return r.json();
        })
        .then((data) => {
          const estado = (data && (data.estado || data.status || '')).toString();
          if (estado === 'En Existencia') {
            upstreamEstado = 'En Existencia';
            inventarioExistencia = Number(data?.inventario);
            renderStockAndCartState();
          } else {
            upstreamEstado = 'Agotado';
            inventarioExistencia = Number(data?.inventario);
            renderStockAndCartState();
          }
        })
        .catch(() => {
          stock.textContent = 'Agotado';
          stock.className = 'pd-stock pd-stock--out';
          upstreamEstado = 'Agotado';
          inventarioExistencia = null;
          setCartEnabled(false, 'Agotado');
        });
    }
  }

  const imgs = Array.isArray(p.images) && p.images.length ? p.images : [p.image || '/images/placeholder.svg'];
  let idx = 0;
  main.src = imgs[idx];
  main.onerror = () => { main.src = '/images/placeholder.svg'; };
  if (lens) lens.style.backgroundImage = `url("${main.src}")`;

  thumbs.innerHTML = imgs.map((src, i) => `<img data-index="${i}" src="${src}" alt="${p.name || ''} ${i+1}" />`).join('');
  thumbs.addEventListener('click', (e)=>{
    const im = e.target.closest('img');
    if (!im || !thumbs.contains(im)) return;
    idx = Number(im.dataset.index || 0);
    main.src = imgs[idx];
    if (lens) lens.style.backgroundImage = `url("${main.src}")`;
  });

  // Prev/Next navigation
  const updateMain = () => {
    main.src = imgs[idx];
    if (lens) lens.style.backgroundImage = `url("${main.src}")`;
  };
  prevBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    idx = (idx - 1 + imgs.length) % imgs.length;
    updateMain();
  });
  nextBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    idx = (idx + 1) % imgs.length;
    updateMain();
  });

  async function recalcDetail() {
    const codigo = price.dataset.codigo;
    if (!codigo) return; // sin código no recalcula
    const mult = Number(qtyInput.value);
    if (!Number.isFinite(mult) || mult <= 0) return;
    try {
      price.classList.add('loading');
      const r = await fetch(`/api/precio?codigo=${encodeURIComponent(codigo)}&n=${encodeURIComponent(mult)}`, { cache: 'no-store' });
      if (!r.ok) {
        try { const e = await r.json(); console.warn('Detalle precio dinámico error', e); } catch {}
        price.classList.remove('loading');
        return;
      }
      const data = await r.json();
      const BOX_SIZE = 1000;
      let unitario = Number(data.precioUnitario);
      if (!Number.isFinite(unitario) || unitario <= 0) {
        const totalEscalon = Number(data.precio);
        const escalon = Number(data.escalonUsado);
        if (Number.isFinite(totalEscalon) && Number.isFinite(escalon) && escalon > 0) {
          unitario = totalEscalon / escalon;
        }
      }
      if (!Number.isFinite(unitario) || unitario <= 0) {
        // fallback: usar p.price / BOX_SIZE
        unitario = Number(p.price) / BOX_SIZE;
      }
      const precioCaja = unitario * BOX_SIZE;
      price.textContent = '$' + formatMoney(precioCaja) + ' / caja';
      price.classList.remove('loading');
    } catch { price.classList.remove('loading'); }
  }
  qtyInput?.addEventListener('input', () => { clearTimeout(qtyInput._t); qtyInput._t = setTimeout(recalcDetail, 180); });
  qtyInput?.addEventListener('input', () => {
    // Revalidar disponibilidad en base a inventario
    // (si el usuario pide más cajas que la existencia en unidades)
    renderStockAndCartState();
  });
  recalcDetail();

  addBtn?.addEventListener('click', () => {
    // Chequeo final antes de agregar
    if (upstreamEstado !== 'En Existencia') return;
    if (exceedsInventory()) {
      renderStockAndCartState();
      return;
    }
    const qty = Math.max(1, Number(document.getElementById('pd-qty').value) || 1);
    cartService.add(p, qty);
    window.dispatchEvent(new Event('toggle-cart'));
  });
}

async function init(){
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));
  const id = getIdFromQuery();
  if (!Number.isFinite(id)) {
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">ID inválido</div>';
    return;
  }
  try {
    const p = await loadProduct(id);
    renderProduct(p);
    // Setup lens effects on detail page
    const wrap = document.querySelector('.pd-gallery .product-img-wrap');
    const main = document.getElementById('pd-main');
    const lens = wrap?.querySelector('.img-lens');
    if (wrap && main && lens) {
      const showLens = () => { lens.style.display = 'block'; lens.style.backgroundImage = `url("${main.src}")`; };
      const hideLens = () => { lens.style.display = 'none'; };
      const moveLens = (clientX, clientY) => {
        const wrapRect = wrap.getBoundingClientRect();
        const imgRect = main.getBoundingClientRect();
        const lw = lens.offsetWidth;
        const lh = lens.offsetHeight;
        let left = clientX - wrapRect.left - lw / 2;
        let top = clientY - wrapRect.top - lh / 2;
        left = Math.max(0, Math.min(left, wrapRect.width - lw));
        top = Math.max(0, Math.min(top, wrapRect.height - lh));
        lens.style.left = left + 'px';
        lens.style.top = top + 'px';
        let relX = clientX - imgRect.left;
        let relY = clientY - imgRect.top;
        relX = Math.max(0, Math.min(relX, imgRect.width));
        relY = Math.max(0, Math.min(relY, imgRect.height));
        const pctX = (relX / imgRect.width) * 100;
        const pctY = (relY / imgRect.height) * 100;
        lens.style.backgroundPosition = pctX + '% ' + pctY + '%';
      };

      wrap.addEventListener('mouseover', () => showLens());
      wrap.addEventListener('mouseout', (e) => {
        if (wrap.contains(e.relatedTarget)) return;
        hideLens();
      });
      wrap.addEventListener('mousemove', (e) => moveLens(e.clientX, e.clientY));
      wrap.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        showLens();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchend', () => hideLens());
    }
  } catch (e) {
    console.error(e);
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">Producto no encontrado</div>';
  }
}

init();
