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
      card.className = 'glass-product-card';

      const img = document.createElement('img');
      img.className = 'gpc-image';
      img.alt = p.name || '';
      img.loading = 'lazy';
      const first = (p.images && p.images[0]) || p.image || '/images/placeholder.svg';
      img.src = first;
      img.onerror = () => { img.src = '/images/placeholder.svg'; };

      const details = document.createElement('div');
      details.className = 'gpc-content';
      const safe = (v) => (v == null ? '' : v);
      const categoryLabel = safe(p.category_name || p.category_nombre || p.category_desc || p.category);

      const isDescLong = p.description && p.description.length > 80;
      let descHtml = `<div class="gpc-desc" title="${safe(p.description)}">${safe(p.description)}</div>`;
      if (isDescLong) {
        descHtml = `
            <div class="gpc-desc clamped" style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;" title="${safe(p.description)}">${safe(p.description)}</div>
            <button type="button" class="gpc-btn-more" style="background: none; border: none; color: var(--admin-kos-blue); cursor: pointer; padding: 0; font-size: 0.85rem; text-align: left; margin-top: 4px; font-weight: 600;">Ver más...</button>
        `;
      }

      details.innerHTML = `
        <h3 class="gpc-title">${safe(p.name)}</h3>
        <div class="gpc-meta">
            <span class="gpc-tag">${categoryLabel || 'Sin Categoría'}</span>
            <span style="font-weight: 600; color: var(--admin-text-main);">${p.price_unit != null ? ('$' + Number(p.price_unit).toLocaleString()) : ''}</span>
        </div>
        <div style="font-size: 0.85rem; color: #555; margin-top: 4px;"><strong>Stock:</strong> ${safe(p.cantidad ?? p.Cantidad)} | <strong>SKU:</strong> ${safe(p.codigo_siesa || p.codigo_siesa)}</div>
        ${descHtml}
        <div class="gpc-actions">
          <button data-id="${p.id}" class="fill-form gpc-btn-edit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Editar
          </button>
          <button data-id="${p.id}" class="delete-prod gpc-btn-delete">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Eliminar
          </button>
        </div>
      `;

      card.appendChild(img);
      card.appendChild(details);
      grid.appendChild(card);
    }

    grid.querySelectorAll('.gpc-btn-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const desc = e.target.previousElementSibling;
        if (desc.classList.contains('clamped')) {
          desc.classList.remove('clamped');
          desc.style.webkitLineClamp = 'unset';
          e.target.textContent = 'Ver menos';
        } else {
          desc.classList.add('clamped');
          desc.style.webkitLineClamp = '2';
          e.target.textContent = 'Ver más...';
        }
      });
    });

    // Editar: llena el form y muestra imágenes actuales
    grid.querySelectorAll('.fill-form').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const prod = products.find(x => String(x.id) === String(id));
        if (!prod) return;

        const form = $('#product-form');
        form.codigo_siesa ? form.codigo_siesa.value = prod.codigo_siesa || '' : (form.querySelector('#p-codigo').value = prod.codigo_siesa || '');
        form.id.value = prod.id;
        form.name.value = prod.name || '';
        if (form['price_unit']) form['price_unit'].value = prod.price_unit != null ? prod.price_unit : '';
        if (form['cantidad']) form['cantidad'].value = prod.cantidad != null ? prod.cantidad : (prod.Cantidad != null ? prod.Cantidad : '');
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
        window.__currentImages = [...(prod.images || [])];
        if (window.__currentImages.length === 0 && prod.image) window.__currentImages.push(prod.image);

        window.__currentImages.forEach((url, idx) => {
          const wrap = document.createElement('div');
          wrap.style.position = 'relative';

          const im = document.createElement('img');
          im.src = url;
          im.alt = prod.name || '';
          im.style.maxHeight = '120px';
          im.style.width = '100%';
          im.style.objectFit = 'contain';
          wrap.appendChild(im);

          const rm = document.createElement('button');
          rm.textContent = 'Quitar';
          rm.type = 'button';
          rm.style.marginTop = '4px';
          rm.style.width = '100%';
          rm.className = 'admin-btn-secondary';
          rm.style.padding = '4px';
          rm.addEventListener('click', () => {
            window.__currentImages.splice(idx, 1);
            wrap.remove();
          });
          wrap.appendChild(rm);

          cur.appendChild(wrap);
        });

        // compute total if both values available
        const pu = Number(form.querySelector('#p-price-unit')?.value);
        const cq = Number(form.querySelector('#p-cantidad')?.value);
        const totalEl = document.getElementById('p-price');
        if (totalEl && Number.isFinite(pu) && Number.isFinite(cq)) totalEl.value = (pu * cq).toFixed(0);

        const btnCancel = document.getElementById('btn-cancel-product');
        if (btnCancel) btnCancel.style.display = 'inline-flex';

        document.querySelector('.admin-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Eliminar
    grid.querySelectorAll('.delete-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm(`Eliminar producto #${id}?`)) return;
        try {
          const r = await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'same-origin' });
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
  const status = $('#form-status'); status.textContent = 'Guardando...';

  try {
    // Build payload (send JSON). Upload selected files to Azure Blob using SAS signed by backend.
    const idParam = (formEl.id && formEl.id.value) ? formEl.id.value : (formEl._id ? formEl._id.value : '') || formEl.querySelector('#p-id')?.value || '';
    const payload = {};
    payload.codigo_siesa = formEl.querySelector('#p-codigo')?.value || '';
    payload.name = formEl.querySelector('#p-name')?.value || '';
    payload.price_unit = formEl.querySelector('#p-price-unit')?.value || '';
    payload.cantidad = formEl.querySelector('#p-cantidad')?.value || '';
    payload.category = formEl.querySelector('#p-category')?.value || '';
    payload.description = formEl.querySelector('#p-desc')?.value || '';

    // Files selected
    const fileInput = document.getElementById('p-images');
    const files = fileInput ? Array.from(fileInput.files) : [];
    const libCount = (window.__libSelected || []).length;
    const currentCount = (window.__currentImages || []).length;

    // Only upload and include images if they are provided, OR if it's a new product
    if (files.length > 0 || libCount > 0 || currentCount > 0 || !idParam) {
      if (libCount + files.length + currentCount > 4) {
        status.textContent = 'No se pueden agregar más de 4 imágenes (incluyendo biblioteca)';
        return;
      }
      const uploadedUrls = [];
      for (const f of files) {
        const url = await uploadFileFromBrowser(f);
        uploadedUrls.push(url);
      }

      // Include selected library images
      const libUrls = (window.__libSelected || []).map(x => x.url).filter(Boolean);
      payload.images = [...(window.__currentImages || []), ...libUrls, ...uploadedUrls];
    } else {
      // If there were genuinely no images selected AND it's an update, let's keep the user's explicit deletion intent if they removed everything
      if (window.__currentImages && window.__currentImages.length === 0) {
        payload.images = [];
      }
    }

    const url = idParam ? `/api/products/${encodeURIComponent(idParam)}` : `/api/products`;
    const method = idParam ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let msg = txt; try { msg = JSON.parse(txt).message || txt; } catch { }
      status.textContent = 'Error: ' + (msg || 'No se pudo guardar');
      return;
    }
    if (idParam) {
      status.innerHTML = '<strong style="color:green">Actualizado correctamente.</strong>';
    } else {
      status.innerHTML = '<strong style="color:green">Creado correctamente.</strong>';
    }
    formEl.reset();
    // clear cantidad and total UI
    const priceEl = document.getElementById('p-price'); if (priceEl) priceEl.value = '';
    const qtyEl = document.getElementById('p-cantidad'); if (qtyEl) qtyEl.value = '';
    $('#new-previews').innerHTML = '';
    $('#current-images').innerHTML = '';
    const btnCancel = document.getElementById('btn-cancel-product');
    if (btnCancel) btnCancel.style.display = 'none';
    window.__libSelected = [];
    window.__currentImages = [];
    await loadProducts();
  } catch (e) {
    console.error(e); status.textContent = 'Error guardando producto.';
  }
}

