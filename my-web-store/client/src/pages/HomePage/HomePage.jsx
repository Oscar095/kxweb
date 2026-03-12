import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { useProducts, useCategories } from '../../hooks/useProducts';
import { checkInventory } from '../../hooks/useInventory';
import { useCartStore } from '../../stores/useCartStore';
import { formatMoney } from '../../lib/format';
import { computePricePerBox, getCantidad } from '../../lib/price';
import styles from './HomePage.module.css';

const ROTATOR_ITEMS = [
  { img: 'https://datalakekos.blob.core.windows.net/images/site-assets/vaso4oz.webp', label: 'Bebidas Calientes' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122758892-fs1mqw-TAPA%20VIAJERA%20NEGRA%20VASO%209OZ.png', label: 'Bebidas Frias' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122962725-ds8bpo-CAJA%20CENA%20ADELANTE.png', label: 'Empaques' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122829555-bddmkl-TAPA%20DE%20CARTON%20CONT%205OZ%20GENERICO.png', label: 'Contenedores' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122791472-zbdvzc-PORTA%20VASOS%20MALETERO%20X2.png', label: 'Porta Vasos' },
  { img: 'https://datalakekos.blob.core.windows.net/images/products/Banners/1772122539922-9ye1g5-TAAPA%20PLANA%20PITILLERA%209OZ.png', label: 'Tapas' },
];

