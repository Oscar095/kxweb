import { renderHeader } from './components/header.js';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));

  const res = await fetch('./data/products.json');
  const products = await res.json();
  const mount = document.getElementById('products');
  renderProducts(products, mount);

  // category buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (cat === 'all') renderProducts(products, mount);
      else renderProducts(products.filter(p => p.category === cat), mount);
    });
  });
}

init();
