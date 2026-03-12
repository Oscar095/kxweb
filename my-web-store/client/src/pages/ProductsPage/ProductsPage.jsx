import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { useProducts, useCategories } from '../../hooks/useProducts';
import { checkInventory } from '../../hooks/useInventory';
import { useCartStore } from '../../stores/useCartStore';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';
import styles from './ProductsPage.module.css';

function ProductCard({ product, inventoryStatus }) {
  const navigate = useNavigate();
  const addToCart = useCartStore((s) => s.add);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [adding, setAdding] = useState(false);

  const imgs = (Array.isArray(product.images) && product.images.length)
    ? product.images
    : [product.image || '/images/placeholder.svg'];
  const price = computePricePerBox(product);
  const totalConIva = Math.round(price * 1.19);
  const outOfStock = inventoryStatus === 'no-disponible';

  const handleAdd = useCallback(async () => {
    if (outOfStock) return;
    setAdding(true);
    const sku = (product.codigo_siesa || product.sku || product.SKU || product.item_ext || '').toString().trim();
    if (sku) {
      const data = await checkInventory(sku);
      const estado = (data?.estado || data?.status || '').toString();
      if (estado !== 'En Existencia') {
        setAdding(false);
        return;
      }
    }
    addToCart(product, qty);
    setTimeout(() => setAdding(false), 350);
  }, [addToCart, product, qty, outOfStock]);

  return (
    <motion.div
      className={styles.card}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.cardVisual} onClick={() => navigate(`/product?id=${product.id}`)}>
        {outOfStock && <span className={styles.stockBadge}>Agotado</span>}
        <img
          className={`${styles.cardImg} ${outOfStock ? styles.imgGray : ''}`}
          src={imgs[imgIdx]}
          alt={product.name}
          loading="lazy"
          onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
        />
        {imgs.length > 1 && (
          <>
            <button
              className={`${styles.imgNav} ${styles.imgPrev}`}
              onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i - 1 + imgs.length) % imgs.length); }}
            >
              &#8249;
            </button>
            <button
              className={`${styles.imgNav} ${styles.imgNext}`}
              onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i + 1) % imgs.length); }}
            >
              &#8250;
            </button>
          </>
        )}
        <div className={styles.cardQuickView}>Ver detalle</div>
      </div>
      <div className={styles.cardBody}>
        <Link to={`/product?id=${product.id}`} className={styles.cardName}>
          {product.name}
        </Link>
        <div className={styles.cardPricing}>
          <span className={styles.cardPrice}>${formatMoney(totalConIva)}</span>
          <span className={styles.cardUnit}>/caja</span>
          <span className={styles.cardIva}>IVA incl.</span>
        </div>
        <div className={styles.cardActions}>
          <div className={styles.qtyControl}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} className={styles.qtyBtn}>-</button>
            <span className={styles.qtyVal}>{qty}</span>
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
    </motion.div>
  );
}

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const initialCat = searchParams.get('cat') || 'all';

  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();

  const [activeCat, setActiveCat] = useState(initialCat);
  const [availability, setAvailability] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [inventoryMap, setInventoryMap] = useState({});

  useEffect(() => {
    if (!products.length) return;
    const checkAll = async () => {
      const map = {};
      await Promise.all(
        products.map(async (p) => {
          const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || p.codigo || '').toString().trim();
          if (!sku) { map[p.id] = 'disponible'; return; }
          const data = await checkInventory(sku);
          const estado = (data?.estado || data?.status || '').toString();
          map[p.id] = estado === 'En Existencia' ? 'disponible' : 'no-disponible';
        })
      );
      setInventoryMap(map);
    };
    checkAll();
  }, [products]);

  const matchCategory = useCallback((product, cat) => {
    if (cat === 'all') return true;
    const catLower = cat.toLowerCase();
    if ((product.category_name || '').toLowerCase() === catLower) return true;
    const dbCat = categories.find(
      (c) => (c.nombre || '').toLowerCase() === catLower || (c.descripcion || '').toLowerCase() === catLower
    );
    if (dbCat && String(product.category) === String(dbCat.id)) return true;
    return false;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => matchCategory(p, activeCat));
    if (availability !== 'all' && Object.keys(inventoryMap).length > 0) {
      result = result.filter((p) => inventoryMap[p.id] === availability);
    }
    if (sortBy === 'asc') {
      result = [...result].sort((a, b) => (a.price_unit || 0) - (b.price_unit || 0));
    } else if (sortBy === 'desc') {
      result = [...result].sort((a, b) => (b.price_unit || 0) - (a.price_unit || 0));
    }
    return result;
  }, [products, activeCat, availability, sortBy, inventoryMap, matchCategory]);

  const catDescription = useMemo(() => {
    if (activeCat === 'all') return '';
    const dbCat = categories.find(
      (c) => (c.nombre || '').toLowerCase() === activeCat.toLowerCase()
    );
    if (dbCat?.descripcion) return dbCat.descripcion;
    const catProducts = filteredProducts.slice(0, 4);
    if (catProducts.length > 0) {
      const names = catProducts.map((p) => p.name).filter(Boolean);
      return `Explora nuestra variedad de ${activeCat}, incluyendo: ${names.join(', ')} y mucho mas.`;
    }
    return '';
  }, [activeCat, categories, filteredProducts]);

  const handleCatClick = (cat) => {
    setActiveCat(cat);
    const url = cat === 'all' ? '/products' : `/products?cat=${encodeURIComponent(cat)}`;
    window.history.replaceState(null, '', url);
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>{activeCat === 'all' ? 'Catalogo Completo' : activeCat} - KOS Colombia</title>
      </Helmet>

      <div className="container">
        {/* Page header */}
        <ScrollReveal>
          <div className={styles.pageHeader}>
            <div className={styles.breadcrumb}>
              <Link to="/">Inicio</Link>
              <span>/</span>
              <span>{activeCat === 'all' ? 'Catalogo' : activeCat}</span>
            </div>
            <h1 className={styles.pageTitle}>
              {activeCat === 'all' ? 'Catalogo Completo' : activeCat}
            </h1>
            {catDescription && <p className={styles.pageDesc}>{catDescription}</p>}
          </div>
        </ScrollReveal>

        {/* Category tabs */}
        <div className={styles.catScroll}>
          <div className={styles.catTabs}>
            <button
              className={`${styles.catTab} ${activeCat === 'all' ? styles.catTabActive : ''}`}
              onClick={() => handleCatClick('all')}
            >
              Todos
            </button>
            {categories.map((c) => {
              const name = c.nombre || c.descripcion || 'Sin Nombre';
              return (
                <button
                  key={c.id}
                  className={`${styles.catTab} ${activeCat === name ? styles.catTabActive : ''}`}
                  onClick={() => handleCatClick(name)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <span className={styles.resultCount}>
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
          </span>
          <div className={styles.filterControls}>
            <select
              className={styles.filterSelect}
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="all">Disponibilidad</option>
              <option value="disponible">Disponibles</option>
              <option value="no-disponible">Agotados</option>
            </select>
            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Ordenar por</option>
              <option value="asc">Precio: Menor a Mayor</option>
              <option value="desc">Precio: Mayor a Menor</option>
            </select>
          </div>
        </div>

        {/* Product grid */}
        {isLoading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className={styles.grid}>
            {filteredProducts.map((p, i) => (
              <ScrollReveal key={p.id} delay={Math.min(i * 0.04, 0.25)}>
                <ProductCard product={p} inventoryStatus={inventoryMap[p.id]} />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M8 11h6" />
            </svg>
            <h3>Sin resultados</h3>
            <p>No hay productos para los filtros seleccionados.</p>
            <button className="btn-primary" onClick={() => { setActiveCat('all'); setAvailability('all'); }}>
              Ver todos los productos
            </button>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
