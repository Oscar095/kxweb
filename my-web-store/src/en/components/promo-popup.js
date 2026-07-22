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
    console.log('[Promo] New session started.');
  }

  const startTime = parseInt(sessionStart, 10);

  const checkPopup = () => {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);

    // Log so the developer can see progress in the console
    if (seconds <= 12) {
      console.log(`[Promo] Elapsed time: ${seconds}s / 10s`);
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
    .promo-v3-img-wrap { width: 100%; height: auto; background: #eee; position: relative; }
    .promo-v3-img-wrap img { width: 100%; height: auto; display: block; }
    .promo-v3-badge {
      position: absolute; top: 14px; left: 14px; z-index: 10;
      background: #ff4d4f; color: #fff; font-weight: 800; font-size: 0.85rem;
      padding: 6px 14px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
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
  // English title/button prefer the bono's English fields, then fall back to
  // its Spanish fields, then to this file's own default copy.
  const titulo = (bono && (bono.titulo_en || bono.titulo)) || 'Discover Our Packaging';
  const textoBoton = (bono && (bono.texto_boton_en || bono.texto_boton)) || 'View Category';
  // NOTE: category value must stay in Spanish — it's matched against the
  // DB's category_name column by the products-page filter (pMatcher).
  const categoriaLink = (bono && bono.categoria_link) || 'Bebidas calientes';
  const pctBadge = (bono && bono.porcentaje_descuento != null)
    ? `<span class="promo-v3-badge">${bono.porcentaje_descuento}% OFF</span>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'promo-v3-modal';
  overlay.className = 'promo-v3-overlay';
  overlay.innerHTML = `
    <div class="promo-v3-content">
      <button class="promo-v3-close" aria-label="Close">&times;</button>
      <div class="promo-v3-img-wrap">
        ${pctBadge}
        <img src="${imgSrc}" alt="Promotion">
      </div>
      <div class="promo-v3-body">
        <h3>${titulo}</h3>
        <button class="promo-v3-btn" id="promo-btn-cta">${textoBoton}</button>
        <div class="promo-v3-optout">
          <label>
            <input type="checkbox" id="promo-dont-show-checkbox"> Don't show again
          </label>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  console.log('[Promo] Modal successfully injected into the DOM.');

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

  // Close when clicking the category button
  const ctaBtn = overlay.querySelector('#promo-btn-cta');
  ctaBtn.onclick = () => {
    window.location.href = '/en/products?cat=' + encodeURIComponent(categoriaLink);
    closePopup();
  };

  overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
}
