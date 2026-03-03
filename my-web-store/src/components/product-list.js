import { productItemTemplate, attachDynamicPriceBehavior } from './product-item.js';

export function renderProducts(products, mount) {
  if (!mount) return;
  // Seguridad: deduplicar por codigo si viene listado completo sin agrupar desde backend
  const seen = new Set();
  const dedup = [];
  for (const p of products) {
    const code = (p.codigo || '').toString();
    if (code && seen.has(code)) continue;
    if (code) seen.add(code);
    dedup.push(p);
  }
  const toRender = dedup.length ? dedup : products;

  // Si la lista está vacía, no sobreescribir el HTML si el llamador ya puso un estado vacío
  if (products.length === 0) {
    return;
  }

  // Mostrar indicador de carga mientras se consulta inventario
  const loader = document.createElement('div');
  loader.className = 'products-loader';
  loader.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;grid-column:1/-1;gap:12px;">
      <div style="width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:var(--primary,#009FE3);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <p style="color:var(--muted,#888);font-size:1rem;margin:0;">Cargando productos...</p>
    </div>
  `;
  // Inyectar keyframes del spinner si no existe
  if (!document.getElementById('loader-spin-style')) {
    const style = document.createElement('style');
    style.id = 'loader-spin-style';
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }
  mount.innerHTML = toRender.map(productItemTemplate).join('');
  mount.prepend(loader);

  // Animación de aparición al hacer scroll
  const items = Array.from(mount.querySelectorAll('.product'));
  // Attach dynamic price behavior y rastrear cuando todos terminan
  let pending = items.length;
  const onProductRevealed = () => {
    pending--;
    if (pending <= 0 && loader.parentNode) {
      loader.remove();
    }
  };
  items.forEach(it => {
    let counted = false;
    const onRevealed = () => { if (counted) return; counted = true; onProductRevealed(); };
    // Observar cuando el producto se revela (opacity pasa a 1)
    const observer = new MutationObserver(() => {
      if (it.style.opacity === '1') {
        observer.disconnect();
        onRevealed();
      }
    });
    observer.observe(it, { attributes: true, attributeFilter: ['style'] });
    // Fallback: si no se detecta cambio en 7s, contar como revelado
    setTimeout(() => { observer.disconnect(); onRevealed(); }, 7000);
    attachDynamicPriceBehavior(it);
  });
  function animateProducts() {
    const trigger = window.innerHeight * 0.92;
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      if (rect.top < trigger) {
        item.classList.add('visible');
      }
    });
  }
  animateProducts();
  window.addEventListener('scroll', animateProducts, { passive: true });
  window.addEventListener('resize', animateProducts, { passive: true });
  // Para refrescar si hay cambios en productos
  setTimeout(animateProducts, 100);
}
