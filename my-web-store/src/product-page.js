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
  main.src = imgs[0];
  main.onerror = () => { main.src = '/images/placeholder.svg'; };

  thumbs.innerHTML = imgs.map((src, i) => `<img src="${src}" alt="${p.name || ''} ${i+1}" />`).join('');
  thumbs.addEventListener('click', (e)=>{
    const im = e.target.closest('img');
    if (!im || !thumbs.contains(im)) return;
    main.src = im.src;
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
  } catch (e) {
    console.error(e);
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">Producto no encontrado</div>';
  }
}

init();
