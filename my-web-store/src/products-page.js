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
