import { cartService } from '../services/cart-service.js';
import { formatMoney } from '../utils/format.js';

export function renderCartDrawer(mount) {
  mount.className = 'cart-drawer';
  mount.innerHTML = `
    <div class="cart-header">
      <strong style="font-size: 1.25rem;color: #fff">Carrito de Compras</strong>
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="clear-cart" class="btn-primary" title="Vaciar carrito" style="font-size: 1.2rem; padding: 6px 10px; border-radius: 6px; scale: 0.75;">Vaciar Carrito</button>
        <button id="close-cart" class="btn-primary" title="Cerrar" style="padding: 6px 10px; border-radius: 6px; scale: 0.75; font-size: 1.2rem;">X</button>
      </div>
    </div>
    <div class="cart-body" id="cart-body"></div>
    <div class="cart-footer" style="display: flex; align-items: center; justify-content: space-between;">
  <a id="cart-total" style="margin-right: auto;">Total: $0,00</a>
      <button id="checkout" class="btn-primary" style="flex-shrink: 0; scale: 0.75;;">Ir a Pagar</button>
    </div>
  `;

  // Precio por caja: intenta usar campo dinámico precioCaja si existe, sino derivar
  function priceOf(item) {
    const rawCandidate = item?.precioCaja ?? item?.precio_caja ?? item?.price ?? item?.precio ?? 0;
    const num = typeof rawCandidate === 'string' ? Number(rawCandidate.replace(/[^\d.-]/g, '')) : Number(rawCandidate);
    return Number.isFinite(num) ? num : 0;
  }

  function groupItems(items) {
    const map = new Map();
    items.forEach(it => {
      const id = it.id;
      const price = priceOf(it);
      const qty = Math.max(1, Number(it._qty) || 1); // usa _qty si existe; sino 1
      // Determina imagen de portada
      const cover = (Array.isArray(it.images) && it.images[0]) ? it.images[0] : (it.image || '/images/placeholder.svg');
      const g = map.get(id) || { id, name: it.name, price, image: cover, quantity: 0, subtotal: 0 };
      if (!g.image) g.image = cover;
      g.quantity += qty;
      g.subtotal = g.price * g.quantity;
      map.set(id, g);
    });
    return Array.from(map.values());
  }

  function update(items){
    const grouped = groupItems(items);
    const body = document.getElementById('cart-body');
    body.innerHTML = grouped.length ? grouped.map(i => `
      <div class="cart-item" data-id="${i.id}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <img src="${i.image || '/images/placeholder.svg'}" alt="${i.name}" onerror="this.onerror=null;this.src='/images/placeholder.svg'" style="width:56px;height:56px;object-fit:contain;background:#fff;border:1px solid #eee;border-radius:6px;flex-shrink:0;" />
        <div class="meta" style="flex:1;min-width:0;">
          <div style="font-weight:600;white-space:normal;overflow:visible;">${i.name}</div>
          <div style="color:var(--muted);font-size:13px">$${formatMoney(i.price)} / caja · Subtotal $${formatMoney(i.subtotal)}</div>
        </div>
        <div class="qty-controls" style="display:flex;align-items:center;gap:6px;">
          <button class="dec" aria-label="Disminuir" style="width:28px;height:28px;border-radius:6px;">-</button>
          <input type="number" class="qty" min="1" value="${i.quantity}" style="width:56px;text-align:center;"/>
          <button class="inc" aria-label="Aumentar" style="width:28px;height:28px;border-radius:6px;">+</button>
        </div>
        <button data-id="${i.id}" class="remove" style="color:black;font-size:10px;padding:3px 5px;border-radius:6px;">Eliminar</button>
      </div>
    `).join('') : '<div>Tu carrito está vacío</div>';

  const total = grouped.reduce((s, it) => s + it.subtotal, 0);
  document.getElementById('cart-total').textContent = `Total: $${formatMoney(total)}`;
  }

  cartService.onChange = update;
  cartService._notify();

  mount.querySelector('#close-cart').addEventListener('click', () => mount.classList.remove('open'));
  mount.querySelector('#clear-cart').addEventListener('click', () => {
    if (confirm('¿Vaciar todo el carrito?')) cartService.clear();
  });
  mount.addEventListener('click', (e)=> {
    const removeBtn = e.target.closest('.remove');
    if (removeBtn) {
      cartService.remove(Number(removeBtn.dataset.id));
      return;
    }
    const inc = e.target.closest('.inc');
    if (inc) {
      const row = inc.closest('.cart-item');
      const id = Number(row?.dataset.id);
      if (Number.isFinite(id)) cartService.changeQty(id, +1);
      return;
    }
    const dec = e.target.closest('.dec');
    if (dec) {
      const row = dec.closest('.cart-item');
      const id = Number(row?.dataset.id);
      if (Number.isFinite(id)) cartService.changeQty(id, -1);
      return;
    }
  });

  // Cambios directos de input cantidad
  mount.addEventListener('change', (e) => {
    const input = e.target.closest('input.qty');
    if (!input) return;
    const row = input.closest('.cart-item');
    const id = Number(row?.dataset.id);
    const val = Math.max(1, Math.floor(Number(input.value) || 1));
    input.value = String(val);
    if (Number.isFinite(id)) cartService.setQty(id, val);
  });

  // global events
  window.addEventListener('toggle-cart', () => mount.classList.toggle('open'));

  // reemplaza el listener del botón checkout por:
  mount.querySelector('#checkout').addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });
}