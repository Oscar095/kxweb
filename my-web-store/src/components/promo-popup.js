export function initPromoPopup() {
  if (window._PROMO_V3_INIT) return;
  window._PROMO_V3_INIT = true;

  if (localStorage.getItem('kx_promo_v3_dismissed') === 'true') {
    return;
  }

  const REQUIRED_TIME_MS = 10000;
  
  let sessionStart = sessionStorage.getItem('kx_promo_v3_start');
  if (!sessionStart) {
    sessionStart = Date.now().toString();
    sessionStorage.setItem('kx_promo_v3_start', sessionStart);
    console.log('[Promo] Nueva sesión iniciada.');
  }
  
  const startTime = parseInt(sessionStart, 10);

  const checkPopup = () => {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    
    // Log para que el usuario vea el progreso en consola
    if (seconds <= 12) {
      console.log(`[Promo] Tiempo acumulado: ${seconds}s / 10s`);
    }

    if (elapsed >= REQUIRED_TIME_MS) {
      showPromoPopup();
      return true;
    }
    return false;
  };

  if (checkPopup()) return;

  const timerInterval = setInterval(() => {
    if (checkPopup()) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

function injectPromoStyles() {
  if (document.getElementById('promo-v3-styles')) return;
  const style = document.createElement('style');
  style.id = 'promo-v3-styles';
  style.textContent = `
    .promo-v3-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 100000;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 0.5s ease;
    }
    .promo-v3-overlay.active { opacity: 1; pointer-events: auto; }
    .promo-v3-content {
      background: #fff; border-radius: 22px; width: 78%; max-width: 300px;
      max-height: 90vh; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch;
      position: relative;
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      transform: scale(0.8); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      margin: 20px;
    }
    .promo-v3-overlay.active .promo-v3-content { transform: scale(1); }
    .promo-v3-close {
      position: absolute; top: 10px; right: 10px; width: 36px; height: 36px;
      background: rgba(0,0,0,0.6); border: 2px solid rgba(255,255,255,0.8); border-radius: 50%;
      color: #fff; font-size: 24px; cursor: pointer; z-index: 100;
      display: flex; align-items: center; justify-content: center;
      line-height: 1; transition: background 0.3s;
    }
    .promo-v3-close:hover { background: rgba(0,0,0,0.9); }
    /* aspect-ratio 9:16 = formato historia de Instagram (1080x1920), el que se sube desde el
       admin — el ancho de la tarjeta define la altura exacta de la foto, así nunca se recorta
       ni se estira. Si algún día se sube una imagen con otra proporción, object-fit:contain
       la deja completa (con márgenes) en vez de recortarla. El overflow-y del padre (arriba)
       sigue siendo el respaldo para pantallas extremadamente bajas. */
    .promo-v3-img-wrap { width: 100%; aspect-ratio: 9 / 16; overflow: hidden; background: #fff; position: relative; }
    .promo-v3-img-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .promo-v3-badge {
      position: absolute; top: 12px; left: 12px; z-index: 10;
      background: #ff4d4f; color: #fff; font-weight: 800; font-size: 0.8rem;
      padding: 5px 12px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .promo-v3-body { padding: 16px; text-align: center; }
    .promo-v3-body h3 { font-size: 1.1rem; color: #1a1a1a; margin: 0 0 12px 0; font-weight: 800; line-height: 1.2; }
    .promo-v3-vigencia { margin: -6px 0 10px 0; font-size: 0.75rem; font-weight: 700; color: #ff4d4f; }
    .promo-v3-btn {
      width: 100%; padding: 12px; border-radius: 50px; border: none;
      background: #00a4e4; color: #fff; font-size: 0.9rem; font-weight: 700;
      text-transform: uppercase; cursor: pointer; margin-bottom: 12px;
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
      box-shadow: 0 4px 15px rgba(0, 164, 228, 0.3);
    }
    .promo-v3-btn:active { transform: scale(0.96); }
    .promo-v3-btn:hover { background: #008cc2; }
    .promo-v3-optout { font-size: 0.78rem; color: #666; display: flex; align-items: center; justify-content: center; }
    .promo-v3-optout input { margin-right: 8px; width: 16px; height: 16px; cursor: pointer; accent-color: #00a4e4; }
    .promo-v3-optout label { cursor: pointer; user-select: none; }

    @media (max-width: 600px) {
      .promo-v3-content { border-radius: 18px; width: 68%; max-width: 260px; margin: 10px; }
      .promo-v3-body { padding: 14px; }
      .promo-v3-body h3 { font-size: 1rem; margin-bottom: 10px; }
      .promo-v3-close { top: 8px; right: 8px; width: 32px; height: 32px; font-size: 20px; }
      .promo-v3-btn { padding: 10px; font-size: 0.85rem; margin-bottom: 10px; }
      .promo-v3-optout { font-size: 0.72rem; }
    }

    /* Pantallas bajas (laptops, o móvil en horizontal): al ser 9:16, angostar la tarjeta ya
       reduce la altura de la foto proporcionalmente; el overflow-y sigue de respaldo si aun
       así no cabe entera, para nunca tener que recortarla. */
    @media (max-height: 700px) {
      .promo-v3-content { width: 55%; max-width: 220px; }
      .promo-v3-body { padding: 10px 14px; }
      .promo-v3-body h3 { font-size: 0.95rem; margin-bottom: 8px; }
      .promo-v3-vigencia { margin: -4px 0 8px 0; font-size: 0.68rem; }
      .promo-v3-btn { padding: 8px; margin-bottom: 8px; }
      .promo-v3-optout { font-size: 0.68rem; }
    }
  `;
  document.head.appendChild(style);
}

async function showPromoPopup() {
  if (document.getElementById('promo-v3-modal')) return;
  if (sessionStorage.getItem('kx_promo_v3_shown') === 'true') return;

  injectPromoStyles();

  // Look for an admin-configured active bono; fall back to the default
  // hardcoded promo if none is active (or the request fails) so the popup
  // keeps working exactly as before on a site with no bonos configured.
  let bono = null;
  try {
    const r = await fetch('/api/bonos?active=1');
    if (r.ok) {
      const list = await r.json();
      bono = Array.isArray(list) && list.length ? list[0] : null;
    }
  } catch (e) { /* use defaults below */ }

  if (document.getElementById('promo-v3-modal')) return; // avoid a double-open race

  const imgSrc = (bono && bono.url) || '/images/banner-bc-cel.jpg';
  const titulo = (bono && bono.titulo) || 'Conoce nuestros envases';
  const textoBoton = (bono && bono.texto_boton) || 'Ver Categoría';
  const categoriaLink = (bono && bono.categoria_link) || 'Bebidas calientes';
  const pctBadge = (bono && bono.porcentaje_descuento != null)
    ? `<span class="promo-v3-badge">${bono.porcentaje_descuento}% OFF</span>`
    : '';
  // Urgencia: si el bono tiene fecha de cierre, mostrarla para reforzar la promoción
  // (útil también cuando se comparte por redes sociales).
  const vigenciaTexto = (bono && bono.fecha_fin)
    ? `<p class="promo-v3-vigencia">Válido hasta el ${new Date(bono.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'promo-v3-modal';
  overlay.className = 'promo-v3-overlay';
  overlay.innerHTML = `
    <div class="promo-v3-content">
      <button class="promo-v3-close" aria-label="Cerrar">&times;</button>
      <div class="promo-v3-img-wrap">
        ${pctBadge}
        <img src="${imgSrc}" alt="Promoción">
      </div>
      <div class="promo-v3-body">
        <h3>${titulo}</h3>
        ${vigenciaTexto}
        <button class="promo-v3-btn" id="promo-btn-cta">${textoBoton}</button>
        <div class="promo-v3-optout">
          <label>
            <input type="checkbox" id="promo-dont-show-checkbox"> No mostrar otra vez
          </label>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  console.log('[Promo] Modal inyectado en el DOM con éxito.');

  setTimeout(() => overlay.classList.add('active'), 100);

  const closePopup = () => {
    sessionStorage.setItem('kx_promo_v3_shown', 'true');
    if (overlay.querySelector('#promo-dont-show-checkbox').checked) {
      localStorage.setItem('kx_promo_v3_dismissed', 'true');
    }
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 500);
  };

  overlay.querySelector('.promo-v3-close').onclick = closePopup;

  // Nuevo: Cerrar al hacer clic en el botón de categoría
  const ctaBtn = overlay.querySelector('#promo-btn-cta');
  ctaBtn.onclick = () => {
    window.location.href = '/products?cat=' + encodeURIComponent(categoriaLink);
    closePopup();
  };

  overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
}
