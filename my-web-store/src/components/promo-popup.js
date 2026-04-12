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
      background: #fff; border-radius: 24px; width: 92%; max-width: 480px;
      position: relative; overflow: hidden;
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      transform: scale(0.8); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      margin: 20px;
    }
    .promo-v3-overlay.active .promo-v3-content { transform: scale(1); }
    .promo-v3-close {
      position: absolute; top: 12px; right: 12px; width: 40px; height: 40px;
      background: rgba(0,0,0,0.6); border: 2px solid rgba(255,255,255,0.8); border-radius: 50%;
      color: #fff; font-size: 28px; cursor: pointer; z-index: 100;
      display: flex; align-items: center; justify-content: center;
      line-height: 1; transition: background 0.3s;
    }
    .promo-v3-close:hover { background: rgba(0,0,0,0.9); }
    .promo-v3-img-wrap { width: 100%; height: auto; background: #eee; }
    .promo-v3-img-wrap img { width: 100%; height: auto; display: block; }
    .promo-v3-body { padding: 25px; text-align: center; }
    .promo-v3-body h3 { font-size: 1.4rem; color: #1a1a1a; margin: 0 0 20px 0; font-weight: 800; line-height: 1.2; }
    .promo-v3-btn {
      width: 100%; padding: 15px; border-radius: 50px; border: none;
      background: #00a4e4; color: #fff; font-size: 1rem; font-weight: 700;
      text-transform: uppercase; cursor: pointer; margin-bottom: 20px;
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
      box-shadow: 0 4px 15px rgba(0, 164, 228, 0.3);
    }
    .promo-v3-btn:active { transform: scale(0.96); }
    .promo-v3-btn:hover { background: #008cc2; }
    .promo-v3-optout { font-size: 0.85rem; color: #666; display: flex; align-items: center; justify-content: center; }
    .promo-v3-optout input { margin-right: 10px; width: 20px; height: 20px; cursor: pointer; accent-color: #00a4e4; }
    .promo-v3-optout label { cursor: pointer; user-select: none; }

    @media (max-width: 600px) {
      .promo-v3-content { border-radius: 20px; width: 85%; max-width: 340px; margin: 10px; }
      .promo-v3-body { padding: 18px; }
      .promo-v3-body h3 { font-size: 1.15rem; margin-bottom: 15px; }
      .promo-v3-close { top: 8px; right: 8px; width: 38px; height: 38px; font-size: 28px; }
      .promo-v3-btn { padding: 12px; font-size: 0.9rem; margin-bottom: 15px; }
      .promo-v3-optout { font-size: 0.8rem; }
    }
  `;
  document.head.appendChild(style);
}

function showPromoPopup() {
  if (document.getElementById('promo-v3-modal')) return;
  if (sessionStorage.getItem('kx_promo_v3_shown') === 'true') return;

  injectPromoStyles();

  const overlay = document.createElement('div');
  overlay.id = 'promo-v3-modal';
  overlay.className = 'promo-v3-overlay';
  overlay.innerHTML = `
    <div class="promo-v3-content">
      <button class="promo-v3-close" aria-label="Cerrar">&times;</button>
      <div class="promo-v3-img-wrap">
        <img src="/images/banner-bc-cel.jpg" alt="Promoción">
      </div>
      <div class="promo-v3-body">
        <h3>Conoce nuestros envases</h3>
        <button class="promo-v3-btn" id="promo-btn-cta">Ver Categoría</button>
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
    window.location.href = '/products?cat=Bebidas calientes';
    closePopup();
  };

  overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
}