async function uploadFileFromBrowser(file) {
  // Upload via server to avoid CORS issues
  const fd = new FormData();
  fd.append('file', file, file.name);
  const r = await fetch('/api/upload-file', { method: 'POST', body: fd, credentials: 'same-origin' });
  if (!r.ok) {
    const txt = await r.text().catch(() => null);
    throw new Error('upload_failed ' + (txt || r.status));
  }
  const j = await r.json();
  if (!j || !j.blobUrl) throw new Error('no_blob_url');
  return j.blobUrl;
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
        cats.map(c => {
          const label = (c.descripcion || c.nombre || c.description || c.nombre);
          return `<option value="${c.id}">${label}</option>`;
        }).join('');
    }
  } catch (e) { console.error('No se pudieron cargar categorías', e); }

  // Also populate categories list UI
  try {
    await loadCategoriesList();
  } catch (e) { }

  $('#product-form').addEventListener('submit', submitForm);
  $('#p-images').addEventListener('change', (e) => renderNewPreviews(e.target.files));

  // Auto cálculo de precio total
  const cantidadInput = document.getElementById('p-cantidad');
  const puInput = document.getElementById('p-price-unit');
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

  // Cancel / Volver action handler
  const btnCancelProd = document.getElementById('btn-cancel-product');
  if (btnCancelProd) {
    btnCancelProd.addEventListener('click', () => {
      $('#product-form').reset();
      $('#product-form').id.value = '';
      $('#new-previews').innerHTML = '';
      $('#current-images').innerHTML = '';
      $('#form-status').textContent = '';
      btnCancelProd.style.display = 'none';
      if ($('#p-price')) $('#p-price').value = '';
      window.__libSelected = [];
      window.__currentImages = [];
      renderLibrarySelection();
      document.querySelector('.admin-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Biblioteca init
  try {
    await loadLibrary();
    const libForm = document.getElementById('library-form');
    libForm?.addEventListener('submit', submitLibraryForm);
  } catch (e) {
    console.error('Error inicializando biblioteca', e);
  }

  // Banners init (sección puede estar oculta por defecto)
  try {
    const bannerForm = document.getElementById('banner-form');
    bannerForm?.addEventListener('submit', submitBannerForm);
    await loadBanners();
  } catch (e) {
    // ignore
  }

  // Logos init (sección puede estar oculta por defecto)
  try {
    const logoForm = document.getElementById('logo-form');
    logoForm?.addEventListener('submit', submitLogoForm);
    await loadLogos();
  } catch (e) {
    // ignore
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Setup dynamic logo
  try {
    const r = await fetch('/api/logos?primary=true', { cache: 'no-store' });
    if (r.ok) {
      const list = await r.json();
      const first = Array.isArray(list) ? list[0] : null;
      if (first && first.url) {
        const finalUrl = first.url; // Remote blob storage may reject unknown query params
        const loginLogo = document.getElementById('admin-login-logo');
        if (loginLogo) {
          loginLogo.src = finalUrl;
          loginLogo.onerror = null; // Remove placeholder fallback if url is officially provided
        }
        const sidebarLogo = document.getElementById('admin-sidebar-logo');
        if (sidebarLogo) {
          sidebarLogo.src = finalUrl;
          sidebarLogo.style.display = 'inline-block';
          sidebarLogo.onerror = null;
          const svgIcon = document.getElementById('admin-sidebar-svg');
          if (svgIcon) svgIcon.style.display = 'none';
        }

        // Also ensure favicon updates dynamically (optional fallback)
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/png';
          document.head.appendChild(link);
        }
        link.href = finalUrl;
      }
    }
  } catch (e) {
    console.error('No se pudo cargar el logo de admin', e);
  }

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

  // Sidebar Navigation Routing
  const navs = [
    { nav: 'nav-products', view: 'view-products' },
    { nav: 'nav-categories', view: 'view-categories', load: loadCategoriesList },
    { nav: 'nav-banners', view: 'view-banners', load: loadBanners },
    { nav: 'nav-logos', view: 'view-logos', load: loadLogos },
    { nav: 'nav-library', view: 'view-library', load: loadLibrary },
  ];

  function switchView(viewId) {
    navs.forEach(n => {
      document.getElementById(n.view)?.classList.remove('active');
      document.getElementById(n.nav)?.classList.remove('active');
    });
    const target = navs.find(n => n.view === viewId);
    if (target) {
      document.getElementById(target.view)?.classList.add('active');
      document.getElementById(target.nav)?.classList.add('active');
      if (target.load) target.load();
      document.querySelector('.admin-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  navs.forEach(n => {
    document.getElementById(n.nav)?.addEventListener('click', () => {
      switchView(n.view);
    });
  });

  // Category form handlers
  const catForm = document.getElementById('category-form');
  catForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const descripcion = document.getElementById('cat-desc').value.trim();
    if (!descripcion) return alert('Ingrese una descripción');
    try {
      const payload = { descripcion };
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/categories/${encodeURIComponent(id)}` : '/api/categories';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        alert('Error: ' + txt);
        return;
      }
      // reset
      document.getElementById('cat-id').value = '';
      document.getElementById('cat-desc').value = '';
      await initAdmin();
      await loadCategoriesList();
      alert('Categoría guardada');
    } catch (err) { console.error(err); alert('Error guardando categoría'); }
  });
  document.getElementById('cat-cancel')?.addEventListener('click', () => {
    document.getElementById('cat-id').value = '';
    document.getElementById('cat-desc').value = '';
  });
});

// Load categories into the categories-list panel
async function loadCategoriesList() {
  try {
    const r = await fetch('/api/categories', { cache: 'no-store' });
    const cats = r.ok ? await r.json() : [];
    const wrap = document.getElementById('categories-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const c of cats) {
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.padding = '6px 0';
      const label = document.createElement('div');
      label.textContent = `${c.id} — ${c.descripcion || c.nombre || ''}`;
      const actions = document.createElement('div');
      const edit = document.createElement('button'); edit.textContent = 'Editar'; edit.type = 'button'; edit.style.marginRight = '8px';
      edit.addEventListener('click', () => {
        document.getElementById('cat-id').value = c.id;
        document.getElementById('cat-desc').value = c.descripcion || c.nombre || '';
        document.getElementById('nav-categories')?.click();
      });
      const del = document.createElement('button'); del.textContent = 'Eliminar'; del.type = 'button'; del.style.background = '#d9534f'; del.style.color = '#fff';
      del.addEventListener('click', async () => {
        if (!confirm(`Eliminar categoría #${c.id}?`)) return;
        try {
          const rr = await fetch(`/api/categories/${encodeURIComponent(c.id)}`, { method: 'DELETE', credentials: 'same-origin' });
          if (!rr.ok) { const t = await rr.text().catch(() => ''); alert('Error: ' + t); return; }
          await loadCategoriesList();
          await initAdmin();
        } catch (err) { console.error(err); alert('Error eliminando'); }
      });
      actions.appendChild(edit); actions.appendChild(del);
      row.appendChild(label); row.appendChild(actions);
      wrap.appendChild(row);
    }
  } catch (e) { console.error('loadCategoriesList error', e); }
}

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
        } catch { }
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Eliminar';
      delBtn.type = 'button';
      delBtn.style.background = '#d9534f';
      delBtn.style.color = '#fff';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Eliminar imagen de biblioteca #${it.id}?`)) return;
        try {
          const rr = await fetch(`/api/biblioteca/${it.id}`, { method: 'DELETE', credentials: 'same-origin' });
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
    const r = await fetch('/api/biblioteca', { method: 'POST', body: fd, credentials: 'same-origin' });
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

// ---- Banners ----
async function loadBanners() {
  const grid = document.getElementById('banners-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/banners', { cache: 'no-store' });
    const items = r.ok ? await r.json() : [];
    renderBanners(items);
  } catch (e) {
    console.error('Error cargando banners', e);
    grid.innerHTML = '<p>Error cargando banners.</p>';
  }
}

