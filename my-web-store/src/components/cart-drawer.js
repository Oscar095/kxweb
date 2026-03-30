import { cartService } from '../services/cart-service.js';
import { formatMoney } from '../utils/format.js';

// --- Inventory check helper for cart ---
// Cache to avoid repeated fetches for the same SKU during a session
const _cartInvCache = new Map();

async function getMaxBoxes(item) {
  const sku = (item.codigo_siesa || item.sku || item.SKU || item.item_ext || '').toString().trim();
  if (!sku) return Infinity; // sin SKU, no limitar

  if (_cartInvCache.has(sku)) return _cartInvCache.get(sku);

  try {
    const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`);
    if (!r.ok) { _cartInvCache.set(sku, 0); return 0; }
    const data = await r.json();
    const estado = (data && (data.estado || data.status || '')).toString();
    if (estado !== 'En Existencia') { _cartInvCache.set(sku, 0); return 0; }
    const inventario = Number(data?.inventario);
    if (!Number.isFinite(inventario)) { _cartInvCache.set(sku, Infinity); return Infinity; }
    const rawUnits = item.cantidad ?? item.Cantidad ?? 1000;
    const unitsPerBox = (Number.isFinite(Number(rawUnits)) && Number(rawUnits) > 0) ? Number(rawUnits) : 1000;
    const maxBoxes = Math.floor(inventario / unitsPerBox);
    _cartInvCache.set(sku, maxBoxes);
    return maxBoxes;
  } catch {
    _cartInvCache.set(sku, 0);
    return 0;
  }
}

function showCartToast(msg, type = 'error') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  toast.className = type === 'error' ? 'toast-error' : 'toast-success';
  toast.textContent = msg;
  root.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

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
      <div class="cart-summary">
        <span style="font-size:1.1rem; color:var(--muted); font-weight:600;">Total a Pagar:</span>
        <div id="cart-total"></div>
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
      const qty = Math.max(1, Number(it._qty) || 1);
      const cover = (Array.isArray(it.images) && it.images[0]) ? it.images[0] : (it.image || '/images/placeholder.svg');
      const g = map.get(id) || { id, name: it.name, price, image: cover, quantity: 0, subtotal: 0, _raw: it };
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
          <div style="color:var(--primary);font-size:13px; font-weight: 600; margin-top:4px;">$${formatMoney(Math.round(i.price * 1.19))} <span style="font-size:10px;color:#f28c30;">IVA incl.</span></div>
          <div style="color:var(--text-main);font-size:13px; margin-top:2px;">Subtotal: <strong>$${formatMoney(Math.round(i.subtotal * 1.19))}</strong></div>
          <div class="cart-stock-warning" data-id="${i.id}" style="display:none; color:#ef4444; font-size:11px; font-weight:600; margin-top:2px;"></div>
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

    const total = grouped.reduce((s, it) => s + Math.round(it.subtotal * 1.19), 0);
    document.getElementById('cart-total').innerHTML = `<strong>$${formatMoney(total)}</strong> <span style="font-size:0.75rem;color:#f28c30;font-weight:600;">IVA incluido</span>`;

    // After rendering, check stock limits for each item
    grouped.forEach(g => checkAndShowStockWarning(g.id, g.quantity, g._raw));
  }

  // Check stock and show/hide warning + disable + button if at limit
  async function checkAndShowStockWarning(productId, currentQty, rawItem) {
    if (!rawItem) return;
    const maxBoxes = await getMaxBoxes(rawItem);
    const warning = mount.querySelector(`.cart-stock-warning[data-id="${productId}"]`);
    const row = mount.querySelector(`.cart-item[data-id="${productId}"]`);
    const incBtn = row?.querySelector('.inc');

    if (maxBoxes !== Infinity && currentQty >= maxBoxes) {
      if (incBtn) {
        incBtn.disabled = true;
        incBtn.style.opacity = '0.4';
        incBtn.style.cursor = 'not-allowed';
      }
      if (currentQty > maxBoxes && maxBoxes >= 0) {
        if (warning) { warning.style.display = 'block'; warning.textContent = `Máximo ${maxBoxes} caja${maxBoxes !== 1 ? 's' : ''} disponible${maxBoxes !== 1 ? 's' : ''}`; }
        // Auto-correct to max
        if (maxBoxes > 0) {
          cartService.setQty(productId, maxBoxes);
        } else {
          cartService.remove(productId);
          showCartToast('Producto agotado, removido del carrito', 'error');
        }
      } else {
        if (warning) { warning.style.display = 'block'; warning.textContent = `Máximo disponible alcanzado`; }
      }
    } else {
      if (incBtn) {
        incBtn.disabled = false;
        incBtn.style.opacity = '';
        incBtn.style.cursor = '';
      }
      if (warning) warning.style.display = 'none';
    }
  }

  cartService.onChange = update;
  cartService._notify();

  mount.querySelector('#close-cart').addEventListener('click', () => {
    mount.classList.remove('open');
    document.body.classList.remove('cart-open');
  });

  let clearConfirmTimeout = null;

  mount.addEventListener('click', async (e) => {
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
      const id = Number(removeBtn.dataset.id);
      // Clear inventory cache for this item
      const item = cartService.items.find(it => it.id === id);
      if (item) {
        const sku = (item.codigo_siesa || item.sku || item.SKU || item.item_ext || '').toString().trim();
        if (sku) _cartInvCache.delete(sku);
      }
      cartService.remove(id);
      return;
    }

    const inc = e.target.closest('.inc');
    if (inc) {
      const row = inc.closest('.cart-item');
      const id = Number(row?.dataset.id);
      if (!Number.isFinite(id)) return;

      // Check inventory before allowing increment
      const item = cartService.items.find(it => it.id === id);
      if (item) {
        inc.disabled = true;
        inc.textContent = '…';
        const maxBoxes = await getMaxBoxes(item);
        const currentQty = Number(item._qty) || 1;
        inc.textContent = '+';

        if (maxBoxes !== Infinity && currentQty >= maxBoxes) {
          inc.disabled = true;
          inc.style.opacity = '0.4';
          showCartToast(`Stock máximo: ${maxBoxes} caja${maxBoxes !== 1 ? 's' : ''}`, 'error');
          return;
        }
        inc.disabled = false;
      }

      cartService.changeQty(id, +1);
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
  mount.addEventListener('change', async (e) => {
    const input = e.target.closest('input.qty');
    if (!input) return;
    const row = input.closest('.cart-item');
    const id = Number(row?.dataset.id);
    let val = Math.max(1, Math.floor(Number(input.value) || 1));

    if (Number.isFinite(id)) {
      const item = cartService.items.find(it => it.id === id);
      if (item) {
        const maxBoxes = await getMaxBoxes(item);
        if (maxBoxes !== Infinity && val > maxBoxes) {
          val = Math.max(1, maxBoxes);
          showCartToast(`Stock máximo: ${maxBoxes} caja${maxBoxes !== 1 ? 's' : ''}`, 'error');
        }
      }
      input.value = String(val);
      cartService.setQty(id, val);
    }
  });

  // global events
  window.addEventListener('toggle-cart', () => {
    mount.classList.toggle('open');
    document.body.classList.toggle('cart-open', mount.classList.contains('open'));
    // Invalidate cache when opening cart so we get fresh inventory
    if (mount.classList.contains('open')) {
      _cartInvCache.clear();
      cartService._notify(); // re-render to re-check stock
    }
  });

  mount.querySelector('#checkout').addEventListener('click', () => {
    window.location.href = '/checkout';
  });
}
