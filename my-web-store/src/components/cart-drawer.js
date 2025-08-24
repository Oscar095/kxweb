import { cartService } from '../services/cart-service.js';

export function renderCartDrawer(mount) {
  mount.className = 'cart-drawer';
  mount.innerHTML = `
    <div class="cart-header">
      <strong style="font-size: 1.25rem;color: #fff">Carrito de Compras</strong>
      <button id="close-cart" style="background: none; border: none; color: #fff; font-size: 1.25rem;">X</button>
    </div>
    <div class="cart-body" id="cart-body"></div>
    <div class="cart-footer" style="display: flex; align-items: center; justify-content: space-between;">
      <a id="cart-total" style="margin-right: auto;">Total: $0.00</a>
      <button id="checkout" class="btn-primary" style="flex-shrink: 0; scale: 0.75;;">Ir a Pagar</button>
    </div>
  `;

  function update(items){
    const body = document.getElementById('cart-body');
    body.innerHTML = items.length ? items.map(i => `
      <div class="cart-item">
      <div class="meta">
        <div>${i.name}</div>
        <div style="color:var(--muted);font-size:13px">$${Number(i.price).toFixed(2)}</div>
      </div>
      <button data-id="${i.id}" class="remove" style="color:black;font-size:14px;padding:8px 8px;">Eliminar</button>
      </div>
    `).join('') : '<div>Tu carrito está vacío</div>';

    const total = items.reduce((s, it) => s + Number(it.price), 0);
    document.getElementById('cart-total').textContent = `Total: $${total.toFixed(2)}`;
  }

  cartService.onChange = update;
  cartService._notify();

  mount.querySelector('#close-cart').addEventListener('click', () => mount.classList.remove('open'));
  mount.addEventListener('click', (e)=> {
    const btn = e.target.closest('.remove');
    if (!btn) return;
    cartService.remove(Number(btn.dataset.id));
  });

  // global events
  window.addEventListener('toggle-cart', () => mount.classList.toggle('open'));

  // reemplaza el listener del botón checkout por:
  mount.querySelector('#checkout').addEventListener('click', () => {
    // redirige al checkout local donde el usuario completa dirección y elige método
    window.location.href = 'checkout.html';
  });
}