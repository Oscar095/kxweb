import { escapeHtml } from './utils/format.js';

// --- Flip cards: toggle on click/tap and on Enter/Space (keyboard) ---
document.querySelectorAll('.ceh-flip-card').forEach((card) => {
  const toggle = () => {
    const flipped = card.classList.toggle('is-flipped');
    card.setAttribute('aria-pressed', String(flipped));
  };
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
});

// --- Accordion: each item opens/closes independently ---
document.querySelectorAll('[data-accordion]').forEach((item) => {
  const header = item.querySelector('.ceh-accordion-header');
  header?.addEventListener('click', () => {
    const isOpen = item.classList.toggle('open');
    header.setAttribute('aria-expanded', String(isOpen));
  });
});

// --- Formulario de denuncia ---
const mount = document.getElementById('denuncia-root');
if (mount) {
  mount.innerHTML = `
    <form id="denuncia-form" class="modern-form">
      <div class="form-row">
        <div class="form-group">
          <label for="d-name">Nombre</label>
          <input id="d-name" name="name" placeholder="Tu nombre completo (opcional)" />
        </div>
        <div class="form-group">
          <label for="d-phone">Teléfono</label>
          <input id="d-phone" name="phone" type="tel" placeholder="+57 300 000 0000 (opcional)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="d-email">Correo electrónico</label>
          <input id="d-email" name="email" type="email" placeholder="correo@ejemplo.com (opcional)" />
        </div>
        <div class="form-group">
          <label for="d-id">Número de identificación</label>
          <input id="d-id" name="identification" placeholder="Opcional" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="d-accused-name">Nombre del denunciado</label>
          <input id="d-accused-name" name="accusedName" placeholder="Si lo conoces" />
        </div>
        <div class="form-group">
          <label for="d-accused-role">Cargo del denunciado</label>
          <input id="d-accused-role" name="accusedRole" placeholder="Si lo conoces" />
        </div>
      </div>

      <div class="form-group full-width">
        <label for="d-detail">Describe con detalle el motivo de la denuncia *</label>
        <textarea id="d-detail" name="detail" required placeholder="Cuéntanos qué sucedió, quiénes estuvieron involucrados y cualquier información relevante..."></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="d-date">Fecha del suceso</label>
          <input id="d-date" name="incidentDate" type="date" />
        </div>
        <div class="form-group">
          <label for="d-time">Hora del suceso</label>
          <input id="d-time" name="incidentTime" type="time" />
        </div>
      </div>

      <div class="form-group full-width">
        <label>¿Alguien más se enteró de lo sucedido?</label>
        <div class="ceh-radio-group">
          <label class="ceh-radio-option"><input type="radio" name="othersAware" value="no" checked /> No</label>
          <label class="ceh-radio-option"><input type="radio" name="othersAware" value="si" /> Sí</label>
        </div>
        <div class="ceh-conditional-field" id="others-aware-wrap">
          <div class="ceh-conditional-field-inner">
            <input id="d-others-detail" name="othersAwareDetail" placeholder="¿Quién más se enteró?" style="margin-top: 10px;" />
          </div>
        </div>
      </div>

      <div class="form-group full-width">
        <label for="attachments">Adjuntar archivos</label>
        <div class="file-upload-wrapper">
          <svg viewBox="0 0 24 24" fill="none" class="upload-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <span class="upload-text"><strong>Haz clic para subir evidencia</strong><br>Imágenes o PDF de soporte (máx 8MB c/u)</span>
          <input id="attachments" name="attachments" type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf" multiple class="file-input-hidden" />
        </div>
      </div>

      <div class="ceh-consent-row">
        <input type="checkbox" id="d-consent" name="consent" required />
        <label for="d-consent">Acepto que mis datos sean tratados conforme a la política de protección de datos personales establecida en la Ley 1581 de 2012 y los contemplados por KOS Colombia S.A.S. y sus finalidades, especialmente para realizar campañas de promoción, comercialización y fidelización de los bienes y servicios que se ofrecen, así como otros proyectos y/o productos de la empresa con la información objeto de este tratamiento. La <a href="/ptee" target="_blank" rel="noopener">política PTEE</a> y de protección de datos aplica a esta página.</label>
      </div>

      <div class="form-group full-width" style="margin-top: 8px; margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div id="recaptcha-error" style="display: none; color: #fecaca; background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.4); padding: 8px 16px; border-radius: 8px; margin-bottom: 12px; font-weight: 500; font-size: 0.95rem; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>Por favor, verifica que no eres un robot</span>
        </div>
        <div id="recaptcha-container" class="g-recaptcha" data-sitekey="6LetrigtAAAAAMm9bIxo_5cQXM-s8SosaZ1Ajh-s"></div>
      </div>

      <div class="actions full-width" style="margin-top: 4px;">
        <button type="submit" class="btn-secondary btn-submit" style="width: 100%; border-radius: 30px; font-size: 1.15rem; padding: 14px 24px;">Enviar denuncia</button>
      </div>
    </form>
    <div id="denuncia-result" style="text-align:center; padding-top: 16px;"></div>
  `;

  // Mostrar/ocultar el campo condicional "¿quién más se enteró?"
  const othersAwareRadios = mount.querySelectorAll('input[name="othersAware"]');
  const othersAwareWrap = document.getElementById('others-aware-wrap');
  const othersDetailInput = document.getElementById('d-others-detail');
  othersAwareRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      const show = mount.querySelector('input[name="othersAware"]:checked')?.value === 'si';
      othersAwareWrap.classList.toggle('is-visible', show);
      if (!show) othersDetailInput.value = '';
    });
  });

  // Actualizar texto visual al seleccionar archivos
  const fileInput = document.getElementById('attachments');
  const uploadText = mount.querySelector('.upload-text');
  const originalUploadText = uploadText ? uploadText.innerHTML : '';
  if (fileInput && uploadText) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        if (e.target.files.length === 1) {
          uploadText.innerHTML = `<strong>${escapeHtml(e.target.files[0].name)}</strong><br>Listo para enviar.`;
        } else {
          uploadText.innerHTML = `<strong>${e.target.files.length} archivos seleccionados</strong><br>Listos para enviar.`;
        }
      } else {
        uploadText.innerHTML = originalUploadText;
      }
    });
  }

  const form = document.getElementById('denuncia-form');
  const result = document.getElementById('denuncia-result');

  // Inyectar script de reCAPTCHA dinámicamente
  const recaptchaScript = document.createElement('script');
  recaptchaScript.src = 'https://www.google.com/recaptcha/api.js';
  recaptchaScript.async = true;
  recaptchaScript.defer = true;
  document.head.appendChild(recaptchaScript);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const recaptchaResponse = fd.get('g-recaptcha-response');
    const recaptchaError = document.getElementById('recaptcha-error');
    const recaptchaContainer = document.getElementById('recaptcha-container');

    if (!recaptchaResponse) {
      if (recaptchaError) {
        recaptchaError.style.display = 'flex';
        recaptchaContainer.classList.remove('shake-animation');
        void recaptchaContainer.offsetWidth;
        recaptchaContainer.classList.add('shake-animation');
      }
      return;
    } else if (recaptchaError) {
      recaptchaError.style.display = 'none';
    }

    try {
      const r = await fetch('/api/denuncias', { method: 'POST', body: fd });
      if (!r.ok) {
        const msg = await r.text();
        result.innerHTML = `<div class="ceh-form-error">No se pudo enviar la denuncia: ${escapeHtml(msg)}</div>`;
        return;
      }
      result.innerHTML = `<div class="ceh-form-success">Gracias por confiar en el Canal Ético. Tu denuncia fue recibida y será tratada con total confidencialidad.</div>`;
      form.reset();
      othersAwareWrap.classList.remove('is-visible');
    } catch (err) {
      console.error(err);
      result.innerHTML = `<div class="ceh-form-error">Error de red al enviar la denuncia. Intenta nuevamente.</div>`;
    }
  });
}
