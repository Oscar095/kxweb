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
      const safe = (v) => (v == null ? '' : v);
      details.innerHTML = `
        <div class="product-name">${safe(p.name)}</div>
        <div class="product-sku" style="color:#555">Código: ${safe(p.codigo)}</div>
        <div class="product-category">Categoría: ${safe(p.category)}</div>
        <div style="color:#444">Línea: ${safe(p.linea)}</div>
        <div style="color:#444">Cantidad: ${p.cantidad != null ? p.cantidad : ''}</div>
        <div style="color:#444">Precio Unitario: ${p.precio_unitario != null ? ('$' + Number(p.precio_unitario).toLocaleString()) : ''}</div>
        <div class="product-description">${safe(p.description)}</div>
        <div class="product-price">Precio Total: $${Number(p.price || 0).toLocaleString()}</div>
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
  form.codigo.value = prod.codigo || '';
        form.id.value = prod.id;
        form.name.value = prod.name || '';
  form.price.value = prod.price || 0;
  if (form.cantidad) form.cantidad.value = prod.cantidad != null ? prod.cantidad : '';
  if (form.precio_unitario) form.precio_unitario.value = prod.precio_unitario != null ? prod.precio_unitario : '';
  if (form.linea) form.linea.value = prod.linea || '';
        // Ensure category select has the current value
        const sel = form.category;
        const val = prod.category || '';
        if (![...sel.options].some(o => o.value === val) && val) {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          sel.appendChild(opt);
        }
        sel.value = val;
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

    // Adjuntar también imágenes seleccionadas desde Biblioteca (si existen)
    if (window.__libSelected && window.__libSelected.length) {
      const input = document.getElementById('p-images');
      const already = input && input.files ? input.files.length : 0;
      const MAX = 6; // debe coincidir con el backend
      const remaining = Math.max(0, MAX - already);
      const toAdd = window.__libSelected.slice(0, remaining);
      for (const it of toAdd) {
        try {
          const resp = await fetch(it.url, { cache: 'no-store' });
          const blob = await resp.blob();
          const file = new File([blob], it.filename || (`lib-${it.id}.jpg`), { type: blob.type || 'image/jpeg' });
          fd.append('images', file);
        } catch (e) { console.warn('No se pudo adjuntar imagen de biblioteca', it, e); }
      }
      if (window.__libSelected.length > toAdd.length) {
        alert(`Solo se pueden enviar ${MAX} imágenes por producto. Se adjuntaron ${toAdd.length} de la biblioteca.`);
      }
    }

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

async function ensureAuth() {
  try {
    const r = await fetch('/api/admin/me', { cache: 'no-store' });
    return r.ok;
  } catch { return false; }
}

async function showLogin() {
  document.getElementById('login-section').style.display = '';
  document.getElementById('admin-section').style.display = 'none';
}
async function showAdmin() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('admin-section').style.display = '';
}

async function initAdmin() {
  // Populate categories select
  try {
    const sel = $('#p-category');
    if (sel) {
      sel.innerHTML = '<option value="">Cargando categorías...</option>';
      const r = await fetch('/api/categories', { cache: 'no-store' });
      const cats = r.ok ? await r.json() : [];
      sel.innerHTML = '<option value="">(sin categoría)</option>' +
        cats.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    }
  } catch (e) { console.error('No se pudieron cargar categorías', e); }

  $('#product-form').addEventListener('submit', submitForm);
  $('#p-images').addEventListener('change', (e) => renderNewPreviews(e.target.files));

  // Auto cálculo de precio total
  const cantidadInput = document.getElementById('p-cantidad');
  const puInput = document.getElementById('p-precio-u');
  const totalInput = document.getElementById('p-price');
  function recalc() {
    if (!cantidadInput || !puInput || !totalInput) return;
    const c = Number(cantidadInput.value);
    const u = Number(puInput.value);
    if (Number.isFinite(c) && Number.isFinite(u)) {
      totalInput.value = (c * u).toFixed(0);
    }
  }
  cantidadInput?.addEventListener('input', recalc);
  puInput?.addEventListener('input', recalc);
  await loadProducts();

  // Biblioteca init
  document.getElementById('library-section').style.display = '';
  await loadLibrary();
  const libForm = document.getElementById('library-form');
  libForm?.addEventListener('submit', submitLibraryForm);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Auth gate
  const authed = await ensureAuth();
  if (!authed) {
    await showLogin();
  } else {
    await showAdmin();
    await initAdmin();
  }

  // Login form
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const payload = { username: fd.get('username'), password: fd.get('password') };
    const msg = document.getElementById('login-msg');
    msg.textContent = '';
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const t = await r.text();
        msg.textContent = 'Error: ' + t;
        return;
      }
      await showAdmin();
      await initAdmin();
    } catch (err) {
      console.error(err);
      msg.textContent = 'No se pudo iniciar sesión';
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    await showLogin();
  });
});

// ---- Biblioteca ----
async function loadLibrary() {
  try {
    const r = await fetch('/api/biblioteca', { cache: 'no-store' });
    const items = r.ok ? await r.json() : [];
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    for (const it of items) {
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      wrap.style.borderRadius = '6px';
      wrap.style.overflow = 'hidden';

      const img = document.createElement('img');
      img.src = it.url;
      img.alt = it.nombre || '';
      img.title = `${it.nombre} (#${it.id})`;
      img.style.width = '100%';
      img.style.height = '88px';
      img.style.objectFit = 'cover';

      const bar = document.createElement('div');
      bar.style.display = 'flex';
      bar.style.gap = '6px';
      bar.style.padding = '4px';

      const addBtn = document.createElement('button');
      addBtn.textContent = 'Usar';
      addBtn.type = 'button';
      addBtn.addEventListener('click', () => addLibrarySelection(it));

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copiar URL';
      copyBtn.type = 'button';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(it.url);
          copyBtn.textContent = 'Copiado!';
          setTimeout(() => (copyBtn.textContent = 'Copiar URL'), 1200);
        } catch {}
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Eliminar';
      delBtn.type = 'button';
      delBtn.style.background = '#d9534f';
      delBtn.style.color = '#fff';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Eliminar imagen de biblioteca #${it.id}?`)) return;
        try {
          const rr = await fetch(`/api/biblioteca/${it.id}`, { method: 'DELETE' });
          if (!rr.ok) return alert('No se pudo eliminar');
          await loadLibrary();
        } catch (e) {
          console.error(e);
          alert('Error eliminando');
        }
      });

      bar.appendChild(copyBtn);
      bar.appendChild(delBtn);
      wrap.appendChild(img);
      wrap.appendChild(bar);
      grid.appendChild(wrap);
    }
  } catch (e) {
    console.error('Error cargando biblioteca', e);
    const grid = document.getElementById('library-grid');
    if (grid) grid.innerHTML = '<p>Error cargando biblioteca.</p>';
  }
}


