import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { apiPost } from '../../lib/api';

const initialForm = { name: '', email: '', phone: '', message: '' };

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      await apiPost('/api/contacts', form);
      setSuccess(true);
      setForm(initialForm);
    } catch (err) {
      setError(err.message || 'Error al enviar el mensaje. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: 'inherit',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.4rem',
    fontWeight: 600,
    fontSize: '0.9rem',
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>Contacto | KosXpress</title>
      </Helmet>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Contactanos</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
          Tienes preguntas sobre nuestros productos o necesitas una cotizacion?
          Dejanos tu mensaje y te responderemos lo antes posible.
        </p>

        {success && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderRadius: 10,
              background: 'rgba(76,175,80,0.15)',
              border: '1px solid rgba(76,175,80,0.3)',
              color: '#4CAF50',
              marginBottom: '1.5rem',
              fontWeight: 600,
            }}
          >
            Mensaje enviado con exito. Nos pondremos en contacto contigo pronto.
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              marginBottom: '1.5rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle} htmlFor="contact-name">Nombre</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Tu nombre completo"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle} htmlFor="contact-email">Correo electronico</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="correo@ejemplo.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle} htmlFor="contact-phone">Telefono</label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+57 300 000 0000"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle} htmlFor="contact-message">Mensaje</label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={5}
              value={form.message}
              onChange={handleChange}
              placeholder="Escribe tu mensaje aqui..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={sending}
            style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }}
          >
            {sending ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </form>

        <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Informacion de contacto</h3>
          <p style={{ marginBottom: '0.4rem' }}>Telefono: +57 315 335 5599</p>
          <p style={{ marginBottom: '0.4rem' }}>Email: ventas@kosxpress.com</p>
          <p>Bogota, Colombia</p>
        </div>
      </div>
    </AnimatedPage>
  );
}
