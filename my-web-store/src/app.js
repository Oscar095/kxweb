import { renderHeader } from './components/header.js';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';

console.log('app.js (módulo) cargado');

async function initBannerCarousel() {
  const hero = document.getElementById('hero');
  const mount = document.getElementById('banner-carousel');
  if (!mount) return;

  try {
    const r = await fetch('/api/banners?active=true', { cache: 'no-store' });
    if (!r.ok) return;
    const banners = await r.json();
    const items = Array.isArray(banners) ? banners.slice(0, 3) : [];
    if (items.length === 0) return;

    hero?.classList.add('hero--with-banners');
    mount.innerHTML = '';

    const slides = items.map((b, i) => {
      const slide = document.createElement('div');
      slide.className = 'banner-slide' + (i === 0 ? ' is-active' : '');
      slide.dataset.index = String(i);
      const img = document.createElement('img');
      img.src = b.url;
      img.alt = b.nombre || `Banner ${i + 1}`;
      img.loading = i === 0 ? 'eager' : 'lazy';
      slide.appendChild(img);
      mount.appendChild(slide);
      return slide;
    });

    // Arrows
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'banner-arrow prev';
    prevBtn.setAttribute('aria-label', 'Banner anterior');
    prevBtn.textContent = '‹';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'banner-arrow next';
    nextBtn.setAttribute('aria-label', 'Siguiente banner');
    nextBtn.textContent = '›';
    mount.appendChild(prevBtn);
    mount.appendChild(nextBtn);

    // Dots
    const nav = document.createElement('div');
    nav.className = 'banner-nav';
    const dots = items.map((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'banner-dot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', `Ir al banner ${i + 1}`);
      d.addEventListener('click', () => setIndex(i, true));
      nav.appendChild(d);
      return d;
    });
    mount.appendChild(nav);

    let idx = 0;
    let timer = null;

    const render = () => {
      slides.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    };

    const setIndex = (next, resetTimer) => {
      idx = (next + slides.length) % slides.length;
      render();
      if (resetTimer) restart();
    };

    const restart = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => setIndex(idx + 1, false), 4000);
    };

    prevBtn.addEventListener('click', () => setIndex(idx - 1, true));
    nextBtn.addEventListener('click', () => setIndex(idx + 1, true));

    // pause on hover (desktop)
    mount.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); timer = null; });
    mount.addEventListener('mouseleave', () => restart());

    restart();
  } catch (e) {
    console.warn('initBannerCarousel error', e);
  }
}

async function init() {
  try {
    const headerMount = document.getElementById('site-header');
    if (headerMount) renderHeader(headerMount);

    const drawerMount = document.getElementById('cart-drawer');
    if (drawerMount) renderCartDrawer(drawerMount);

    // Banners (home)
    await initBannerCarousel();

    console.log('Fetch: cargando ./data/products.json ... desde', location.href);
    const res = await fetch('/api/products', { cache: 'no-store' });
    console.log('Fetch status:', res.status, 'ok:', res.ok);
    if (!res.ok) {
      throw new Error(`Error al cargar products.json: ${res.status}`);
    }

    const products = await res.json();
    console.log('Productos cargados:', products);

    const productsMount = document.getElementById('products');
    if (!productsMount) {
      console.error('No se encontró el elemento #products en el DOM');
      return;
    }

    if (!Array.isArray(products) || products.length === 0) {
      productsMount.innerHTML = '<p>No hay productos disponibles.</p>';
      return;
    }

    renderProducts(products, productsMount);

    // Delegado: manejar clicks "Agregar" y leer cantidad del input
    productsMount.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-to-cart');
      if (!btn || !productsMount.contains(btn)) return;
      const id = Number(btn.dataset.id);
      const product = products.find(p => p.id === id);
      if (!product) return;
      const card = btn.closest('.product');
      const qty = Math.max(1, Number(card?.querySelector('.qty-input')?.value) || 1);
      cartService.add(product, qty);
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 350);
    });

    // Delegado: navegación de imágenes (prev/next) por tarjeta
    productsMount.addEventListener('click', (e) => {
      const prev = e.target.closest('.img-prev');
      const next = e.target.closest('.img-next');
      const nav = prev || next;
      if (!nav || !productsMount.contains(nav)) return;
      e.preventDefault();
      e.stopPropagation(); // evita navegar al link de la imagen
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
      const lens = wrap?.querySelector('.img-lens');
      if (lens && imgEl) {
        lens.style.backgroundImage = `url("${imgEl.src}")`;
      }
    });

    // Evita que clicks en la lupa (lens) interfieran con navegación
    productsMount.addEventListener('mousedown', (e) => {
      if (e.target.closest('.img-lens')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // search filter (global event dispatched from header)
    window.addEventListener('search', (e) => {
      const q = (e.detail || '').toLowerCase();
      const filtered = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
      renderProducts(filtered, productsMount);
    });

  } catch (err) {
    console.error('Error en init():', err);
    const mount = document.getElementById('products') || document.body;
    mount.innerHTML = `<div style="color:red;padding:16px">Error al cargar productos: ${err.message}</div>`;
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
        <!-- Puedes agregar aquí un título o slogan si lo deseas -->
      </div>
    `;
    main.insertBefore(hero, main.firstChild);
  }
});

init();