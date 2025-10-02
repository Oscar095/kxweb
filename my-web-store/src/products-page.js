import { renderHeader } from './components/header.js';
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
  const products = await res.json();
  const categories = resCats.ok ? await resCats.json() : [];
  const mount = document.getElementById('products');
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
      btn.dataset.cat = c.nombre;
      btn.textContent = c.nombre;
      catWrap.appendChild(btn);
    }
  }

  // Delegado: manejar clicks "Agregar" y leer cantidad del input
  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn || !mount.contains(btn)) return;
    const id = Number(btn.dataset.id);
    const product = products.find(p => p.id === id);
    if (!product) return;
    const card = btn.closest('.product');
    const qty = Math.max(1, Number(card?.querySelector('.qty-input')?.value) || 1);
    cartService.add(product, qty);
    btn.classList.add('added');
    setTimeout(() => btn.classList.remove('added'), 350);
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
    const touch = e.touches[0];
    const wrap = e.target.closest('.product-img-wrap');
    if (!wrap || !mount.contains(wrap) || !touch) return;
    e.preventDefault();
    showLens(wrap);
    moveLens(wrap, touch.clientX, touch.clientY);
  }, { passive: false });

  mount.addEventListener('touchmove', (e) => {
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
      catWrap.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 350);
      const cat = btn.dataset.cat;
      if (cat === 'all') renderProducts(products, mount);
      else renderProducts(products.filter(p => p.category === cat), mount);
    });
  }
}

init();
