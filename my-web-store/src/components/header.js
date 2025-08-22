export function renderHeader(mount) {
  mount.innerHTML = `
    <div class="header-inner container">
      <div class="logo"><a href="index.html"><img src="images/LogoKos2.png" alt="Kos Xpress" class="logo-img"/></a></div>
      <nav class="nav">
        <a href="index.html">Inicio</a>
        <a href="products.html">Productos</a>
        <a href="contact.html">Contacto</a>
      </nav>
      <div class="search">
        <input id="search-input" placeholder="Buscar productos..." />
        <button id="cart-toggle" title="Carrito" class="cart-btn">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 6h15l-1.5 9h-12L4 2H2" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="10" cy="20" r="1.5" fill="#fff"/>
            <circle cx="18" cy="20" r="1.5" fill="#fff"/>
          </svg>
          <span id="cart-count" class="cart-count">0</span>
        </button>
      </div>
    </div>
  `;

  const cartToggle = document.getElementById('cart-toggle');
  if (cartToggle) cartToggle.addEventListener('click', () => window.dispatchEvent(new CustomEvent('toggle-cart')));

  const input = document.getElementById('search-input');
  if (input) input.addEventListener('input', () => window.dispatchEvent(new CustomEvent('search', { detail: input.value })));

  // badge: subscribe to cartService to update count
  import('../services/cart-service.js').then(mod => {
    const svc = mod.cartService;
    function update(items) {
      const el = document.getElementById('cart-count');
      if (!el) return;
      el.textContent = String(items.length || 0);
      el.style.display = items.length ? 'inline-block' : 'none';
    }
    svc.subscribe(update);
    update(svc.items || []);
  }).catch(e => console.warn('No se pudo inicializar cart badge', e));

  // Render shared footer into any .site-footer element present on the page
  const footerContainer = document.querySelector('.site-footer');
  if (footerContainer) {
    import('./footer.js').then(mod => {
      try { mod.renderFooter(footerContainer); } catch (err) { console.warn('renderFooter failed', err); }
    }).catch(err => { console.warn('No se pudo cargar footer module', err); });
  }
}