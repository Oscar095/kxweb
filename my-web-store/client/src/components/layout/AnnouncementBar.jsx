import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './AnnouncementBar.module.css';

const MESSAGES = [
  { icon: '🚚', text: 'Envio gratis en pedidos mayores a $500.000' },
  { icon: '📦', text: 'Precios por caja con IVA incluido' },
  { icon: '🎨', text: 'Personaliza tus vasos con tu marca' },
  { icon: '⚡', text: 'Entrega en 24 a 72 horas a toda Colombia' },
];

export default function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const msg = MESSAGES[index];

  return (
    <div className={styles.bar}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className={styles.message}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.icon}>{msg.icon}</span>
          {msg.text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
