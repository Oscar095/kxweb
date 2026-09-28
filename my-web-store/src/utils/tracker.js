// Analytics tracker - sends page views to /api/track
(function () {
  if (location.pathname.includes('admin')) return; // Don't track admin pages

  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min de inactividad = nueva sesión (igual que GA)
  const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } }
  };

  // Visitante: persiste entre visitas (permite contar visitantes únicos)
  let visitorId = store.get('_vid');
  if (!visitorId) { visitorId = newId(); store.set('_vid', visitorId); }

  // Sesión: se renueva tras 30 min sin actividad
  const now = Date.now();
  let sessionId = store.get('_sid');
  const lastSeen = Number(store.get('_sts') || 0);
  if (!sessionId || now - lastSeen > SESSION_TIMEOUT) sessionId = newId();
  store.set('_sid', sessionId);
  store.set('_sts', String(now));

  function track(page, productId) {
    const q = new URLSearchParams(location.search);
    const body = {
      page,
      session_id: sessionId,
      visitor_id: visitorId,
      referrer: document.referrer || '',
      utm_source: q.get('utm_source') || '',
      utm_medium: q.get('utm_medium') || '',
      utm_campaign: q.get('utm_campaign') || '',
      gclid: q.has('gclid') ? 1 : 0,
      fbclid: q.has('fbclid') ? 1 : 0
    };
    if (productId != null) body.product_id = productId;
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(() => { /* silent */ });
  }

  // Track page view on load
  const page = location.pathname + location.search;
  const params = new URLSearchParams(location.search);
  const productId = params.get('id') && location.pathname.includes('product') ? Number(params.get('id')) : null;
  track(page, productId);

  // --- Ultra-Reliable Scroll Reveal ---
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        entry.target.classList.remove('reveal-prep');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  function initReveal() {
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Only hide it if it's actually below the current view
      if (rect.top > window.innerHeight && !el.classList.contains('revealed')) {
        el.classList.add('reveal-prep');
        revealObserver.observe(el);
      } else {
        el.classList.add('revealed');
      }
    });
  }

  // Run as soon as possible and on all load events
  initReveal();
  window.addEventListener('load', initReveal);
  window.addEventListener('content-loaded', () => setTimeout(initReveal, 100));

  // FAIL-SAFE: Reveal everything after a short delay
  setTimeout(() => {
    document.querySelectorAll('.reveal-prep').forEach(el => {
      el.classList.add('revealed');
      el.classList.remove('reveal-prep');
    });
  }, 1200);
})();
