export function productItemTemplate(p) {
  // Use placeholder.svg by default and fallback on image load error
  const imgSrc = p.image || 'images/placeholder.svg';
  return /* html */`
    <article class="product" data-id="${p.id}">
      <img src="${imgSrc}" alt="${p.name}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
      <div>
        <h3>${p.name}</h3>
        <p class="price">$${Number(p.price).toFixed(2)}</p>
        <p class="desc">${p.description || ''}</p>
      </div>
      <div>
        <button class="add-to-cart" data-id="${p.id}">Agregar</button>
      </div>
    </article>
  `;
}