function renderBanners(items) {
  const grid = document.getElementById('banners-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const list = Array.isArray(items) ? items : [];
  const activeCount = list.filter(x => !!x.activo).length;

  for (const it of list) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.borderRadius = '6px';
    wrap.style.overflow = 'hidden';
    wrap.style.border = '1px solid #eee';
    wrap.style.background = '#fff';

    const img = document.createElement('img');
    img.src = it.url;
    img.alt = it.nombre || 'Banner';
    img.title = `${it.nombre || 'Banner'} (#${it.id})`;
    img.style.width = '100%';
    img.style.height = '88px';
    img.style.objectFit = 'cover';

    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.gap = '6px';
    bar.style.padding = '6px';
    bar.style.alignItems = 'center';

    const orderWrap = document.createElement('label');
    orderWrap.style.display = 'inline-flex';
    orderWrap.style.alignItems = 'center';
    orderWrap.style.gap = '6px';
    orderWrap.style.fontSize = '12px';
    orderWrap.style.color = '#111';
    orderWrap.textContent = 'Orden:';

    const sel = document.createElement('select');
    sel.style.padding = '4px 6px';
    sel.style.borderRadius = '6px';
    sel.style.border = '1px solid #ccc';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '(sin)';
    sel.appendChild(opt0);
    for (const n of [1, 2, 3]) {
      const o = document.createElement('option');
      o.value = String(n);
      o.textContent = String(n);
      sel.appendChild(o);
    }
    const currentOrden = (it.orden == null ? '' : String(it.orden));
    sel.value = currentOrden;
    sel.addEventListener('change', async () => {
      const v = sel.value;
      if (!v) {
        alert('Para mantener el orden consistente, elige 1, 2 o 3');
        sel.value = currentOrden;
        return;
      }
      const ok = await setBannerOrden(it.id, Number(v));
      if (!ok) {
        sel.value = currentOrden;
      } else {
        await loadBanners();
      }
    });
    orderWrap.appendChild(sel);

    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '6px';
    label.style.fontSize = '12px';
    label.style.color = '#111';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!it.activo;
    chk.addEventListener('change', async () => {
      // Enforce max 3 on UI side too
      const newActive = chk.checked;
      if (newActive) {
        const currentActive = Array.from(grid.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).length;
        if (currentActive > 3) {
          chk.checked = false;
          alert('Máximo 3 banners activos');
          return;
        }
      }
      const ok = await setBannerActive(it.id, newActive);
      if (!ok) {
        chk.checked = !newActive;
      } else {
        await loadBanners();
      }
    });

    const t = document.createElement('span');
    t.textContent = `Activo (${activeCount}/3)`;
    label.appendChild(chk);
    label.appendChild(t);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Eliminar';
    delBtn.style.background = '#d9534f';
    delBtn.style.color = '#fff';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Eliminar banner #${it.id}?`)) return;
      try {
        const rr = await fetch(`/api/banners/${encodeURIComponent(it.id)}`, { method: 'DELETE', credentials: 'same-origin' });
        if (!rr.ok) {
          const txt = await rr.text().catch(() => '');
          alert('Error: ' + (txt || 'No se pudo eliminar'));
          return;
        }
        await loadBanners();
      } catch (e) {
        console.error(e);
        alert('Error eliminando banner');
      }
    });

    bar.appendChild(orderWrap);
    bar.appendChild(label);
    bar.appendChild(delBtn);

    wrap.appendChild(img);
    wrap.appendChild(bar);
    grid.appendChild(wrap);
  }
}

