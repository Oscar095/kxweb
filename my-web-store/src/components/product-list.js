import { productItemTemplate } from './product-item.js';

export function renderProducts(products, mount) {
    if (!mount) return;
    mount.innerHTML = products.map(productItemTemplate).join('');
    // Animación de aparición al hacer scroll
    const items = Array.from(mount.querySelectorAll('.product'));
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
