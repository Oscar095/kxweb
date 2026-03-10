import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { apiGet } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { computePricePerBox } from '../../lib/price';

const IVA_RATE = 1.19;

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet('/api/products')
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data.products || data.data || [];
        setProducts(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error al cargar productos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.toLowerCase();
  const results = query
    ? products.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const category = (p.category_name || p.categoria || '').toLowerCase();
        return name.includes(q) || category.includes(q);
      })
    : [];

  return (
    <AnimatedPage>
      <Helmet>
        <title>{query ? `Resultados: ${query}` : 'Buscar'} | KosXpress</title>
      </Helmet>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Resultados de busqueda</h1>
        {query && (
          <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
            Mostrando resultados para: <strong>{query}</strong>
          </p>
        )}

        {!query && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <p>Ingresa un termino de busqueda para encontrar productos.</p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p>Cargando productos...</p>
          </div>
        )}

        {error && (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>{error}</p>
          </div>
        )}

        {query && !loading && !error && results.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              No se encontraron productos para &quot;{query}&quot;.
            </p>
            <Link
              to="/products"
              className="btn-primary"
              style={{ display: 'inline-block', padding: '12px 32px', textDecoration: 'none' }}
            >
              Ver todos los productos
            </Link>
          </div>
        )}

        {results.length > 0 && (
          <>
            <p style={{ marginBottom: '1rem', opacity: 0.7 }}>
              {results.length} producto{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {results.map((product) => {
                const price = computePricePerBox(product);
                const totalConIva = Math.round(price * IVA_RATE);
                const imgSrc =
                  (Array.isArray(product.images) && product.images[0]) ||
                  product.image ||
                  '/images/placeholder.svg';

                return (
                  <Link
                    key={product.id}
                    to={`/product?id=${product.id}`}
                    className="glass-panel"
                    style={{
                      display: 'block',
                      padding: '1rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <img
                      src={imgSrc}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'contain',
                        borderRadius: 8,
                        marginBottom: '0.75rem',
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/images/placeholder.svg';
                      }}
                    />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{product.name}</h3>
                    <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>
                      {product.category_name || product.categoria || ''}
                    </p>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      ${formatMoney(totalConIva)}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>
                        / caja (IVA incl.)
                      </span>
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
