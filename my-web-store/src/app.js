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

    // Rotator carousel moved after product fetch

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

    // Hero Product Rotator - Dynamic from all products
    const rotatorContainer = document.querySelector('.product-rotator');
    if (rotatorContainer && products.length > 0) {
      // Collect valid images with their product name
      const allProductItems = [];
      for (const p of products) {
        const pImages = new Set();
        if (p.image) pImages.add(p.image);
        if (Array.isArray(p.images)) p.images.forEach(img => pImages.add(img));
        if (p.image2) pImages.add(p.image2);
        if (p.image3) pImages.add(p.image3);
        if (p.image4) pImages.add(p.image4);

        const validImgs = Array.from(pImages).filter(img => img && img !== '/images/placeholder.svg');
        validImgs.forEach(img => {
          allProductItems.push({ img, name: p.name || 'Producto KOS' });
        });
      }

      // Shuffle logic
      const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      };

      // Select up to 8 random unique images
      const randomItems = shuffle(allProductItems).slice(0, 8);

      if (randomItems.length > 0) {
        rotatorContainer.innerHTML = randomItems.map((it, idx) => `
          <div class="rotator-item ${idx === 0 ? 'active' : ''}">
            <img src="${it.img}" alt="${it.name}">
            <div class="rotator-caption">${it.name}</div>
          </div>
        `).join('');

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
    }

    // Funciones de navegación (SPA mode)    
    window.pMatcher = (p, cQuery) => {
      const pCat = String(p.category_name || p.category_nombre || p.category_desc || p.category || '').toLowerCase();
      const pName = String(p.name || '').toLowerCase();
      const pDesc = String(p.description || '').toLowerCase();
      const pStr = pCat + " " + pName + " " + pDesc;
      const catNameLower = String(cQuery || '').trim().toLowerCase();

      if (String(p.category).toLowerCase() === catNameLower || pCat === catNameLower) return true;

      if (catNameLower.includes('tapas') && catNameLower.includes('contenedor')) {
        return pStr.includes('tapa') && pStr.includes('contenedor');
      }
      if (catNameLower.includes('tapas') && catNameLower.includes('vaso')) {
        return pStr.includes('tapa') && (!pStr.includes('contenedor'));
      }
      if (catNameLower.includes('porta') || catNameLower.includes('porta vasos') || catNameLower.includes('porta_vasos')) {
        return pStr.includes('porta');
      }
      if (catNameLower.includes('vasos') && catNameLower.includes('caliente')) {
        return (pStr.includes('vaso') || pStr.includes('7oz') || pName.includes('vaso')) && !pStr.includes('fria') && !pStr.includes('porta') && !pStr.includes('tapa');
      }
      if (catNameLower.includes('vasos') && (catNameLower.includes('fría') || catNameLower.includes('fria'))) {
        return (pStr.includes('vaso') || pStr.includes('9oz') || pStr.includes('fria')) && !pStr.includes('caliente') && !pStr.includes('porta') && !pStr.includes('tapa');
      }
      if (catNameLower.includes('contenedor')) {
        return pStr.includes('contenedor') && !pStr.includes('tapa');
      }
      if (catNameLower.includes('empaque')) {
        return pStr.includes('empaque');
      }
      if (catNameLower.includes('plato')) {
        return pStr.includes('plato');
      }
      if (catNameLower === 'tapas') {
        return pStr.includes('tapa');
      }

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

          // 2) Gather all unique images from ALL products
          const allCatImages = new Set();
          allCatImages.add(c.img); // Always include the default
          for (const p of products) {
            if (p.image) allCatImages.add(p.image);
            if (Array.isArray(p.images)) p.images.forEach(img => allCatImages.add(img));
            if (p.image2) allCatImages.add(p.image2);
            if (p.image3) allCatImages.add(p.image3);
            if (p.image4) allCatImages.add(p.image4);
          }
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
        if (filtered.length === 0) {
          productsMount.style.display = 'block';
          productsMount.innerHTML = `
            <div style="text-align:center; padding: 60px 24px; width: 100%; grid-column: 1 / -1;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; color: var(--muted); margin-bottom: 16px; margin: 0 auto; display: block;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">Sin disponibilidad</h3>
              <p style="color: var(--muted); font-size: 1.1rem;">En este momento no hay disponibilidad de estos productos.</p>
            </div>
          `;
        } else {
          productsMount.style.display = 'grid';
          renderProducts(filtered, productsMount);
        }
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

      // Basic fallback styles just in case css isn't present
      if (type === 'error') {
        toast.style.background = '#e74c3c';
        toast.style.color = '#fff';
      }

      root.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    };

    // Delegado: manejar clicks "Agregar" y leer cantidad del input
    productsMount.addEventListener('click', async (e) => {
      const btn = e.target.closest('.add-to-cart');
      if (!btn || !productsMount.contains(btn)) return;
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
        const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`, { cache: 'no-store' });
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
      const filtered = products.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const pCat = String(p.category_name || p.category_nombre || p.category_desc || p.category || '').toLowerCase();
        return pName.includes(q) || pCat.includes(q);
      });
      if (categoryHub) categoryHub.style.display = 'none';
      if (catalogNav) {
        catalogNav.style.display = 'flex';
        catalogTitle.textContent = 'Resultados de Búsqueda';
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
            <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 8px;">Sin disponibilidad</h3>
            <p style="color: var(--muted); font-size: 1.1rem;">En este momento no hay disponibilidad de estos productos.</p>
          </div>
        `;
      } else {
        productsMount.style.display = 'grid';
        renderProducts(filtered, productsMount);
      }
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