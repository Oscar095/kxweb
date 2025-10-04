export function renderFooter(mount) {
  if (!mount) return;
  mount.innerHTML = `
    <style>
      .footer-inner { 
        display:flex; 
        flex-direction:row; 
        align-items:flex-start; 
        justify-content:space-between; 
        gap:32px; /* doble separación */
        flex-wrap:wrap; 
        text-align:left;
      }
      .footer-left { flex:1 1 320px; font-size:16px; text-align:center; }
      .footer-left br { line-height:1; }
      .footer-right { flex:0 0 auto; width:420px; max-width:100%; display:flex; flex-direction:column; align-items:center; text-align:center; }
      .footer-map-wrapper { width:100%; }
      .footer-map-wrapper iframe { width:100%; height:315px; border:0; border-radius:8px; }
      .footer-social { margin:14px 0 6px; display:flex; gap:12px; font-size:0; justify-content:center; }
      .footer-social .social-link svg { width:24px; height:24px; }
  .footer-logo { height:78px; width:auto; display:block; margin:12px auto 0; filter:drop-shadow(0 2px 6px rgba(0,0,0,.15)); }
      @media (max-width:700px) {
        .footer-inner { flex-direction:column; text-align:center; }
        .footer-right { width:100%; }
        .footer-map-wrapper { width:100%; }
        .footer-social { justify-content:center; }
      }
    </style>
    <div class="container footer-inner">
      <div class="footer-left">
        © 2025 Kos Xpress — Todos los derechos reservados <br/><br/>
        Yumbo - Valle del Cauca
        <div class="footer-social">
          <a class="social-link" href="https://www.instagram.com/kos_colombia" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.5"/><circle cx="17.6" cy="6.4" r="0.6" fill="currentColor"/></svg>
          </a>
          <a class="social-link" href="https://www.facebook.com/KosColombia" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a4 4 0 00-4 4v3H8v4h3v8h4v-8h3l1-4h-4V6a1 1 0 011-1h2V2z" fill="currentColor"/></svg>
          </a>
          <a class="social-link" href="https://wa.me/573225227073" target="_blank" rel="noopener" aria-label="Chat por WhatsApp" title="WhatsApp">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" width="24" height="24">
              <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.472-.149-.672.15-.198.297-.768.966-.94 1.164-.173.198-.346.223-.643.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.672-1.614-.92-2.205-.242-.58-.487-.5-.672-.51l-.572-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.48 1.065 2.876 1.214 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.053 21.996h-.003a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.515-5.257c.001-5.453 4.439-9.89 9.893-9.89 2.64 0 5.122 1.03 6.988 2.897a9.82 9.82 0 012.9 6.993c-.003 5.452-4.441 9.889-9.893 9.889z"/>
            </svg>
          </a>
        </div>
        <img class="footer-logo" src="/api/biblioteca/1/imagen?v=1759590414237" alt="Logo Kos" loading="lazy" decoding="async"/>
      </div>
      <div class="footer-right">
        <div class="footer-map-wrapper">
          <h3 style="margin:0 0 8px;font-size:18px;font-weight:600;">¿Dónde estamos ubicados?</h3>
          <iframe title="Ubicación Kos Xpress" src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d509699.4414915121!2d-76.4916!3d3.5812979999999994!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30aa48036190e3%3A0x3bc28d96060bf132!2sCl.%2010%20%23%206-21%2C%20Br.%20Puerto%20Isaac%2C%20Yumbo%2C%20Valle%20del%20Cauca%2C%20Colombia!5e0!3m2!1ses!2sus!4v1759518577768!5m2!1ses!2sus" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    </div>
  `;
}
