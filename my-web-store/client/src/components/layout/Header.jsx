import { useRef, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '../../stores/useCartStore';
import { useUIStore } from '../../stores/useUIStore';
import AnnouncementBar from './AnnouncementBar';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', key: 'inicio' },
  { to: '/products', label: 'Productos', key: 'productos' },
  { to: '/personalizados', label: 'Personalizados', key: 'personalizados' },
  { to: '/contact', label: 'Contacto', key: 'contacto' },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const totalItems = useCartStore((s) => s.totalItems());
  const toggleCart = useUIStore((s) => s.toggleCart);
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/api/biblioteca/1/imagen?v=1');
  const searchRef = useRef(null);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load dynamic logo
  useEffect(() => {
    fetch('/api/logos?primary=true', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((list) => {
        const first = Array.isArray(list) ? list[0] : null;
        if (first?.url) setLogoUrl(first.url);
      })
      .catch(() => {});
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    closeMobileNav();
    setSearchOpen(false);
  }, [location.pathname, closeMobileNav]);

  // Close mobile nav on desktop resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 900) closeMobileNav(); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [closeMobileNav]);

  // Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        closeMobileNav();
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeMobileNav]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const isActive = useCallback((path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  const isHeroPage = location.pathname === '/';

  return (
    <>
      <AnnouncementBar />
      <header
        className={`${styles.header} ${scrolled ? styles.scrolled : ''} ${
          isHeroPage && !scrolled ? styles.heroMode : ''
        }`}
      >
        <div className={styles.inner}>
          {/* Logo */}
          <Link to="/" className={styles.logo}>
            <img src={logoUrl} alt="KOS Colombia" className={styles.logoImg} />
          </Link>

          {/* Desktop Nav */}
          <nav className={`${styles.nav} ${isMobileNavOpen ? styles.open : ''}`}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className={`${styles.navLink} ${isActive(link.to) ? styles.active : ''}`}
              >
                {link.label}
                {isActive(link.to) && (
                  <motion.span
                    className={styles.navUnderline}
                    layoutId="nav-underline"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* Controls */}
          <div className={styles.controls}>
            {/* Search toggle */}
            <button
              className={styles.iconBtn}
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Buscar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* Cart */}
            <button
              className={styles.iconBtn}
              onClick={toggleCart}
              aria-label="Carrito"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.span
                    className={styles.cartCount}
                    key="cart-count"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    {totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Mobile menu toggle */}
            <button
              className={styles.menuToggle}
              onClick={toggleMobileNav}
              aria-label="Menu"
            >
              <span className={`${styles.burger} ${isMobileNavOpen ? styles.burgerOpen : ''}`} />
            </button>
          </div>
        </div>

        {/* Expandable search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              className={styles.searchBar}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 56, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.searchInner}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={searchRef}
                  className={styles.searchInput}
                  placeholder="Buscar vasos, contenedores, empaques..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <button
                  className={styles.searchClose}
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile backdrop */}
      <div
        className={`${styles.backdrop} ${isMobileNavOpen ? styles.backdropOpen : ''}`}
        onClick={closeMobileNav}
      />
    </>
  );
}
