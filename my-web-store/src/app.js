import { renderHeader } from './components/header.js';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';

console.log('app.js (módulo) cargado');


async function init() {
  try {
    const headerMount = document.getElementById('site-header');
    if (headerMount) renderHeader(headerMount);

    const drawerMount = document.getElementById('cart-drawer');
    if (drawerMount) renderCartDrawer(drawerMount);



    console.log('Fetch: cargando ./data/products.json ... desde', location.href);
    const [resProd, resCat] = await Promise.all([
      fetch('/api/products', { cache: 'no-store' }),
      fetch('/api/categories', { cache: 'no-store' })
    ]);

    if (!resProd.ok) throw new Error(`Error al cargar productos: ${resProd.status}`);
    const products = await resProd.json();
    const categories = resCat.ok ? await resCat.json() : [];

    const productsMount = document.getElementById('products');
    const categoryHub = document.getElementById('category-grid');
    const catalogNav = document.getElementById('catalog-nav');
    const btnBack = document.getElementById('btn-back-categories');
    const catalogTitle = document.getElementById('current-category-title');

    // Funciones de navegación (SPA mode)
    const showCategories = () => {
      if (productsMount) productsMount.style.display = 'none';
      if (catalogNav) catalogNav.style.display = 'none';
      if (categoryHub) {
        // Render Categories
        categoryHub.innerHTML = categories.map(c => `
          <div class="category-card" data-cat="${c.nombre || c.id}">
            <h3>${c.nombre}</h3>
            <p>${c.descripcion || 'Explorar productos'}</p>
          </div>
        `).join('');
        categoryHub.style.display = 'grid';
      }
    };

    const showProducts = (catVal) => {
      if (categoryHub) categoryHub.style.display = 'none';
      if (catalogNav) {
        catalogNav.style.display = 'flex';
        // Attempt to find the full category name if catVal is an id
        const foundCat = categories.find(c => String(c.id) === String(catVal) || String(c.nombre) === String(catVal));
        catalogTitle.textContent = (foundCat && foundCat.nombre) ? foundCat.nombre : (catVal || 'Resultados de Búsqueda');
      }
      if (productsMount) {
        const filtered = catVal ? products.filter(p => String(p.category) === String(catVal) || String(p.category_name) === String(catVal) || String(p.categoria) === String(catVal)) : products;
        renderProducts(filtered, productsMount);
        productsMount.style.display = 'grid';
      }
    };

    // Inicializar con categorías si existen, si no con todos los productos
    if (categories.length > 0 && categoryHub) {
      showCategories();

      // Manejo click de categoría
      categoryHub.addEventListener('click', (e) => {
        const card = e.target.closest('.category-card');
        if (!card) return;
        const cat = card.dataset.cat;
        showProducts(cat);
        // Scroll suave a esa sección
        catalogNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // Manejo botón volver
      btnBack?.addEventListener('click', () => {
        showCategories();
        document.getElementById('catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else if (productsMount) {
      renderProducts(products, productsMount);
    }

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
    });

    // search filter (global event dispatched from header)
    window.addEventListener('search', (e) => {
      const q = (e.detail || '').toLowerCase();
      if (!q) {
        if (categories.length > 0) showCategories();
        else renderProducts(products, productsMount);
        return;
      }
      const filtered = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
      if (categoryHub) categoryHub.style.display = 'none';
      if (catalogNav) {
        catalogNav.style.display = 'flex';
        catalogTitle.textContent = 'Resultados de Búsqueda';
      }
      productsMount.style.display = 'grid';
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