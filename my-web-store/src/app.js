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
    window.pMatcher = (p, cQuery) => {
      const pCat = String(p.category_name || '').toLowerCase();
      const pName = String(p.name || '').toLowerCase();
      const pStr = pCat + " " + pName + " " + String(p.description || '').toLowerCase();
      const catNameLower = String(cQuery || '').toLowerCase();

      if (String(p.category) === catNameLower || pCat === catNameLower) return true;
      if (catNameLower.includes('vasos')) {
        if (catNameLower.includes('caliente') && (pCat.includes('generica') || pName.includes('7oz') || pName.includes('vasos'))) return true;
        if (catNameLower.includes('fría') && (pCat.includes('fria') || pStr.includes('fria') || pName.includes('9oz'))) return true;
      }
      if (catNameLower.includes('contenedor') && pStr.includes('contenedor')) return true;
      if (catNameLower.includes('tapa') && pStr.includes('tapa')) return true;
      if (catNameLower.includes('empaque') && pStr.includes('empaque')) return true;
      if (catNameLower.includes('plato') && pStr.includes('plato')) return true;
      if (catNameLower.includes('porta') && pStr.includes('porta')) return true;

      return false;
    };

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
          <div class="category-grid-vertical" id="cat-track">
            ${userCategories.map(c => {
          // 1) Find all products matching this category
          const catProducts = products.filter(p => window.pMatcher(p, c.nombre));

          // 2) Gather all unique images from these products
          const allCatImages = new Set();
          allCatImages.add(c.img); // Always include the default
          catProducts.forEach(p => {
            if (p.image) allCatImages.add(p.image);
            if (Array.isArray(p.images)) p.images.forEach(img => allCatImages.add(img));
            if (p.image2) allCatImages.add(p.image2);
            if (p.image3) allCatImages.add(p.image3);
            if (p.image4) allCatImages.add(p.image4);
          });
          const imgArray = Array.from(allCatImages).filter(img => img && img !== '/images/placeholder.svg');
          const imagesJson = JSON.stringify(imgArray).replace(/"/g, '&quot;');

          // 3) Build dynamic description string
          let desc = "Descubre las mejores opciones que brindamos para esta categoría de nuestra tienda.";
          if (catProducts.length > 0) {
            // Get up to 4 distinct product names
            const names = Array.from(new Set(catProducts.map(p => p.name).filter(Boolean))).slice(0, 4);
            if (names.length > 0) {
              const last = names.pop();
              const listStr = names.length > 0 ? names.join(', ') + ' y ' + last : last;
              desc = `Explora nuestra variedad de ${c.nombre}, incluyendo: ${listStr} y mucho más.`;
            }
          }

          return `
              <div class="category-card" data-cat="${c.id}">
                <div class="cat-image-wrapper">
                  <img src="${c.img}" alt="${c.nombre}" loading="lazy" draggable="false" class="cat-hero-img" data-images="${imagesJson}">
                </div>
                <div class="category-content">
                  <div class="cat-content-inner">
                    <h3>${c.nombre}</h3>
                    <p class="cat-desc">${desc}</p>
                    <span class="btn-explore">Explorar opciones &#8594;</span>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        `;

        // Obtener elementos recién creados buscando DENTRO de categoryHub
        const track = categoryHub.querySelector('#cat-track');

        // Random Image Rotation Logic
        const catImages = categoryHub.querySelectorAll('.cat-hero-img');
        if (catImages.length > 0) {
          setInterval(() => {
            catImages.forEach(imgEl => {
              try {
                const rawData = imgEl.getAttribute('data-images');
                if (!rawData) return;
                const imgList = JSON.parse(rawData);
                if (Array.isArray(imgList) && imgList.length > 1) {
                  // Pick a random image different from the current one
                  let nextImg = imgEl.src;
                  let attempts = 0;
                  while (attempts < 5 && (nextImg === imgEl.src || nextImg.includes(imgEl.src))) {
                    nextImg = imgList[Math.floor(Math.random() * imgList.length)];
                    attempts++;
                  }

                  // Trigger fade transition
                  imgEl.classList.add('fade-out');
                  setTimeout(() => {
                    imgEl.src = nextImg;
                    imgEl.classList.remove('fade-out');
                  }, 400); // Wait for fade out to complete before changing src
                }
              } catch (e) {
                // ignore parsing errors
              }
            });
          }, 5000); // Change images every 5 seconds
        }

        // Integrar lógica de clic en la tarjeta
        if (track) {
          track.addEventListener('click', (e) => {
            const card = e.target.closest('.category-card');
            if (card) {
              const cat = card.dataset.cat;
              window.location.href = '/products?cat=' + encodeURIComponent(cat);
            }
          });
        }


      }
    };

    const showProducts = (catVal) => {
      if (categoryHub) categoryHub.style.display = 'none';
      if (catalogNav) {
        catalogNav.style.display = 'flex';
        // Attempt to find the full category name if catVal is an id
        const staticCat = userCategories && userCategories.find(c => String(c.id) === String(catVal));
        const foundCat = categories.find(c => String(c.id) === String(catVal) || String(c.nombre) === String(catVal) || (staticCat && String(c.descripcion).toLowerCase() === staticCat.nombre.toLowerCase()));

        catalogTitle.textContent = staticCat ? staticCat.nombre : ((foundCat && foundCat.descripcion) ? foundCat.descripcion : (catVal || 'Resultados de Búsqueda'));

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

    // Toast notification system
    const showToast = (msg) => {
      let root = document.getElementById('toast-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'toast-root';
        document.body.appendChild(root);
      }
      const toast = document.createElement('div');
      toast.className = 'toast-success';
      toast.textContent = msg;
      root.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    };

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
      showToast('Producto Agregado Exitosamente');
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
        const descEl = document.getElementById('current-category-desc');
        if (descEl) descEl.style.display = 'none';
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