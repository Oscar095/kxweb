// Analytics tracker - sends page views to /api/track
(function () {
  if (location.pathname.includes('admin')) return; // Don't track admin pages

  // --- Meta Pixel Code ---
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '554057515152837');
  fbq('track', 'PageView');
  // --- End Meta Pixel Code ---

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
