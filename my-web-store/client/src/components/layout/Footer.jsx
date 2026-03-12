import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState('/api/biblioteca/1/imagen?v=1');

  useEffect(() => {
    fetch('/api/logos?primary=true', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        const first = Array.isArray(list) ? list[0] : null;
        if (first?.url) setLogoUrl(first.url);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        {/* Col 1: Brand */}
        <div className={styles.brand}>
          <img
            className={styles.logo}
            src={logoUrl}
            alt="KOS Colombia"
            loading="lazy"
          />
          <p className={styles.tagline}>
            Fabricantes de empaques y vasos de papel para food service.
            Calidad premium, entrega agil a toda Colombia.
          </p>
          <div className={styles.socialRow}>
            <a
              className={styles.socialLink}
              href="https://www.instagram.com/kos_colombia"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="17.6" cy="6.4" r="0.9" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              className={styles.socialLink}
              href="https://www.facebook.com/KosColombia"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <svg viewBox="0 0 24 24">
                <path d="M18 2h-3a4 4 0 00-4 4v3H8v4h3v8h4v-8h3l1-4h-4V6a1 1 0 011-1h2V2z" fill="currentColor" />
              </svg>
            </a>
            <a
              className={styles.socialLink}
              href="https://wa.me/573225227073"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.472-.149-.672.15-.198.297-.768.966-.94 1.164-.173.198-.346.223-.643.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.672-1.614-.92-2.205-.242-.58-.487-.5-.672-.51l-.572-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.48 1.065 2.876 1.214 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Col 2: Navigation */}
        <div>
          <h4 className={styles.colTitle}>Navegacion</h4>
          <ul className={styles.links}>
            <li><Link to="/products">Catalogo de productos</Link></li>
            <li><Link to="/personalizados">Personalizados</Link></li>
            <li><Link to="/contact">Contacto</Link></li>
            <li><Link to="/about">Sobre nosotros</Link></li>
          </ul>
        </div>

        {/* Col 3: Contact */}
        <div>
          <h4 className={styles.colTitle}>Contacto</h4>
          <ul className={styles.contactList}>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Cl. 10 #no. 21A 120, Yumbo, Valle del Cauca</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
              <a href="https://wa.me/573225227073">+57 322 522 7073</a>
            </li>
          </ul>
        </div>

        {/* Col 4: Map */}
        <div>
          <h4 className={styles.colTitle}>Ubicacion</h4>
          <div className={styles.mapWrap}>
            <iframe
              title="Ubicacion KOS Colombia"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3982.1!2d-76.5047945!3d3.5468968!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30a976708cf407%3A0x7f1e9ebdd755feea!2sKOS%20Colombia!5e0!3m2!1ses!2sco!4v1709518577768!5m2!1ses!2sco"
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      {/* Payment methods + copyright */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} KOS Colombia — Todos los derechos reservados
          </span>
          <div className={styles.payMethods}>
            <span className={styles.payLabel}>Metodos de pago:</span>
            <span className={styles.payBadge}>Wompi</span>
            <span className={styles.payBadge}>Visa</span>
            <span className={styles.payBadge}>Mastercard</span>
            <span className={styles.payBadge}>PSE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
