import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';
import { formatMoney } from './utils/format.js';

function getIdFromQuery(){
  const u = new URL(location.href);
  return Number(u.searchParams.get('id'));
}

async function loadProduct(id){
  // Intenta endpoint de detalle
  try {
    const r = await fetch(`/api/products/${id}`, { cache: 'no-store' });
    if (r.ok) return r.json();
  } catch (_) { /* fallback abajo */ }
  // Fallback: carga listado y busca por id (útil si el server no se reinició aún)
  const list = await fetch('/api/products', { cache: 'no-store' });
  if (!list.ok) throw new Error('No se pudo cargar el producto');
  const products = await list.json();
  const p = products.find(x => Number(x.id) === Number(id));
  if (!p) throw new Error('Producto no encontrado');
  return p;
}

function renderProduct(p){
  const main = document.getElementById('pd-main');
  const wrap = main.closest('.product-img-wrap');
  const lens = wrap?.querySelector('.img-lens');
  const prevBtn = wrap?.querySelector('.img-prev');
  const nextBtn = wrap?.querySelector('.img-next');
  const thumbs = document.getElementById('pd-thumbs');
  const name = document.getElementById('pd-name');
  const cat = document.getElementById('pd-category');
  const price = document.getElementById('pd-price');
  const desc = document.getElementById('pd-desc');

  name.textContent = p.name || '';
  cat.textContent = p.category ? `Categoría: ${p.category}` : '';
  price.textContent = `$${formatMoney(Number(p.price||0))}`;
  desc.textContent = p.description || '';

  const imgs = Array.isArray(p.images) && p.images.length ? p.images : [p.image || '/images/placeholder.svg'];
  let idx = 0;
  main.src = imgs[idx];
  main.onerror = () => { main.src = '/images/placeholder.svg'; };
  if (lens) lens.style.backgroundImage = `url("${main.src}")`;

  thumbs.innerHTML = imgs.map((src, i) => `<img data-index="${i}" src="${src}" alt="${p.name || ''} ${i+1}" />`).join('');
  thumbs.addEventListener('click', (e)=>{
    const im = e.target.closest('img');
    if (!im || !thumbs.contains(im)) return;
    idx = Number(im.dataset.index || 0);
    main.src = imgs[idx];
    if (lens) lens.style.backgroundImage = `url("${main.src}")`;
  });

  // Prev/Next navigation
  const updateMain = () => {
    main.src = imgs[idx];
    if (lens) lens.style.backgroundImage = `url("${main.src}")`;
  };
  prevBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    idx = (idx - 1 + imgs.length) % imgs.length;
    updateMain();
  });
  nextBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    idx = (idx + 1) % imgs.length;
    updateMain();
  });

  document.getElementById('pd-add').addEventListener('click', () => {
    const qty = Math.max(1, Number(document.getElementById('pd-qty').value) || 1);
    cartService.add(p, qty);
    window.dispatchEvent(new Event('toggle-cart'));
  });
}

async function init(){
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));
  const id = getIdFromQuery();
  if (!Number.isFinite(id)) {
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">ID inválido</div>';
    return;
  }
  try {
    const p = await loadProduct(id);
    renderProduct(p);
    // Setup lens effects on detail page
    const wrap = document.querySelector('.pd-gallery .product-img-wrap');
    const main = document.getElementById('pd-main');
    const lens = wrap?.querySelector('.img-lens');
    if (wrap && main && lens) {
      const showLens = () => { lens.style.display = 'block'; lens.style.backgroundImage = `url("${main.src}")`; };
      const hideLens = () => { lens.style.display = 'none'; };
      const moveLens = (clientX, clientY) => {
        const wrapRect = wrap.getBoundingClientRect();
        const imgRect = main.getBoundingClientRect();
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

      wrap.addEventListener('mouseover', () => showLens());
      wrap.addEventListener('mouseout', (e) => {
        if (wrap.contains(e.relatedTarget)) return;
        hideLens();
      });
      wrap.addEventListener('mousemove', (e) => moveLens(e.clientX, e.clientY));
      wrap.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        showLens();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchend', () => hideLens());
    }
  } catch (e) {
    console.error(e);
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">Producto no encontrado</div>';
  }
}

init();
