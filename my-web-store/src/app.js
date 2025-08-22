import { renderHeader } from './components/header.js';
import { renderProducts } from './components/product-list.js';
import { renderCartDrawer } from './components/cart-drawer.js';

console.log('app.js (módulo) cargado');

async function init() {
  try {
    const headerMount = document.getElementById('site-header');
    if (headerMount) renderHeader(headerMount);

    const drawerMount = document.getElementById('cart-drawer');
    if (drawerMount) renderCartDrawer(drawerMount);

    console.log('Fetch: cargando ./data/products.json ... desde', location.href);
    const res = await fetch('./data/products.json', { cache: 'no-store' });
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

init();