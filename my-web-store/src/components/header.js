export function renderHeader(container) {
  // Animación de rectángulo en nav
  setTimeout(() => {
    const nav = document.querySelector('.nav-animated');
    const rect = nav ? nav.querySelector('.nav-rect') : null;
    const links = nav ? nav.querySelectorAll('.nav-link') : [];
    if (!rect || !links.length) return;
    function moveRect(e) {
      const link = e.currentTarget;
      const { left, top, width, height } = link.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      rect.style.left = (left - navRect.left) + 'px';
      rect.style.top = (top - navRect.top) + 'px';
      rect.style.width = width + 'px';
      rect.style.height = height + 'px';
      rect.style.opacity = '1';
    }
    function hideRect() {
      rect.style.opacity = '0';
      rect.style.width = '0';
    }
    links.forEach(link => {
      link.addEventListener('mouseenter', moveRect);
      link.addEventListener('focus', moveRect);
      link.addEventListener('mouseleave', hideRect);
      link.addEventListener('blur', hideRect);
    });
  }, 100);
  container.innerHTML = `
    <div class="header-inner container">
      <div class="logo"><a href="index.html"><img src="images/LogoKos2.png" alt="Kos Xpress" class="logo-img"/></a></div>
      <nav class="nav nav-animated">
        <a href="index.html" class="nav-link" data-nav="inicio">Inicio</a>
        <a href="products.html" class="nav-link" data-nav="productos">Productos</a>
        <a href="about.html" class="nav-link" data-nav="about">Nosotros</a>
        <a href="contact.html" class="nav-link" data-nav="contacto">Contacto</a>
        <a href="admin.html" class="nav-link" data-nav="admin">Admin</a>
        <span class="nav-rect"></span>
      </nav>
      <div class="search">
        <button id="menu-toggle" class="menu-toggle" aria-label="Abrir menú">☰</button>
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
    <div id="nav-backdrop" class="nav-backdrop" aria-hidden="true"></div>
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

  // Mobile nav toggle
  const nav = container.querySelector('.nav');
  const menuBtn = document.getElementById('menu-toggle');
  const backdrop = document.getElementById('nav-backdrop');
  const closeNav = () => { nav?.classList.remove('open'); backdrop?.classList.remove('open'); };
  const openNav = () => { nav?.classList.add('open'); backdrop?.classList.add('open'); };
  menuBtn?.addEventListener('click', () => {
    if (!nav) return;
    if (nav.classList.contains('open')) closeNav();
    else openNav();
  });
  backdrop?.addEventListener('click', closeNav);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  // Close nav when resizing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeNav();
  });

  // Mark active link (applies orange background in mobile)
  try {
    const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    nav?.querySelectorAll('a').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href.endsWith(current)) a.classList.add('is-active');
      // Also treat root as index
      if ((current === '' || current === '/') && (href.endsWith('index.html') || href === '/')) {
        a.classList.add('is-active');
      }
    });
  } catch {}
}