function addLibrarySelection(item) {
  window.__libSelected = window.__libSelected || [];
  if (!window.__libSelected.find(x => x.id === item.id)) {
    window.__libSelected.push(item);
    renderLibrarySelection();
  }
}

function removeLibrarySelection(id) {
  window.__libSelected = (window.__libSelected || []).filter(x => x.id !== id);
  renderLibrarySelection();
}

function renderLibrarySelection() {
  const wrap = document.getElementById('lib-selected');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const it of (window.__libSelected || [])) {
    const cell = document.createElement('div');
    const img = document.createElement('img');
    img.src = it.url;
    img.alt = it.nombre || '';
    img.style.width = '100%';
    img.style.height = '88px';
    img.style.objectFit = 'cover';
    const rm = document.createElement('button');
    rm.textContent = 'Quitar';
    rm.type = 'button';
    rm.style.marginTop = '4px';
    rm.addEventListener('click', () => removeLibrarySelection(it.id));
    cell.appendChild(img);
    cell.appendChild(rm);
    wrap.appendChild(cell);
  }
}
async function submitLibraryForm(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const status = document.getElementById('library-status');
  status.textContent = 'Subiendo...';
  try {
    const fd = new FormData(form);
    const r = await fetch('/api/biblioteca', { method: 'POST', body: fd });
    if (!r.ok) {
      status.textContent = 'Error subiendo imagen';
      return;
    }
    status.textContent = 'Subida correcta';
    form.reset();
    await loadLibrary();
    setTimeout(() => (status.textContent = ''), 1200);
  } catch (e) {
    console.error(e);
    status.textContent = 'Error subiendo imagen';
  }
}