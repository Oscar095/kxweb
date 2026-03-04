import { renderHeader } from './components/header.js';
import { renderCartDrawer } from './components/cart-drawer.js';
import { initChatbot } from './components/chatbot.js';

console.log('personalizados.js cargado');

// Precios base por producto (Ejemplo de tabla de volumenes)
const pricingData = {
    'vaso_4oz': { base: 120, descuentoPor1000: 2 },
    'vaso_7oz': { base: 150, descuentoPor1000: 3 },
    'vaso_9oz': { base: 180, descuentoPor1000: 3 },
    'tapa_generica': { base: 80, descuentoPor1000: 1 },
    'porta_vasos': { base: 400, descuentoPor1000: 10 },
    'contenedor_16oz': { base: 550, descuentoPor1000: 15 }
};

function formatCurrency(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function initCotizador() {
    const select = document.getElementById('producto-select');
    const slider = document.getElementById('cantidad-slider');
    const displayCant = document.getElementById('cantidad-display');
    const displayUnitario = document.getElementById('precio-unitario-display');
    const displayTotal = document.getElementById('precio-total-display');
    const badgeAhorro = document.getElementById('ahorro-badge');
    const btnWhatsapp = document.getElementById('btn-whatsapp-cotizar');

    if (!select || !slider) return;

    function calcular() {
        const prodKey = select.value;
        const cantidad = parseInt(slider.value, 10);
        const data = pricingData[prodKey];

        if (!data) return;

        // Lógica simple: por cada 1000 unidades, reduce el precio unitario (hasta un límite de -30%)
        const unidadesBase = 2000;
        const intervalos1000 = Math.max(0, (cantidad - unidadesBase) / 1000);
        let descuentoTotal = intervalos1000 * data.descuentoPor1000;

        // Limitar descuento al 30% del base
        const maxDescuento = data.base * 0.3;
        if (descuentoTotal > maxDescuento) descuentoTotal = maxDescuento;

        const unitarioActual = data.base - descuentoTotal;
        const total = unitarioActual * cantidad;

        // Actualizar UI
        displayCant.textContent = formatCurrency(cantidad);
        displayUnitario.innerHTML = `$${formatCurrency(unitarioActual)} <span class="currency">COP</span>`;
        displayTotal.innerHTML = `$${formatCurrency(Math.round(total))} <span class="currency">COP</span>`;

        // Añadir pulso para feedback visual
        displayCant.classList.remove('pulse-val');
        displayUnitario.classList.remove('pulse-val');
        displayTotal.classList.remove('pulse-val');

        void displayTotal.offsetWidth; // Trigger reflow

        displayCant.classList.add('pulse-val');
        displayUnitario.classList.add('pulse-val');
        displayTotal.classList.add('pulse-val');

        setTimeout(() => {
            displayCant.classList.remove('pulse-val');
            displayUnitario.classList.remove('pulse-val');
            displayTotal.classList.remove('pulse-val');
        }, 200);

        if (descuentoTotal > 0) {
            const ahorroTotal = descuentoTotal * cantidad;
            badgeAhorro.textContent = `Ahorras $${formatCurrency(ahorroTotal)} COP en total`;
            badgeAhorro.style.display = 'inline-block';
        } else {
            badgeAhorro.style.display = 'none';
        }

        // Actualizar CTA WhatsApp
        const nombreProducto = select.options[select.selectedIndex].text;
        const mensaje = `Hola KosXpress! 👋%0AQuiero cotizar un pedido especial:%0A%0A📦 Producto: *${nombreProducto}*%0A🔢 Cantidad: *${formatCurrency(cantidad)} unidades*%0A💰 Inversión Aprox: *$${formatCurrency(Math.round(total))} COP*%0A%0A¿Me pueden asesorar con el diseño y tiempos de entrega?`;

        btnWhatsapp.onclick = () => {
            window.open(`https://wa.me/573215560942?text=${mensaje}`, '_blank');
        };
    }

    // Event Listeners
    select.addEventListener('change', calcular);
    slider.addEventListener('input', calcular);

    // Background track update for slider (Chrome/Safari)
    slider.addEventListener('input', function () {
        const value = (this.value - this.min) / (this.max - this.min) * 100;
        this.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${value}%, #333 ${value}%, #333 100%)`;
    });

    // Init calculation
    calcular();
    // Trigger initial gradient fill
    slider.dispatchEvent(new Event('input'));
}

// Interseccion Observer para animaciones de Scroll (Scroll Reveal)
function initScrollAnimations() {
    const reveals = document.querySelectorAll('.scroll-reveal, .reveal-on-scroll');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Animamos solo una vez
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    });

    reveals.forEach(el => observer.observe(el));
}

// Parallax Native Animation for the Story Flow Background
function initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax-shape, .parallax-dot, .parallax-img');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;

        parallaxElements.forEach(el => {
            const speed = el.getAttribute('data-speed') || 1;
            // Eje Y offset by speed mapping
            const yPos = -(scrollY * speed * 0.1);
            el.style.transform = `translateY(${yPos}px)`;
        });
    });
}

// Init Page
document.addEventListener('DOMContentLoaded', () => {
    try {
        const headerMount = document.getElementById('site-header');
        if (headerMount) renderHeader(headerMount);

        const drawerMount = document.getElementById('cart-drawer');
        if (drawerMount) renderCartDrawer(drawerMount);

        // Render shared footer
        const footerContainer = document.querySelector('.site-footer');
        if (footerContainer) {
            import('./components/footer.js').then(mod => {
                try { mod.renderFooter(footerContainer); } catch (e) { console.warn(e); }
            }).catch(() => { });
        }

        requestAnimationFrame(() => {
            initCotizador();
            initScrollAnimations();
            initParallax(); // Initializing parallax events
        });        // initChatbot(); // Se solicitó ocultar la burbuja global en esta sección

    } catch (error) {
        console.error('Error inicializando personalizados.js:', error);
    }
});
