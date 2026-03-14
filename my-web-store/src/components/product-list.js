import { productItemTemplate, attachDynamicPriceBehavior } from './product-item.js';

const INITIAL_BATCH = 12;
const SCROLL_BATCH = 12;

export function renderProducts(products, mount) {
  if (!mount) return;

  // Deduplicate by code
  const seen = new Set();
  const dedup = [];
  for (const p of products) {
    const code = (p.codigo || '').toString();
    if (code && seen.has(code)) continue;
    if (code) seen.add(code);
    dedup.push(p);
  }
  const toRender = dedup.length ? dedup : products;
  if (toRender.length === 0) return;

  // Clean up previous observer
  if (mount._scrollObserver) {
    mount._scrollObserver.disconnect();
    mount._scrollObserver = null;
  }

  // Render first batch immediately — no loader, no spinner
  const initial = toRender.slice(0, INITIAL_BATCH);
  const remaining = toRender.slice(INITIAL_BATCH);

  mount.innerHTML = initial.map(productItemTemplate).join('');
  const initialCards = Array.from(mount.querySelectorAll('.product'));
  initialCards.forEach(card => attachDynamicPriceBehavior(card));

  // Progressive loading for remaining products
  if (remaining.length > 0) {
    let cursor = 0;

    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    sentinel.style.gridColumn = '1 / -1';
    mount.appendChild(sentinel);

    const loadNextBatch = () => {
      if (cursor >= remaining.length) {
        sentinel.remove();
        observer.disconnect();
        return;
      }
      const batch = remaining.slice(cursor, cursor + SCROLL_BATCH);
      cursor += SCROLL_BATCH;

      const fragment = document.createDocumentFragment();
      const temp = document.createElement('div');
      temp.innerHTML = batch.map(productItemTemplate).join('');
      const cards = Array.from(temp.children);
      cards.forEach(card => fragment.appendChild(card));
      mount.insertBefore(fragment, sentinel);
      cards.forEach(card => attachDynamicPriceBehavior(card));

      if (cursor >= remaining.length) {
        sentinel.remove();
        observer.disconnect();
      }
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadNextBatch();
    }, { rootMargin: '400px' });

    observer.observe(sentinel);
    mount._scrollObserver = observer;
  }
}
