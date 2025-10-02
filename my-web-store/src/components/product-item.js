import { formatMoney } from '../utils/format.js';
export function productItemTemplate(p) {
  // Normaliza precio desde price o precio
  const priceNum = (() => {
    const raw = p.price ?? p.precio ?? 0;
    const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    return Number.isFinite(num) ? num : 0;
  })();
  // Use placeholder.svg by default and fallback on image load error
  const imgSrc = (Array.isArray(p.images) && p.images[0]) || p.image || 'images/placeholder.svg';
  const qtyInputId = `qty-${p.id}`;
  return /* html */`
    <article class="product" data-id="${p.id}">
      <div class="product-media">
        <div class="product-img-wrap" data-index="0" style="position:relative;">
          <div class="img-lens"></div>
          <img class="product-img" src="${imgSrc}" alt="${p.name}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
          ${Array.isArray(p.images) && p.images.length > 1 ? `
            <button class="img-prev" aria-label="Imagen anterior">‹</button>
            <button class="img-next" aria-label="Imagen siguiente">›</button>
          ` : ''}
        </div>
      </div>
      <div>
        <a href="/product.html?id=${p.id}" class="product-link" style="color:inherit;text-decoration:none"><h3>${p.name}</h3></a>
        <p class="price">$${formatMoney(priceNum)}</p>
        <p class="desc">${p.description || ''}</p>
      </div>
      <div class="product-actions" style="display:flex;gap:8px;align-items:center;">
        <label for="${qtyInputId}" class="qty-label" style="font-size:0.9rem;">Cantidad</label>
        <input id="${qtyInputId}" type="number" class="qty-input" min="1" value="1" aria-label="Cantidad" style="width:64px;padding:4px;">
        <button class="add-to-cart" data-id="${p.id}">Agregar</button>
      </div>
    </article>
  `;
}