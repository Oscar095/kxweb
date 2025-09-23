export function productItemTemplate(p) {
  // Normaliza precio desde price o precio
  const priceNum = (() => {
    const raw = p.price ?? p.precio ?? 0;
    const num = typeof raw === 'string' ? Number(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    return Number.isFinite(num) ? num : 0;
  })();
  // Use placeholder.svg by default and fallback on image load error
  const imgSrc = p.image || 'images/placeholder.svg';
  const qtyInputId = `qty-${p.id}`;
  return /* html */`
    <article class="product" data-id="${p.id}">
      <img src="${imgSrc}" alt="${p.name}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
      <div>
        <h3>${p.name}</h3>
        <p class="price">$${priceNum.toFixed(2)}</p>
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