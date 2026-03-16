import { renderHeader } from './components/header.js?v=24.0';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';
import { productItemTemplate, attachDynamicPriceBehavior } from './components/product-item.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap matching text in <mark class="search-hl"> without breaking child elements */
function highlightInEl(el, query) {
  if (!query || !el) return;
  const re = new RegExp(`(${escapeRe(query)})`, 'gi');
  const walk = (node) => {
    if (node.nodeType === 3) {
      if (re.test(node.textContent)) {
        re.lastIndex = 0;
        const span = document.createElement('span');
        span.innerHTML = node.textContent.replace(re, '<mark class="search-hl">$1</mark>');
        node.parentNode.replaceChild(span, node);
      }
    } else if (node.nodeType === 1 && node.tagName !== 'MARK') {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  walk(el);
}

function animateCount(el, target) {
  if (!el) return;
  const dur = 550;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showSkeleton(container) {
  container.innerHTML = `
    <div class="search-skeleton-grid">
      ${Array.from({ length: 6 }, () => `
        <div class="search-skeleton-card">
          <div class="skel skel-img"></div>
          <div class="skel skel-title"></div>
          <div class="skel skel-price"></div>
          <div class="skel skel-btn"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function getCatLabel(p) {
  return String(p.category_name || p.category_nombre || p.category_desc || p.category || 'General').trim();
}

// ── main ─────────────────────────────────────────────────────────────────────

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  const params = new URLSearchParams(window.location.search);
  let query = params.get('q') || '';

  const searchInput = document.getElementById('search-page-input');
  const clearBtn = document.getElementById('clear-search-btn');
  const statsEl = document.getElementById('search-stats');
  const filtersEl = document.getElementById('search-filters');
  const resultsEl = document.getElementById('search-results');

  if (searchInput) { searchInput.value = query; }
  syncClearBtn(query);
  showSkeleton(resultsEl);
  document.title = query ? `"${query}" — Búsqueda KosXpress` : 'Búsqueda — KosXpress';

  const resProd = await fetch('/api/products');
  const products = resProd.ok ? await resProd.json() : [];

  let activeFilter = 'all';

  // ── filter ──────────────────────────────────────────────────────────────────

  function filterProducts(q) {
    const qL = q.trim().toLowerCase();
    if (!qL) return products;
    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const cat = getCatLabel(p).toLowerCase();
      return name.includes(qL) || desc.includes(qL) || cat.includes(qL);
    });
  }

  function groupByCat(list) {
    const map = {};
    list.forEach(p => {
      const c = getCatLabel(p);
      map[c] = (map[c] || 0) + 1;
    });
    return map;
  }

  // ── render stats ────────────────────────────────────────────────────────────

  function renderStats(filtered, q) {
    if (!statsEl) return;
    if (!q.trim() && !filtered.length) { statsEl.innerHTML = ''; return; }

    const catCount = Object.keys(groupByCat(filtered)).length;
    statsEl.innerHTML = `
      <span class="stats-badge"><span id="anim-count">0</span>&nbsp;resultado${filtered.length !== 1 ? 's' : ''}</span>
      ${catCount > 1 ? `<span class="stats-sep">·</span><span class="stats-cats">${catCount} categorías</span>` : ''}
      ${q.trim() ? `<span class="stats-sep">·</span><span class="stats-for">para <em>"${q}"</em></span>` : ''}
    `;
    animateCount(document.getElementById('anim-count'), filtered.length);
  }

  // ── render filter chips ──────────────────────────────────────────────────────

  function renderFilters(filtered, q) {
    const groups = groupByCat(filtered);
    const cats = Object.keys(groups);
    if (cats.length <= 1) { filtersEl.innerHTML = ''; return; }

    const chips = [
      { key: 'all', label: 'Todos', count: filtered.length },
      ...cats.map(c => ({ key: c, label: c, count: groups[c] }))
    ];

    filtersEl.innerHTML = chips.map(chip => `
      <button class="search-chip${chip.key === activeFilter ? ' active' : ''}" data-cat="${chip.key}">
        ${chip.label}
        <span class="chip-num">${chip.count}</span>
      </button>
    `).join('');

    filtersEl.querySelectorAll('.search-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.cat;
        const toShow = activeFilter === 'all'
          ? filtered
          : filtered.filter(p => getCatLabel(p) === activeFilter);
        renderFilters(filtered, q);
        renderCards(toShow, q);
      });
    });
  }

  // ── render cards ─────────────────────────────────────────────────────────────

  function renderCards(list, q) {
    if (list.length === 0) {
      resultsEl.innerHTML = `
        <div class="search-empty-state">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="46" height="46">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11" stroke-linecap="round"/>
            </svg>
          </div>
          <h3>Sin resultados</h3>
          <p>No encontramos productos para <strong>"${q}"</strong>.<br>Intenta con otro término o explora el catálogo.</p>
          <a href="/products" class="btn-primary" style="display:inline-block;margin-top:24px;padding:12px 36px;text-decoration:none;border-radius:14px;">
            Ver todos los productos
          </a>
        </div>
      `;
      return;
    }

    // Deduplicate by código (same logic as product-list.js)
    const seen = new Set();
    const dedup = [];
    for (const p of list) {
      const code = (p.codigo || '').toString();
      if (code && seen.has(code)) continue;
      if (code) seen.add(code);
      dedup.push(p);
    }

    resultsEl.innerHTML = dedup.map(productItemTemplate).join('');

    const cards = Array.from(resultsEl.querySelectorAll('.product'));
    cards.forEach((card, i) => {
      card.style.transitionDelay = `${i * 50}ms`;
      card.classList.add('search-card-anim');
      attachDynamicPriceBehavior(card);
      // Highlight matching text inside product name
      const h3 = card.querySelector('h3');
      if (h3 && q.trim()) highlightInEl(h3, q.trim());
    });

    // Intersection observer for scroll reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    cards.forEach(card => observer.observe(card));
  }

  // ── run ──────────────────────────────────────────────────────────────────────

  function run(q) {
    const filtered = filterProducts(q);
    activeFilter = 'all';
    renderStats(filtered, q);
    renderFilters(filtered, q);
    renderCards(filtered, q);
    document.title = q ? `"${q}" — Búsqueda KosXpress` : 'Búsqueda — KosXpress';
  }

  // Initial render
  run(query);

  // ── input events ─────────────────────────────────────────────────────────────

  let debounce;
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value;
    syncClearBtn(q);
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      query = q;
      const url = new URL(window.location);
      q.trim() ? url.searchParams.set('q', q.trim()) : url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
      run(q);
    }, 220);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    syncClearBtn('');
    query = '';
    window.history.replaceState({}, '', window.location.pathname);
    run('');
  });

  // Sync with header search input (if user types there while on this page)
  window.addEventListener('search', (e) => {
    const q = e.detail || '';
    if (searchInput) searchInput.value = q;
    syncClearBtn(q);
    query = q;
    run(q);
  });

  // ── cart delegate ─────────────────────────────────────────────────────────────

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

  resultsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const card = btn.closest('.product');
    const qty = Math.max(1, Number(card?.querySelector('.qty-input')?.value) || 1);
    const sku = (product.codigo_siesa || product.sku || product.SKU || product.item_ext || '').toString().trim();

    if (!sku) {
      cartService.add(product, qty);
      btn.classList.add('added');
      showToast('Agregado Exitosamente');
      setTimeout(() => btn.classList.remove('added'), 350);
      return;
    }

    try {
      btn.disabled = true; btn.textContent = '...';
      const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`);
      if (!r.ok) throw new Error('err');
      const data = await r.json();
      if ((data.estado || data.status || '') !== 'En Existencia') {
        showToast('Producto Agotado', 'error'); return;
      }
      const rawUnits = product.cantidad ?? product.Cantidad ?? 1000;
      const upb = (Number.isFinite(Number(rawUnits)) && Number(rawUnits) > 0) ? Number(rawUnits) : 1000;
      if (Number.isFinite(Number(data?.inventario)) && qty * upb > Number(data.inventario)) {
        showToast('Producto Agotado', 'error'); return;
      }
      cartService.add(product, qty);
      btn.classList.add('added');
      showToast('Agregado Exitosamente');
      setTimeout(() => btn.classList.remove('added'), 350);
    } catch { showToast('Producto Agotado', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Agregar'; }
  });

  // Image nav delegate
  resultsEl.addEventListener('click', (e) => {
    const prev = e.target.closest('.img-prev');
    const next = e.target.closest('.img-next');
    const nav = prev || next;
    if (!nav) return;
    e.preventDefault(); e.stopPropagation();
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
}

function syncClearBtn(q) {
  document.getElementById('clear-search-btn')?.classList.toggle('visible', !!q.trim());
}

init();
