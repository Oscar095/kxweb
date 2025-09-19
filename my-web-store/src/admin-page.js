const $ = (sel) => document.querySelector(sel);

async function loadProducts() {
  try {
    const res = await fetch('/api/products', { cache: 'no-store' });
    const products = await res.json();

    const grid = $('#products-grid');
    grid.innerHTML = '';

    for (const p of products) {
      const card = document.createElement('div');
      // usa clase distinta para evitar conflictos de CSS
      card.className = 'admin-product-card';

      // Imagen con URL derivada del id y cache-busting
      const img = document.createElement('img');
      img.alt = p.name || '';
      img.loading = 'lazy';
      img.style.width = '160px';
      img.style.height = '160px';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      img.style.background = '#fff';
      img.style.border = '1px solid #eee';
      img.src = `/api/products/${p.id}/image?v=${Date.now()}`;
      img.onerror = () => { img.src = '/images/placeholder.svg'; };

      const details = document.createElement('div');
      details.className = 'admin-product-details';
      details.innerHTML = `
        <div class="product-name">${p.name}</div>
        <div class="product-category">${p.category || ''}</div>
        <div class="product-description">${p.description || ''}</div>
        <div class="product-price">$${Number(p.price || 0).toLocaleString()}</div>
        <div class="product-actions">
          <button data-id="${p.id}" class="fill-form">Editar</button>
        </div>
      `;

      card.appendChild(img);
      card.appendChild(details);
      grid.appendChild(card);
    }

    // Rellenar form al dar "Editar"
    grid.querySelectorAll('.fill-form').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const prod = products.find(x => String(x.id) === String(id));
        if (!prod) return;

        const form = $('#product-form');
        form.id.value = prod.id;
        form.name.value = prod.name || '';
        form.price.value = prod.price || 0;
        form.category.value = prod.category || '';
        form.description.value = prod.description || '';
        form.image.value = ''; // imagen se define si seleccionas un archivo nuevo
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  } catch (e) {
    console.error(e);
    $('#products-grid').innerHTML = '<p>Error cargando productos.</p>';
  }
}

async function submitForm(ev) {
  ev.preventDefault();
  const formEl = ev.currentTarget;

  const status = $('#form-status');
  status.textContent = 'Guardando...';

  try {
    const fd = new FormData(formEl);
    // Normaliza valores vacíos
    if (!fd.get('id')) fd.delete('id');

    const res = await fetch('/api/products', {
      method: 'POST',
      body: fd
    });

    if (!res.ok) {
      const msg = await res.text();
      status.textContent = 'Error: ' + msg;
      return;
    }

    status.textContent = 'Guardado correctamente.';
    formEl.reset();
    await loadProducts();
  } catch (e) {
    console.error(e);
    status.textContent = 'Error guardando producto.';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#product-form').addEventListener('submit', submitForm);
  await loadProducts();
});