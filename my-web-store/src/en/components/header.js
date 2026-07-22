import { initChatbot } from './chatbot.js';
import { SITE_CONFIG } from '../../utils/config.js';
import { initPromoPopup } from './promo-popup.js?v=999';
import { getLangSwitchUrl } from '../../utils/lang-switch.js';

export function renderHeader(container) {
  const langSwitchHref = getLangSwitchUrl(location.pathname, location.search);
  const currentUrl = location.pathname + location.search;
  // Initialize Promotional Popup as early as possible
  try { initPromoPopup(); } catch(e) { console.error('[Promo] Init error:', e); }

  // Animated rectangle on nav hover
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
    <div class="free-shipping-bar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
      Delivery <strong>${SITE_CONFIG.DELIVERY_TIME_EN}</strong> to ${SITE_CONFIG.DELIVERY_SCOPE_EN}
    </div>
    <div class="announcement-bar">
      <div class="announcement-fade-container">
        <span class="announce-item active">🌟 Box prices include VAT</span>
        <span class="announce-item">✨ Customize from 2,000 units with your brand</span>
        <span class="announce-item">💻 Shop easily and quickly from our website</span>
        <span class="announce-item">📦 Fast and secure nationwide shipping</span>
      </div>
    </div>
    <div class="header-glass-pill">
      <button id="menu-toggle" class="menu-toggle" aria-label="Open menu">☰</button>
      <div class="logo">
        <a href="/en/">
          <img id="site-logo-img" src="/api/biblioteca/1/imagen?v=1759590414237" alt="Kos Logo" class="logo-img" decoding="async" loading="eager"/>
        </a>
      </div>
      <nav class="nav nav-animated" role="navigation" aria-label="Main navigation">
        <a href="/en/" class="nav-link" data-nav="home">Home</a>
        <a href="/en/company" class="nav-link" data-nav="company">About Us</a>
        <a href="/en/products" class="nav-link" data-nav="products">Products</a>
        <a href="/en/custom" class="nav-link" data-nav="custom">Custom Packaging</a>
        <div class="nav-dropdown">
          <a href="/en/ethics" class="nav-link nav-dropdown-btn" data-nav="ethics">Ethics Channel</a>
          <div class="nav-dropdown-content">
            <a href="/en/ethics" class="nav-link-sub">PTEE</a>
          </div>
        </div>
        <a href="/en/contact" class="nav-link" data-nav="contact">Contact</a>
        <span class="nav-rect"></span>
      </nav>
      <div class="search">
        <input id="search-input" placeholder="Search products..." aria-label="Search products" />
        <div class="lang-switcher">
          <button type="button" id="lang-switch-btn" class="cart-btn lang-switch-btn" aria-haspopup="true" aria-expanded="false" aria-label="Change language" title="Change language">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </button>
          <div class="lang-switch-menu" id="lang-switch-menu" role="menu">
            <a href="${langSwitchHref}" class="lang-switch-item" role="menuitem">Español</a>
            <a href="${currentUrl}" class="lang-switch-item is-current" role="menuitem" aria-current="true">English</a>
          </div>
        </div>
        <button id="cart-toggle" title="Cart" class="cart-btn" aria-label="Open shopping cart">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cartGrid" width="3" height="3" patternUnits="userSpaceOnUse">
                <path d="M3 0H0M0 0V3" stroke="currentColor" stroke-width="0.3"/>
              </pattern>
            </defs>
            <path d="M4 4 H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polygon points="6,6 21,6 19.5,13.5 8.5,13.5" fill="url(#cartGrid)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M8.5 13.5 L19.5 13.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8.5 13.5 L7.5 18 M19.5 13.5 L20.5 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="10" cy="20" r="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="18" cy="20" r="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span id="cart-count" class="cart-count">0</span>
        </button>
      </div>
    </div>
    <div id="nav-backdrop" class="nav-backdrop" aria-hidden="true"></div>
  `;

  // Announcement Bar Rotation
  const announceItems = container.querySelectorAll('.announce-item');
  if (announceItems.length > 0) {
    let currentAnnounce = 0;
    setInterval(() => {
      announceItems[currentAnnounce].classList.remove('active');
      currentAnnounce = (currentAnnounce + 1) % announceItems.length;
      announceItems[currentAnnounce].classList.add('active');
    }, 4000);
  }

  const cartToggle = document.getElementById('cart-toggle');
  if (cartToggle) cartToggle.addEventListener('click', () => window.dispatchEvent(new CustomEvent('toggle-cart')));

  const input = document.getElementById('search-input');
  if (input) {
    input.addEventListener('input', () => window.dispatchEvent(new CustomEvent('search', { detail: input.value })));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        window.location.href = '/en/search?q=' + encodeURIComponent(input.value.trim());
        closeAutocomplete();
      }
      if (e.key === 'Escape') closeAutocomplete();
    });

    let acDropdown = null;
    let acProducts = null;
    let acDebounce = null;

    const createDropdown = () => {
      if (acDropdown) return acDropdown;
      acDropdown = document.createElement('div');
      acDropdown.className = 'search-autocomplete';
      acDropdown.id = 'search-autocomplete';
      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(acDropdown);
      return acDropdown;
    };

    const closeAutocomplete = () => {
      if (acDropdown) { acDropdown.style.display = 'none'; acDropdown.innerHTML = ''; }
    };

    const fetchProducts = async () => {
      if (acProducts) return acProducts;
      try {
        const r = await fetch('/api/products');
        if (r.ok) acProducts = await r.json();
      } catch { acProducts = []; }
      return acProducts || [];
    };

    input.addEventListener('input', async () => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 2) { closeAutocomplete(); return; }
      clearTimeout(acDebounce);
      acDebounce = setTimeout(async () => {
        const products = await fetchProducts();
        const matches = products.filter(p =>
          (p.name || '').toLowerCase().includes(query) ||
          (p.category_name || p.category?.nombre || '').toLowerCase().includes(query)
        ).slice(0, 5);

        const dd = createDropdown();
        if (matches.length === 0) {
          dd.innerHTML = '<div class="ac-empty">No products found</div>';
          dd.style.display = 'block';
          return;
        }

        dd.innerHTML = matches.map(p => {
          const img = Array.isArray(p.images) && p.images.length ? p.images[0] : (p.image || '/images/placeholder.svg');
          const catName = p.category?.nombre || p.category_name || '';
          return `<a href="/product?id=${p.id}" class="ac-item">
            <img src="${img}" alt="${p.name}" class="ac-img" loading="lazy" />
            <div class="ac-info">
              <span class="ac-name">${p.name}</span>
              <span class="ac-cat">${catName}</span>
            </div>
          </a>`;
        }).join('');
        dd.style.display = 'block';
      }, 200);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !(acDropdown && acDropdown.contains(e.target))) {
        closeAutocomplete();
      }
    });
  }

  // Dynamic logo
  (async () => {
    try {
      const img = document.getElementById('site-logo-img');
      if (!img) return;
      const r = await fetch('/api/logos?primary=true');
      if (!r.ok) return;
      const list = await r.json();
      const first = Array.isArray(list) ? list[0] : null;
      if (!first || !first.url) return;
      img.src = first.url;
    } catch { /* ignore */ }
  })();

  // Cart badge
  import('../../services/cart-service.js').then(mod => {
    const svc = mod.cartService;
    function update(items) {
      const el = document.getElementById('cart-count');
      if (!el) return;
      el.textContent = String(items.length || 0);
      el.style.display = items.length ? 'inline-block' : 'none';
    }
    svc.subscribe(update);
    update(svc.items || []);
  }).catch(e => console.warn('Could not initialize cart badge', e));

  // Render shared footer
  const footerContainer = document.querySelector('.site-footer');
  if (footerContainer) {
    import('./footer.js').then(mod => {
      try { mod.renderFooter(footerContainer); } catch (err) { console.warn('renderFooter failed', err); }
    }).catch(err => { console.warn('Could not load footer module', err); });
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

  nav?.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeNav);
  });
  backdrop?.addEventListener('click', closeNav);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeNav();
  });

  // Lazy chatbot
  let chatbotLoaded = false;
  const loadChatbot = () => {
    if (chatbotLoaded) return;
    chatbotLoaded = true;
    initChatbot();
    ['scroll', 'click', 'touchstart'].forEach(evt =>
      window.removeEventListener(evt, loadChatbot, { passive: true })
    );
  };
  if (window.scrollY > 100) {
    initChatbot();
    chatbotLoaded = true;
  } else {
    ['scroll', 'click', 'touchstart'].forEach(evt =>
      window.addEventListener(evt, loadChatbot, { passive: true, once: true })
    );
    setTimeout(loadChatbot, 5000);
  }

  // Mark active link
  try {
    let current = (location.pathname.split('/').pop() || '').toLowerCase();
    if (current.endsWith('.html')) current = current.replace('.html', '');
    if (current === '' || current === 'index') current = 'home';

    nav?.querySelectorAll('a').forEach(a => {
      let href = (a.getAttribute('href') || '').toLowerCase();
      if (href.endsWith('.html')) href = href.replace('.html', '');
      if (href === '/en/' || href === '/en') href = 'home';
      if (href.endsWith(current)) {
        a.classList.add('is-active');
      }
    });
  } catch { }

  // Language switcher dropdown
  const langBtn = container.querySelector('#lang-switch-btn');
  const langMenu = container.querySelector('#lang-switch-menu');
  if (langBtn && langMenu) {
    const closeLangMenu = () => {
      langMenu.classList.remove('open');
      langBtn.setAttribute('aria-expanded', 'false');
    };
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = langMenu.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', (e) => {
      if (!langMenu.contains(e.target) && e.target !== langBtn) closeLangMenu();
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenu(); });
  }
}
