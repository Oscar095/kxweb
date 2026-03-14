import { productItemTemplate, attachDynamicPriceBehavior } from './product-item.js';

// How many products to render in the first paint (above the fold)
const INITIAL_BATCH = 12;
// How many more to add each time the sentinel enters the viewport
const SCROLL_BATCH = 12;

/**
 * Generates skeleton placeholder HTML.
 */
function skeletonHTML(count = 6) {
  const card = `
    <div class="skel-card">
      <div class="skel-img"></div>
      <div class="skel-body">
        <div class="skel-line w40 h10"></div>
        <div class="skel-line w80"></div>
        <div class="skel-line w60"></div>
        <div class="skel-line h32"></div>
      </div>
    </div>`;
  return card.repeat(count);
}

/**
 * Show skeleton placeholders in mount while data loads.
 */
export function showSkeletons(mount, count = 6) {
  if (!mount) return;
  mount.innerHTML = skeletonHTML(count);
}

/**
 * Render products progressively:
 *  1. First INITIAL_BATCH rendered immediately
 *  2. Remaining batches rendered as user scrolls (IntersectionObserver)
 *  3. attachDynamicPriceBehavior called per card after insert
 */
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
  if (mount._v2Observer) {
    mount._v2Observer.disconnect();
    mount._v2Observer = null;
  }

  // Split into initial batch and rest
  const initial = toRender.slice(0, INITIAL_BATCH);
  const remaining = toRender.slice(INITIAL_BATCH);

  // Render initial batch synchronously
  mount.innerHTML = initial.map(productItemTemplate).join('');
  const initialCards = Array.from(mount.querySelectorAll('.v2-card'));
  initialCards.forEach(card => attachDynamicPriceBehavior(card));

  // If there are more products, set up progressive loading
  if (remaining.length > 0) {
    let cursor = 0;

    // Create a sentinel element at the bottom
    const sentinel = document.createElement('div');
    sentinel.className = 'v2-sentinel';
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

      // Insert before sentinel
      mount.insertBefore(fragment, sentinel);
      cards.forEach(card => attachDynamicPriceBehavior(card));

      // If no more remaining, clean up
      if (cursor >= remaining.length) {
        sentinel.remove();
        observer.disconnect();
      }
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadNextBatch();
      }
    }, { rootMargin: '400px' }); // Start loading 400px before visible

    observer.observe(sentinel);
    mount._v2Observer = observer;
  }
}
