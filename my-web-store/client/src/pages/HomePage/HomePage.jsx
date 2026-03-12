import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ScrollReveal from '../../components/ui/ScrollReveal';
import SplitTextReveal from '../../components/ui/SplitTextReveal';
import MarqueeStrip from '../../components/ui/MarqueeStrip';
import CountUp from '../../components/ui/CountUp';
import { useProducts } from '../../hooks/useProducts';
import { checkInventory } from '../../hooks/useInventory';
import { useCartStore } from '../../stores/useCartStore';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';
import styles from './HomePage.module.css';

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

const HERO_PRODUCTS = [
  { img: 'https://datalakekos.blob.core.windows.net/images/site-assets/vaso4oz.webp', label: 'Bebidas Calientes' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122758892-fs1mqw-TAPA%20VIAJERA%20NEGRA%20VASO%209OZ.png', label: 'Tapas' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122962725-ds8bpo-CAJA%20CENA%20ADELANTE.png', label: 'Empaques' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122829555-bddmkl-TAPA%20DE%20CARTON%20CONT%205OZ%20GENERICO.png', label: 'Contenedores' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122791472-zbdvzc-PORTA%20VASOS%20MALETERO%20X2.png', label: 'Porta Vasos' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122539922-9ye1g5-TAAPA%20PLANA%20PITILLERA%209OZ.png', label: 'Bebidas Frias' },
];

const CATEGORIES = [
  { id: 'Bebidas calientes', nombre: 'Bebidas Calientes', img: 'https://datalakekos.blob.core.windows.net/images/site-assets/bebidashot.webp', size: 'large' },
  { id: 'Bebidas Frias', nombre: 'Bebidas Frias', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629716983-obzb88-bf.jpg', size: 'tall' },
  { id: 'Contenedores', nombre: 'Contenedores', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629736581-hmztu7-contenedores.jpg', size: 'normal' },
  { id: 'Empaques', nombre: 'Empaques', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629749077-mg4feg-empaques.jpg', size: 'normal' },
  { id: 'Platos', nombre: 'Platos', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629764583-4y38gx-platos.jpg', size: 'normal' },
  { id: 'Porta vasos', nombre: 'Porta Vasos', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629787369-kao1o8-porta-vasos.jpg', size: 'wide' },
  { id: 'Tapas para Contenedores', nombre: 'Tapas Contenedores', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629814468-tugjuk-tapascontenedores.jpg', size: 'normal' },
  { id: 'Tapas para Vasos', nombre: 'Tapas para Vasos', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629834934-5ceoiw-tapasvaso.jpg', size: 'normal' },
  { id: 'Accesorios', nombre: 'Accesorios', img: 'https://datalakekos.blob.core.windows.net/images/products/1772141806562-oycteh-accesorios.png', size: 'wide' },
];

const MARQUEE_ITEMS = [
  '500+ Negocios confian en nosotros',
  'Envio a toda Colombia',
  'Material Biodegradable Certificado',
  'Pago Seguro con Wompi',
  'Fabricacion Propia',
  'Precios por caja con IVA incluido',
];

const VALUE_PROPS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20M5 20V8l7-5 7 5v12" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
    stat: 'Fabricacion',
    title: 'Propia',
    desc: 'Producimos directamente, sin intermediarios',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <path d="M9 9h.01M15 9h.01" />
        <path d="M2 12h2M20 12h2M12 2v2M12 20v2" />
      </svg>
    ),
    stat: '100%',
    title: 'Biodegradable',
    desc: 'Comprometidos con el medio ambiente',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    stat: '24-72h',
    title: 'Entrega',
    desc: 'Despacho rapido a toda Colombia',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v4M12 19v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M1 12h4M19 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    stat: 'Mejores',
    title: 'Precios',
    desc: 'Precios de fabrica, directos al por mayor',
  },
];

/* ═══════════════════════════════════════════
   HERO PRODUCT STAGE
   ═══════════════════════════════════════════ */

function ProductStage() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % HERO_PRODUCTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.stage}>
      <div className={styles.stageGlow} />
      <div className={styles.stageProduct}>
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={HERO_PRODUCTS[current].img}
            alt={HERO_PRODUCTS[current].label}
            className={styles.stageImg}
            loading={current === 0 ? 'eager' : 'lazy'}
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </AnimatePresence>
      </div>
      <div className={styles.stageThumbs}>
        {HERO_PRODUCTS.map((item, i) => (
          <button
            key={i}
            className={`${styles.stageThumb} ${i === current ? styles.stageThumbActive : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={item.label}
          >
            <img src={item.img} alt={item.label} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   BEST SELLER CARD
   ═══════════════════════════════════════════ */

function BestSellerCard({ product, rank }) {
  const navigate = useNavigate();
  const addToCart = useCartStore((s) => s.add);
  const [qty, setQty] = useState(1);
  const [stock, setStock] = useState(null);
  const [adding, setAdding] = useState(false);

  const sku = product.codigo_siesa || product.sku || product.SKU || product.item_ext || '';
  const price = computePricePerBox(product);
  const totalConIva = Math.round(price * 1.19);
  const imgSrc = (Array.isArray(product.images) && product.images[0]) || product.image || '/images/placeholder.svg';
  const outOfStock = stock !== null && stock !== 'En Existencia';

  useEffect(() => {
    if (!sku) { setStock('En Existencia'); return; }
    checkInventory(sku).then((data) => {
      setStock((data?.estado || data?.status || 'Agotado').toString());
    });
  }, [sku]);

  const handleAdd = useCallback(async () => {
    if (outOfStock) return;
    setAdding(true);
    addToCart(product, qty);
    setTimeout(() => setAdding(false), 350);
  }, [addToCart, product, qty, outOfStock]);

  return (
    <motion.article
      className={styles.productCard}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: stock !== null ? 1 : 0.3, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.productVisual} onClick={() => navigate(`/product?id=${product.id}`)}>
        {outOfStock && <span className={styles.outBadge}>Agotado</span>}
        <span className={styles.rankBadge}>{rank}</span>
        <img
          className={`${styles.productImg} ${outOfStock ? styles.grayscale : ''}`}
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
        />
        <motion.div
          className={styles.quickAdd}
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
        >
          Ver producto
        </motion.div>
      </div>
      <div className={styles.productBody}>
        <Link to={`/product?id=${product.id}`} className={styles.productName}>
          {product.name}
        </Link>
        <div className={styles.productPricing}>
          <span className={styles.productPrice}>${formatMoney(totalConIva)}</span>
          <span className={styles.productUnit}>/caja</span>
          <span className={styles.ivaBadge}>IVA incl.</span>
        </div>
        <div className={styles.productActions}>
          <div className={styles.qtyControl}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} className={styles.qtyBtn}>-</button>
            <span className={styles.qtyValue}>{qty}</span>
            <button onClick={() => setQty(qty + 1)} className={styles.qtyBtn}>+</button>
          </div>
          <motion.button
            className={styles.addBtn}
            disabled={outOfStock || adding}
            onClick={handleAdd}
            whileTap={{ scale: 0.95 }}
          >
            {outOfStock ? 'Agotado' : adding ? 'Listo!' : 'Agregar'}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

/* ═══════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════ */

export default function HomePage() {
  const { data: products = [] } = useProducts();
  const navigate = useNavigate();

  const bestSellers = products
    .filter((p) => p.image && !p.image.includes('placeholder'))
    .slice(0, 4);
  const filledBs = bestSellers.length < 4
    ? [...bestSellers, ...products.slice(0, 4 - bestSellers.length)]
    : bestSellers;

  return (
    <AnimatedPage>
      <Helmet>
        <title>KOS Colombia - Empaques y Vasos de Papel para Food Service</title>
        <meta name="description" content="Fabricantes de vasos de papel, contenedores y empaques biodegradables para food service. Precios de fabrica, envio a toda Colombia." />
      </Helmet>

      {/* ══════ SECTION 1: HERO INMERSIVO ══════ */}
      <section className={styles.hero}>
        <div className={styles.heroGlowBlue} />
        <div className={styles.heroGlowOrange} />
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <motion.span
              className={styles.heroEyebrow}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              FABRICANTES DE EMPAQUES PARA FOOD SERVICE
            </motion.span>

            <SplitTextReveal
              text="Empaques que impulsan tu negocio"
              className={styles.heroTitle}
              delay={0.4}
            />

            <motion.p
              className={styles.heroSub}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.7 }}
            >
              Vasos, contenedores y empaques biodegradables.
              Precios por caja, envio a toda Colombia.
            </motion.p>

            <motion.div
              className={styles.heroCtas}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              <Link to="/products" className={`btn-primary ${styles.heroBtn}`}>
                Ver Catalogo
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link to="/personalizados" className={`btn-outline ${styles.heroBtnOutline}`}>
                Personaliza tus Vasos
              </Link>
            </motion.div>

            <motion.div
              className={styles.heroTrust}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.8 }}
            >
              <div className={styles.trustMicro}>
                <strong>500+</strong> Clientes
              </div>
              <span className={styles.trustDivider} />
              <div className={styles.trustMicro}>
                <strong>24-72h</strong> Entrega
              </div>
              <span className={styles.trustDivider} />
              <div className={styles.trustMicro}>
                <strong>100%</strong> Pago Seguro
              </div>
            </motion.div>
          </div>

          <motion.div
            className={styles.heroStage}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <ProductStage />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className={styles.scrollHint}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </motion.div>
      </section>

      {/* ══════ SECTION 2: SOCIAL PROOF MARQUEE ══════ */}
      <MarqueeStrip items={MARQUEE_ITEMS} speed={35} />

      {/* ══════ SECTION 3: CATEGORIES BENTO GRID ══════ */}
      <section className={`${styles.categoriesSection} section`}>
        <div className="container">
          <ScrollReveal>
            <div className={styles.sectionHeader}>
              <h2 className="section-title">
                Explora Nuestra{' '}
                <span className="text-gradient-secondary">Linea</span>
              </h2>
              <p className="section-subtitle">
                Encuentra el empaque perfecto para tu negocio de alimentos
              </p>
            </div>
          </ScrollReveal>

          <div className={styles.bentoGrid}>
            {CATEGORIES.map((cat, i) => (
              <ScrollReveal key={cat.id} delay={i * 0.05}>
                <motion.div
                  className={`${styles.bentoCard} ${styles[`bento_${cat.size}`]}`}
                  whileHover={{ y: -6 }}
                  onClick={() => navigate(`/products?cat=${encodeURIComponent(cat.id)}`)}
                >
                  <div className={styles.bentoImg}>
                    <img src={cat.img} alt={cat.nombre} loading="lazy" />
                  </div>
                  <div className={styles.bentoOverlay} />
                  <div className={styles.bentoContent}>
                    <h3>{cat.nombre}</h3>
                    <span className={styles.bentoExplore}>
                      Explorar
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SECTION 4: BEST SELLERS ══════ */}
      {filledBs.length > 0 && (
        <section className={`${styles.bestSection} section section-warm`}>
          <div className="container">
            <ScrollReveal>
              <div className={styles.bestHeader}>
                <div>
                  <span className={styles.bestTag}>Populares</span>
                  <h2 className="section-title">Lo Mas Vendido</h2>
                  <p className="section-subtitle">
                    Los productos preferidos por nuestros clientes
                  </p>
                </div>
                <Link to="/products" className={styles.viewAll}>
                  Ver catalogo completo
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </ScrollReveal>
            <div className={styles.bestGrid}>
              {filledBs.map((p, i) => (
                <ScrollReveal key={p.id} delay={i * 0.08}>
                  <BestSellerCard product={p} rank={i + 1} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════ SECTION 5: VALUE PROPOSITION STRIP ══════ */}
      <section className={`${styles.valueSection} section section-dark`}>
        <div className="container">
          <div className={styles.valueGrid}>
            {VALUE_PROPS.map((vp, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className={styles.valueItem}>
                  <div className={styles.valueIcon}>{vp.icon}</div>
                  <div className={styles.valueStat}>{vp.stat}</div>
                  <div className={styles.valueTitle}>{vp.title}</div>
                  <p className={styles.valueDesc}>{vp.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SECTION 6: CUSTOMIZATION CTA ══════ */}
      <section className={styles.customSection}>
        <div className={styles.customBg} />
        <div className={`${styles.customInner} container`}>
          <ScrollReveal>
            <div className={styles.customText}>
              <span className={styles.customEyebrow}>PERSONALIZACION</span>
              <h2 className={styles.customTitle}>Tu marca en cada vaso</h2>
              <p className={styles.customDesc}>
                Imprime tu logo en nuestros vasos y empaques. Pedidos desde 1,000 unidades.
                Haz que tu marca sea inolvidable.
              </p>
              <Link to="/personalizados" className="btn-secondary">
                Cotizar Ahora
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>
          <motion.div
            className={styles.customVisual}
            initial={{ opacity: 0, x: 80 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src="https://datalakekos.blob.core.windows.net/images/site-assets/vaso4oz.webp"
              alt="Vaso personalizado"
              loading="lazy"
            />
          </motion.div>
        </div>
      </section>

      {/* ══════ SECTION 7: TRUST / STATS ══════ */}
      <section className={`${styles.statsSection} section`}>
        <div className="container">
          <ScrollReveal>
            <div className={styles.sectionHeader} style={{ textAlign: 'center' }}>
              <h2 className="section-title">
                Confian en{' '}
                <span className="text-gradient-primary">Nosotros</span>
              </h2>
            </div>
          </ScrollReveal>
          <div className={styles.statsGrid}>
            <ScrollReveal delay={0}>
              <div className={styles.statCard}>
                <CountUp end={500} suffix="+" className={styles.statNumber} />
                <span className={styles.statLabel}>Negocios atendidos</span>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className={styles.statCard}>
                <CountUp end={50000} suffix="+" className={styles.statNumber} />
                <span className={styles.statLabel}>Cajas entregadas</span>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className={styles.statCard}>
                <CountUp end={32} className={styles.statNumber} />
                <span className={styles.statLabel}>Departamentos cubiertos</span>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <div className={styles.statCard}>
                <CountUp end={98} suffix="%" className={styles.statNumber} />
                <span className={styles.statLabel}>Clientes satisfechos</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ══════ SECTION 8: NEWSLETTER + WHATSAPP CTA ══════ */}
      <section className={`${styles.ctaSection} section section-dark`}>
        <div className="container">
          <div className={styles.ctaInner}>
            <ScrollReveal>
              <div className={styles.ctaText}>
                <h2 className={styles.ctaTitle}>Recibe ofertas exclusivas</h2>
                <p className={styles.ctaDesc}>
                  Suscribete y recibe novedades, promociones y descuentos directos a tu correo.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <div className={styles.ctaActions}>
                <div className={styles.ctaEmail}>
                  <input type="email" placeholder="tu@correo.com" className={styles.ctaInput} />
                  <button className={styles.ctaSubmit}>Suscribirse</button>
                </div>
                <a
                  href="https://wa.me/573225227073"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.waBtn}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.472-.149-.672.15-.198.297-.768.966-.94 1.164-.173.198-.346.223-.643.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.672-1.614-.92-2.205-.242-.58-.487-.5-.672-.51l-.572-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.48 1.065 2.876 1.214 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  </svg>
                  Escribenos por WhatsApp
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </AnimatedPage>
  );
}
