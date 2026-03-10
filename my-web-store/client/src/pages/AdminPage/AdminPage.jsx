import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { formatMoney } from '../../lib/format';

/* ───────────────────────── colour tokens ───────────────────────── */
const PRIMARY   = '#009FE3';
const SECONDARY = '#F28C30';
const DARK      = '#0f1117';
const SIDEBAR_BG = '#161b22';
const CARD_BG   = '#1c2130';
const BORDER    = 'rgba(255,255,255,0.08)';
const TEXT_MAIN  = '#e6edf3';
const TEXT_MUTED = 'rgba(255,255,255,0.45)';
const DANGER    = '#d9534f';
const SUCCESS   = '#28a745';
const WARNING   = '#f0ad4e';

/* ───────────────────────── shared styles ────────────────────────── */
const glassCard = {
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 24,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const btnPrimary = {
  padding: '10px 22px',
  background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
};

const btnDanger = {
  ...btnPrimary,
  background: DANGER,
};

const btnSecondary = {
  ...btnPrimary,
  background: 'rgba(255,255,255,0.08)',
  border: `1px solid ${BORDER}`,
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'rgba(255,255,255,0.06)',
  color: TEXT_MAIN,
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT_MUTED,
  fontWeight: 600,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle = {
  padding: '12px 14px',
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT_MAIN,
  verticalAlign: 'middle',
};

/* ───────────────────────── helpers ──────────────────────────────── */
function StatusBadge({ status }) {
  const s = (status || 'PENDING').toUpperCase();
  const map = {
    APPROVED: { bg: `${SUCCESS}22`, color: SUCCESS, label: 'Aprobado' },
    PENDING:  { bg: `${WARNING}22`, color: WARNING, label: 'Pendiente' },
    DECLINED: { bg: `${DANGER}22`,  color: DANGER,  label: 'Rechazado' },
    ERROR:    { bg: `${DANGER}22`,  color: DANGER,  label: 'Error' },
  };
  const info = map[s] || { bg: 'rgba(255,255,255,0.08)', color: TEXT_MUTED, label: s };
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: info.bg, color: info.color, fontSize: '0.8rem', fontWeight: 600 }}>
      {info.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: TEXT_MAIN, marginBottom: 20 }}>{children}</h2>;
}

/* ═══════════════════════════════════════════════════════════════════
   TAB DEFINITIONS
   ═══════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: '~' },
  { id: 'productos',  label: 'Productos',  icon: '#' },
  { id: 'pedidos',    label: 'Pedidos',     icon: '$' },
  { id: 'contactos',  label: 'Contactos',  icon: '@' },
  { id: 'banners',    label: 'Banners',     icon: '%' },
  { id: 'biblioteca', label: 'Biblioteca', icon: '&' },
  { id: 'logos',      label: 'Logos',       icon: '*' },
];

/* ═══════════════════════════════════════════════════════════════════
   LOGIN FORM
   ═══════════════════════════════════════════════════════════════════ */
