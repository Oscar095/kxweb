import { renderHeader } from './components/header.js?v=2';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';
async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  // Load products and categories
  const [res, resCats] = await Promise.all([
    fetch('/api/products'),
    fetch('/api/categories')
  ]);
  // NOTE: removed cache:'no-store' — browser can cache briefly
  const allProducts = await res.json();
  const products = allProducts.filter(p => p.habilitado !== false && p.habilitado !== 0);
  const categories = resCats.ok ? await resCats.json() : [];

  // Helper: find DB category by nombre or descripcion (case-insensitive)
  const findCategory = (name) => {
    const q = String(name || '').trim().toLowerCase();
    return categories.find(c =>
      String(c.nombre || '').toLowerCase() === q ||
      String(c.descripcion || '').toLowerCase() === q
    ) || null;
  };

  // Reusable matcher: filters products by DB category ID
  window.pMatcher = (p, cQuery) => {
    const catNameLower = String(cQuery || '').trim().toLowerCase();
    // Exact match by category_name (c.descripcion from DB)
    if (String(p.category_name || '').toLowerCase() === catNameLower) return true;
    // Match via DB category ID
    const matchedCat = findCategory(cQuery);
    if (matchedCat && String(p.category) === String(matchedCat.id)) return true;
    return false;
  };
  const mount = document.getElementById('products');

  // ── Inventory cache for availability filter ──
  // Shared globally so attachDynamicPriceBehavior can reuse results
  if (!window._inventoryCache) window._inventoryCache = new Map();
  const inventoryCache = window._inventoryCache;

  async function checkAllInventory() {
    const skuMap = []; // { id, sku }
    for (const p of products) {
      const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '').toString().trim();
      if (inventoryCache.has(p.id)) continue;
      if (!sku) { inventoryCache.set(p.id, 'disponible'); continue; }
      skuMap.push({ id: p.id, sku });
    }
    if (skuMap.length === 0) return;

    // Usar endpoint bulk en vez de N llamadas individuales
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
          if (inv && inv.estado === 'En Existencia') {
            inventoryCache.set(id, 'disponible');
          } else {
            inventoryCache.set(id, 'no-disponible');
          }
        }
        return;
      }
    } catch (e) {
      console.warn('Bulk inventory failed, falling back to individual checks', e);
    }

    // Fallback: llamadas individuales si el bulk falla
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

  // ── Filter & sort helpers ──
  const filterSelect = document.getElementById('filter-disponible');
  const sortSelect = document.getElementById('sort-precio');

  function applyFilterSort(list) {
    let result = [...list];

    // Filter by availability
    const filterVal = filterSelect?.value || 'all';
    if (filterVal !== 'all' && inventoryCache.size > 0) {
      result = result.filter(p => inventoryCache.get(p.id) === filterVal);
    }

    // Sort by price
    const sortVal = sortSelect?.value || 'default';
    if (sortVal === 'asc') {
      result.sort((a, b) => (a.price_unit || 0) - (b.price_unit || 0));
    } else if (sortVal === 'desc') {
      result.sort((a, b) => (b.price_unit || 0) - (a.price_unit || 0));
    }

    return result;
  }

  renderProducts(products, mount);

  // Render dynamic category buttons
  const catWrap = document.getElementById('cat-btn-group');
  if (catWrap) {
    const existing = Array.from(catWrap.querySelectorAll('.cat-btn'));
    // keep the first 'Todos' and add others dynamically
    const toKeep = existing.find(b => b.dataset.cat === 'all');
    catWrap.innerHTML = '';
    if (toKeep) catWrap.appendChild(toKeep);
    for (const c of categories) {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      const catName = c.nombre || c.descripcion || 'Sin Nombre';
      btn.dataset.cat = catName;
      btn.textContent = catName;
      catWrap.appendChild(btn);
    }
  }

  // Parse URL parameter
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get('cat') || 'all';

  // Create a function to filter and update the UI
  const applyCategoryFilter = (cat) => {
    const titleEl = document.getElementById('products-page-title') || document.querySelector('h1');
    const descEl = document.getElementById('current-category-desc');

    // Update active button state
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });

    if (cat === 'all') {
      if (titleEl) titleEl.textContent = 'Catálogo Completo';
      if (descEl) descEl.style.display = 'none';
      const sorted = applyFilterSort(products);
      renderProducts(sorted, mount);
    } else {
      if (titleEl) titleEl.textContent = cat;
      const foundCat = categories.find(c => String(c.nombre) === String(cat));

      if (descEl) {
        if (foundCat && foundCat.descripcion) {
          descEl.textContent = foundCat.descripcion;
          descEl.style.display = 'block';
        } else {
          // Dynamic text generation
          const catProducts = products.filter(p => window.pMatcher(p, cat));
          if (catProducts.length > 0) {
            const names = Array.from(new Set(catProducts.map(p => p.name).filter(Boolean))).slice(0, 4);
            const last = names.pop();
            const listStr = names.length > 0 ? names.join(', ') + ' y ' + last : last || '';
            descEl.textContent = `Explora nuestra variedad de ${cat}, incluyendo: ${listStr} y mucho más.`;
            descEl.style.display = 'block';
          } else {
            descEl.style.display = 'none';
          }
        }
      }
      const filtered = applyFilterSort(products.filter(p => window.pMatcher(p, cat)));
      if (filtered.length === 0) {
        mount.innerHTML = `
          <div style="text-align:center; padding: 60px 24px; width: 100%; grid-column: 1 / -1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; color: var(--muted); margin-bottom: 16px; margin: 0 auto; display: block;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">Sin disponibilidad</h3>
            <p style="color: var(--muted); font-size: 1.1rem;">No hay productos para los filtros seleccionados.</p>
          </div>
        `;
      } else {
        renderProducts(filtered, mount);
      }
    }
  };

  // Track active category and search query to restore on filter/sort change
  let currentCat = initialCat;
  let currentSearch = '';

  // Apply initial filter
  applyCategoryFilter(initialCat);

  // Toast notification system
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

    // Trigger animation
    setTimeout(() => toast.classList.add('visible'), 10);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  };

  // Delegado: manejar clicks "Agregar" y leer cantidad del input
  mount.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn || !mount.contains(btn)) return;
    const id = Number(btn.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const card = btn.closest('.product');
    const qty = Math.max(1, Number(card?.querySelector('.qty-input')?.value) || 1);

    const sku = (product.codigo_siesa || product.sku || product.SKU || product.item_ext || '').toString().trim();

    const onAddSuccess = () => {
      cartService.add(product, qty);
      btn.classList.add('added');
      showToast('Agregado Exitosamente');
      setTimeout(() => btn.classList.remove('added'), 350);
    };

    const setBtnLoading = (loading) => {
      btn.disabled = loading;
      btn.textContent = loading ? '...' : 'Agregar';
    };

    if (!sku) {
      // No sku means we can't check inventory, just allow it
      onAddSuccess();
      return;
    }

    try {
      setBtnLoading(true);
      const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`);
      if (!r.ok) throw new Error('inventario_error');
      const data = await r.json();
      const estado = (data && (data.estado || data.status || '')).toString();
      const inventarioExistencia = Number(data?.inventario);

      if (estado !== 'En Existencia') {
        showToast('Producto Agotado', 'error');
        return;
      }

      // Validate units
      const rawUnits = product.cantidad ?? product.Cantidad ?? 1000;
      const unitsPerBox = (Number.isFinite(Number(rawUnits)) && Number(rawUnits) > 0) ? Number(rawUnits) : 1000;
      const requestedUnits = qty * unitsPerBox;

      if (Number.isFinite(inventarioExistencia) && requestedUnits > inventarioExistencia) {
        showToast('Producto Agotado', 'error');
        return;
      }

      onAddSuccess();
    } catch (err) {
      console.error('Error checando inventario', err);
      // Fallback if network issue
      showToast('Producto Agotado', 'error');
    } finally {
      setBtnLoading(false);
    }
  });

  // Delegado: navegación de imágenes (prev/next)
  mount.addEventListener('click', (e) => {
    const prev = e.target.closest('.img-prev');
    const next = e.target.closest('.img-next');
    const nav = prev || next;
    if (!nav || !mount.contains(nav)) return;
    e.preventDefault();
    e.stopPropagation();
    const card = nav.closest('.product');
    const id = Number(card?.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const imgs = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
    const wrap = card.querySelector('.product-img-wrap');
    const imgEl = card.querySelector('.product-img');
    let idx = Number(wrap?.dataset.index || 0);
    if (prev) idx = (idx - 1 + imgs.length) % imgs.length;
    if (next) idx = (idx + 1) % imgs.length;
    wrap.dataset.index = String(idx);
    if (imgEl) imgEl.src = imgs[idx] || '/images/placeholder.svg';
    // Sync lens background with current image if visible
    const lens = wrap?.querySelector('.img-lens');
    if (lens && imgEl) {
      lens.style.backgroundImage = `url("${imgEl.src}")`;
    }
  });

  // --- LENS MAGNIFIER EFFECT ---
  const showLens = (wrap) => {
    const lens = wrap.querySelector('.img-lens');
    const img = wrap.querySelector('.product-img');
    if (!lens || !img) return;
    lens.style.display = 'block';
    lens.style.backgroundImage = `url("${img.src}")`;
  };

  const hideLens = (wrap) => {
    const lens = wrap.querySelector('.img-lens');
    if (!lens) return;
    lens.style.display = 'none';
  };

  const moveLens = (wrap, clientX, clientY) => {
    const lens = wrap.querySelector('.img-lens');
    const img = wrap.querySelector('.product-img');
    if (!lens || !img) return;
    const wrapRect = wrap.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const lw = lens.offsetWidth;
    const lh = lens.offsetHeight;

    let left = clientX - wrapRect.left - lw / 2;
    let top = clientY - wrapRect.top - lh / 2;
    // clamp within wrapper bounds
    left = Math.max(0, Math.min(left, wrapRect.width - lw));
    top = Math.max(0, Math.min(top, wrapRect.height - lh));
    lens.style.left = left + 'px';
    lens.style.top = top + 'px';

    // background position based on position relative to the image itself
    let relX = clientX - imgRect.left;
    let relY = clientY - imgRect.top;
    relX = Math.max(0, Math.min(relX, imgRect.width));
    relY = Math.max(0, Math.min(relY, imgRect.height));
    const pctX = (relX / imgRect.width) * 100;
    const pctY = (relY / imgRect.height) * 100;
    lens.style.backgroundPosition = pctX + '% ' + pctY + '%';
  };

  // Mouse over to show lens (use mouseover/mouseout because mouseenter/leave don't bubble)
  mount.addEventListener('mouseover', (e) => {
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    showLens(wrap);
  });

  mount.addEventListener('mouseout', (e) => {
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    // if moving within the same wrapper, ignore
    if (wrap.contains(e.relatedTarget)) return;
    hideLens(wrap);
  });

  mount.addEventListener('mousemove', (e) => {
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    moveLens(wrap, e.clientX, e.clientY);
  });

  // Touch support
  mount.addEventListener('touchstart', (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    const touch = e.touches[0];
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap) || !touch) return;
    e.preventDefault();
    showLens(wrap);
    moveLens(wrap, touch.clientX, touch.clientY);
  }, { passive: false });

  mount.addEventListener('touchmove', (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    const touch = e.touches[0];
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap) || !touch) return;
    e.preventDefault();
    moveLens(wrap, touch.clientX, touch.clientY);
  }, { passive: false });

  mount.addEventListener('touchend', (e) => {
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    hideLens(wrap);
  });

  // category buttons (delegate to container for dynamic elements)
  if (catWrap) {
    catWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-btn');
      if (!btn || !catWrap.contains(btn)) return;

      const cat = btn.dataset.cat;
      currentCat = cat;
      currentSearch = '';
      
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';

      applyCategoryFilter(cat);

      // Add small feedback class
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 350);

      // Update URL without reloading
      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + (cat === 'all' ? '' : '?cat=' + encodeURIComponent(cat));
      window.history.pushState({ path: newurl }, '', newurl);
    });
  }

  // Search filter (global event dispatched from header)
  window.addEventListener('search', (e) => {
    const q = (e.detail || '').trim().toLowerCase();
    const titleEl = document.getElementById('products-page-title') || document.querySelector('h1');
    const descEl = document.getElementById('current-category-desc');

    currentSearch = q;
    if (!q) {
      applyCategoryFilter(currentCat);
      return;
    }

    const searchMatches = products.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();
      const pCat = String(p.category_name || p.category_nombre || p.category_desc || p.category || '').toLowerCase();
      return pName.includes(q) || pDesc.includes(q) || pCat.includes(q);
    });
    const filtered = applyFilterSort(searchMatches);

    if (titleEl) titleEl.textContent = `Resultados: "${e.detail}"`;
    if (descEl) descEl.style.display = 'none';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));

    if (filtered.length === 0) {
      mount.innerHTML = `
        <div style="text-align:center; padding: 60px 24px; width: 100%; grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; color: var(--muted); margin-bottom: 16px; margin: 0 auto; display: block;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">Sin resultados</h3>
          <p style="color: var(--muted); font-size: 1.1rem;">No se encontraron productos para "${e.detail}".</p>
        </div>
      `;
    } else {
      renderProducts(filtered, mount);
    }
  });

  // Filter & sort change listeners
  const reapply = () => {
    if (currentSearch) {
      window.dispatchEvent(new CustomEvent('search', { detail: currentSearch }));
    } else {
      applyCategoryFilter(currentCat);
    }
  };
  sortSelect?.addEventListener('change', reapply);
  filterSelect?.addEventListener('change', reapply);

  // Batch-check inventory for availability filter
  checkAllInventory().then(() => {
    // Reapply current view if availability filter is active
    if (filterSelect?.value !== 'all') reapply();
  });
}

init();
