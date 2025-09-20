const $ = (sel) => document.querySelector(sel);

function renderNewPreviews(files) {
  const wrap = $('#new-previews');
  wrap.innerHTML = '';
  if (!files || files.length === 0) return;
  [...files].forEach(f => {
    const url = URL.createObjectURL(f);
    const img = document.createElement('img');
    img.src = url;
    img.alt = f.name;
    wrap.appendChild(img);
  });
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products', { cache: 'no-store' });
    const products = await res.json();

    const grid = $('#products-grid');
    grid.innerHTML = '';

    for (const p of products) {
      const card = document.createElement('div');
      card.className = 'admin-product-card';

      const img = document.createElement('img');
      img.alt = p.name || '';
      img.loading = 'lazy';
      img.style.width = '160px';
      img.style.height = '160px';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      img.style.background = '#fff';
      img.style.border = '1px solid #eee';
      const first = (p.images && p.images[0]) || p.image || '/images/placeholder.svg';
      img.src = first;
      img.onerror = () => { img.src = '/images/placeholder.svg'; };

      const details = document.createElement('div');
      details.className = 'admin-product-details';
      details.innerHTML = `
        <div class="product-name">${p.name}</div>
        <div class="product-category">${p.category || ''}</div>
        <div class="product-description">${p.description || ''}</div>
        <div class="product-price">$${Number(p.price || 0).toLocaleString()}</div>
        <div class="product-actions" style="display:flex; gap:8px;">
          <button data-id="${p.id}" class="fill-form">Editar</button>
          <button data-id="${p.id}" class="delete-prod" style="background:#d9534f;color:#fff;">Eliminar</button>
        </div>
      `;

      card.appendChild(img);
      card.appendChild(details);
      grid.appendChild(card);
    }

    // Editar: llena el form y muestra imágenes actuales
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
        form.images.value = ''; // limpia selección

        const cur = $('#current-images');
        cur.innerHTML = '';
        (prod.images || (prod.image ? [prod.image] : [])).forEach(url => {
          const im = document.createElement('img');
          im.src = url;
          im.alt = prod.name || '';
          cur.appendChild(im);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Eliminar
    grid.querySelectorAll('.delete-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm(`Eliminar producto #${id}?`)) return;
        try {
          const r = await fetch(`/api/products/${id}`, { method: 'DELETE' });
          if (!r.ok) return alert('Error eliminando producto');
          await loadProducts();
        } catch (err) {
          console.error(err);
          alert('Error eliminando producto');
        }
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
    if (!fd.get('id')) fd.delete('id');

    const res = await fetch('/api/products', { method: 'POST', body: fd });

    if (!res.ok) {
      const msg = await res.text();
      status.textContent = 'Error: ' + msg;
      return;
    }

    status.textContent = 'Guardado correctamente.';
    formEl.reset();
    $('#new-previews').innerHTML = '';
    $('#current-images').innerHTML = '';
    await loadProducts();
  } catch (e) {
    console.error(e);
    status.textContent = 'Error guardando producto.';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#product-form').addEventListener('submit', submitForm);
  $('#p-images').addEventListener('change', (e) => renderNewPreviews(e.target.files));
  await loadProducts();
});