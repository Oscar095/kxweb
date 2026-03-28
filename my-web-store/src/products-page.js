import { renderHeader } from './components/header.js?v=24.0';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';
import { applyOutOfStockToCard } from './components/product-item.js';
async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  // Load products and categories
  const [res, resCats] = await Promise.all([
    fetch('/api/products'),
    fetch('/api/categories')
  ]);
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
    if (String(p.category_name || '').toLowerCase() === catNameLower) return true;
    const matchedCat = findCategory(cQuery);
    if (matchedCat && String(p.category) === String(matchedCat.id)) return true;
    return false;
  };
  const mount = document.getElementById('products');
  const countBadge = document.getElementById('product-count-badge');

  // Helper to update product count badge
  function updateProductCount(count) {
    if (countBadge) {
      countBadge.textContent = `${count} ${count === 1 ? 'producto' : 'productos'}`;
    }
  }

  // ── Inventory cache for availability filter ──
  if (!window._inventoryCache) window._inventoryCache = new Map();
  const inventoryCache = window._inventoryCache;

  // Promise global que se resuelve cuando bulk-inventory termina.
  // product-item.js la usa para no asumir 'Agotado' antes de tiempo.
  if (!window._inventoryReady) {
    let _resolveInv;
    window._inventoryReady = new Promise(r => { _resolveInv = r; });
    window._resolveInventoryReady = _resolveInv;
  }

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
      const data = await r.json().catch(() => ({}));
      for (const { id, sku } of skuMap) {
        const inv = data[sku];
        const isOk = (inv && inv.estado === 'En Existencia');
        if (inv && !isOk) {
          inventoryCache.set(id, 'no-disponible');
        } else {
          // En caso de SKU no encontrado, asumimos disponible
          inventoryCache.set(id, 'disponible');
        }
      }
      return;
    } catch (e) {
      console.warn('Bulk inventory failed, falling back to individual checks', e);
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

  // ── Filter & sort states ──
  let currentFilter = 'all';
  let currentSort = 'default';

  function applyFilterSort(list) {
    let result = [...list];

    if (currentFilter !== 'all' && inventoryCache.size > 0) {
      result = result.filter(p => inventoryCache.get(p.id) === currentFilter);
    }

    if (currentSort === 'asc' || currentSort === 'desc') {
      const getBoxPrice = (p) => {
        const up = Number(p.price_unit || p.precio_unitario || 0);
        const cant = Number(p.cantidad || p.Cantidad || 1000);
        return up * cant * 1.19;
      };
      result.sort((a, b) => {
        const priceA = getBoxPrice(a);
        const priceB = getBoxPrice(b);
        return currentSort === 'asc' ? priceA - priceB : priceB - priceA;
      });
    }

    return result;
  }

  // Custom Dropdown Helper
  function setupCustomDropdown(dropdownId, onSelect) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const button = dropdown.querySelector('.filter-control-wrap');
    const label = dropdown.querySelector('.dropdown-selected-label');
    const list = dropdown.querySelector('.dropdown-list');
    const items = list.querySelectorAll('li');

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other dropdowns
      document.querySelectorAll('.custom-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('is-open');
      });
      dropdown.classList.toggle('is-open');
    });

    items.forEach(item => {
      item.addEventListener('click', () => {
        const val = item.dataset.value;
        const text = item.textContent;

        // Update UI
        label.textContent = text;
        items.forEach(i => i.classList.remove('is-selected'));
        item.classList.add('is-selected');

        dropdown.classList.remove('is-open');
        onSelect(val);
      });
    });
  }

  // Initialize dropdowns
  setupCustomDropdown('filter-dropdown', (val) => {
    currentFilter = val;
    applyCategoryFilter(currentCat);
  });
  setupCustomDropdown('sort-dropdown', (val) => {
    currentSort = val;
    applyCategoryFilter(currentCat);
  });

  // Global click to close dropdowns
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('is-open'));
  });

  // Initial render
  updateProductCount(products.length);
  renderProducts(products, mount);

  // Render original V2 category list
  const catContainer = document.getElementById('cat-btn-group');

  if (catContainer) {
    catContainer.innerHTML = '';

    // Todos button (ALWAYS rendered first)
    const btnAll = document.createElement('button');
    btnAll.className = 'v2-cat-btn active';
    btnAll.dataset.cat = 'all';
    btnAll.innerHTML = `
      <span>Todos</span>
      <span class="v2-cat-count">${products.length}</span>
    `;
    catContainer.appendChild(btnAll);

    // Other categories
    if (categories && categories.length > 0) {
      for (const c of categories) {
        const btn = document.createElement('button');
        btn.className = 'v2-cat-btn';
        const catName = c.nombre || c.descripcion || 'Sin Nombre';
        btn.dataset.cat = catName;

        const count = products.filter(p => window.pMatcher(p, catName)).length;
        if (count === 0 && categories.length > 5) continue;

        btn.innerHTML = `
          <span>${catName}</span>
          <span class="v2-cat-count">${count}</span>
        `;
        catContainer.appendChild(btn);
      }
    } else {
      console.warn('No active categories found or API failed.');
    }

    catContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.v2-cat-btn');
      if (!btn) return;
      applyCategoryFilter(btn.dataset.cat);
    });
  }

  // Parse URL parameter
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get('cat') || 'all';

  // Toggle categories on mobile (accordion style)
  const mobileCatToggle = document.getElementById('mobile-cat-toggle');
  const sidebar = document.getElementById('category-sidebar');

  if (mobileCatToggle && sidebar) {
    mobileCatToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // BUG FIX: Prevent immediate close by document listener
      const isExpanded = sidebar.classList.toggle('is-expanded');
      mobileCatToggle.classList.toggle('is-open', isExpanded);
      console.log('Mobile category toggled. Expanded:', isExpanded);
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('is-expanded') && !sidebar.contains(e.target) && !mobileCatToggle.contains(e.target)) {
        sidebar.classList.remove('is-expanded');
        mobileCatToggle.classList.remove('is-open');
      }
    });
  }

  // Create a function to filter and update the UI
  const applyCategoryFilter = (cat) => {
    currentCat = cat;
    // Close sidebar on mobile
    if (sidebar) sidebar.classList.remove('is-expanded');

    // Auto-scroll to top of product section on change (unless initial load)
    const productsSection = document.getElementById('products-page-title') || document.getElementById('products');
    if (productsSection && window.pageYOffset > 500) {
      const offset = 140; // Adjust for sticky filters/toggle
      const top = productsSection.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }

    const titleEl = document.getElementById('products-page-title') || document.querySelector('h1');
    const descEl = document.getElementById('current-category-desc');

    document.querySelectorAll('.v2-cat-btn').forEach(btn => {
      const isActive = btn.dataset.cat === cat;
      btn.classList.toggle('active', isActive);
    });

    if (cat === 'all') {
      if (titleEl) titleEl.textContent = 'Catálogo Completo';
      if (descEl) descEl.style.display = 'none';
      const sorted = applyFilterSort(products);
      updateProductCount(sorted.length);
      renderProducts(sorted, mount);
    } else {
      if (titleEl) titleEl.textContent = cat;
      const foundCat = categories.find(c => String(c.nombre) === String(cat));

      if (descEl) {
        if (foundCat && foundCat.descripcion) {
          descEl.textContent = foundCat.descripcion;
          descEl.style.display = 'block';
        } else {
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
      updateProductCount(filtered.length);
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

  let currentCat = initialCat;
  let currentSearch = '';

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
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  };

  // Delegado: manejar clicks "Agregar"
  mount.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-to-cart');
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
      showToast('Agregado Exitosamente');
      setTimeout(() => btn.classList.remove('added'), 350);
    };

    const setBtnLoading = (loading) => {
      btn.disabled = loading;
      btn.textContent = loading ? '...' : 'Agregar';
    };

    if (!sku) {
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
      showToast('Producto Agotado', 'error');
    } finally {
      setBtnLoading(false);
    }
  });

  // Delegado: navegación de imágenes (prev/next)
  mount.addEventListener('click', (e) => {
    const prev = e.target.closest('.v2-img-nav.prev');
    const next = e.target.closest('.v2-img-nav.next');
    const nav = prev || next;
    if (!nav || !mount.contains(nav)) return;
    e.preventDefault();
    e.stopPropagation();
    const card = nav.closest('.v2-card');
    const id = Number(card?.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const imgs = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
    const wrap = card.querySelector('.v2-card-img-wrap');
    const imgEl = card.querySelector('.product-img');
    let idx = Number(wrap?.dataset.index || 0);
    if (prev) idx = (idx - 1 + imgs.length) % imgs.length;
    if (next) idx = (idx + 1) % imgs.length;
    wrap.dataset.index = String(idx);
    if (imgEl) imgEl.src = imgs[idx] || '/images/placeholder.svg';
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

  mount.addEventListener('mouseover', (e) => {
    const wrap = e.target.closest('.v2-card-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    showLens(wrap);
  });

  mount.addEventListener('mouseout', (e) => {
    const wrap = e.target.closest('.v2-card-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    if (wrap.contains(e.relatedTarget)) return;
    hideLens(wrap);
  });

  mount.addEventListener('mousemove', (e) => {
    const wrap = e.target.closest('.v2-card-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    moveLens(wrap, e.clientX, e.clientY);
  });

  mount.addEventListener('touchstart', (e) => {
    if (window.innerWidth <= 900) return; // Skip lens on mobile — let card onclick work
    if (e.target.closest('button') || e.target.closest('a')) return;
    const touch = e.touches[0];
    const wrap = e.target.closest('.v2-card-img-wrap');
    if (!wrap || !mount.contains(wrap) || !touch) return;
    e.preventDefault();
    showLens(wrap);
    moveLens(wrap, touch.clientX, touch.clientY);
  }, { passive: false });

  mount.addEventListener('touchmove', (e) => {
    if (window.innerWidth <= 900) return; // Skip lens on mobile
    if (e.target.closest('button') || e.target.closest('a')) return;
    const touch = e.touches[0];
    const wrap = e.target.closest('.v2-card-img-wrap');
    if (!wrap || !mount.contains(wrap) || !touch) return;
    e.preventDefault();
    moveLens(wrap, touch.clientX, touch.clientY);
  }, { passive: false });

  mount.addEventListener('touchend', (e) => {
    if (window.innerWidth <= 900) return; // Skip lens on mobile
    const wrap = e.target.closest('.v2-card-img-wrap');
    if (!wrap || !mount.contains(wrap)) return;
    hideLens(wrap);
  });

  // Segmented control clicks
  if (segmentedControl) {
    segmentedControl.addEventListener('click', (e) => {
      const pill = e.target.closest('.segment-pill');
      if (!pill || !segmentedControl.contains(pill)) return;

      const cat = pill.dataset.cat;
      currentCat = cat;
      currentSearch = '';

      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';

      applyCategoryFilter(cat);

      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + (cat === 'all' ? '' : '?cat=' + encodeURIComponent(cat));
      window.history.pushState({ path: newurl }, '', newurl);
    });

    // Handle window resize to keep indicator in place
    window.addEventListener('resize', () => {
      const active = segmentedControl.querySelector('.segment-pill.active');
      if (active) updateIndicator(active);
    });
  }

  // Search filter
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

  // Fetch inventory (non-blocking)
  checkAllInventory().then(() => {
    console.log('[checkAllInventory] Finished bulk check');
    if (currentFilter !== 'all') reapply();
    window.dispatchEvent(new CustomEvent('content-loaded'));
  });
  
  // Escuchar actualizaciones individuales de stock para refrescar el filtro
  window.addEventListener('inventory-updated', () => {
    if (currentFilter !== 'all') {
      reapply();
    }
  });

  window.dispatchEvent(new CustomEvent('content-loaded'));
}

init();
