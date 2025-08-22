import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

// Leer carrito desde localStorage (misma llave que usa tu cart-service)
const cart = JSON.parse(localStorage.getItem('cart') || '[]');

function renderSummary(mount, items) {
  if (!mount) return;
  if (!items.length) {
    mount.innerHTML = '<p>El carrito está vacío.</p>';
    return;
  }
  const total = items.reduce((s,i)=> s + Number(i.price || 0), 0);
  mount.innerHTML = `
    <h2>Resumen de la orden</h2>
    <ul>
      ${items.map(i=>`<li>${i.name} — $${Number(i.price).toFixed(2)}</li>`).join('')}
    </ul>
    <p><strong>Total: $${total.toFixed(2)}</strong></p>
  `;
  return total;
}

const summaryMount = document.getElementById('order-summary');
const total = renderSummary(summaryMount, cart);

const form = document.getElementById('checkout-form');
const message = document.getElementById('checkout-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = '';

  if (!cart.length) {
    message.textContent = 'El carrito está vacío.';
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  // construir payload para el servidor
  const payload = {
    shipping: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      notes: data.notes || ''
    },
    paymentMethod: data.paymentMethod,
    items: cart
  };

  try {
    document.getElementById('pay-btn').disabled = true;
    message.textContent = 'Creando orden...';

    // Llamar a tu backend que comunica con PayU y devuelve la URL donde redirigir
    const res = await fetch('/api/create-payu-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json();
    if (res.ok && body.redirectUrl) {
      // redirigir al checkout de PayU (o a la página de pago retornada por tu servidor)
      window.location.href = body.redirectUrl;
    } else {
      message.textContent = body.message || 'Error al crear la orden.';
      document.getElementById('pay-btn').disabled = false;
    }
  } catch (err) {
    console.error(err);
    message.textContent = 'Error de red, intenta de nuevo.';
    document.getElementById('pay-btn').disabled = false;
  }
});