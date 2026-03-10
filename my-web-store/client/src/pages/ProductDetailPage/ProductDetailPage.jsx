import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { useCartStore } from '../../stores/useCartStore';
import { useUIStore } from '../../stores/useUIStore';
import { apiGet } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';
import styles from './ProductDetailPage.module.css';

function parseDescription(text) {
  if (!text) return { subtitle: '', specs: [], recommendations: [], brand: [], other: [] };
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (!lines.length) return { subtitle: '', specs: [], recommendations: [], brand: [], other: [] };

  const subtitle = lines[0];
  const remaining = lines.slice(1);
  const specRegex = /^(Material|Capacidad[\s\w]*|Cantidad por caja|Cantidad|Calibre):\s*(.*)$/i;
  const recomTitleRegex = /^Recomendaciones de uso:$/i;
  const brandRegex = /^Elegir KOS Colombia es elegir consciencia\.$/i;

  const specs = [];
  const recommendations = [];
  const brand = [];
  const other = [];
  let section = 'normal';

  for (let i = 0; i < remaining.length; i++) {
    const line = remaining[i];
    if (brandRegex.test(line) || section === 'brand') { section = 'brand'; brand.push(line); continue; }
    if (recomTitleRegex.test(line)) { section = 'recommendations'; continue; }
    if (section === 'recommendations') { recommendations.push(line.replace(/^-\s*/, '').trim()); continue; }

    const specMatch = line.match(specRegex);
    if (specMatch) {
      let value = specMatch[2].trim();
      if (!value && i + 1 < remaining.length && !specRegex.test(remaining[i + 1])) {
        value = remaining[++i];
      }
      specs.push({ label: specMatch[1], value, sub: false });
      if (specMatch[1].toLowerCase() === 'material') section = 'material_specs';
      else section = 'normal';
      continue;
    }
    if (section === 'material_specs' && line.startsWith('-')) {
      const clean = line.replace(/^-\s*/, '').trim();
      const ci = clean.indexOf(':');
      specs.push(ci !== -1
        ? { label: clean.substring(0, ci).trim(), value: clean.substring(ci + 1).trim(), sub: true }
        : { label: '', value: clean, sub: true });
      continue;
    }
    if (section === 'material_specs') section = 'normal';
    other.push(line);
  }
  return { subtitle, specs, recommendations, brand, other };
}

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const productId = Number(searchParams.get('id'));
  const addToCart = useCartStore((s) => s.add);
  const openCart = useUIStore((s) => s.openCart);

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [stock, setStock] = useState('loading');
  const [displayPrice, setDisplayPrice] = useState(0);

  const mainImgRef = useRef(null);
  const lensRef = useRef(null);
  const wrapRef = useRef(null);

  // Load product
  useEffect(() => {
    if (!Number.isFinite(productId)) return;
    setLoading(true);
    (async () => {
      try {
        let p;
        try { p = await apiGet(`/api/products/${productId}`); } catch {
          const all = await apiGet('/api/products');
          p = all.find((x) => Number(x.id) === productId);
        }
        if (!p) throw new Error('Not found');
        setProduct(p);
        setDisplayPrice(Math.round(computePricePerBox(p) * 1.19));

        // Check inventory
        const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || '').toString().trim();
        if (!sku) { setStock('available'); }
        else {
          const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`, { cache: 'no-store' });
          if (r.ok) {
            const data = await r.json();
            setStock((data?.estado || data?.status || '') === 'En Existencia' ? 'available' : 'out');
          } else { setStock('out'); }
        }

        // Load related
        try {
          const all = await apiGet('/api/products');
          const candidates = all.filter((x) => x.id !== p.id && x.active !== false);
          const catName = (p.category_name || p.category_nombre || '').toLowerCase();
          let rel = candidates.filter((x) => {
            const cn = (x.category_name || x.category_nombre || '').toLowerCase();
            if (catName.includes('vaso')) return cn.includes('tapa') || cn.includes('portavaso');
            if (catName.includes('tapa')) return cn.includes('vaso') || cn.includes('contenedor');
            if (catName.includes('contenedor') || catName.includes('plato')) return cn.includes('tapa') || cn.includes('empaque');
            return cn === catName;
          });
          rel.sort(() => Math.random() - 0.5);
          setRelated(rel.slice(0, 2));
        } catch {}
      } catch { setProduct(null); }
      setLoading(false);
    })();
  }, [productId]);

  // Dynamic price
  useEffect(() => {
    if (!product?.codigo) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/precio?codigo=${encodeURIComponent(product.codigo)}&n=${qty}`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        let unitario = Number(data.precioUnitario);
        if (!Number.isFinite(unitario) || unitario <= 0) {
          const total = Number(data.precio);
          const esc = Number(data.escalonUsado);
          if (Number.isFinite(total) && Number.isFinite(esc) && esc > 0) unitario = total / esc;
        }
        if (Number.isFinite(unitario) && unitario > 0) {
          setDisplayPrice(Math.round(unitario * 1000 * 1.19));
        }
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [qty, product]);

  // Lens zoom
  const handleMouseMove = useCallback((e) => {
    const lens = lensRef.current;
    const wrap = wrapRef.current;
    const img = mainImgRef.current;
    if (!lens || !wrap || !img) return;
    lens.style.display = 'block';
    lens.style.backgroundImage = `url("${img.src}")`;
    const wr = wrap.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const lw = lens.offsetWidth;
    const lh = lens.offsetHeight;
    let left = Math.max(0, Math.min(e.clientX - wr.left - lw / 2, wr.width - lw));
    let top = Math.max(0, Math.min(e.clientY - wr.top - lh / 2, wr.height - lh));
    lens.style.left = left + 'px';
    lens.style.top = top + 'px';
    const rx = Math.max(0, Math.min(e.clientX - ir.left, ir.width));
    const ry = Math.max(0, Math.min(e.clientY - ir.top, ir.height));
    lens.style.backgroundPosition = `${(rx / ir.width) * 100}% ${(ry / ir.height) * 100}%`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (lensRef.current) lensRef.current.style.display = 'none';
  }, []);

  if (loading) {
    return (
      <AnimatedPage>
        <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e0e0e0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </AnimatedPage>
    );
  }

  if (!product) {
    return (
      <AnimatedPage>
        <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
          <h2>Producto no encontrado</h2>
          <Link to="/products" className="btn-primary" style={{ display: 'inline-block', marginTop: 16 }}>
            Ver catalogo
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  const imgs = (Array.isArray(product.images) && product.images.length) ? product.images : [product.image || '/images/placeholder.svg'];
  const parsed = parseDescription(product.description);
  const catName = product.category_name || product.category_nombre || product.category || '';
  const outOfStock = stock === 'out';

  const handleAdd = () => {
    if (outOfStock) return;
    addToCart(product, Math.max(1, qty));
    openCart();
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>{product.name} - KosXpress</title>
        <meta name="description" content={parsed.subtitle || `Compra ${product.name} en KosXpress`} />
      </Helmet>

      <div className={`${styles.page} container`}>
        <div className={styles.layout}>
          {/* Gallery */}
          <div className={styles.gallery}>
            <div
              ref={wrapRef}
              className={styles.mainImgWrap}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <img
                ref={mainImgRef}
                className={styles.mainImg}
                src={imgs[imgIdx]}
                alt={product.name}
                onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
              />
              <div ref={lensRef} className={styles.lens} />
              {imgs.length > 1 && (
                <>
                  <button className={styles.prevBtn} onClick={() => setImgIdx((i) => (i - 1 + imgs.length) % imgs.length)}>&#8249;</button>
                  <button className={styles.nextBtn} onClick={() => setImgIdx((i) => (i + 1) % imgs.length)}>&#8250;</button>
                </>
              )}
            </div>
            <div className={styles.thumbs}>
              {imgs.map((src, i) => (
                <img
                  key={i}
                  className={`${styles.thumb} ${i === imgIdx ? styles.active : ''}`}
                  src={src}
                  alt={`${product.name} ${i + 1}`}
                  onClick={() => setImgIdx(i)}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
                />
              ))}
            </div>
          </div>

          {/* Info */}
          <motion.div className={styles.info} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            {catName && <p className={styles.category}>Categoria: {catName}</p>}
            <h1 className={styles.name}>{product.name}</h1>
            <div className={styles.price}>
              ${formatMoney(displayPrice)}
              <span className={styles.perBox}> / caja</span>{' '}
              <span className={styles.ivaBadge}>IVA incluido</span>
            </div>

            {stock === 'loading' ? (
              <span className={styles.stockLoading}>Consultando inventario...</span>
            ) : outOfStock ? (
              <span className={styles.stockOut}>Agotado</span>
            ) : (
              <span className={styles.stockOk}>En Existencia</span>
            )}

            {parsed.subtitle && <p className={styles.subtitle}>{parsed.subtitle}</p>}

            <div className={styles.actions}>
              <input
                type="number"
                className={styles.qtyInput}
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
              <motion.button
                className={`btn-primary ${styles.addBtn}`}
                disabled={outOfStock || stock === 'loading'}
                onClick={handleAdd}
                whileTap={{ scale: 0.95 }}
              >
                {outOfStock ? 'No disponible' : 'Agregar al carrito'}
              </motion.button>
            </div>

            {/* Specs */}
            {parsed.specs.length > 0 && (
              <div className={`glass-panel ${styles.specs}`}>
                <div className={styles.specsTitle}>Especificaciones Tecnicas</div>
                <div className={styles.specsGrid}>
                  {parsed.specs.map((s, i) => (
                    <div key={i} className={`${styles.specItem} ${s.sub ? styles.specSubItem : ''}`}>
                      {s.label && <span className={styles.specLabel}>{s.label}</span>}
                      <span className={styles.specValue}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {parsed.recommendations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3>Recomendaciones de uso</h3>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {parsed.recommendations.map((r, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.other.length > 0 && (
              <div style={{ marginTop: 16, fontWeight: 500 }}>
                {parsed.other.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            )}
          </motion.div>
        </div>

        {/* Complementary products */}
        {related.length > 0 && (
          <ScrollReveal>
            <div className={styles.complementary}>
              <h2 className={styles.compTitle}>Complementa tu compra</h2>
              <div className={styles.compGrid}>
                {related.map((p) => {
                  const img = (Array.isArray(p.images) && p.images[0]) || p.image || '/images/placeholder.svg';
                  const price = computePricePerBox(p);
                  return (
                    <Link key={p.id} to={`/product?id=${p.id}`} className={styles.compCard}>
                      <div className={styles.compImg}>
                        <img src={img} alt={p.name} loading="lazy" onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }} />
                      </div>
                      <div>
                        <h4 className={styles.compName}>{p.name}</h4>
                        <div className={styles.compPrice}>${formatMoney(Math.round(price * 1.19))}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        )}
      </div>
    </AnimatedPage>
  );
}
