import { renderHeader } from './components/header.js?v=24.0';
import { renderCartDrawer } from './components/cart-drawer.js';
import { initChatbot } from './components/chatbot.js';

console.log('personalizados.js cargado');

// Dynamic product data loaded from API
let productsData = [];

function formatCurrency(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        productsData = await res.json();
    } catch (e) {
        console.warn('No se pudieron cargar los productos:', e);
    }
}

function populateSelect(select) {
    select.innerHTML = '';

    if (!productsData.length) {
        select.innerHTML = '<option value="">No se encontraron productos</option>';
        return;
    }

    // Group by category
    const groups = {};
    productsData.forEach(p => {
        const cat = p.category_name || 'Otros';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
    });

    // Sort categories and build select
    Object.keys(groups).sort().forEach(catName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = catName;
        groups[catName].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            opt.dataset.priceUnit = p.price_unit;
            opt.dataset.cantidad = p.cantidad;
            optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
    });
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

    // Populate the select with API data
    populateSelect(select);

    function calcular() {
        const selectedOpt = select.options[select.selectedIndex];
        if (!selectedOpt || !selectedOpt.dataset.priceUnit) return;

        const basePrice = parseFloat(selectedOpt.dataset.priceUnit);
        const cantidad = parseInt(slider.value, 10);

        // Volume discount: ~2% per each 1000 over base 2000, capped at 30%
        const unidadesBase = 2000;
        const intervalos1000 = Math.max(0, (cantidad - unidadesBase) / 1000);
        let descuentoPct = intervalos1000 * 0.02;
        if (descuentoPct > 0.30) descuentoPct = 0.30;

        const unitarioActual = basePrice * (1 - descuentoPct);
        const total = unitarioActual * cantidad;
        const ahorro = (basePrice - unitarioActual) * cantidad;

        // Update UI
        displayCant.textContent = formatCurrency(cantidad);
        displayUnitario.innerHTML = `$${formatCurrency(unitarioActual)} <span class="currency">COP</span>`;
        displayTotal.innerHTML = `$${formatCurrency(Math.round(total))} <span class="currency">COP</span>`;

        // Pulse animation
        displayCant.classList.remove('pulse-val');
        displayUnitario.classList.remove('pulse-val');
        displayTotal.classList.remove('pulse-val');
        void displayTotal.offsetWidth;
        displayCant.classList.add('pulse-val');
        displayUnitario.classList.add('pulse-val');
        displayTotal.classList.add('pulse-val');
        setTimeout(() => {
            displayCant.classList.remove('pulse-val');
            displayUnitario.classList.remove('pulse-val');
            displayTotal.classList.remove('pulse-val');
        }, 200);

        if (ahorro > 0) {
            badgeAhorro.textContent = `Ahorras $${formatCurrency(Math.round(ahorro))} COP en total`;
            badgeAhorro.style.display = 'inline-block';
        } else {
            badgeAhorro.style.display = 'none';
        }

        // WhatsApp CTA
        const nombreProducto = selectedOpt.text;
        const mensaje = `Hola KosXpress! 👋%0AQuiero cotizar un pedido personalizado:%0A%0A📦 Producto: *${nombreProducto}*%0A🔢 Cantidad: *${formatCurrency(cantidad)} unidades*%0A💰 Inversión Aprox: *$${formatCurrency(Math.round(total))} COP*%0A%0A¿Me pueden asesorar con el diseño y tiempos de entrega?`;

        btnWhatsapp.onclick = () => {
            window.open(`https://wa.me/573225227073?text=${mensaje}`, '_blank');
        };
    }

    // Events
    select.addEventListener('change', calcular);
    slider.addEventListener('input', calcular);

    // Slider track gradient
    slider.addEventListener('input', function () {
        const value = (this.value - this.min) / (this.max - this.min) * 100;
        this.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${value}%, #333 ${value}%, #333 100%)`;
    });

    calcular();
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
    const parallaxElements = document.querySelectorAll('.parallax-shape, .parallax-dot, .parallax-img, .cta-blob[data-speed]');

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
document.addEventListener('DOMContentLoaded', async () => {
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

        // Load products from API then init calculator
        await loadProducts();

        requestAnimationFrame(() => {
            initCotizador();
            initScrollAnimations();
            initParallax();
        });


    } catch (error) {
        console.error('Error inicializando personalizados.js:', error);
    }
});
