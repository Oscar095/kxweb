import { renderHeader } from './components/header.js?v=999';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from '../services/cart-service.js';
import { applyOutOfStockToCard } from './components/product-item.js';
import { withEnglishCopyList } from './utils/product-i18n.js';

// Category filter values must stay in Spanish — they are matched against the
// DB's category_name column by pMatcher below. This map is only the LAST-RESORT
// fallback label — the real source of truth is category_translations via
// GET /api/categories (nombre_en), looked up via findCategory() in init().
const EN_CATEGORY_LABELS = {
  'Bebidas calientes': 'Hot Cups',
  'Bebidas Frías': 'Cold Cups',
  'Contenedores': 'Food Tubs',
  'Empaques': 'Packaging',
  'Platos': 'Plates',
  'Porta vasos': 'Cup Holders',
  'Tapas para Contenedores': 'Food Tub Lids',
  'Tapas para Vasos': 'Cup Lids',
  'Accesorios': 'Takeout Essentials',
};

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  // Load products and categories
  const [res, resCats] = await Promise.all([
    fetch('/api/products'),
    fetch('/api/categories')
  ]);
  const allProducts = withEnglishCopyList(await res.json());
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

  const enLabel = (cat) => {
    const catData = findCategory(cat);
    return (catData && catData.nombre_en) || EN_CATEGORY_LABELS[cat] || cat;
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
      countBadge.textContent = `${count} ${count === 1 ? 'product' : 'products'}`;
    }
  }

  // ── Inventory cache for availability filter ──
  if (!window._inventoryCache) window._inventoryCache = new Map();
  const inventoryCache = window._inventoryCache;

  // Global promise resolved when bulk-inventory finishes.
  // product-item.js uses it to avoid assuming 'Out of Stock' too early.
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
          // If SKU wasn't found, assume available
          inventoryCache.set(id, 'disponible');
        }
      }
      return;
    } catch (e) {
      console.warn('Bulk inventory failed, falling back to individual checks', e);
    }

    // Individual fallback
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

    // "All" button (ALWAYS rendered first)
    const btnAll = document.createElement('button');
    btnAll.className = 'v2-cat-btn active';
    btnAll.dataset.cat = 'all';
    btnAll.innerHTML = `
      <span>All</span>
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
          <span>${enLabel(catName)}</span>
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

  // ── URL slug helpers ──
  // Converts a category name into a URL slug
  function toSlug(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanumerics with a dash
      .replace(/^-+|-+$/g, '');     // trim leading/trailing dashes
  }

  // Finds the category whose slug matches the given hash
  function catFromSlug(slug) {
    if (!slug) return null;
    const s = slug.toLowerCase();
    return categories.find(c => toSlug(c.nombre || c.descripcion || '') === s) || null;
  }

  // Parse URL: hash (#slug) first, then ?cat= as fallback
  const rawHash = window.location.hash.replace(/^#/, '').trim();
  const params = new URLSearchParams(window.location.search);
  let initialCat = 'all';
  if (rawHash) {
    // Try to resolve the hash as a category slug
    const matchedCat = catFromSlug(rawHash);
    if (matchedCat) {
      initialCat = matchedCat.nombre || matchedCat.descripcion || 'all';
    } else if (rawHash !== 'all') {
      // Try a direct name match (legacy)
      const direct = categories.find(c =>
        toSlug(c.nombre || '') === rawHash || toSlug(c.descripcion || '') === rawHash
      );
      initialCat = direct ? (direct.nombre || direct.descripcion || 'all') : 'all';
    }
  } else {
    initialCat = params.get('cat') || 'all';
  }

  // Toggle categories on mobile (accordion style)
  const mobileCatToggle = document.getElementById('mobile-cat-toggle');
  const sidebar = document.getElementById('category-sidebar');

  if (mobileCatToggle && sidebar) {
    mobileCatToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // BUG FIX: Prevent immediate close by document listener
      const isExpanded = sidebar.classList.toggle('is-expanded');
      mobileCatToggle.classList.toggle('is-open', isExpanded);
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
  const applyCategoryFilter = (cat, skipUrlUpdate) => {
    currentCat = cat;
    // Close sidebar on mobile
    if (sidebar) sidebar.classList.remove('is-expanded');

    // ── Update URL with category hash ──
    if (!skipUrlUpdate) {
      const newHash = cat === 'all' ? '' : '#' + toSlug(cat);
      const newUrl = window.location.pathname + window.location.search + newHash;
      window.history.pushState({ cat }, '', newUrl);
    }

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
      if (titleEl) titleEl.textContent = 'Full Catalog';
      if (descEl) descEl.style.display = 'none';
      const sorted = applyFilterSort(products);
      updateProductCount(sorted.length);
      renderProducts(sorted, mount);
    } else {
      if (titleEl) titleEl.textContent = enLabel(cat);
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
            const listStr = names.length > 0 ? names.join(', ') + ' and ' + last : last || '';
            descEl.textContent = `Explore our range of ${enLabel(cat)}, including: ${listStr} and much more.`;
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
            <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">No Availability</h3>
            <p style="color: var(--muted); font-size: 1.1rem;">No products match the selected filters.</p>
          </div>
        `;
      } else {
        renderProducts(filtered, mount);
      }
    }
  };

  let currentCat = initialCat;
  let currentSearch = '';

  // Initial load: don't update URL (it already comes from the hash/param)
  applyCategoryFilter(initialCat, true);

  // Handle browser Back/Forward button
  window.addEventListener('popstate', (e) => {
    const hash = window.location.hash.replace(/^#/, '').trim();
    let cat = 'all';
    if (hash) {
      const matched = catFromSlug(hash);
      if (matched) cat = matched.nombre || matched.descripcion || 'all';
    } else {
      const p = new URLSearchParams(window.location.search);
      cat = p.get('cat') || 'all';
    }
    applyCategoryFilter(cat, true); // skipUrlUpdate=true so no extra history state is created
  });

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

  // Delegate: handle "Add" clicks
  mount.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn || btn.disabled || !mount.contains(btn)) return;
    const id = Number(btn.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const card = btn.closest('.v2-card');
    const qty = Math.max(1, Number(card?.querySelector('.v2-qty-input')?.value) || 1);

    const sku = (product.codigo_siesa || product.sku || product.SKU || product.item_ext || '').toString().trim();

    const onAddSuccess = () => {
      cartService.add(product, qty);
      btn.classList.add('added');
      showToast('Added Successfully');
      setTimeout(() => btn.classList.remove('added'), 350);
    };

    const setBtnLoading = (loading) => {
      btn.disabled = loading;
      btn.textContent = loading ? '...' : 'Add';
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
        showToast('Product Out of Stock', 'error');
        return;
      }

      const rawUnits = product.cantidad ?? product.Cantidad ?? 1000;
      const unitsPerBox = (Number.isFinite(Number(rawUnits)) && Number(rawUnits) > 0) ? Number(rawUnits) : 1000;
      const requestedUnits = qty * unitsPerBox;

      if (Number.isFinite(inventarioExistencia) && requestedUnits > inventarioExistencia) {
        showToast('Product Out of Stock', 'error');
        return;
      }

      onAddSuccess();
    } catch (err) {
      console.error('Error checking inventory', err);
      showToast('Product Out of Stock', 'error');
    } finally {
      setBtnLoading(false);
    }
  });

  // Delegate: image navigation (prev/next)
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

    if (titleEl) titleEl.textContent = `Results: "${e.detail}"`;
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
          <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">No Results</h3>
          <p style="color: var(--muted); font-size: 1.1rem;">No products found for "${e.detail}".</p>
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
  // Fetch inventory (non-blocking)
  checkAllInventory().then(() => {
    console.log('[checkAllInventory] Finished bulk check');
    if (currentFilter !== 'all') reapply();
    window.dispatchEvent(new CustomEvent('content-loaded'));
  });

  // Listen for individual stock updates to refresh the filter
  window.addEventListener('inventory-updated', () => {
    if (currentFilter !== 'all') {
      reapply();
    }
  });

  window.dispatchEvent(new CustomEvent('content-loaded'));
}

init();
