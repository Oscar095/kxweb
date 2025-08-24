import { productItemTemplate } from './product-item.js';
import { cartService } from '../services/cart-service.js';

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

    // Delegated click handler for add-to-cart buttons
    mount.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(btn.dataset.id);
            const product = products.find(p => p.id === id);
            if (product) {
                cartService.add(product);
                // brief button feedback
                btn.classList.add('added');
                setTimeout(() => btn.classList.remove('added'), 350);
                // show toast notification
                showToast(`Producto agregado: ${product.name}`);
            }
        });
    });
}

function showToast(text) {
    let root = document.getElementById('toast-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'toast-root';
        document.body.appendChild(root);
    }

    const t = document.createElement('div');
    t.className = 'toast-success';
    t.textContent = text;
    root.appendChild(t);

    // show -> hide
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => t.classList.remove('visible'), 1800);
    setTimeout(() => t.remove(), 2200);
}