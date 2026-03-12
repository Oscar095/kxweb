import styles from './MarqueeStrip.module.css';

export default function MarqueeStrip({ items = [], separator = '✦', speed = 30 }) {
  const content = items.map((item, i) => (
    <span key={i} className={styles.item}>
      <span className={styles.text}>{item}</span>
      <span className={styles.sep}>{separator}</span>
    </span>
  ));

  return (
    <div className={styles.marquee}>
      <div
        className={styles.track}
        style={{ '--marquee-speed': `${speed}s` }}
      >
        <div className={styles.content}>{content}{content}{content}{content}</div>
      </div>
    </div>
  );
}
