import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { escapeHtml } from '../utils/format.js';

renderHeader(document.getElementById('site-header'));
renderCartDrawer(document.getElementById('cart-drawer'));

const mount = document.getElementById('contact-root');
mount.innerHTML = `
  <form id="contact-form" class="contact-form modern-form">
    <div class="form-row">
      <div class="form-group">
        <label for="name">Full Name</label>
        <input id="name" name="name" required placeholder="Your full name" />
      </div>
      <div class="form-group">
        <label for="phone">Phone</label>
        <input id="phone" name="phone" type="tel" placeholder="+1 000 000 0000" />
      </div>
    </div>
    <div class="form-group full-width">
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" required placeholder="email@example.com" />
    </div>
    <div class="form-group full-width">
      <label for="message">Message</label>
      <textarea id="message" name="message" required placeholder="Describe your inquiry, product of interest, or order details..."></textarea>
    </div>
    <div class="form-group full-width">
      <label for="attachments">Attachments</label>
      <div class="file-upload-wrapper">
        <svg viewBox="0 0 24 24" fill="none" class="upload-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span class="upload-text"><strong>Click to upload files</strong><br>Logos, designs, reference images (max 10MB)</span>
        <input id="attachments" name="attachments" type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf" multiple class="file-input-hidden" />
      </div>
    </div>
    <style>
      @keyframes shakeError {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
      }
      .shake-animation {
        animation: shakeError 0.4s ease-in-out;
      }
    </style>
    <div class="form-group full-width" style="margin-top: 24px; margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div id="recaptcha-error" style="display: none; color: #d93025; background: #fce8e6; border: 1px solid #fad2cf; padding: 8px 16px; border-radius: 8px; margin-bottom: 12px; font-weight: 500; font-size: 0.95rem; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(217, 48, 37, 0.15);">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Please verify that you are not a robot</span>
      </div>
      <div id="recaptcha-container" class="g-recaptcha" data-sitekey="6LetrigtAAAAAMm9bIxo_5cQXM-s8SosaZ1Ajh-s"></div>
    </div>
    <div class="actions full-width" style="margin-top: 12px;">
      <button type="submit" class="btn-primary btn-submit" style="width: 100%; border-radius: 30px; font-size: 1.15rem; padding: 14px 24px;">Send message</button>
    </div>
  </form>
  <div id="contact-result" style="text-align:center; padding-top: 16px;"></div>
`;

// File upload feedback
const fileInput = document.getElementById('attachments');
const uploadText = document.querySelector('.upload-text');
const originalUploadText = uploadText ? uploadText.innerHTML : '';

if (fileInput && uploadText) {
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length === 1) {
        uploadText.innerHTML = `<strong>${escapeHtml(e.target.files[0].name)}</strong><br>Ready to send.`;
      } else {
        uploadText.innerHTML = `<strong>${e.target.files.length} files selected</strong><br>Ready to send.`;
      }
    } else {
      uploadText.innerHTML = originalUploadText;
    }
  });
}

const form = document.getElementById('contact-form');
const result = document.getElementById('contact-result');

// Inject reCAPTCHA script dynamically
const recaptchaScript = document.createElement('script');
recaptchaScript.src = "https://www.google.com/recaptcha/api.js";
recaptchaScript.async = true;
recaptchaScript.defer = true;
document.head.appendChild(recaptchaScript);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  fd.set('name', (fd.get('name') || '').toString().trim());
  fd.set('email', (fd.get('email') || '').toString().trim());
  fd.set('phone', (fd.get('phone') || '').toString().trim());
  fd.set('message', (fd.get('message') || '').toString().trim());

  const recaptchaResponse = fd.get('g-recaptcha-response');
  const recaptchaError = document.getElementById('recaptcha-error');
  const recaptchaContainer = document.getElementById('recaptcha-container');

  if (!recaptchaResponse) {
    if (recaptchaError) {
      recaptchaError.style.display = 'flex';
      recaptchaContainer.classList.remove('shake-animation');
      void recaptchaContainer.offsetWidth;
      recaptchaContainer.classList.add('shake-animation');
    } else {
      result.innerHTML = `<div class="contact-error">Please check the "I'm not a robot" box.</div>`;
    }
    return;
  } else {
    if (recaptchaError) recaptchaError.style.display = 'none';
  }

  try {
    const r = await fetch('/api/contacts', { method: 'POST', body: fd });
    if (!r.ok) {
      result.innerHTML = `<div class="contact-error">Something went wrong — please check your information and try again.</div>`;
      return;
    }
    const name = escapeHtml(fd.get('name') || '');
    const email = escapeHtml(fd.get('email') || '');
    result.innerHTML = `<div class="contact-success">Thank you, ${name}! Your message has been received. We'll get back to you at ${email}.</div>`;
    form.reset();
  } catch (err) {
    console.error(err);
    result.innerHTML = `<div class="contact-error">Network error while sending the form. Please try again.</div>`;
  }
});
