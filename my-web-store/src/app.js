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

    // Hero Product Rotator Carousel (Delivery Slide Animation)
    const rotatorItems = document.querySelectorAll('.rotator-item');
    if (rotatorItems.length > 0) {
      let currentIdx = 0;

      setInterval(() => {
        const currentItem = rotatorItems[currentIdx];

        // Old item moves out to the left
        currentItem.classList.remove('active');
        currentItem.classList.add('exiting');

        // Remove exiting class after transition completes so it can reset to the right side
        setTimeout(() => {
          currentItem.classList.remove('exiting');
        }, 800);

        currentIdx = (currentIdx + 1) % rotatorItems.length;
        const nextItem = rotatorItems[currentIdx];

        // New item slides in from the right
        nextItem.classList.remove('exiting'); // Just in case
        // Small delay to allow previous item to clear the center slightly, creating a "bump" collision feel
        setTimeout(() => {
          nextItem.classList.add('active');
        }, 100);

      }, 4000); // 4 seconds interval
    }

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

        // Categorías solicitadas por el cliente mapeadas a imágenes y rutas id
        // Categorías solicitadas por el cliente mapeadas a imágenes
        const userCategories = [
          { id: "Vasos para bebidas calientes", nombre: "Vasos para bebidas calientes", img: "images/7oz.png" },
          { id: "Vasos para bebidas frías", nombre: "Vasos para bebidas frías", img: "images/9onza.png" },
          { id: "tapas para vasos", nombre: "Tapas para vasos", img: "images/4oz.png" },
          { id: "contenedores", nombre: "Contenedores", img: "images/portahamburguesa.png" },
          { id: "tapas de contenedores", nombre: "Tapas de contenedores", img: "images/PortaPAPA.png" },
          { id: "empaques", nombre: "Empaques", img: "images/portaperro.png" },
          { id: "platos", nombre: "Platos", img: "images/Productos.png" },
          { id: "porta_vasos", nombre: "Porta Vasos", img: "images/LogoKos2.png" },
          { id: "tapas_para_vasos_2", nombre: "Tapas para Vasos", img: "images/4oz.png" }
        ];

        // Cambiamos wrapper base
        categoryHub.className = "category-hub-container container";
        categoryHub.style.display = 'block';

        categoryHub.innerHTML = `
          <button class="cat-nav-btn cat-nav-prev" aria-label="Anterior">&#10094;</button>
          <div class="category-track" id="cat-track">
            ${userCategories.map(c => `
              <div class="category-card" data-cat="${c.id}">
                <img src="${c.img}" alt="${c.nombre}" loading="lazy" draggable="false">
                <div class="category-content">
                  <h3>${c.nombre}</h3>
                  <p>Explorar opciones</p>
                </div>
              </div>
            `).join('')}
          </div>
          <button class="cat-nav-btn cat-nav-next" aria-label="Siguiente">&#10095;</button>
        `;

        // Obtener elementos recién creados buscando DENTRO de categoryHub
        const track = categoryHub.querySelector('#cat-track');
        const btnPrev = categoryHub.querySelector('.cat-nav-prev');
        const btnNext = categoryHub.querySelector('.cat-nav-next');

        let exactScroll = 0;
        let isDown = false;
        let startX;
        let scrollLeftPos = 0;
        let isDragging = false;
        let isHovered = false;

        // Auto desplazamiento suave continuo (Ticker)
        const autoScroll = () => {
          if (!isDown && !isHovered && track) {
            track.style.scrollSnapType = 'none'; // Sin snap para movimiento fluido
            exactScroll += 0.5; // Muy lento
            if (exactScroll >= track.scrollWidth - track.clientWidth - 1) {
              exactScroll = 0; // Reinicia al llegar al final
            }
            track.scrollLeft = exactScroll;
          } else if (track) {
            exactScroll = track.scrollLeft;
          }
          requestAnimationFrame(autoScroll);
        };
        requestAnimationFrame(autoScroll);

        // Pausar auto-scroll si el mouse esta encima del contenedor completo
        categoryHub.addEventListener('mouseenter', () => isHovered = true);
        categoryHub.addEventListener('mouseleave', () => {
          isDown = false;
          isHovered = false;
          if (track) track.style.cursor = 'grab';
        });

        // Navegacion con flechas
        if (btnPrev && btnNext && track) {
          btnPrev.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita clicks propagados
            track.scrollBy({ left: -328, behavior: 'smooth' });
          });
          btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            track.scrollBy({ left: 328, behavior: 'smooth' });
          });
        }

        // --- Integrar Lógica de Arrastre ---
        if (track) {
          track.addEventListener('mousedown', (e) => {
            isDown = true;
            isDragging = false;
            track.style.cursor = 'grabbing';
            track.style.scrollSnapType = 'none';
            startX = e.pageX - track.offsetLeft;
            scrollLeftPos = track.scrollLeft;
          });

          track.addEventListener('mouseup', () => {
            isDown = false;
            track.style.cursor = 'grab';
            track.style.scrollSnapType = 'x mandatory';
          });

          track.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - track.offsetLeft;
            const walk = (x - startX) * 2;
            if (Math.abs(walk) > 5) isDragging = true;
            track.scrollLeft = scrollLeftPos - walk;
          });

          // Prevenir navegacion si estabamos arrastrando
          track.addEventListener('click', (e) => {
            if (isDragging) {
              e.preventDefault();
              e.stopPropagation();
              isDragging = false;
              return;
            }

            // Si es un click normal en una tarjeta:
            const card = e.target.closest('.category-card');
            if (card) {
              const cat = card.dataset.cat;
              showProducts(cat);
              catalogNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, { capture: true });
        }
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