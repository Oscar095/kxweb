import { useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ScrollReveal from '../../components/ui/ScrollReveal';
import { apiPost } from '../../lib/api';
import styles from './ContactPage.module.css';

const initialForm = { name: '', email: '', phone: '', message: '' };

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      files.forEach((file) => formData.append('files', file));

      await apiPost('/api/contacts', form);
      setSuccess(true);
      setForm(initialForm);
      setFiles([]);
    } catch (err) {
      setError(err.message || 'Error al enviar el mensaje. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>Contacto | KOS Colombia</title>
      </Helmet>

      <div className={styles.page}>
        <div className="container">
          <div className={styles.layout}>
            {/* Left — Info */}
            <ScrollReveal>
              <div className={styles.info}>
                <h1 className={styles.title}>Contactanos</h1>
                <p className={styles.subtitle}>
                  Tienes preguntas sobre nuestros productos o necesitas una cotizacion?
                  Dejanos tu mensaje y te responderemos lo antes posible.
                </p>

                <div className={styles.infoCards}>
                  <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </div>
                    <div>
                      <h4>Telefono</h4>
                      <a href="tel:+573153355599">+57 315 335 5599</a>
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <div>
                      <h4>Email</h4>
                      <a href="mailto:ventas@kosxpress.com">ventas@kosxpress.com</a>
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div>
                      <h4>Ubicacion</h4>
                      <span>Cl. 10 #21A 120, Yumbo, Valle del Cauca</span>
                    </div>
                  </div>

                  <a
                    href="https://wa.me/573225227073"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.waCard}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.472-.149-.672.15-.198.297-.768.966-.94 1.164-.173.198-.346.223-.643.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.672-1.614-.92-2.205-.242-.58-.487-.5-.672-.51l-.572-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.48 1.065 2.876 1.214 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    </svg>
                    Escribenos por WhatsApp
                  </a>
                </div>
              </div>
            </ScrollReveal>

            {/* Right — Form */}
            <ScrollReveal delay={0.15}>
              <div className={styles.formCard}>
                {success && (
                  <div className={styles.successMsg}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Mensaje enviado con exito. Te responderemos pronto.
                  </div>
                )}

                {error && (
                  <div className={styles.errorMsg}>{error}</div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="contact-name">Nombre</label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Tu nombre completo"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="contact-phone">Telefono</label>
                      <input
                        id="contact-phone"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+57 300 000 0000"
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="contact-email">Correo electronico</label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="contact-message">Mensaje</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Describe tu consulta, producto de interes o pedido..."
                    />
                  </div>

                  {/* File upload */}
                  <div className={styles.formGroup}>
                    <label>Archivos adjuntos</label>
                    <div
                      className={styles.uploadZone}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Haz clic para subir archivos</span>
                      <span className={styles.uploadHint}>Logos, disenos, imagenes de referencia (max 10MB)</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.ai,.psd,.svg"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </div>
                    {files.length > 0 && (
                      <div className={styles.fileList}>
                        {files.map((file, i) => (
                          <div key={i} className={styles.fileItem}>
                            <span className={styles.fileName}>{file.name}</span>
                            <button
                              type="button"
                              className={styles.fileRemove}
                              onClick={() => removeFile(i)}
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <motion.button
                    type="submit"
                    className={`btn-primary ${styles.submitBtn}`}
                    disabled={sending}
                    whileTap={{ scale: 0.98 }}
                  >
                    {sending ? 'Enviando...' : 'Enviar mensaje'}
                  </motion.button>
                </form>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
