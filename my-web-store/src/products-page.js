import { renderHeader } from './components/header.js';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  const res = await fetch('/api/products');
  const products = await res.json();
  const mount = document.getElementById('products');
  renderProducts(products, mount);

  // category buttons
  const catBtns = Array.from(document.querySelectorAll('.cat-btn'));
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 350);
      const cat = btn.dataset.cat;
      if (cat === 'all') renderProducts(products, mount);
      else renderProducts(products.filter(p => p.category === cat), mount);
    });
  });
}

init();