async function submitBannerForm(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const status = document.getElementById('banner-status');
  if (status) status.textContent = 'Subiendo...';
  try {
    const fd = new FormData(form);
    const r = await fetch('/api/banners', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      if (status) status.textContent = 'Error subiendo banner';
      alert('Error: ' + (txt || 'No se pudo subir'));
      return;
    }
    if (status) status.textContent = 'Subido';
    form.reset();
    await loadBanners();
    setTimeout(() => { if (status) status.textContent = ''; }, 1200);
  } catch (e) {
    console.error(e);
    if (status) status.textContent = 'Error subiendo banner';
  }
}

async function setBannerActive(id, activo) {
  try {
    const r = await fetch(`/api/banners/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !!activo }),
      credentials: 'same-origin'
    });
    if (!r.ok) {
      let msg = 'No se pudo actualizar';
      try {
        const j = await r.json();
        msg = j.message || msg;
      } catch {
        const t = await r.text().catch(() => '');
        if (t) msg = t;
      }
      alert(msg);
      return false;
    }
    return true;
  } catch (e) {
    console.error(e);
    alert('Error actualizando banner');
    return false;
  }
}

async function setBannerOrden(id, orden) {
  try {
    const r = await fetch(`/api/banners/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden: Number(orden) }),
      credentials: 'same-origin'
    });
    if (!r.ok) {
      let msg = 'No se pudo actualizar';
      try {
        const j = await r.json();
        msg = j.message || msg;
      } catch {
        const t = await r.text().catch(() => '');
        if (t) msg = t;
      }
      alert(msg);
      return false;
    }
    return true;
  } catch (e) {
    console.error(e);
    alert('Error actualizando orden del banner');
    return false;
  }
}