function LoginForm({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${DARK} 0%, #161b26 100%)`, padding: 24 }}>
      <div style={{ ...glassCard, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: TEXT_MAIN, marginBottom: 8 }}>Admin KosXpress</h1>
        <p style={{ color: TEXT_MUTED, marginBottom: 28, fontSize: '0.9rem' }}>Inicia sesion para acceder al panel</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <input
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 20 }}
          />
          {error && <p style={{ color: DANGER, fontSize: '0.85rem', marginBottom: 14 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', padding: '12px 20px', fontSize: '1rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD TAB
   ═══════════════════════════════════════════════════════════════════ */
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/admin/dashboard')
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: TEXT_MUTED }}>Cargando dashboard...</p>;
  if (!stats) return <p style={{ color: TEXT_MUTED }}>No se pudo cargar el dashboard.</p>;

  const kpis = stats.kpis || {};

  const kpiCards = [
    { label: 'Total Pedidos',    value: Number(kpis.total_pedidos || 0).toLocaleString('es-CO'),   color: PRIMARY },
    { label: 'Aprobados',        value: Number(kpis.pedidos_aprobados || 0).toLocaleString('es-CO'), color: SUCCESS },
    { label: 'Ingresos Totales', value: `$${formatMoney(kpis.ingresos_totales || 0)}`,              color: SECONDARY },
    { label: 'Visitas',          value: Number(kpis.total_views || 0).toLocaleString('es-CO'),       color: '#8b5cf6' },
    { label: 'Contactos',        value: Number(kpis.total_contacts || 0).toLocaleString('es-CO'),    color: '#ec4899' },
  ];

  const recentOrders = stats.pedidosRecientes || [];

  return (
    <div>
      <SectionTitle>Dashboard</SectionTitle>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {kpiCards.map((k, i) => (
          <div key={i} style={{ ...glassCard, padding: '20px 18px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ color: TEXT_MUTED, fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: TEXT_MAIN }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div style={glassCard}>
        <h3 style={{ color: TEXT_MAIN, fontWeight: 700, fontSize: '1.05rem', marginBottom: 16 }}>Pedidos Recientes</h3>
        {recentOrders.length === 0 ? (
          <p style={{ color: TEXT_MUTED }}>No hay pedidos aun.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}><strong>#{p.id}</strong></td>
                    <td style={tdStyle}>{p.name || ''}</td>
                    <td style={tdStyle}>${formatMoney(p.total_value)}</td>
                    <td style={tdStyle}><StatusBadge status={p.payment_status} /></td>
                    <td style={tdStyle}>{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRODUCTS TAB
   ═══════════════════════════════════════════════════════════════════ */
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [formStatus, setFormStatus] = useState('');

  /* form fields */
  const [fName, setFName] = useState('');
  const [fPriceUnit, setFPriceUnit] = useState('');
  const [fCantidad, setFCantidad] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fCodigo, setFCodigo] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const resetForm = () => {
    setEditId('');
    setFName('');
    setFPriceUnit('');
    setFCantidad('');
    setFCategory('');
    setFDescription('');
    setFCodigo('');
    setFormStatus('');
    setShowForm(false);
  };

  const fillForm = (p) => {
    setEditId(p.id);
    setFName(p.name || '');
    setFPriceUnit(p.price_unit != null ? String(p.price_unit) : '');
    setFCantidad(p.cantidad != null ? String(p.cantidad) : '');
    setFCategory(p.category || '');
    setFDescription(p.description || '');
    setFCodigo(p.codigo_siesa || '');
    setShowForm(true);
    setFormStatus('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('Guardando...');
    const payload = {
      codigo_siesa: fCodigo,
      name: fName,
      price_unit: fPriceUnit,
      cantidad: fCantidad,
      category: fCategory,
      description: fDescription,
    };
    try {
      if (editId) {
        await apiPut(`/api/products/${encodeURIComponent(editId)}`, payload);
        setFormStatus('Actualizado correctamente.');
      } else {
        await apiPost('/api/products', payload);
        setFormStatus('Creado correctamente.');
      }
      await loadProducts();
      setTimeout(resetForm, 1200);
    } catch (err) {
      setFormStatus('Error: ' + (err.message || 'No se pudo guardar'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Eliminar producto #${id}?`)) return;
    try {
      await apiDelete(`/api/products/${encodeURIComponent(id)}`);
      await loadProducts();
    } catch {
      alert('Error eliminando producto');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <SectionTitle>Productos</SectionTitle>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>+ Nuevo Producto</button>
      </div>

      {/* Product form */}
      {showForm && (
        <div style={{ ...glassCard, marginBottom: 24 }}>
          <h3 style={{ color: TEXT_MAIN, fontWeight: 700, marginBottom: 16 }}>{editId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.82rem', marginBottom: 4, fontWeight: 600 }}>Codigo SIESA</label>
                <input style={inputStyle} value={fCodigo} onChange={(e) => setFCodigo(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.82rem', marginBottom: 4, fontWeight: 600 }}>Nombre *</label>
                <input style={inputStyle} value={fName} onChange={(e) => setFName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.82rem', marginBottom: 4, fontWeight: 600 }}>Precio Unitario</label>
                <input style={inputStyle} type="number" step="any" value={fPriceUnit} onChange={(e) => setFPriceUnit(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.82rem', marginBottom: 4, fontWeight: 600 }}>Cantidad</label>
                <input style={inputStyle} type="number" value={fCantidad} onChange={(e) => setFCantidad(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.82rem', marginBottom: 4, fontWeight: 600 }}>Categoria</label>
                <input style={inputStyle} value={fCategory} onChange={(e) => setFCategory(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.82rem', marginBottom: 4, fontWeight: 600 }}>Descripcion</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={fDescription}
                onChange={(e) => setFDescription(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" style={btnPrimary}>{editId ? 'Actualizar' : 'Crear'}</button>
              <button type="button" onClick={resetForm} style={btnSecondary}>Cancelar</button>
              {formStatus && (
                <span style={{ fontSize: '0.85rem', color: formStatus.startsWith('Error') ? DANGER : SUCCESS, fontWeight: 600 }}>{formStatus}</span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Products table */}
      {loading ? (
        <p style={{ color: TEXT_MUTED }}>Cargando productos...</p>
      ) : products.length === 0 ? (
        <p style={{ color: TEXT_MUTED }}>No hay productos.</p>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Imagen</th>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Precio Unit.</th>
                  <th style={thStyle}>Cant.</th>
                  <th style={thStyle}>Categoria</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const img = (Array.isArray(p.images) && p.images[0]) || p.image || '';
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}>
                        {img ? (
                          <img src={img} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', background: '#222' }} />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: 8, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: '0.7rem' }}>N/A</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 200 }}>{p.name}</td>
                      <td style={tdStyle}>{p.price_unit != null ? `$${formatMoney(p.price_unit)}` : '-'}</td>
                      <td style={tdStyle}>{p.cantidad ?? p.Cantidad ?? '-'}</td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 16, background: `${PRIMARY}18`, color: PRIMARY, fontSize: '0.8rem', fontWeight: 600 }}>
                          {p.category_name || p.category || 'Sin Cat.'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.82rem', color: TEXT_MUTED }}>{p.codigo_siesa || '-'}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => fillForm(p)} style={{ ...btnSecondary, padding: '6px 14px', fontSize: '0.8rem' }}>
                            Editar
                          </button>
                          <button onClick={() => handleDelete(p.id)} style={{ ...btnDanger, padding: '6px 14px', fontSize: '0.8rem' }}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PEDIDOS TAB
   ═══════════════════════════════════════════════════════════════════ */
function PedidosTab() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const loadPedidos = useCallback(async (pg) => {
    const p = pg || page;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 15 });
      if (filterStatus) params.set('status', filterStatus);
      if (filterSearch) params.set('search', filterSearch);

      const data = await apiGet(`/api/admin/pedidos?${params}`);
      setPedidos(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterSearch]);

  useEffect(() => { loadPedidos(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilter = () => { setPage(1); loadPedidos(1); };

  return (
    <div>
      <SectionTitle>Pedidos</SectionTitle>

      {/* Filters */}
      <div style={{ ...glassCard, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>Estado</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="">Todos</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PENDING">Pendiente</option>
            <option value="DECLINED">Rechazado</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: TEXT_MUTED, fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>Buscar</label>
          <input
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
            placeholder="Nombre, email..."
            style={{ ...inputStyle, width: 200 }}
          />
        </div>
        <button onClick={handleFilter} style={btnPrimary}>Filtrar</button>
        <button onClick={() => { setFilterStatus(''); setFilterSearch(''); setPage(1); setTimeout(() => loadPedidos(1), 0); }} style={btnSecondary}>Limpiar</button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: TEXT_MUTED }}>Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <div style={glassCard}><p style={{ color: TEXT_MUTED, textAlign: 'center' }}>No se encontraron pedidos</p></div>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}><strong>#{p.id}</strong></td>
                    <td style={tdStyle}>{p.name || ''}</td>
                    <td style={{ ...tdStyle, fontSize: '0.85rem', color: TEXT_MUTED }}>{p.email || ''}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>${formatMoney(p.total_value)}</td>
                    <td style={tdStyle}><StatusBadge status={p.payment_status} /></td>
                    <td style={{ ...tdStyle, fontSize: '0.85rem' }}>{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ ...btnSecondary, opacity: page <= 1 ? 0.4 : 1 }}>Anterior</button>
          <span style={{ color: TEXT_MUTED, display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>Pagina {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ ...btnSecondary, opacity: page >= totalPages ? 0.4 : 1 }}>Siguiente</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTACTS TAB
   ═══════════════════════════════════════════════════════════════════ */
function ContactsTab() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/contacts')
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionTitle>Contactos</SectionTitle>

      {loading ? (
        <p style={{ color: TEXT_MUTED }}>Cargando contactos...</p>
      ) : contacts.length === 0 ? (
        <div style={glassCard}><p style={{ color: TEXT_MUTED, textAlign: 'center' }}>No hay mensajes de contacto.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {contacts.map((c, i) => (
            <div key={c.id || i} style={glassCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div>
                  <strong style={{ color: TEXT_MAIN }}>{c.name || c.nombre || 'Sin nombre'}</strong>
                  <span style={{ color: TEXT_MUTED, fontSize: '0.85rem', marginLeft: 12 }}>{c.email || ''}</span>
                </div>
                <span style={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>{fmtDate(c.createdAt || c.created_at)}</span>
              </div>
              {(c.phone || c.telefono) && <p style={{ color: TEXT_MUTED, fontSize: '0.85rem', margin: '0 0 6px' }}>Tel: {c.phone || c.telefono}</p>}
              <p style={{ color: TEXT_MAIN, lineHeight: 1.6, margin: 0, fontSize: '0.92rem' }}>{c.message || c.mensaje || ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BANNERS TAB
   ═══════════════════════════════════════════════════════════════════ */
function BannersTab() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/banners');
      setBanners(Array.isArray(data) ? data : []);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBanners(); }, [loadBanners]);

  const handleDelete = async (id) => {
    if (!window.confirm(`Eliminar banner #${id}?`)) return;
    try {
      await apiDelete(`/api/banners/${encodeURIComponent(id)}`);
      await loadBanners();
    } catch {
      alert('Error eliminando banner');
    }
  };

  return (
    <div>
      <SectionTitle>Banners</SectionTitle>

      {loading ? (
        <p style={{ color: TEXT_MUTED }}>Cargando banners...</p>
      ) : banners.length === 0 ? (
        <div style={glassCard}><p style={{ color: TEXT_MUTED, textAlign: 'center' }}>No hay banners.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {banners.map((b) => (
            <div key={b.id} style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
              <img src={b.url} alt={b.nombre || 'Banner'} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ color: TEXT_MAIN, fontWeight: 600, fontSize: '0.88rem' }}>{b.nombre || `Banner #${b.id}`}</div>
                  <span style={{ fontSize: '0.75rem', color: b.activo ? SUCCESS : TEXT_MUTED }}>{b.activo ? 'Activo' : 'Inactivo'}</span>
                  {b.orden && <span style={{ fontSize: '0.75rem', color: TEXT_MUTED, marginLeft: 8 }}>Orden: {b.orden}</span>}
                </div>
                <button onClick={() => handleDelete(b.id)} style={{ ...btnDanger, padding: '5px 12px', fontSize: '0.78rem' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BIBLIOTECA TAB
   ═══════════════════════════════════════════════════════════════════ */
function BibliotecaTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/biblioteca');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const handleDelete = async (id) => {
    if (!window.confirm(`Eliminar imagen #${id}?`)) return;
    try {
      await apiDelete(`/api/biblioteca/${id}`);
      await loadLibrary();
    } catch {
      alert('Error eliminando imagen');
    }
  };

  const handleCopy = async (url, idx) => {
    try {
      await navigator.clipboard.writeText(url);
      // brief visual feedback
      const el = document.getElementById(`lib-copy-${idx}`);
      if (el) { el.textContent = 'Copiado!'; setTimeout(() => { el.textContent = 'Copiar URL'; }, 1200); }
    } catch { /* ignore */ }
  };

  return (
    <div>
      <SectionTitle>Biblioteca de Imagenes</SectionTitle>

      {loading ? (
        <p style={{ color: TEXT_MUTED }}>Cargando biblioteca...</p>
      ) : items.length === 0 ? (
        <div style={glassCard}><p style={{ color: TEXT_MUTED, textAlign: 'center' }}>No hay imagenes en la biblioteca.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
          {items.map((it, idx) => (
            <div key={it.id} style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
              <img src={it.url} alt={it.nombre || ''} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
              <div style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button id={`lib-copy-${idx}`} onClick={() => handleCopy(it.url, idx)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}>Copiar URL</button>
                <button onClick={() => handleDelete(it.id)} style={{ ...btnDanger, padding: '4px 10px', fontSize: '0.75rem' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOGOS TAB
   ═══════════════════════════════════════════════════════════════════ */
function LogosTab() {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/logos');
      setLogos(Array.isArray(data) ? data : []);
    } catch {
      setLogos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogos(); }, [loadLogos]);

  const handleDelete = async (id) => {
    if (!window.confirm(`Eliminar logo #${id}?`)) return;
    try {
      await apiDelete(`/api/logos/${encodeURIComponent(id)}`);
      await loadLogos();
    } catch {
      alert('Error eliminando logo');
    }
  };

  return (
    <div>
      <SectionTitle>Logos</SectionTitle>

      {loading ? (
        <p style={{ color: TEXT_MUTED }}>Cargando logos...</p>
      ) : logos.length === 0 ? (
        <div style={glassCard}><p style={{ color: TEXT_MUTED, textAlign: 'center' }}>No hay logos.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {logos.map((l) => (
            <div key={l.id} style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
              <div style={{ background: '#fff', padding: 8 }}>
                <img src={l.url} alt={l.nombre || 'Logo'} style={{ width: '100%', height: 80, objectFit: 'contain' }} />
              </div>
              <div style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: l.principal ? SUCCESS : TEXT_MUTED, fontWeight: 600, fontSize: '0.82rem' }}>
                  {l.principal ? 'Principal' : 'Secundario'}
                </span>
                <button onClick={() => handleDelete(l.id)} style={{ ...btnDanger, padding: '4px 10px', fontSize: '0.75rem' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADMIN PANEL (sidebar + content)
   ═══════════════════════════════════════════════════════════════════ */
function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':  return <DashboardTab />;
      case 'productos':  return <ProductsTab />;
      case 'pedidos':    return <PedidosTab />;
      case 'contactos':  return <ContactsTab />;
      case 'banners':    return <BannersTab />;
      case 'biblioteca': return <BibliotecaTab />;
      case 'logos':      return <LogosTab />;
      default:           return <DashboardTab />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: DARK }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240,
        minWidth: 240,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: sidebarOpen ? 0 : -260,
        bottom: 0,
        zIndex: 99,
        transition: 'left 0.25s ease',
        /* desktop: always visible */
        ...(typeof window !== 'undefined' && window.innerWidth >= 768 ? { position: 'sticky', left: 0 } : {}),
      }}>
        {/* brand */}
        <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div style={{ color: TEXT_MAIN, fontWeight: 700, fontSize: '1rem' }}>KosXpress</div>
              <div style={{ color: TEXT_MUTED, fontSize: '0.72rem' }}>Admin Panel</div>
            </div>
          </div>
        </div>

        {/* nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                margin: '2px 0',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: activeTab === t.id ? 700 : 500,
                background: activeTab === t.id ? `${PRIMARY}18` : 'transparent',
                color: activeTab === t.id ? PRIMARY : TEXT_MAIN,
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* logout */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${BORDER}` }}>
          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: `${DANGER}15`,
              color: DANGER,
              textAlign: 'left',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* top bar */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: `1px solid ${BORDER}`, background: SIDEBAR_BG }}>
          {/* hamburger for mobile */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ display: 'none', background: 'none', border: 'none', color: TEXT_MAIN, cursor: 'pointer', padding: 4, ...(typeof window !== 'undefined' && window.innerWidth < 768 ? { display: 'block' } : {}) }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>
            {TABS.find((t) => t.id === activeTab)?.label || 'Dashboard'}
          </h1>
        </header>

        {/* content */}
        <main style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', overflowY: 'auto' }}>
          {renderTab()}
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const admin = useAuthStore((s) => s.admin);
  const checkSession = useAuthStore((s) => s.checkSession);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    checkSession().finally(() => setChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DARK }}>
        <p style={{ color: TEXT_MUTED, fontSize: '1rem' }}>Verificando sesion...</p>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Admin - KosXpress</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {admin ? <AdminPanel /> : <LoginForm onSuccess={() => {}} />}
    </AnimatedPage>
  );
}
