import { renderHeader } from './components/header.js?v=2';
import { renderCartDrawer } from './components/cart-drawer.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

const mount = document.getElementById('contact-root');
mount.innerHTML = `
  <form id="contact-form" class="contact-form modern-form">
    <div class="form-row">
      <div class="form-group">
        <label for="name">Nombre</label>
        <input id="name" name="name" required placeholder="Tu nombre completo" />
      </div>
      <div class="form-group">
        <label for="phone">Telefono</label>
        <input id="phone" name="phone" type="tel" placeholder="+57 300 000 0000" />
      </div>
    </div>
    <div class="form-group full-width">
      <label for="email">Correo electronico</label>
      <input id="email" name="email" type="email" required placeholder="correo@ejemplo.com" />
    </div>
    <div class="form-group full-width">
      <label for="message">Mensaje</label>
      <textarea id="message" name="message" required placeholder="Describe tu consulta, producto de interes o pedido..."></textarea>
    </div>
    <div class="form-group full-width">
      <label for="attachments">Archivos adjuntos</label>
      <div class="file-upload-wrapper">
        <svg viewBox="0 0 24 24" fill="none" class="upload-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span class="upload-text"><strong>Haz clic para subir archivos</strong><br>Logos, diseños, imagenes de referencia (max 10MB)</span>
        <input id="attachments" name="attachments" type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf" multiple class="file-input-hidden" />
      </div>
    </div>
    <div class="actions full-width" style="margin-top: 12px;">
      <button type="submit" class="btn-primary btn-submit" style="width: 100%; border-radius: 30px; font-size: 1.15rem; padding: 14px 24px;">Enviar mensaje</button>
    </div>
  </form>
  <div id="contact-result" style="text-align:center; padding-top: 16px;"></div>
`;

// Make the visual file upload update when files are selected
const fileInput = document.getElementById('attachments');
const uploadText = document.querySelector('.upload-text');
const originalUploadText = uploadText ? uploadText.innerHTML : '';

if (fileInput && uploadText) {
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length === 1) {
        uploadText.innerHTML = `<strong>${e.target.files[0].name}</strong><br>Listo para enviar.`;
      } else {
        uploadText.innerHTML = `<strong>${e.target.files.length} archivos seleccionados</strong><br>Listos para enviar.`;
      }
    } else {
      uploadText.innerHTML = originalUploadText;
    }
  });
}

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
