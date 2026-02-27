export function renderFooter(mount) {
  if (!mount) return;
  mount.innerHTML = `
    <style>
      .footer-grid {
        display: grid;
        grid-template-columns: 1fr 1.3fr;
        gap: 48px;
        padding-top: 48px;
        padding-bottom: 36px;
        align-items: start;
      }
      .footer-brand {}
      .footer-logo {
        height: 72px;
        width: auto;
        display: block;
        margin-bottom: 14px;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,.12));
      }
      .footer-tagline {
        font-size: 0.92rem;
        color: var(--muted);
        line-height: 1.65;
        margin: 0 0 24px;
        max-width: 270px;
      }
      .footer-social-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .footer-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 9px 18px;
        border-radius: 24px;
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
        color: #fff;
        letter-spacing: 0.3px;
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        box-shadow: 0 3px 10px rgba(0,0,0,0.12);
      }
      .footer-pill:hover {
        transform: translateY(-3px);
        filter: brightness(1.1);
        box-shadow: 0 8px 20px rgba(0,0,0,0.18);
      }
      .footer-pill svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        fill: currentColor;
      }
      .footer-pill-ig {
        background: linear-gradient(135deg, #f77737 0%, #c13584 50%, #833ab4 100%);
      }
      .footer-pill-fb {
        background: #1877F2;
      }
      .footer-pill-wa {
        background: #25D366;
      }
      .footer-location h4 {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-main);
        margin: 0 0 8px;
      }
      .footer-address-row {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 0.88rem;
        color: var(--muted);
        margin: 0 0 16px;
        line-height: 1.5;
      }
      .footer-address-row svg {
        width: 15px;
        height: 15px;
        flex-shrink: 0;
        margin-top: 2px;
        stroke: var(--primary);
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .footer-map-wrap iframe {
        width: 100%;
        height: 255px;
        border: 0;
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.09);
        display: block;
      }
      .footer-bottom-bar {
        border-top: 1px solid rgba(0, 0, 0, 0.07);
        padding: 18px 24px;
        max-width: var(--max-width);
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.83rem;
        color: var(--muted);
      }
      @media (max-width: 700px) {
        .footer-grid {
          grid-template-columns: 1fr;
          gap: 32px;
          padding-top: 36px;
        }
        .footer-tagline { max-width: 100%; }
        .footer-bottom-bar { flex-direction: column; text-align: center; }
      }
    </style>

    <div class="footer-grid container">
      <div class="footer-brand">
        <img id="footer-logo-img" class="footer-logo" src="/api/biblioteca/1/imagen?v=1759590414237" alt="Logo Kos" loading="lazy" decoding="async"/>
        <p class="footer-tagline">Soluciones ideales en empaques para tu negocio. Calidad premium, entrega ágil.</p>
        <div class="footer-social-pills">
          <a class="footer-pill footer-pill-ig" href="https://www.instagram.com/kos_colombia" target="_blank" rel="noopener" aria-label="Instagram">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.6" cy="6.4" r="0.9" fill="currentColor" stroke="none"/></svg>
            Instagram
          </a>
          <a class="footer-pill footer-pill-fb" href="https://www.facebook.com/KosColombia" target="_blank" rel="noopener" aria-label="Facebook">
            <svg viewBox="0 0 24 24"><path d="M18 2h-3a4 4 0 00-4 4v3H8v4h3v8h4v-8h3l1-4h-4V6a1 1 0 011-1h2V2z"/></svg>
            Facebook
          </a>
          <a class="footer-pill footer-pill-wa" href="https://wa.me/573225227073" target="_blank" rel="noopener" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.472-.149-.672.15-.198.297-.768.966-.94 1.164-.173.198-.346.223-.643.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.672-1.614-.92-2.205-.242-.58-.487-.5-.672-.51l-.572-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.48 1.065 2.876 1.214 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.053 21.996h-.003a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.515-5.257c.001-5.453 4.439-9.89 9.893-9.89 2.64 0 5.122 1.03 6.988 2.897a9.82 9.82 0 012.9 6.993c-.003 5.452-4.441 9.889-9.893 9.889z"/></svg>
            WhatsApp
          </a>
        </div>
      </div>

      <div class="footer-location">
        <h4>¿Dónde estamos ubicados?</h4>
        <p class="footer-address-row">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Cl. 10 #6-21, Br. Puerto Isaac, Yumbo, Valle del Cauca, Colombia
        </p>
        <div class="footer-map-wrap">
          <iframe title="Ubicación Kos Xpress" src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d509699.4414915121!2d-76.4916!3d3.5812979999999994!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30aa48036190e3%3A0x3bc28d96060bf132!2sCl.%2010%20%23%206-21%2C%20Br.%20Puerto%20Isaac%2C%20Yumbo%2C%20Valle%20del%20Cauca%2C%20Colombia!5e0!3m2!1ses!2sus!4v1759518577768!5m2!1ses!2sus" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    </div>

    <div class="footer-bottom-bar">
      <span>© 2025 Kos Xpress — Todos los derechos reservados</span>
      <span>Yumbo, Valle del Cauca, Colombia</span>
    </div>
  `;

  // Logo dinámico
  (async () => {
    try {
      const img = mount.querySelector('#footer-logo-img');
      if (!img) return;
      const r = await fetch('/api/logos?primary=true', { cache: 'no-store' });
      if (!r.ok) return;
      const list = await r.json();
      const first = Array.isArray(list) ? list[0] : null;
      if (!first || !first.url) return;
      const sep = first.url.includes('?') ? '&' : '?';
      img.src = first.url + sep + 'v=' + Date.now();
    } catch {
      // ignore
    }
  })();
}
