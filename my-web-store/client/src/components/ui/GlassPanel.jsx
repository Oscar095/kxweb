import { motion } from 'framer-motion';

export default function GlassPanel({ children, className = '', hover = false, ...props }) {
  const Component = hover ? motion.div : 'div';
  const hoverProps = hover
    ? {
        whileHover: { y: -5, boxShadow: '0 12px 40px rgba(0, 159, 227, 0.15)' },
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }
    : {};

  return (
    <Component
      className={`glass-panel ${className}`}
      {...hoverProps}
      {...props}
    >
      {children}
    </Component>
  );
}