const CATEGORIES = [
  { id: 'Bebidas calientes', nombre: 'Bebidas calientes', img: 'https://datalakekos.blob.core.windows.net/images/site-assets/bebidashot.webp' },
  { id: 'Bebidas Frias', nombre: 'Bebidas Frias', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629716983-obzb88-bf.jpg' },
  { id: 'Contenedores', nombre: 'Contenedores', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629736581-hmztu7-contenedores.jpg' },
  { id: 'Empaques', nombre: 'Empaques', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629749077-mg4feg-empaques.jpg' },
  { id: 'Platos', nombre: 'Platos', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629764583-4y38gx-platos.jpg' },
  { id: 'Porta vasos', nombre: 'Porta vasos', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629787369-kao1o8-porta-vasos.jpg' },
  { id: 'Tapas para Contenedores', nombre: 'Tapas para Contenedores', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629814468-tugjuk-tapascontenedores.jpg' },
  { id: 'Tapas para Vasos', nombre: 'Tapas para Vasos', img: 'https://datalakekos.blob.core.windows.net/images/products/1769629834934-5ceoiw-tapasvaso.jpg' },
  { id: 'Accesorios', nombre: 'Accesorios', img: 'https://datalakekos.blob.core.windows.net/images/products/1772141806562-oycteh-accesorios.png' },
];

function HeroRotator() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % ROTATOR_ITEMS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.carouselWrap}>
      <div className={styles.rotator}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            className={styles.rotatorItem}
            initial={{ opacity: 0, x: 300, scale: 0.9, rotate: 8 }}
            animate={{ opacity: 1, x: 0, scale: 1.1, rotate: 0 }}
            exit={{ opacity: 0, x: -200, scale: 0.8, rotate: -6 }}
            transition={{
              enter: { duration: 0.9, ease: [0.34, 1.56, 0.64, 1] },
              exit: { duration: 0.6, ease: [0.4, 0, 1, 1] },
            }}
          >
            <motion.img
              src={ROTATOR_ITEMS[current].img}
              alt={ROTATOR_ITEMS[current].label}
              loading={current === 0 ? 'eager' : 'lazy'}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className={styles.rotatorCaption}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {ROTATOR_ITEMS[current].label}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={styles.dots}>
        {ROTATOR_ITEMS.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`Ir a slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

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
      className={styles.bsCard}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: stock !== null ? 1 : 0.3, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.bsVisual} onClick={() => navigate(`/product?id=${product.id}`)}>
        {outOfStock && <span className={styles.outOfStockBadge}>No disponible</span>}
        <span className={styles.bsRank}>#{rank}</span>
        <img
          className={`${styles.bsImg} ${outOfStock ? styles.imgGrayscale : ''}`}
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
        />
        <span className={styles.bsFlame}>&#x1F525;</span>
      </div>
      <div className={styles.bsBody}>
        <Link to={`/product?id=${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 className={styles.bsName}>{product.name}</h3>
        </Link>
        <p className={styles.bsPrice}>
          ${formatMoney(totalConIva)}
          <span className={styles.bsPerBox}> / caja</span>{' '}
          <span style={{ fontSize: '0.65rem', color: '#4CAF50', fontWeight: 600 }}>IVA incluido</span>
        </p>
        <div className={styles.bsActions}>
          <input
            type="number"
            className={styles.qtyInput}
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <motion.button
            className={`btn-primary ${styles.bsAddBtn}`}
            disabled={outOfStock || adding}
            onClick={handleAdd}
            whileTap={{ scale: 0.95 }}
          >
            {outOfStock ? 'No disponible' : adding ? '...' : 'Agregar'}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

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
        <title>KosXpress - Empaques Desechables y Biodegradables en Colombia</title>
        <meta name="description" content="Tu tienda online de empaques desechables, biodegradables y productos para alimentos en Colombia." />
      </Helmet>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlass}>
          <motion.div
            className={styles.heroContent}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <h1>Empaques Premium para tu Negocio</h1>
            <p>
              Vasos, contenedores y empaques biodegradables con envío a toda Colombia.
              Precios por caja con IVA incluido.
            </p>
            <div className={styles.heroActions}>
              <motion.a
                href="/products"
                className="btn-primary"
                style={{ fontSize: '1.3rem', padding: '18px 48px', textTransform: 'uppercase', letterSpacing: '1px', textDecoration: 'none', display: 'inline-block' }}
                onClick={(e) => { e.preventDefault(); navigate('/products'); }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Compra ahora
              </motion.a>
              <motion.a
                href="/personalizados"
                className={styles.btnNaranja}
                style={{ textDecoration: 'none' }}
                onClick={(e) => { e.preventDefault(); navigate('/personalizados'); }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Personaliza
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </motion.a>
            </div>
          </motion.div>
          <HeroRotator />
        </div>
      </section>

      {/* Benefits */}
      <section className={`${styles.benefits} container`}>
        <ScrollReveal>
          <h2 className={styles.benefitsTitle}>¿Por qué elegirnos?</h2>
        </ScrollReveal>
        <div className={styles.benefitsGrid}>
          {[
            { icon: 'check', title: 'Calidad premium', desc: 'Seleccionamos cuidadosamente cada envase para garantizar los mejores acabados y presentación.' },
            { icon: 'shield', title: 'Materiales resistentes', desc: 'Nuestros productos están fabricados con materiales de alta durabilidad.' },
            { icon: 'truck', title: 'Entrega ágil', desc: 'Optimizamos nuestros procesos logísticos para que recibas tus empaques en el menor tiempo posible.' },
          ].map((b, i) => (
            <ScrollReveal key={b.title} delay={i * 0.1}>
              <div className={styles.benefitCard}>
                <div className={styles.benefitIcon}>
                  {b.icon === 'check' && (
                    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                  {b.icon === 'shield' && (
                    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  )}
                  {b.icon === 'truck' && (
                    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  )}
                </div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Trust Signals */}
      <section className={`${styles.trust} container`}>
        <ScrollReveal>
          <div className={styles.trustGrid}>
            <div className={styles.trustItem}>
              <strong>500+</strong>
              <span>Negocios confían en nosotros</span>
            </div>
            <div className={styles.trustItem}>
              <strong>100%</strong>
              <span>Pago seguro con Wompi</span>
            </div>
            <div className={styles.trustItem}>
              <strong>24-72h</strong>
              <span>Tiempo de entrega</span>
            </div>
            <div className={styles.trustItem}>
              <strong>Certificado</strong>
              <span>Material biodegradable</span>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Categories */}
      <section className={`${styles.catalog} container`}>
        <ScrollReveal>
          <div className={styles.catalogHeader}>
            <h2>Explora por Categoría</h2>
            <p>Selecciona la línea de productos que mejor se adapte a tu negocio.</p>
          </div>
        </ScrollReveal>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((cat, i) => (
            <ScrollReveal key={cat.id} delay={i * 0.06}>
              <motion.div
                className={styles.categoryCard}
                whileHover={{ y: -6 }}
                onClick={() => navigate(`/products?cat=${encodeURIComponent(cat.id)}`)}
              >
                <div className={styles.catBg}>
                  <img src={cat.img} alt={cat.nombre} loading="lazy" />
                  <div className={styles.catOverlay} />
                </div>
                <div className={styles.catContent}>
                  <h3>{cat.nombre}</h3>
                  <span className={styles.explorePill}>Explorar &rarr;</span>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Best Sellers */}
      {filledBs.length > 0 && (
        <section className={`${styles.bestSellers} container`}>
          <ScrollReveal>
            <div className={styles.bsHeader}>
              <div>
                <span className={styles.bsTag}>&#x1F525; Populares</span>
                <h2>Más vendidos</h2>
                <p>Los productos preferidos por nuestros clientes.</p>
              </div>
              <Link to="/products" className={styles.bsViewAll}>
                Ver catálogo completo &rarr;
              </Link>
            </div>
          </ScrollReveal>
          <div className={styles.bsGrid}>
            {filledBs.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 0.08}>
                <BestSellerCard product={p} rank={i + 1} />
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}
    </AnimatedPage>
  );
}
