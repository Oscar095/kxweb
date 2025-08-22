import { renderHeader } from './components/header.js';
import { cartService } from './services/cart-service.js';

function renderCartPage(mount) {
  function update(items) {
    mount.innerHTML = items.length ? items.map(i => `
      <div class="cart-item">
        <div>${i.name}</div>
        <div>$${Number(i.price).toFixed(2)}</div>
        <div><button data-id="${i.id}" class="remove">Eliminar</button></div>
      </div>
    `).join('') : '<div>Tu carrito está vacío</div>';

    const total = items.reduce((s, it) => s + Number(it.price), 0);
    mount.insertAdjacentHTML('beforeend', `<div class="cart-total">Total: $${total.toFixed(2)}</div>`);
  }

  cartService.onChange = (items) => {
    mount.innerHTML = '';
    update(items);
  };

  cartService._notify();

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove');
    if (!btn) return;
    cartService.remove(Number(btn.dataset.id));
  });
}

renderHeader(document.getElementById('site-header'));
renderCartPage(document.getElementById('cart-page'));
