import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

const mount = document.getElementById('contact-root');
mount.innerHTML = `
  <form id="contact-form" class="contact-form">
    <div style="margin-bottom: 8px;">
      <label for="name">Nombre</label>
      <input id="name" name="name" required placeholder="Tu nombre completo" />
    </div>
    <div style="margin-bottom: 8px;">
      <label for="email">Correo</label>
      <input id="email" name="email" type="email" required placeholder="tucorreo@ejemplo.com" />
    </div>
    <div style="margin-bottom: 8px;">
      <label for="phone">Celular</label>
      <input id="phone" name="phone" type="tel" placeholder="(123) 456-7890" />
    </div>
    <div style="margin-bottom: 8px;">
      <label for="message">Descripción de la necesidad</label>
      <textarea id="message" name="message" required placeholder="Escribe aquí tu mensaje..."></textarea>
    </div>
    <div style="margin-bottom: 16px;">
      <label for="attachments">Adjuntos (imágenes o PDF)</label>
      <input id="attachments" name="attachments" type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf" multiple style="background: rgba(255,255,255,0.4);" />
    </div>
    <div class="actions">
      <button type="submit" class="btn-primary" style="width: 100%; border-radius: 12px; font-size: 1.25rem;">Enviar Mensaje</button>
    </div>
  </form>
  <div id="contact-result" style="text-align:center; padding-top: 16px;"></div>
`;

const form = document.getElementById('contact-form');
const result = document.getElementById('contact-result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  // Normaliza strings
  fd.set('name', (fd.get('name') || '').toString().trim());
  fd.set('email', (fd.get('email') || '').toString().trim());
  fd.set('phone', (fd.get('phone') || '').toString().trim());
  fd.set('message', (fd.get('message') || '').toString().trim());

  try {
    const r = await fetch('/api/contacts', { method: 'POST', body: fd });
    if (!r.ok) {
      const msg = await r.text();
      result.innerHTML = `<div class="contact-error">No se pudo enviar: ${msg}</div>`;
      return;
    }
    const name = fd.get('name');
    const email = fd.get('email');
    result.innerHTML = `<div class="contact-success">Gracias ${name}, tu mensaje fue recibido. Te contactaremos al ${email}.</div>`;
    form.reset();
  } catch (err) {
    console.error(err);
    result.innerHTML = `<div class="contact-error">Error de red al enviar el formulario.</div>`;
  }
});
