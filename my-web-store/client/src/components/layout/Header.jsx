import { useRef, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '../../stores/useCartStore';
import { useUIStore } from '../../stores/useUIStore';
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
  const [logoUrl, setLogoUrl] = useState('/api/biblioteca/1/imagen?v=1');
  const navRef = useRef(null);
  const rectRef = useRef(null);

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
  }, [location.pathname, closeMobileNav]);

  // Close mobile nav on desktop resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 900) closeMobileNav(); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [closeMobileNav]);

  // Escape key closes mobile nav
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeMobileNav(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeMobileNav]);

  // Nav hover rectangle
  const handleLinkHover = useCallback((e) => {
    const rect = rectRef.current;
    const nav = navRef.current;
    if (!rect || !nav) return;
    const linkRect = e.currentTarget.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    rect.style.left = (linkRect.left - navRect.left) + 'px';
    rect.style.top = (linkRect.top - navRect.top) + 'px';
    rect.style.width = linkRect.width + 'px';
    rect.style.height = linkRect.height + 'px';
    rect.style.opacity = '1';
  }, []);

  const handleLinkLeave = useCallback(() => {
    const rect = rectRef.current;
    if (rect) {
      rect.style.opacity = '0';
      rect.style.width = '0';
    }
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className={styles.header}>
      <div className={styles.pill}>
        <div className={styles.logo}>
          <Link to="/">
            <img src={logoUrl} alt="Logo Kos" className={styles.logoImg} />
          </Link>
        </div>

        <nav
          ref={navRef}
          className={`${styles.nav} ${isMobileNavOpen ? styles.open : ''}`}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className={`${styles.navLink} ${isActive(link.to) ? styles.active : ''}`}
              onMouseEnter={handleLinkHover}
              onMouseLeave={handleLinkLeave}
              onFocus={handleLinkHover}
              onBlur={handleLinkLeave}
            >
              {link.label}
            </Link>
          ))}
          <span ref={rectRef} className={styles.navRect} />
        </nav>

        <div className={styles.controls}>
          <button
            className={styles.menuToggle}
            onClick={toggleMobileNav}
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <input
            className={styles.searchInput}
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />

          <button
            className={styles.cartBtn}
            onClick={toggleCart}
            title="Carrito"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M4 4 H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <polygon points="6,6 21,6 19.5,13.5 8.5,13.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8.5 13.5 L19.5 13.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8.5 13.5 L7.5 18 M19.5 13.5 L20.5 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="10" cy="20" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="18" cy="20" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
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
        </div>
      </div>

      <div
        className={`${styles.backdrop} ${isMobileNavOpen ? styles.open : ''}`}
        onClick={closeMobileNav}
      />
    </header>
  );
}
