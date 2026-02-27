import { cartService } from '../services/cart-service.js';
import { formatMoney } from '../utils/format.js';

export function renderCartDrawer(mount) {
  mount.className = 'cart-drawer';
  mount.innerHTML = `
    <div class="cart-header">
      <h2>Carrito</h2>
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="clear-cart" title="Vaciar carrito" style="background:transparent; border:none; color:var(--muted); text-decoration:underline; cursor:pointer; font-weight:600; font-size: 0.9rem;">Vaciar</button>
        <button id="close-cart" title="Cerrar" style="background:var(--primary); color:#fff; border:none; width: 32px; height: 32px; border-radius: 50%; font-weight: bold; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 12px rgba(0,159,227,0.3);">✕</button>
      </div>
    </div>
    <div class="cart-body" id="cart-body"></div>
    <div class="cart-footer">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <span style="font-size:1.1rem; color:var(--muted); font-weight:600;">Total a Pagar:</span>
        <strong id="cart-total" style="font-size:1.6rem; color:var(--text-main);">$0,00</strong>
      </div>
      <button id="checkout" class="btn-primary" style="width: 100%; font-size: 1.15rem; padding: 14px; border-radius: 12px; box-sizing: border-box; text-align:center;">Procesar Pago</button>
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

  function update(items) {
    const grouped = groupItems(items);
    const body = document.getElementById('cart-body');
    body.innerHTML = grouped.length ? grouped.map(i => `
      <div class="cart-item" data-id="${i.id}" style="display:flex;align-items:center;justify-content:space-between;gap:12px; padding: 12px; margin-bottom: 12px; background: rgba(255,255,255,0.5); border: 1px solid rgba(0,0,0,0.05); border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <a href="/product?id=${i.id}" style="flex-shrink:0;display:block;" title="Ver ${i.name}">
          <img src="${i.image || '/images/placeholder.svg'}" alt="${i.name}" onerror="this.onerror=null;this.src='/images/placeholder.svg'" style="width:64px;height:64px;object-fit:contain;background:#fff;border-radius:12px;padding:4px;transition:opacity .2s;" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'" />
        </a>
        <div class="meta" style="flex:1;min-width:0;">
          <a href="/product?id=${i.id}" style="text-decoration:none;color:inherit;"><div style="font-weight:700;white-space:normal;overflow:visible; font-size: 1rem; color:var(--text-main); line-height: 1.2;">${i.name}</div></a>
          <div style="color:var(--primary);font-size:13px; font-weight: 600; margin-top:4px;">$${formatMoney(i.price)}</div>
          <div style="color:var(--text-main);font-size:13px; margin-top:2px;">Subtotal: <strong>$${formatMoney(i.subtotal)}</strong></div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <button data-id="${i.id}" class="remove" style="color:#ff4d4f;background:transparent; border:none; font-weight:600; font-size:12px;cursor:pointer; padding:0; text-decoration:underline;">Quitar</button>
          
          <div class="qty-controls" style="display:flex;align-items:center;gap:4px; background: rgba(0,0,0,0.04); border-radius:8px; padding:4px;">
            <button class="dec" aria-label="Disminuir" style="width:24px;height:24px;border-radius:6px;color:var(--text-main);background:#fff;border:1px solid rgba(0,0,0,0.05);cursor:pointer;font-weight:bold;">-</button>
            <input type="number" class="qty" min="1" value="${i.quantity}" style="width:32px;text-align:center;background:transparent;border:none;font-weight:700;color:var(--text-main);font-size:0.9rem;"/>
            <button class="inc" aria-label="Aumentar" style="width:24px;height:24px;border-radius:6px;color:#fff;background:var(--primary);border:none;cursor:pointer;font-weight:bold;">+</button>
          </div>
        </div>
      </div>
    `).join('') : '<div style="text-align:center; padding:40px 0; color:var(--muted); font-weight:600;">Ouch, tu carrito está vacío 🛒</div>';

    const total = grouped.reduce((s, it) => s + it.subtotal, 0);
    document.getElementById('cart-total').textContent = `Total: $${formatMoney(total)}`;
  }

  cartService.onChange = update;
  cartService._notify();

  mount.querySelector('#close-cart').addEventListener('click', () => mount.classList.remove('open'));

  let clearConfirmTimeout = null;

  mount.addEventListener('click', (e) => {
    const clearBtn = e.target.closest('#clear-cart');
    if (clearBtn) {
      e.preventDefault();
      e.stopPropagation();

      if (clearBtn.dataset.confirm === 'true') {
        cartService.clear();
        mount.classList.remove('open');
        clearBtn.dataset.confirm = 'false';
        clearBtn.textContent = 'Vaciar';
        clearBtn.style.color = 'var(--muted)';
        clearTimeout(clearConfirmTimeout);
      } else {
        clearBtn.dataset.confirm = 'true';
        clearBtn.textContent = '¿Seguro?';
        clearBtn.style.color = '#ff4d4f';
        clearConfirmTimeout = setTimeout(() => {
          clearBtn.dataset.confirm = 'false';
          clearBtn.textContent = 'Vaciar';
          clearBtn.style.color = 'var(--muted)';
        }, 4500);
      }
      return;
    }

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
    window.location.href = '/checkout';
  });
}