import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const wordVariants = {
  hidden: { y: 60, opacity: 0, rotateX: -15 },
  visible: {
    y: 0,
    opacity: 1,
    rotateX: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function SplitTextReveal({
  text,
  className = '',
  as: Tag = 'h1',
  delay = 0,
}) {
  const words = text.split(' ');

  return (
    <Tag className={className} style={{ perspective: '600px' }}>
      <motion.span
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        transition={{ delayChildren: delay }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em' }}
      >
        {words.map((word, i) => (
          <motion.span
            key={i}
            variants={wordVariants}
            style={{ display: 'inline-block', transformOrigin: 'bottom' }}
          >
            {word}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  );
}
