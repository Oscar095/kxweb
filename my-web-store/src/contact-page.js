import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

const mount = document.getElementById('contact-root');
mount.innerHTML = `
  <form id="contact-form" class="contact-form">
    <div>
      <label for="name">Nombre</label>
      <input id="name" name="name" required />
    </div>
    <div>
      <label for="email">Correo</label>
      <input id="email" name="email" type="email" required />
    </div>
    <div>
      <label for="phone">Celular</label>
      <input id="phone" name="phone" type="tel" />
    </div>
    <div>
      <label for="message">Descripción de la necesidad</label>
      <textarea id="message" name="message" required></textarea>
    </div>
    <div class="actions">
      <button type="submit" class="btn-primary">Enviar</button>
    </div>
  </form>
  <div id="contact-result"></div>
`;

const form = document.getElementById('contact-form');
const result = document.getElementById('contact-result');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    message: form.message.value.trim()
  };

  // Simular envío: mostrar resultado y limpiar
  result.innerHTML = `<div class="contact-success">Gracias ${data.name}, tu mensaje fue recibido. Te contactaremos al ${data.email}.</div>`;
  form.reset();
});