// ---- Logos ----
async function loadLogos() {
  const grid = document.getElementById('logos-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/logos', { cache: 'no-store' });
    const items = r.ok ? await r.json() : [];
    renderLogos(items);
  } catch (e) {
    console.error('Error cargando logos', e);
    grid.innerHTML = '<p>Error cargando logos.</p>';
  }
}

function renderLogos(items) {
  const grid = document.getElementById('logos-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const list = Array.isArray(items) ? items : [];

  for (const it of list) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.borderRadius = '6px';
    wrap.style.overflow = 'hidden';
    wrap.style.border = '1px solid #eee';
    wrap.style.background = '#fff';

    const img = document.createElement('img');
    img.src = it.url;
    img.alt = it.nombre || 'Logo';
    img.title = `${it.nombre || 'Logo'} (#${it.id})`;
    img.style.width = '100%';
    img.style.height = '88px';
    img.style.objectFit = 'contain';
    img.style.background = '#fff';

    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.gap = '6px';
    bar.style.padding = '6px';
    bar.style.alignItems = 'center';

    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '6px';
    label.style.fontSize = '12px';
    label.style.color = '#111';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!it.principal;
    chk.addEventListener('change', async () => {
      // checkbox funciona como selección única
      if (!chk.checked) {
        chk.checked = true;
        alert('Siempre debe haber un logo principal. Selecciona otro si quieres cambiarlo.');
        return;
      }
      const ok = await setLogoPrincipal(it.id);
      if (ok) await loadLogos();
      else chk.checked = false;
    });

    const t = document.createElement('span');
    t.textContent = 'Principal';
    label.appendChild(chk);
    label.appendChild(t);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Eliminar';
    delBtn.style.background = '#d9534f';
    delBtn.style.color = '#fff';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Eliminar logo #${it.id}?`)) return;
      try {
        const rr = await fetch(`/api/logos/${encodeURIComponent(it.id)}`, { method: 'DELETE', credentials: 'same-origin' });
        if (!rr.ok) {
          const txt = await rr.text().catch(() => '');
          alert('Error: ' + (txt || 'No se pudo eliminar'));
          return;
        }
        await loadLogos();
      } catch (e) {
        console.error(e);
        alert('Error eliminando logo');
      }
    });

    bar.appendChild(label);
    bar.appendChild(delBtn);

    wrap.appendChild(img);
    wrap.appendChild(bar);
    grid.appendChild(wrap);
  }
}

async function submitLogoForm(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const status = document.getElementById('logo-status');
  if (status) status.textContent = 'Subiendo...';
  try {
    const fd = new FormData(form);
    const r = await fetch('/api/logos', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      if (status) status.textContent = 'Error subiendo logo';
      alert('Error: ' + (txt || 'No se pudo subir'));
      return;
    }
    if (status) status.textContent = 'Subido';
    form.reset();
    await loadLogos();
    setTimeout(() => { if (status) status.textContent = ''; }, 1200);
  } catch (e) {
    console.error(e);
    if (status) status.textContent = 'Error subiendo logo';
  }
}

async function setLogoPrincipal(id) {
  try {
    const r = await fetch(`/api/logos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principal: true }),
      credentials: 'same-origin'
    });
    if (!r.ok) {
      let msg = 'No se pudo actualizar';
      try {
        const j = await r.json();
        msg = j.message || msg;
      } catch {
        const t = await r.text().catch(() => '');
        if (t) msg = t;
      }
      alert(msg);
      return false;
    }
    return true;
  } catch (e) {
    console.error(e);
    alert('Error actualizando logo');
    return false;
  }
}