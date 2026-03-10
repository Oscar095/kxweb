import { useState, useEffect, useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { apiGet } from '../../lib/api';
import { formatMoney } from '../../lib/format';

/* ───────────────────────── colour tokens ───────────────────────── */
const PRIMARY   = '#009FE3';
const SECONDARY = '#F28C30';
const DARK      = '#0a0e1a';
const DARK2     = '#111827';
const GLASS_BG  = 'rgba(255,255,255,0.06)';
const GLASS_BD  = 'rgba(255,255,255,0.12)';

/* ───────────────────────── parallax images ──────────────────────── */
const PARALLAX_IMGS = [
  { src: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/1.webp', speed: -1.5 },
  { src: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/2.webp', speed:  2.5 },
  { src: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/3.webp', speed:  1.2 },
  { src: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/4.webp', speed: -1.0 },
  { src: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/5.webp', speed: -1.5 },
  { src: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/6.webp', speed: -0.8 },
];

/* ────────── helper: format integer with commas ────────── */
function fmtInt(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ═══════════════════════════════════════════════════════════════════
   Floating Particles
   ═══════════════════════════════════════════════════════════════════ */
function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 3 + Math.random() * 6,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    dur: 6 + Math.random() * 8,
    delay: Math.random() * 4,
    opacity: 0.15 + Math.random() * 0.3,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.id % 2 === 0 ? PRIMARY : SECONDARY,
            left: p.left,
            top: p.top,
            opacity: p.opacity,
          }}
          animate={{ y: [0, -30, 0], x: [0, 15, 0], opacity: [p.opacity, p.opacity * 0.5, p.opacity] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Parallax Background
   ═══════════════════════════════════════════════════════════════════ */
function ParallaxBackground() {
  const { scrollY } = useScroll();

  const positions = [
    { left: '5%',  top: '8%',  w: 140 },
    { right: '4%', top: '22%', w: 120 },
    { left: '12%', top: '45%', w: 100 },
    { right: '10%',top: '55%', w: 130 },
    { left: '3%',  top: '72%', w: 110 },
    { right: '8%', top: '85%', w: 100 },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {PARALLAX_IMGS.map((img, i) => {
        const y = useTransform(scrollY, [0, 3000], [0, img.speed * -120]);
        const pos = positions[i] || {};
        return (
          <motion.img
            key={i}
            src={img.src}
            alt=""
            loading="lazy"
            style={{
              position: 'absolute',
              width: pos.w || 120,
              borderRadius: 16,
              opacity: 0.12,
              filter: 'blur(2px)',
              y,
              ...pos,
            }}
          />
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════════════════════════════ */
function HeroSection() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 180]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: `linear-gradient(135deg, ${DARK} 0%, #0f1729 60%, #1a1030 100%)` }}>
      {/* gradient blobs */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${PRIMARY}33 0%, transparent 70%)`, top: '-10%', left: '-8%', filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${SECONDARY}33 0%, transparent 70%)`, bottom: '-5%', right: '-5%', filter: 'blur(60px)' }} />

      <FloatingParticles />

      {/* background watermark */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
        <span style={{ fontSize: 'clamp(4rem, 14vw, 12rem)', fontWeight: 900, color: 'rgba(255,255,255,0.03)', letterSpacing: '0.05em', userSelect: 'none' }}>KOSXPRESS</span>
      </div>

      <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 2, width: '100%', maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 48 }}>
        {/* text */}
        <div style={{ flex: '1 1 440px' }}>
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.1, color: '#fff', margin: 0 }}
          >
            Productos{' '}
            <span style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Personalizados
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ marginTop: 24, fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, maxWidth: 520 }}
          >
            Destaca tu marca con empaques personalizados de alta calidad. Desde tu primer pedido, te ayudamos a crear una experiencia unica para tus clientes.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => document.getElementById('cotizador-section')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ marginTop: 36, padding: '16px 40px', fontSize: '1.1rem', fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: `0 8px 30px ${SECONDARY}44`, letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', gap: 10 }}
          >
            COTIZAR AHORA
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </motion.button>
        </div>

        {/* hero image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ flex: '1 1 340px', display: 'flex', justifyContent: 'center' }}
        >
          <motion.img
            src="https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/13.webp"
            alt="Composicion de Envases KosXpress"
            style={{ maxWidth: '100%', width: 420, borderRadius: 24, filter: 'drop-shadow(0 20px 60px rgba(0,159,227,0.25))' }}
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Value Proposition Section
   ═══════════════════════════════════════════════════════════════════ */
function ValueProps() {
  const cards = [
    {
      img: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/11.webp',
      title: <>Personaliza tus envases desde <span style={{ color: SECONDARY, fontWeight: 800 }}>2.000</span> Unidades</>,
      desc: 'El volumen ideal disenado para emprendedores y negocios en crecimiento continuo. Escala tu marca de manera inteligente, sin comprometer tu flujo de caja.',
    },
    {
      img: 'https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/7.webp',
      title: <>No tienes un diseno? En <span style={{ color: PRIMARY, fontWeight: 800 }}>KosXpress</span> te ayudamos a crearlo</>,
      desc: 'Nuestro equipo especializado de diseno grafico esta listo para plasmar tu vision en el empaque perfecto. Nos encargamos de que tu identidad brille.',
    },
  ];

  return (
    <section style={{ position: 'relative', padding: '100px 24px', background: DARK2, zIndex: 2 }}>
      {/* glow accents */}
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${SECONDARY}22 0%, transparent 70%)`, top: '10%', left: '-5%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${PRIMARY}22 0%, transparent 70%)`, bottom: '5%', right: '-3%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48 }}>
        {cards.map((c, i) => (
          <ScrollReveal key={i} delay={i * 0.15}>
            <div style={{ background: GLASS_BG, border: `1px solid ${GLASS_BD}`, borderRadius: 20, padding: 32, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 20 }}>
                {c.title}
              </h2>
              <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                <img src={c.img} alt="" loading="lazy" style={{ width: '100%', height: 220, objectFit: 'cover' }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, fontSize: '1rem' }}>{c.desc}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Quote Calculator
   ═══════════════════════════════════════════════════════════════════ */
function QuoteCalculator() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState(2000);

  useEffect(() => {
    apiGet('/api/products')
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  /* group products by category */
  const grouped = useMemo(() => {
    const g = {};
    products.forEach((p) => {
      const cat = p.category_name || 'Otros';
      if (!g[cat]) g[cat] = [];
      g[cat].push(p);
    });
    return Object.keys(g).sort().map((cat) => ({ cat, items: g[cat] }));
  }, [products]);

  /* auto-select first when products load */
  useEffect(() => {
    if (products.length && !selectedId) {
      setSelectedId(String(products[0].id));
    }
  }, [products, selectedId]);

  /* calculation */
  const selected = products.find((p) => String(p.id) === String(selectedId));
  const basePrice = selected ? parseFloat(selected.price_unit) || 0 : 0;

  const unidadesBase = 2000;
  const intervalos = Math.max(0, (quantity - unidadesBase) / 1000);
  let discountPct = intervalos * 0.02;
  if (discountPct > 0.30) discountPct = 0.30;

  const unitPrice = basePrice * (1 - discountPct);
  const total = unitPrice * quantity;
  const savings = (basePrice - unitPrice) * quantity;

  /* whatsapp */
  const whatsappMsg = selected
    ? `Hola KosXpress! Quiero cotizar un pedido personalizado:%0A%0AProducto: *${selected.name}*%0ACantidad: *${fmtInt(quantity)} unidades*%0AInversion Aprox: *$${fmtInt(Math.round(total))} COP*%0A%0AMe pueden asesorar con el diseno y tiempos de entrega?`
    : '';

  const sliderPct = ((quantity - 2000) / (50000 - 2000)) * 100;

  return (
    <section
      id="cotizador-section"
      style={{ position: 'relative', padding: '100px 24px', background: `linear-gradient(180deg, ${DARK2} 0%, ${DARK} 100%)`, zIndex: 2 }}
    >
      <ScrollReveal>
        <div style={{ maxWidth: 900, margin: '0 auto', background: GLASS_BG, border: `1px solid ${GLASS_BD}`, borderRadius: 24, padding: 'clamp(24px, 5vw, 48px)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            Calculadora de Inversion
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginBottom: 40, fontSize: '1.05rem' }}>
            Descubre cuanto puedes ahorrar al personalizar en volumen.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
            {/* ── Controls ── */}
            <div>
              {/* product select */}
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 8, fontSize: '0.95rem' }}>
                Selecciona el Producto
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${GLASS_BD}`, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '1rem', outline: 'none', marginBottom: 28, appearance: 'auto' }}
              >
                {grouped.length === 0 && <option value="">Cargando productos...</option>}
                {grouped.map((g) => (
                  <optgroup key={g.cat} label={g.cat} style={{ background: '#1a1f2e', color: '#fff' }}>
                    {g.items.map((p) => (
                      <option key={p.id} value={p.id} style={{ background: '#1a1f2e' }}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* quantity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <label style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.95rem' }}>
                  Cantidad de Unidades
                </label>
                <motion.span
                  key={quantity}
                  initial={{ scale: 1.15, color: SECONDARY }}
                  animate={{ scale: 1, color: '#fff' }}
                  transition={{ duration: 0.2 }}
                  style={{ fontWeight: 700, fontSize: '1.15rem' }}
                >
                  {fmtInt(quantity)}
                </motion.span>
              </div>

              <input
                type="range"
                min={2000}
                max={50000}
                step={1000}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  background: `linear-gradient(to right, ${PRIMARY} 0%, ${PRIMARY} ${sliderPct}%, #333 ${sliderPct}%, #333 100%)`,
                  accentColor: PRIMARY,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: 6 }}>
                <span>2k</span><span>10k</span><span>50k+</span>
              </div>
            </div>

            {/* ── Results ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* unit price card */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BD}`, borderRadius: 14, padding: '20px 24px' }}>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precio Unitario Estimado</span>
                <motion.div
                  key={unitPrice}
                  initial={{ scale: 1.08 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  style={{ fontSize: '1.6rem', fontWeight: 800, color: PRIMARY, marginTop: 6 }}
                >
                  ${formatMoney(unitPrice)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>COP</span>
                </motion.div>
                {savings > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 8, display: 'inline-block', background: `${SECONDARY}22`, color: SECONDARY, padding: '4px 12px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    Ahorras ${fmtInt(Math.round(savings))} COP en total
                  </motion.div>
                )}
              </div>

              {/* total card */}
              <div style={{ background: `linear-gradient(135deg, ${PRIMARY}18, ${SECONDARY}12)`, border: `1px solid ${PRIMARY}33`, borderRadius: 14, padding: '24px 24px' }}>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inversion Total Aproximada</span>
                <motion.div
                  key={total}
                  initial={{ scale: 1.08 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, color: '#fff', marginTop: 6 }}
                >
                  ${fmtInt(Math.round(total))} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>COP</span>
                </motion.div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', marginTop: 8 }}>*Precios referenciales sujetos a diseno final e IVA.</p>
              </div>

              {/* WhatsApp CTA */}
              <motion.a
                href={`https://wa.me/573225227073?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '16px 20px',
                  background: '#25d366',
                  color: '#fff',
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  textDecoration: 'none',
                  boxShadow: '0 6px 24px rgba(37,211,102,0.35)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <WhatsAppIcon />
                Cotizar este pedido por WhatsApp
              </motion.a>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CTA Final Section
   ═══════════════════════════════════════════════════════════════════ */
function CTASection() {
  return (
    <section style={{ position: 'relative', padding: '120px 24px', background: `linear-gradient(135deg, ${DARK} 0%, #0f1729 100%)`, overflow: 'hidden', zIndex: 2 }}>
      {/* blobs */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${SECONDARY}20 0%, transparent 70%)`, top: '-15%', left: '10%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${PRIMARY}20 0%, transparent 70%)`, bottom: '-10%', right: '5%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <FloatingParticles />

      <ScrollReveal>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 900, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 40 }}>
          {/* text */}
          <div style={{ flex: '1 1 400px', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 5vw, 3rem)', fontWeight: 800, color: '#fff', lineHeight: 1.15, margin: 0 }}>
              <span style={{ display: 'block', fontSize: '0.7em', color: 'rgba(255,255,255,0.6)' }}>Listo para llevar tu</span>
              <span style={{ display: 'block' }}>MARCA AL SIGUIENTE</span>
              <span style={{ display: 'block', background: `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>NIVEL?</span>
            </h2>
          </div>

          {/* cup image */}
          <div style={{ flex: '1 1 260px', display: 'flex', justifyContent: 'center' }}>
            <motion.img
              src="https://datalakekos.blob.core.windows.net/images/site-assets/fotos_kx/14.webp"
              alt="Vaso personalizado KosXpress"
              loading="lazy"
              animate={{ y: [0, -14, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ maxWidth: '100%', width: 280, borderRadius: 20, filter: 'drop-shadow(0 20px 50px rgba(0,159,227,0.3))' }}
            />
          </div>
        </div>

        {/* CTA button */}
        <div style={{ textAlign: 'center', marginTop: 48, position: 'relative', zIndex: 2 }}>
          <motion.a
            href="https://wa.me/573225227073"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.06, boxShadow: `0 12px 40px ${SECONDARY}55` }}
            whileTap={{ scale: 0.96 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '18px 48px',
              background: `linear-gradient(135deg, ${SECONDARY}, ${PRIMARY})`,
              color: '#fff',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: '1.15rem',
              textDecoration: 'none',
              boxShadow: `0 8px 30px ${SECONDARY}44`,
              letterSpacing: '0.02em',
            }}
          >
            Comunicate con Nosotros!
          </motion.a>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WhatsApp floating button
   ═══════════════════════════════════════════════════════════════════ */
function WhatsAppFloat() {
  return (
    <motion.a
      href="https://wa.me/573225227073?text=Hola,%20quisiera%20hablar%20con%20un%20asesor%20sobre%20empaques%20personalizados"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat en WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={{ scale: 1.12 }}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: '#25d366',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(37,211,102,0.45)',
        zIndex: 9999,
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      <WhatsAppIcon size={32} />
    </motion.a>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WhatsApp SVG Icon
   ═══════════════════════════════════════════════════════════════════ */
function WhatsAppIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════════════ */
export default function PersonalizadosPage() {
  return (
    <AnimatedPage>
      <Helmet>
        <title>Productos Personalizados - KosXpress</title>
        <meta name="description" content="Empaques personalizados con tu marca. Vasos, portacomidas y mas con impresion personalizada en KosXpress Colombia." />
        <meta property="og:title" content="Empaques Personalizados - KosXpress" />
        <meta property="og:description" content="Empaques personalizados con tu marca. Vasos, portacomidas y mas con impresion personalizada." />
        <link rel="canonical" href="https://kosxpress.com/personalizados" />
      </Helmet>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <HeroSection />

        <div style={{ position: 'relative' }}>
          <ParallaxBackground />
          <ValueProps />
          <QuoteCalculator />
          <CTASection />
        </div>

        <WhatsAppFloat />
      </div>
    </AnimatedPage>
  );
}
