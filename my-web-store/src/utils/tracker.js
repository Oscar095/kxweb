// Analytics tracker - sends page views to /api/track
(function () {
  if (location.pathname.includes('admin')) return; // Don't track admin pages

  let sessionId = sessionStorage.getItem('_sid');
  if (!sessionId) {
    sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_sid', sessionId);
  }

  function track(page, productId) {
    const body = { page, session_id: sessionId, referrer: document.referrer || '' };
    if (productId != null) body.product_id = productId;
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => { /* silent */ });
  }

  // Track page view on load
  const page = location.pathname + location.search;
  const params = new URLSearchParams(location.search);
  const productId = params.get('id') && location.pathname.includes('product') ? Number(params.get('id')) : null;
  track(page, productId);
})();
