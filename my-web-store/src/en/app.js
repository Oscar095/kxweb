import { renderHeader } from './components/header.js?v=999';
import { renderProducts } from './components/product-list.js';
import { applyOutOfStockToCard } from './components/product-item.js';
import { attachDynamicPriceBehavior } from './components/product-item.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from '../services/cart-service.js';
import { formatMoney } from '../utils/format.js';
import { withEnglishCopyList } from './utils/product-i18n.js';

console.log('[KosXpress] en/app.js loaded');
window._inventoryCache = window._inventoryCache || new Map();

// Category filter values must stay in Spanish — they are matched against the
// DB's category_name column by pMatcher below. This map is only the LAST-RESORT
// fallback label — the real source of truth is category_translations via
// GET /api/categories (nombre_en), looked up by findCategoryData() in init().
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

// Looks up a category's DB-driven English overlay (nombre_en/imagen_en) by its
// Spanish name — case-insensitive match against descripcion/nombre.
function findCategoryData(categories, spanishName) {
  const q = String(spanishName || '').trim().toLowerCase();
  return categories.find(c => String(c.descripcion || c.nombre || '').trim().toLowerCase() === q) || null;
}

function renderBestSellers(products, mount) {
  if (!mount || !products.length) return;
  mount.innerHTML = products.map((p, idx) => {
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
    const skuAttr = p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '';
    return `
      <article class="bs-card" data-id="${p.id}" data-sku="${skuAttr}" style="opacity:1;">
        <div class="bs-card-visual" style="position:relative; cursor:pointer;" onclick="if(!event.target.closest('button') && !event.target.closest('input')) { window.location.href='/en/product?id=${p.id}'; }">
          <div class="out-of-stock-badge" style="display: none; position: absolute; bottom: 8px; right: 8px; background-color: var(--secondary, #f28c30); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; z-index: 2; pointer-events: none; text-transform: uppercase; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">Out of Stock</div>
          <span class="bs-card-rank">#${idx + 1}</span>
          <img class="bs-card-img" src="${imgSrc}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/images/placeholder.svg'">
          <span class="bs-card-flame">🔥</span>
        </div>
        <div class="bs-card-body">
          <a href="/en/product?id=${p.id}" class="bs-card-name-link">
            <h3 class="bs-card-name">${p.name}</h3>
          </a>
          <p class="price bs-card-price" data-base-price="${unitPrice}" data-cantidad="${cantidadNum ?? ''}" data-codigo="${skuAttr}">
            $${formatMoney(totalConIva)}<span class="bs-per-box"> / box</span> <span style="font-size:0.65rem;color:#4CAF50;font-weight:600;">VAT included</span>
          </p>
          <div class="bs-card-actions">
            <div class="qty-control-premium" style="width: 105px; flex-shrink: 0; height: 36px;">
              <button type="button" class="qty-btn qty-btn-minus">-</button>
              <input id="bs-qty-${p.id}" type="number" class="qty-input" min="1" step="1" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Quantity" data-dynamic-price="1" style="width: 33px; padding: 0;">
              <button type="button" class="qty-btn qty-btn-plus">+</button>
            </div>
            <button class="add-to-cart bs-add-btn btn-primary" data-id="${p.id}">Add</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const items = Array.from(mount.querySelectorAll('.bs-card'));

  // Bulk inventory check for best sellers (non-blocking)
  const bsSkus = items.map(it => it.getAttribute('data-sku')).filter(Boolean);
  if (bsSkus.length > 0) {
    fetch('/api/inventario-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus: [...new Set(bsSkus)] })
    }).then(r => r.ok ? r.json() : {}).then(data => {
      items.forEach(it => {
        const sku = it.getAttribute('data-sku');
        if (!sku) return;
        const inv = data[sku];
        // Only mark as out of stock if the response is positive AND says "Agotado"
        // If there's no info (inv undefined) or a previous error, don't alarm the user.
        const isOk = (inv && inv.estado === 'En Existencia');
        if (inv && !isOk) {
          applyOutOfStockToCard(it);
        }
      });
    }).catch(() => { });
  }

  items.forEach(it => {
    attachDynamicPriceBehavior(it);
  });
}

async function init() {
  try {
    const headerMount = document.getElementById('site-header');
    if (headerMount) renderHeader(headerMount);

    const drawerMount = document.getElementById('cart-drawer');
    if (drawerMount) renderCartDrawer(drawerMount);

    const [resProd, resCat] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories')
    ]);

    if (!resProd.ok) throw new Error(`Error loading products: ${resProd.status}`);
    const allProducts = withEnglishCopyList(await resProd.json());
    const products = allProducts.filter(p => p.habilitado !== false && p.habilitado !== 0);
    const categories = resCat.ok ? await resCat.json() : [];
    const enLabel = (cat) => {
      const catData = findCategoryData(categories, cat);
      return (catData && catData.nombre_en) || EN_CATEGORY_LABELS[cat] || cat;
    };

    // Bulk inventory check for all products, fills the local cache
    const getSku = (p) => (p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '').toString().trim();
    const allSkus = products.map(getSku).filter(Boolean);

    if (allSkus.length > 0) {
      fetch('/api/inventario-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus: [...new Set(allSkus)] })
      })
        .then(async r => {
          const data = await r.json();

          products.forEach(p => {
            const sku = getSku(p);
            const inv = data[sku];
            if (inv) {
              const isOk = (inv.estado === 'En Existencia');
              // If the state isn't "En Existencia", mark it out of stock (including upstream error cases)
              if (!isOk) {
                window._inventoryCache.set(Number(p.id), 'no-disponible');
              } else {
                window._inventoryCache.set(Number(p.id), 'disponible');
              }
            }
          });

          // Apply styles to already-rendered cards (Best Sellers)
          const currentCards = document.querySelectorAll('.v2-card, .bs-card');
          currentCards.forEach(card => {
            const pid = Number(card.dataset.id);
            if (window._inventoryCache.get(pid) === 'no-disponible') {
              applyOutOfStockToCard(card);
            }
          });
        })
        .catch(err => console.error('[KosXpress] Bulk inventory check error:', err));
    }

    const productsMount = document.getElementById('products');
    const categoryHub = document.getElementById('category-grid');
    const catalogNav = document.getElementById('catalog-nav');
    const btnBack = document.getElementById('btn-back-categories');
    const catalogTitle = document.getElementById('current-category-title');

    // Populate Best Sellers
    const bestSellersGrid = document.getElementById('best-sellers-grid');
    if (bestSellersGrid && products.length > 0) {
      let bsProducts = products.filter(p => p.image && !p.image.includes('placeholder')).slice(0, 4);
      if (bsProducts.length < 4) {
        bsProducts.push(...products.slice(0, 4 - bsProducts.length));
      }
      renderBestSellers(bsProducts, bestSellersGrid);
    }

    // Hero Product Rotator - Use predefined HTML items
    const rotatorContainer = document.querySelector('.product-rotator');
    if (rotatorContainer) {
      const newRotatorItems = document.querySelectorAll('.rotator-item');
      if (newRotatorItems.length > 1) {
        let currentIdx = 0;
        setInterval(() => {
          const currentItem = newRotatorItems[currentIdx];
          currentItem.classList.remove('active');
          currentItem.classList.add('exiting');
          setTimeout(() => {
            currentItem.classList.remove('exiting');
          }, 800);

          currentIdx = (currentIdx + 1) % newRotatorItems.length;
          const nextItem = newRotatorItems[currentIdx];
          nextItem.classList.remove('exiting');
          setTimeout(() => {
            nextItem.classList.add('active');
          }, 100);
        }, 4000);
      }
    }

    // Helper: find DB category by nombre or descripcion (case-insensitive)
    const findCategory = (name) => {
      const q = String(name || '').trim().toLowerCase();
      return categories.find(c =>
        String(c.nombre || '').toLowerCase() === q ||
        String(c.descripcion || '').toLowerCase() === q
      ) || null;
    };

    // Navigation functions (SPA mode)
    // Matcher: filters products by DB category ID (no fuzzy text)
    window.pMatcher = (p, cQuery) => {
      const catNameLower = String(cQuery || '').trim().toLowerCase();
      // Exact match by category_name (c.descripcion from DB)
      if (String(p.category_name || '').toLowerCase() === catNameLower) return true;
      // Match via DB category ID
      const matchedCat = findCategory(cQuery);
      if (matchedCat && String(p.category) === String(matchedCat.id)) return true;
      return false;
    };

    const showCategories = () => {
      if (productsMount) productsMount.style.display = 'none';
      if (catalogNav) catalogNav.style.display = 'none';
      if (categoryHub) {

        // Categories requested by the client, mapped to images.
        // NOTE: `id`/`nombre` MUST stay Spanish — they're matched against the
        // DB's category_name column. Only the rendered label is translated.
        const userCategories = [
          { id: "Bebidas calientes", nombre: "Bebidas calientes", img: "https://datalakekos.blob.core.windows.net/images/site-assets/bebidashot.webp" },
          { id: "Bebidas Frías", nombre: "Bebidas Frías", img: "https://datalakekos.blob.core.windows.net/images/products/1769629716983-obzb88-bf.jpg" },
          { id: "Contenedores", nombre: "Contenedores", img: "https://datalakekos.blob.core.windows.net/images/products/1769629736581-hmztu7-contenedores.jpg" },
          { id: "Empaques", nombre: "Empaques", img: "https://datalakekos.blob.core.windows.net/images/products/1769629749077-mg4feg-empaques.jpg" },
          { id: "Platos", nombre: "Platos", img: "https://datalakekos.blob.core.windows.net/images/products/1769629764583-4y38gx-platos.jpg" },
          { id: "Porta vasos", nombre: "Porta vasos", img: "https://datalakekos.blob.core.windows.net/images/products/1769629787369-kao1o8-porta-vasos.jpg" },
          { id: "Tapas para Contenedores", nombre: "Tapas para Contenedores", img: "https://datalakekos.blob.core.windows.net/images/products/1769629814468-tugjuk-tapascontenedores.jpg" },
          { id: "Tapas para Vasos", nombre: "Tapas para Vasos", img: "https://datalakekos.blob.core.windows.net/images/products/1769629834934-5ceoiw-tapasvaso.jpg" },
          { id: "Accesorios", nombre: "Accesorios", img: "https://datalakekos.blob.core.windows.net/images/products/1772141806562-oycteh-accesorios.png" }
        ];

        categoryHub.className = "category-hub-modern container";
        categoryHub.style.display = 'block';

        categoryHub.innerHTML = `
          <div class="category-grid-modern" id="cat-grid">
            ${userCategories.map(c => {
          const catData = findCategoryData(categories, c.nombre);
          const displayName = (catData && catData.nombre_en) || enLabel(c.nombre);
          const displayImg = (catData && catData.imagen_en) || c.img;
          const imagesJson = JSON.stringify([displayImg]).replace(/"/g, '&quot;');

          return `
              <div class="category-card-modern" data-cat="${c.id}">
                <div class="cat-card-bg">
                  <img src="${displayImg}" alt="${displayName}" loading="lazy" draggable="false" class="cat-hero-img" data-images="${imagesJson}">
                  <div class="cat-card-overlay"></div>
                </div>
                <div class="cat-card-content">
                  <h3>${displayName}</h3>
                  <span class="btn-explore-pill">Explore &rarr;</span>
                </div>
              </div>
            `}).join('')}
          </div>
        `;

        // Fetch the freshly-created elements by searching WITHIN categoryHub
        const track = categoryHub.querySelector('#cat-grid');

        // Category images stay static, they aren't rotated.
      }
    };

    const showProducts = (catVal) => {
      if (categoryHub) categoryHub.style.display = 'none';
      if (catalogNav) {
        catalogNav.style.display = 'flex';
        // Attempt to find the full category name if catVal is an id
        const staticCat = userCategories && userCategories.find(c => String(c.id) === String(catVal));
        const foundCat = categories.find(c => String(c.id) === String(catVal) || String(c.nombre) === String(catVal) || (staticCat && String(c.descripcion).toLowerCase() === staticCat.nombre.toLowerCase()));

        catalogTitle.textContent = staticCat ? enLabel(staticCat.nombre) : ((foundCat && foundCat.descripcion) ? foundCat.descripcion : (enLabel(catVal) || 'Search Results'));

        const descEl = document.getElementById('current-category-desc');
        if (descEl) {
          if (foundCat && foundCat.descripcion) {
            descEl.textContent = foundCat.descripcion;
            descEl.style.display = 'block';
          } else {
            descEl.style.display = 'none';
          }
        }
      }
      if (productsMount) {
        const filtered = catVal ? products.filter(p => window.pMatcher(p, catVal)) : products;
        if (filtered.length === 0) {
          productsMount.style.display = 'block';
          productsMount.innerHTML = `
            <div style="text-align:center; padding: 60px 24px; width: 100%; grid-column: 1 / -1;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; color: var(--muted); margin-bottom: 16px; margin: 0 auto; display: block;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">No Availability</h3>
              <p style="color: var(--muted); font-size: 1.1rem;">These products aren't available right now.</p>
            </div>
          `;
        } else {
          productsMount.style.display = 'grid';
          renderProducts(filtered, productsMount);
        }
      }
    };

    // Initialize with categories if present, otherwise with all products
    if (categories.length > 0 && categoryHub) {
      showCategories();

      // Category click handling
      categoryHub.addEventListener('click', (e) => {
        const card = e.target.closest('.category-card-modern');
        if (!card) return;
        const cat = card.dataset.cat;
        window.location.href = '/en/products?cat=' + encodeURIComponent(cat);
      });

      // Back button handling
      btnBack?.addEventListener('click', () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        showCategories();
        document.getElementById('catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else if (productsMount) {
      renderProducts(products, productsMount);
    }

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

    // Delegate: handle "Add" clicks and read the quantity input
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.add-to-cart');
      if (!btn || btn.disabled) return;
      const id = Number(btn.dataset.id);
      const product = products.find(p => p.id === id);
      if (!product) return;
      const card = btn.closest('.v2-card') || btn.closest('.product') || btn.closest('.bs-card');
      const qtyInput = card?.querySelector('.qty-input');
      const qty = Math.max(1, Number(qtyInput?.value) || 1);

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
        // No SKU means we can't check inventory, just allow it
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

        // Validate units
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
        // Fallback if network issue
        showToast('Product Out of Stock', 'error');
      } finally {
        setBtnLoading(false);
      }
    });

    // Delegate: image navigation (prev/next) per card
    document.addEventListener('click', (e) => {
      const prev = e.target.closest('.img-prev');
      const next = e.target.closest('.img-next');
      const nav = prev || next;
      if (!nav) return;
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
      if (wrap) wrap.dataset.index = String(idx);
      if (imgEl) imgEl.src = imgs[idx] || '/images/placeholder.svg';
    });

    // search filter (global event dispatched from header)
    window.addEventListener('search', (e) => {
      const q = (e.detail || '').toLowerCase();
      if (!q) {
        if (categories.length > 0) showCategories();
        else renderProducts(products, productsMount);
        return;
      }
      const filtered = products.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const pCat = String(p.category_name || p.category_nombre || p.category_desc || p.category || '').toLowerCase();
        return pName.includes(q) || pCat.includes(q);
      });
      if (categoryHub) categoryHub.style.display = 'none';
      if (catalogNav) {
        catalogNav.style.display = 'flex';
        catalogTitle.textContent = 'Search Results';
        const descEl = document.getElementById('current-category-desc');
        if (descEl) descEl.style.display = 'none';
      }
      if (filtered.length === 0) {
        productsMount.style.display = 'block';
        productsMount.innerHTML = `
          <div style="text-align:center; padding: 60px 24px; width: 100%; grid-column: 1 / -1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; color: var(--muted); margin-bottom: 16px; margin: 0 auto; display: block;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">No Availability</h3>
            <p style="color: var(--muted); font-size: 1.1rem;">These products aren't available right now.</p>
          </div>
        `;
      } else {
        productsMount.style.display = 'grid';
        renderProducts(filtered, productsMount);
      }
    });

  } catch (err) {
    console.error('Error in init():', err);
    const mount = document.getElementById('products') || document.body;
    mount.innerHTML = `<div style="color:red;padding:16px">Error loading products: ${err.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  if (main && !document.querySelector('.hero')) {
    const hero = document.createElement('section');
    hero.id = 'hero';
    hero.className = 'hero';
    hero.innerHTML = `
      <div class="hero-inner">
        <!-- Optional title/slogan can go here -->
      </div>
    `;
    main.insertBefore(hero, main.firstChild);
  }
});

init();
