import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

const transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export default function AnimatedPage({ children, className }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
