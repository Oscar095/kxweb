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
    mount.innerHTML = toRender.map(productItemTemplate).join('');
    // Animación de aparición al hacer scroll
  const items = Array.from(mount.querySelectorAll('.product'));
  // Attach dynamic price behavior
  items.forEach(it => attachDynamicPriceBehavior(it));
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
