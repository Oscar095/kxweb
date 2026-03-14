import { renderHeader } from './components/header.js';
import { renderProducts, showSkeletons } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  const mount = document.getElementById('v2-products');
  const catList = document.getElementById('v2-cat-list');
  const titleEl = document.getElementById('v2-page-title');
  const countEl = document.getElementById('v2-product-count');
  const filterSelect = document.getElementById('v2-filter');
  const sortSelect = document.getElementById('v2-sort');
  const scrollTopBtn = document.getElementById('v2-scroll-top');

  // ── 1. Show skeletons immediately ──
  showSkeletons(mount, 6);

  // ── 2. Fetch data in parallel ──
  const [res, resCats] = await Promise.all([
    fetch('/api/products'),
    fetch('/api/categories')
  ]);
  const allProducts = await res.json();
  const products = allProducts.filter(p => p.habilitado !== false && p.habilitado !== 0);
  const categories = resCats.ok ? await resCats.json() : [];

  // ── 3. Category matcher ──
  const findCategory = (name) => {
    const q = String(name || '').trim().toLowerCase();
    return categories.find(c =>
      String(c.nombre || '').toLowerCase() === q ||
      String(c.descripcion || '').toLowerCase() === q
    ) || null;
  };

  window.pMatcher = (p, cQuery) => {
    const catNameLower = String(cQuery || '').trim().toLowerCase();
    if (String(p.category_name || '').toLowerCase() === catNameLower) return true;
    const matchedCat = findCategory(cQuery);
    if (matchedCat && String(p.category) === String(matchedCat.id)) return true;
    return false;
  };

  // ── 4. Build category sidebar with counts ──
  const catCounts = new Map();
  catCounts.set('all', products.length);
  for (const p of products) {
    const cn = (p.category_name || '').trim();
    if (cn) catCounts.set(cn, (catCounts.get(cn) || 0) + 1);
  }

  // Update "Todos" count
  const allCountEl = document.getElementById('v2-count-all');
  if (allCountEl) allCountEl.textContent = String(products.length);

  // Add category buttons
  if (catList) {
    for (const c of categories) {
      const catName = c.nombre || c.descripcion || 'Sin Nombre';
      const count = catCounts.get(catName) || 0;
      const btn = document.createElement('button');
      btn.className = 'v2-cat-btn';
      btn.dataset.cat = catName;
      btn.innerHTML = `${catName} <span class="v2-cat-count">${count}</span>`;
      catList.appendChild(btn);
    }
  }

  // ── 5. Inventory cache ──
  if (!window._inventoryCache) window._inventoryCache = new Map();
  const inventoryCache = window._inventoryCache;

  async function checkAllInventory() {
    const skuMap = [];
    for (const p of products) {
      const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '').toString().trim();
      if (inventoryCache.has(p.id)) continue;
      if (!sku) { inventoryCache.set(p.id, 'disponible'); continue; }
      skuMap.push({ id: p.id, sku });
    }
    if (skuMap.length === 0) return;

    try {
      const uniqueSkus = [...new Set(skuMap.map(s => s.sku))];
      const r = await fetch('/api/inventario-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus: uniqueSkus })
      });
      if (r.ok) {
        const data = await r.json();
        for (const { id, sku } of skuMap) {
          const inv = data[sku];
          inventoryCache.set(id, inv && inv.estado === 'En Existencia' ? 'disponible' : 'no-disponible');
        }
        return;
      }
    } catch (e) {
      console.warn('Bulk inventory failed, falling back', e);
    }

    // Fallback individual
    await Promise.all(skuMap.map(async ({ id, sku }) => {
      if (inventoryCache.has(id)) return;
      try {
        const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`);
        if (r.ok) {
          const data = await r.json();
          const estado = (data && (data.estado || data.status || '')).toString();
          inventoryCache.set(id, estado === 'En Existencia' ? 'disponible' : 'no-disponible');
        } else {
          inventoryCache.set(id, 'no-disponible');
        }
      } catch {
        inventoryCache.set(id, 'no-disponible');
      }
    }));
  }

  // ── 6. Filter & sort ──
  function applyFilterSort(list) {
    let result = [...list];
    const filterVal = filterSelect?.value || 'all';
    if (filterVal !== 'all' && inventoryCache.size > 0) {
      result = result.filter(p => inventoryCache.get(p.id) === filterVal);
    }
    const sortVal = sortSelect?.value || 'default';
    if (sortVal === 'asc') result.sort((a, b) => (a.price_unit || 0) - (b.price_unit || 0));
    else if (sortVal === 'desc') result.sort((a, b) => (b.price_unit || 0) - (a.price_unit || 0));
    return result;
  }

  // ── 7. Render products immediately (replaces skeletons) ──
  let currentCat = 'all';
  let currentSearch = '';

  function updateCountLabel(n) {
    if (countEl) countEl.textContent = `${n} producto${n !== 1 ? 's' : ''}`;
  }

  function applyCategoryFilter(cat) {
    // Update active button
    if (catList) {
      catList.querySelectorAll('.v2-cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
      });
    }

    let filtered;
    if (cat === 'all') {
      if (titleEl) titleEl.textContent = 'Catalogo';
      filtered = applyFilterSort(products);
    } else {
      if (titleEl) titleEl.textContent = cat;
      filtered = applyFilterSort(products.filter(p => window.pMatcher(p, cat)));
    }

    updateCountLabel(filtered.length);

    if (filtered.length === 0) {
      mount.innerHTML = `
        <div class="v2-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Sin disponibilidad</h3>
          <p>No hay productos para los filtros seleccionados.</p>
        </div>`;
    } else {
      renderProducts(filtered, mount);
    }
  }

  // Parse initial category from URL
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get('cat') || 'all';
  currentCat = initialCat;
  applyCategoryFilter(initialCat);

  // ── 8. Toast system ──
  const showToast = (msg, type = 'success') => {
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
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  };

  // ── 9. Event delegation: Add to cart ──
  mount.addEventListener('click', async (e) => {
    const btn = e.target.closest('.v2-add-btn');
    if (!btn || !mount.contains(btn)) return;
    const id = Number(btn.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const card = btn.closest('.v2-card');
    const qty = Math.max(1, Number(card?.querySelector('.v2-qty-input')?.value) || 1);
    const sku = (product.codigo_siesa || product.sku || product.SKU || product.item_ext || '').toString().trim();

    const onAddSuccess = () => {
      cartService.add(product, qty);
      btn.classList.add('added');
      btn.textContent = 'Agregado';
      showToast('Agregado Exitosamente');
      setTimeout(() => { btn.classList.remove('added'); btn.textContent = 'Agregar'; }, 600);
    };

    if (!sku) { onAddSuccess(); return; }

    try {
      btn.disabled = true; btn.textContent = '...';
      const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`);
      if (!r.ok) throw new Error('inventario_error');
      const data = await r.json();
      const estado = (data && (data.estado || data.status || '')).toString();
      const inventarioExistencia = Number(data?.inventario);

      if (estado !== 'En Existencia') {
        showToast('Producto Agotado', 'error');
        return;
      }

      const rawUnits = product.cantidad ?? product.Cantidad ?? 1000;
      const unitsPerBox = (Number.isFinite(Number(rawUnits)) && Number(rawUnits) > 0) ? Number(rawUnits) : 1000;
      const requestedUnits = qty * unitsPerBox;

      if (Number.isFinite(inventarioExistencia) && requestedUnits > inventarioExistencia) {
        showToast('Producto Agotado', 'error');
        return;
      }

      onAddSuccess();
    } catch {
      showToast('Producto Agotado', 'error');
    } finally {
      btn.disabled = false;
      if (btn.textContent === '...') btn.textContent = 'Agregar';
    }
  });

  // ── 10. Image navigation ──
  mount.addEventListener('click', (e) => {
    const nav = e.target.closest('.v2-img-nav');
    if (!nav || !mount.contains(nav)) return;
    e.preventDefault();
    e.stopPropagation();
    const card = nav.closest('.v2-card');
    const id = Number(card?.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const imgs = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
    const wrap = card.querySelector('.v2-card-img-wrap');
    const imgEl = wrap?.querySelector('img');
    let idx = Number(wrap?.dataset.index || 0);
    if (nav.classList.contains('prev')) idx = (idx - 1 + imgs.length) % imgs.length;
    else idx = (idx + 1) % imgs.length;
    wrap.dataset.index = String(idx);
    if (imgEl) {
      imgEl.classList.remove('loaded');
      imgEl.src = imgs[idx] || '/images/placeholder.svg';
    }
    // Update dots
    const dots = wrap.querySelectorAll('.v2-img-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  });

  // ── 11. Category button clicks ──
  if (catList) {
    catList.addEventListener('click', (e) => {
      const btn = e.target.closest('.v2-cat-btn');
      if (!btn || !catList.contains(btn)) return;
      const cat = btn.dataset.cat;
      currentCat = cat;
      currentSearch = '';
      applyCategoryFilter(cat);

      // Update URL
      const newurl = window.location.protocol + '//' + window.location.host + window.location.pathname + (cat === 'all' ? '' : '?cat=' + encodeURIComponent(cat));
      window.history.pushState({ path: newurl }, '', newurl);
    });
  }

  // ── 12. Search ──
  window.addEventListener('search', (e) => {
    const q = (e.detail || '').trim().toLowerCase();
    currentSearch = q;
    if (!q) { applyCategoryFilter(currentCat); return; }

    const searchMatches = products.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();
      const pCat = String(p.category_name || p.category_nombre || p.category_desc || p.category || '').toLowerCase();
      return pName.includes(q) || pDesc.includes(q) || pCat.includes(q);
    });
    const filtered = applyFilterSort(searchMatches);

    if (titleEl) titleEl.textContent = `Resultados: "${e.detail}"`;
    updateCountLabel(filtered.length);
    if (catList) catList.querySelectorAll('.v2-cat-btn').forEach(b => b.classList.remove('active'));

    if (filtered.length === 0) {
      mount.innerHTML = `
        <div class="v2-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Sin resultados</h3>
          <p>No se encontraron productos para "${e.detail}".</p>
        </div>`;
    } else {
      renderProducts(filtered, mount);
    }
  });

  // ── 13. Filter & sort change ──
  const reapply = () => {
    if (currentSearch) {
      window.dispatchEvent(new CustomEvent('search', { detail: currentSearch }));
    } else {
      applyCategoryFilter(currentCat);
    }
  };
  sortSelect?.addEventListener('change', reapply);
  filterSelect?.addEventListener('change', reapply);

  // ── 14. Background inventory check ──
  checkAllInventory().then(() => {
    if (filterSelect?.value !== 'all') reapply();
  });

  // ── 15. Scroll-to-top button ──
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 600);
    }, { passive: true });
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── 16. Render footer ──
  import('./components/footer.js').then(m => {
    const footerEl = document.querySelector('.site-footer');
    if (footerEl && m.renderFooter) m.renderFooter(footerEl);
  }).catch(() => {});
}

init();
