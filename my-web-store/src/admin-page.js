const $ = (sel) => document.querySelector(sel);

function renderNewPreviews(files) {
  const wrap = $('#new-previews');
  wrap.innerHTML = '';
  if (!files || files.length === 0) return;
  [...files].forEach(f => {
    const url = URL.createObjectURL(f);
    const item = document.createElement('div');
    item.className = 'admin-img-preview-item';
    item.innerHTML = `
      <img src="${url}" alt="${f.name}">
      <div class="admin-img-preview-overlay">
        <span style="font-size:0.65rem; color:var(--admin-text-muted); font-weight:600;">NUEVA</span>
      </div>
    `;
    wrap.appendChild(item);
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
      if (!p.habilitado) card.style.opacity = '0.55';

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

      const toggleLabel = p.habilitado ? 'Habilitado' : 'Deshabilitado';
      const toggleClass = p.habilitado ? 'gpc-btn-toggle-on' : 'gpc-btn-toggle-off';

      details.innerHTML = `
        <h3 class="gpc-title">${safe(p.name)}</h3>
        <div class="gpc-meta">
            <span class="gpc-tag">${categoryLabel || 'Sin Categoría'}</span>
            <span style="font-weight: 600; color: var(--admin-text-main);">${p.price_unit != null ? ('$' + Number(p.price_unit).toLocaleString()) : ''}</span>
        </div>
        <div style="font-size: 0.85rem; color: #555; margin-top: 4px;"><strong>Stock:</strong> ${safe(p.cantidad ?? p.Cantidad)} | <strong>SKU:</strong> ${safe(p.codigo_siesa || p.codigo_siesa)}</div>
        ${p.es_personalizado ? '<div style="font-size:0.75rem; color:#d97706; font-weight:700; text-transform:uppercase; margin-top:4px;">✨ Personalizado</div>' : ''}
        ${descHtml}
        <div class="gpc-actions">
          <button data-id="${p.id}" class="toggle-habilitado ${toggleClass}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="${p.habilitado ? 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z' : 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z'}"/></svg>
            ${toggleLabel}
          </button>
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
        // Set empaque select
        const selEmp = form.querySelector('#p-empaque');
        if (selEmp) selEmp.value = prod.row_empaque != null ? prod.row_empaque : '';
        const selPers = form.querySelector('#p-personalizado');
        if (selPers) {
          selPers.value = String(prod.es_personalizado || 'false');
          // Update visibility
          const priceGroup = document.getElementById('p-precio-personalizado-group');
          if (priceGroup) priceGroup.style.display = (selPers.value === 'true') ? 'block' : 'none';
        }
        const inputPersPrice2000 = form.querySelector('#p-precio-personalizado-2000');
        if (inputPersPrice2000) inputPersPrice2000.value = prod.precio_personalizado_2000 != null ? prod.precio_personalizado_2000 : '';
        const inputPersPrice4000 = form.querySelector('#p-precio-personalizado-4000');
        if (inputPersPrice4000) inputPersPrice4000.value = prod.precio_personalizado_4000 != null ? prod.precio_personalizado_4000 : '';
        const inputPersPrice8000 = form.querySelector('#p-precio-personalizado-8000');
        if (inputPersPrice8000) inputPersPrice8000.value = prod.precio_personalizado_8000 != null ? prod.precio_personalizado_8000 : '';
        const inputPersPrice20000 = form.querySelector('#p-precio-personalizado-20000');
        if (inputPersPrice20000) inputPersPrice20000.value = prod.precio_personalizado_20000 != null ? prod.precio_personalizado_20000 : '';
        
        form.description.value = prod.description || '';
        form.images.value = ''; // limpia selección

        const cur = $('#current-images');
        cur.innerHTML = '';
        window.__currentImages = [...(prod.images || [])];
        if (window.__currentImages.length === 0 && prod.image) window.__currentImages.push(prod.image);

        window.__currentImages.forEach((url, idx) => {
          const item = document.createElement('div');
          item.className = 'admin-img-preview-item';
          
          item.innerHTML = `
            <img src="${url}" alt="${prod.name || ''}">
            <div class="admin-img-preview-overlay">
              <button type="button" class="admin-btn-icon danger remove-current" data-idx="${idx}" title="Quitar imagen">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          `;

          item.querySelector('.remove-current').addEventListener('click', () => {
            window.__currentImages.splice(idx, 1);
            item.remove();
          });

          cur.appendChild(item);
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

    // Toggle habilitado/deshabilitado
    grid.querySelectorAll('.toggle-habilitado').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        try {
          const r = await fetch(`/api/products/${id}/toggle`, { method: 'PATCH', credentials: 'same-origin' });
          if (!r.ok) return alert('Error cambiando estado del producto');
          await loadProducts();
        } catch (err) {
          console.error(err);
          alert('Error cambiando estado del producto');
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
    payload.row_empaque = formEl.querySelector('#p-empaque')?.value || '';
    payload.es_personalizado = formEl.querySelector('#p-personalizado')?.value || 'false';
    payload.precio_personalizado_2000 = formEl.querySelector('#p-precio-personalizado-2000')?.value || '';
    payload.precio_personalizado_4000 = formEl.querySelector('#p-precio-personalizado-4000')?.value || '';
    payload.precio_personalizado_8000 = formEl.querySelector('#p-precio-personalizado-8000')?.value || '';
    payload.precio_personalizado_20000 = formEl.querySelector('#p-precio-personalizado-20000')?.value || '';
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

document.addEventListener('change', (e) => {
  if (e.target.id === 'p-personalizado') {
    const priceGroup = document.getElementById('p-precio-personalizado-group');
    if (priceGroup) priceGroup.style.display = (e.target.value === 'true') ? 'block' : 'none';
  }
});

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
  // Load dashboard first (default view)
  try { await loadDashboard(); } catch (e) { console.error('Dashboard init error', e); }

  // Setup pedidos filters
  document.getElementById('pedidos-filter-btn')?.addEventListener('click', () => loadPedidos(1));
  document.getElementById('pedidos-filter-clear')?.addEventListener('click', () => {
    document.getElementById('pedidos-filter-status').value = '';
    document.getElementById('pedidos-filter-from').value = '';
    document.getElementById('pedidos-filter-to').value = '';
    document.getElementById('pedidos-filter-search').value = '';
    loadPedidos(1);
  });
  document.getElementById('pedidos-filter-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPedidos(1); });

  // Setup pedido modal close
  document.getElementById('pedido-modal-close')?.addEventListener('click', () => {
    document.getElementById('pedido-modal').style.display = 'none';
  });
  document.getElementById('pedido-modal')?.querySelector('.admin-modal-overlay')?.addEventListener('click', () => {
    document.getElementById('pedido-modal').style.display = 'none';
  });

  // Setup contacts filter
  document.getElementById('contacts-filter-btn')?.addEventListener('click', () => loadContacts(1));
  document.getElementById('contacts-filter-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadContacts(1); });

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

  // Populate tipo empaque select
  try {
    const selEmp = $('#p-empaque');
    if (selEmp) {
      selEmp.innerHTML = '<option value="">Cargando empaques...</option>';
      const r = await fetch('/api/tipo-empaque', { cache: 'no-store' });
      const empaques = r.ok ? await r.json() : [];
      selEmp.innerHTML = '<option value="">(sin empaque)</option>' +
        empaques.map(e => `<option value="${e.id}">${e.descripcion}</option>`).join('');
    }
  } catch (e) { console.error('No se pudieron cargar tipos de empaque', e); }

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
    { nav: 'nav-dashboard', view: 'view-dashboard', load: loadDashboard },
    { nav: 'nav-pedidos', view: 'view-pedidos', load: loadPedidos },
    { nav: 'nav-contacts', view: 'view-contacts', load: loadContacts },
    { nav: 'nav-products', view: 'view-products' },
    { nav: 'nav-products-en', view: 'view-products-en', load: loadProductsEnList },
    { nav: 'nav-categories', view: 'view-categories', load: loadCategoriesList },
    { nav: 'nav-categories-en', view: 'view-categories-en', load: loadCategoriesEnList },
    { nav: 'nav-banners', view: 'view-banners', load: loadBanners },
    { nav: 'nav-logos', view: 'view-logos', load: loadLogos },
    { nav: 'nav-library', view: 'view-library', load: loadLibrary },
    { nav: 'nav-bonos', view: 'view-bonos', load: loadBonosAdmin },
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

  // Product English-translation form handlers
  document.getElementById('pt-cancel-btn')?.addEventListener('click', closeProductEnForm);

  document.getElementById('pt-images')?.addEventListener('change', (e) => renderPtNewPreviews(e.target.files));

  document.getElementById('product-en-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('product-en-status');
    const product_id = Number(document.getElementById('pt-product-id').value);
    if (!product_id) return;
    const name_en = document.getElementById('pt-name-en').value.trim();
    const description_en = document.getElementById('pt-desc-en').value.trim();
    status.textContent = 'Guardando...';
    try {
      const fileInput = document.getElementById('pt-images');
      const files = fileInput ? Array.from(fileInput.files) : [];
      if (ptCurrentImages.length + files.length > 4) {
        status.textContent = 'No se pueden agregar más de 4 fotos.';
        return;
      }
      const uploadedUrls = [];
      for (const f of files) {
        uploadedUrls.push(await uploadFileFromBrowser(f));
      }
      const images_en = [...ptCurrentImages, ...uploadedUrls];

      const r = await fetch('/api/product-translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id, name_en, description_en, images_en }),
        credentials: 'same-origin'
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        status.textContent = 'Error: ' + txt;
        return;
      }
      status.innerHTML = '<strong style="color:green">Traducción guardada.</strong>';
      await loadProductsEnList();
      closeProductEnForm();
    } catch (err) { console.error(err); status.textContent = 'Error guardando la traducción'; }
  });

  document.getElementById('pt-delete-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('product-en-status');
    const product_id = Number(document.getElementById('pt-product-id').value);
    if (!product_id) return;
    if (!confirm('¿Eliminar la traducción en inglés de este producto (nombre, descripción y fotos)?')) return;
    try {
      const r = await fetch(`/api/product-translations/${encodeURIComponent(product_id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        status.textContent = 'Error: ' + txt;
        return;
      }
      status.textContent = 'Traducción eliminada.';
      await loadProductsEnList();
      closeProductEnForm();
    } catch (err) { console.error(err); status.textContent = 'Error eliminando la traducción'; }
  });

  document.getElementById('pt-search')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = !q ? ptAllProducts : ptAllProducts.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.codigo_siesa || '').toLowerCase().includes(q)
    );
    renderProductsEnGrid(filtered);
  });

  // Bonos form handlers
  document.getElementById('bono-form')?.addEventListener('submit', submitBonoForm);
  document.getElementById('bono-cancel')?.addEventListener('click', resetBonoForm);

  // Category English-translation form handlers
  document.getElementById('ct-cancel-btn')?.addEventListener('click', closeCategoryEnForm);
  document.getElementById('ct-image')?.addEventListener('change', (e) => renderCtNewPreview(e.target.files));

  document.getElementById('category-en-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('category-en-status');
    const category_id = Number(document.getElementById('ct-category-id').value);
    if (!category_id) return;
    const nombre_en = document.getElementById('ct-name-en').value.trim();
    status.textContent = 'Guardando...';
    try {
      const fileInput = document.getElementById('ct-image');
      const file = fileInput && fileInput.files[0];
      const imagen_en = file ? await uploadFileFromBrowser(file) : ctCurrentImageUrl;

      const r = await fetch('/api/category-translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id, nombre_en, imagen_en: imagen_en || '' }),
        credentials: 'same-origin'
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        status.textContent = 'Error: ' + txt;
        return;
      }
      status.innerHTML = '<strong style="color:green">Traducción guardada.</strong>';
      await loadCategoriesEnList();
      closeCategoryEnForm();
    } catch (err) { console.error(err); status.textContent = 'Error guardando la traducción'; }
  });

  document.getElementById('ct-delete-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('category-en-status');
    const category_id = Number(document.getElementById('ct-category-id').value);
    if (!category_id) return;
    if (!confirm('¿Eliminar la traducción en inglés de esta categoría (nombre e imagen)?')) return;
    try {
      const r = await fetch(`/api/category-translations/${encodeURIComponent(category_id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        status.textContent = 'Error: ' + txt;
        return;
      }
      status.textContent = 'Traducción eliminada.';
      await loadCategoriesEnList();
      closeCategoryEnForm();
    } catch (err) { console.error(err); status.textContent = 'Error eliminando la traducción'; }
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

// ---- Productos (Inglés) — card grid + edit form ----
// Does not touch dbo.products — only reads/writes the name_en/description_en/images_en
// overlay that the server joins into GET /api/products and stores via
// POST /api/product-translations.
let ptAllProducts = [];
let ptCurrentImages = [];

async function loadProductsEnList() {
  const grid = document.getElementById('products-en-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/products', { cache: 'no-store' });
    ptAllProducts = r.ok ? await r.json() : [];
    renderProductsEnGrid(ptAllProducts);
  } catch (e) {
    console.error('loadProductsEnList error', e);
    grid.innerHTML = '<p>Error cargando productos.</p>';
  }
}

function renderProductsEnGrid(products) {
  const grid = document.getElementById('products-en-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const safe = (v) => (v == null ? '' : v);

  for (const p of products) {
    const card = document.createElement('div');
    card.className = 'glass-product-card';

    const img = document.createElement('img');
    img.className = 'gpc-image';
    img.alt = p.name || '';
    img.loading = 'lazy';
    img.src = (p.images_en && p.images_en[0]) || (p.images && p.images[0]) || p.image || '/images/placeholder.svg';
    img.onerror = () => { img.src = '/images/placeholder.svg'; };

    const details = document.createElement('div');
    details.className = 'gpc-content';
    const isTranslated = !!(p.name_en || p.description_en || (p.images_en && p.images_en.length));
    const statusBadge = isTranslated
      ? '<span style="font-size:0.72rem; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:10px;">Traducido</span>'
      : '<span style="font-size:0.72rem; font-weight:700; color:#92400e; background:#fef3c7; padding:2px 8px; border-radius:10px;">Sin traducir</span>';

    details.innerHTML = `
      <h3 class="gpc-title">${safe(p.name)}</h3>
      <div class="gpc-meta">
        <span class="gpc-tag">${safe(p.codigo_siesa) || 'Sin SKU'}</span>
        ${statusBadge}
      </div>
      ${p.name_en ? `<div style="font-size:0.85rem; color:#555; margin-top:6px;"><strong>EN:</strong> ${safe(p.name_en)}</div>` : ''}
      <div class="gpc-actions">
        <button type="button" data-id="${p.id}" class="fill-form-en gpc-btn-edit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          Editar Inglés
        </button>
      </div>
    `;

    card.appendChild(img);
    card.appendChild(details);
    grid.appendChild(card);
  }

  grid.querySelectorAll('.fill-form-en').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const prod = ptAllProducts.find(x => String(x.id) === String(id));
      if (prod) openProductEnForm(prod);
    });
  });
}

function openProductEnForm(product) {
  document.getElementById('pt-product-id').value = product.id;
  document.getElementById('pt-sku-ref').value = product.codigo_siesa || '';
  document.getElementById('pt-name-ref').value = product.name || '';
  document.getElementById('pt-desc-ref').value = product.description || '';
  document.getElementById('pt-name-en').value = product.name_en || '';
  document.getElementById('pt-desc-en').value = product.description_en || '';
  document.getElementById('pt-images').value = '';
  document.getElementById('pt-new-previews').innerHTML = '';
  renderPtCurrentImages(product.images_en || []);

  const deleteBtn = document.getElementById('pt-delete-btn');
  if (deleteBtn) deleteBtn.style.display = (product.name_en || product.description_en || (product.images_en && product.images_en.length)) ? 'inline-block' : 'none';
  document.getElementById('product-en-status').textContent = '';
  document.getElementById('product-en-form-container').style.display = 'block';
  document.querySelector('.admin-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeProductEnForm() {
  document.getElementById('product-en-form')?.reset();
  document.getElementById('pt-product-id').value = '';
  document.getElementById('pt-new-previews').innerHTML = '';
  document.getElementById('pt-current-images').innerHTML = '';
  document.getElementById('pt-delete-btn').style.display = 'none';
  document.getElementById('product-en-status').textContent = '';
  document.getElementById('product-en-form-container').style.display = 'none';
  ptCurrentImages = [];
}

function renderPtCurrentImages(urls) {
  const wrap = document.getElementById('pt-current-images');
  if (!wrap) return;
  wrap.innerHTML = '';
  ptCurrentImages = [...(urls || [])];
  ptCurrentImages.forEach((url, idx) => {
    const item = document.createElement('div');
    item.className = 'admin-img-preview-item';
    item.innerHTML = `
      <img src="${url}" alt="">
      <div class="admin-img-preview-overlay">
        <button type="button" class="admin-btn-icon danger remove-pt-current" data-idx="${idx}" title="Quitar imagen">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    item.querySelector('.remove-pt-current').addEventListener('click', () => {
      ptCurrentImages.splice(idx, 1);
      renderPtCurrentImages(ptCurrentImages);
    });
    wrap.appendChild(item);
  });
}

function renderPtNewPreviews(files) {
  const wrap = document.getElementById('pt-new-previews');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!files || files.length === 0) return;
  [...files].forEach(f => {
    const url = URL.createObjectURL(f);
    const item = document.createElement('div');
    item.className = 'admin-img-preview-item';
    item.innerHTML = `
      <img src="${url}" alt="${f.name}">
      <div class="admin-img-preview-overlay">
        <span style="font-size:0.65rem; color:var(--admin-text-muted); font-weight:600;">NUEVA</span>
      </div>
    `;
    wrap.appendChild(item);
  });
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
    const item = document.createElement('div');
    item.className = 'admin-img-preview-item';
    item.innerHTML = `
      <img src="${it.url}" alt="${it.nombre || ''}">
      <div class="admin-img-preview-overlay">
        <button type="button" class="admin-btn-icon danger remove-lib" data-id="${it.id}" title="Quitar de selección">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    item.querySelector('.remove-lib').addEventListener('click', () => removeLibrarySelection(it.id));
    wrap.appendChild(item);
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

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function fmtCOP(n) {
  return Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-CO');
}

async function loadDashboard() {
  try {
    const r = await fetch('/api/admin/dashboard', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('Error cargando dashboard');
    const data = await r.json();
    const k = data.kpis || {};

    // KPIs
    const el = (id) => document.getElementById(id);
    el('kpi-total-pedidos').textContent = fmtNum(k.total_pedidos);
    el('kpi-aprobados').textContent = fmtNum(k.pedidos_aprobados);
    el('kpi-ingresos').textContent = fmtCOP(k.ingresos_totales);
    el('kpi-visitas').textContent = fmtNum(k.total_views);
    el('kpi-contactos').textContent = fmtNum(k.total_contacts);

    const COLORS = ['#009FE3', '#F28C30', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'];

    // Chart: Visitas por dia
    destroyChart('chart-visitas');
    const ctxV = el('chart-visitas');
    if (ctxV && data.visitasPorDia) {
      chartInstances['chart-visitas'] = new Chart(ctxV, {
        type: 'line',
        data: {
          labels: data.visitasPorDia.map(d => d.dia?.slice(5) || ''),
          datasets: [{
            label: 'Visitas',
            data: data.visitasPorDia.map(d => d.views),
            borderColor: '#009FE3',
            backgroundColor: 'rgba(0,159,227,0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // Chart: Ventas por mes
    destroyChart('chart-ventas');
    const ctxS = el('chart-ventas');
    if (ctxS && data.ventasPorMes) {
      chartInstances['chart-ventas'] = new Chart(ctxS, {
        type: 'bar',
        data: {
          labels: data.ventasPorMes.map(d => d.mes || ''),
          datasets: [{
            label: 'Ingresos',
            data: data.ventasPorMes.map(d => d.ingresos),
            backgroundColor: COLORS.slice(0, data.ventasPorMes.length)
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // Chart: Top vendidos
    destroyChart('chart-top-vendidos');
    const ctxTV = el('chart-top-vendidos');
    if (ctxTV && data.topVendidos && data.topVendidos.length) {
      chartInstances['chart-top-vendidos'] = new Chart(ctxTV, {
        type: 'bar',
        data: {
          labels: data.topVendidos.map(d => (d.product_name || '').slice(0, 25)),
          datasets: [{
            label: 'Unidades vendidas',
            data: data.topVendidos.map(d => d.total_qty),
            backgroundColor: COLORS.slice(0, data.topVendidos.length)
          }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
      });
    } else if (ctxTV) {
      ctxTV.parentElement.innerHTML += '<p style="color:var(--admin-text-muted);text-align:center;">Sin datos aun</p>';
    }

    // Chart: Top vistos
    destroyChart('chart-top-vistos');
    const ctxTVi = el('chart-top-vistos');
    if (ctxTVi && data.topVistos && data.topVistos.length) {
      chartInstances['chart-top-vistos'] = new Chart(ctxTVi, {
        type: 'bar',
        data: {
          labels: data.topVistos.map(d => (d.product_name || 'ID:' + d.product_id).slice(0, 25)),
          datasets: [{
            label: 'Visitas',
            data: data.topVistos.map(d => d.views),
            backgroundColor: COLORS.slice(0, data.topVistos.length)
          }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
      });
    } else if (ctxTVi) {
      ctxTVi.parentElement.innerHTML += '<p style="color:var(--admin-text-muted);text-align:center;">Sin datos aun</p>';
    }

    // Table: Top paises
    const paisesEl = el('table-paises');
    if (paisesEl && data.topPaises) {
      paisesEl.innerHTML = data.topPaises.length ? `<table class="admin-table"><thead><tr><th>Pais</th><th>Visitas</th></tr></thead><tbody>${data.topPaises.map(p => `<tr><td>${p.country}</td><td>${fmtNum(p.views)}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--admin-text-muted);text-align:center;">Sin datos aun</p>';
    }

    // Table: Top ciudades
    const ciudadesEl = el('table-ciudades');
    if (ciudadesEl && data.topCiudades) {
      ciudadesEl.innerHTML = data.topCiudades.length ? `<table class="admin-table"><thead><tr><th>Ciudad</th><th>Pais</th><th>Visitas</th></tr></thead><tbody>${data.topCiudades.map(c => `<tr><td>${c.city}</td><td>${c.country}</td><td>${fmtNum(c.views)}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--admin-text-muted);text-align:center;">Sin datos aun</p>';
    }

    // Recent orders
    const recentEl = el('dash-pedidos-recientes');
    if (recentEl && data.pedidosRecientes) {
      if (!data.pedidosRecientes.length) {
        recentEl.innerHTML = '<p style="color:var(--admin-text-muted);">No hay pedidos aun.</p>';
      } else {
        recentEl.innerHTML = `<table class="admin-table"><thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${data.pedidosRecientes.map(p => `<tr><td>${p.id}</td><td>${p.name || ''}</td><td>${fmtCOP(p.total_value)}</td><td>${renderStatusBadge(p.payment_status)}</td><td>${formatDate(p.createdAt)}</td></tr>`).join('')}</tbody></table>`;
      }
    }

  } catch (e) {
    console.error('loadDashboard error', e);
  }
}

function renderStatusBadge(status) {
  const s = (status || 'PENDING').toUpperCase();
  const map = {
    'APPROVED': { cls: 'badge-success', label: 'Aprobado' },
    'PENDING': { cls: 'badge-warning', label: 'Pendiente' },
    'DECLINED': { cls: 'badge-danger', label: 'Rechazado' },
    'ERROR': { cls: 'badge-danger', label: 'Error' },
  };
  const info = map[s] || { cls: 'badge-muted', label: s };
  return `<span class="admin-badge ${info.cls}">${info.label}</span>`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pedidos
// ═══════════════════════════════════════════════════════════════════════════════
let pedidosPage = 1;

async function loadPedidos(page) {
  pedidosPage = page || 1;
  try {
    const status = document.getElementById('pedidos-filter-status')?.value || '';
    const from = document.getElementById('pedidos-filter-from')?.value || '';
    const to = document.getElementById('pedidos-filter-to')?.value || '';
    const search = document.getElementById('pedidos-filter-search')?.value || '';

    const params = new URLSearchParams({ page: pedidosPage, limit: 15 });
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search) params.set('search', search);

    const r = await fetch(`/api/admin/pedidos?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('Error cargando pedidos');
    const data = await r.json();

    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--admin-text-muted);padding:32px;">No se encontraron pedidos</td></tr>';
    } else {
      tbody.innerHTML = data.data.map(p => `
        <tr>
          <td><strong>#${p.id}</strong></td>
          <td>${p.name || ''}<br><small style="color:var(--admin-text-muted);">NIT: ${p.nit_id || ''}</small></td>
          <td>${p.email || ''}</td>
          <td>${p.city || ''}</td>
          <td>${fmtCOP(p.total_value)}</td>
          <td>${renderStatusBadge(p.payment_status)}</td>
          <td>${formatDate(p.createdAt)}</td>
          <td><button class="admin-btn-primary admin-btn-sm" onclick="window.__viewPedido(${p.id})">Ver</button></td>
        </tr>
      `).join('');
    }

    // Pagination
    const pagEl = document.getElementById('pedidos-pagination');
    if (pagEl && data.pages > 1) {
      let html = '';
      for (let i = 1; i <= data.pages; i++) {
        html += `<button class="admin-page-btn ${i === data.page ? 'active' : ''}" onclick="window.__loadPedidosPage(${i})">${i}</button>`;
      }
      pagEl.innerHTML = html;
    } else if (pagEl) {
      pagEl.innerHTML = '';
    }

  } catch (e) {
    console.error('loadPedidos error', e);
    const tbody = document.getElementById('pedidos-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--admin-danger);">Error cargando pedidos</td></tr>';
  }
}

// Expose for inline onclick handlers
window.__loadPedidosPage = (p) => loadPedidos(p);

window.__viewPedido = async (id) => {
  try {
    const r = await fetch(`/api/admin/pedidos/${id}`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('Error cargando pedido');
    const data = await r.json();
    const p = data.pedido;
    const items = data.items || [];

    const modal = document.getElementById('pedido-modal');
    const body = document.getElementById('pedido-modal-body');
    if (!modal || !body) return;

    const itemsHtml = items.length ? `
      <table class="admin-table" style="margin-top:16px;">
        <thead><tr><th>Producto</th><th>SKU</th><th>Precio Unit.</th><th>Cant.</th><th>Subtotal</th></tr></thead>
        <tbody>${items.map(i => `<tr><td>${i.product_name || ''}</td><td>${i.product_sku || ''}</td><td>${fmtCOP(i.price_unit)}</td><td>${i.quantity}</td><td>${fmtCOP(i.subtotal)}</td></tr>`).join('')}</tbody>
      </table>` : '<p style="color:var(--admin-text-muted);margin-top:16px;">No se registraron productos para este pedido (pedido anterior al sistema de items).</p>';

    body.innerHTML = `
      <div class="pedido-detail-grid">
        <div class="pedido-detail-section">
          <h4>Informacion del Pedido</h4>
          <div class="pedido-detail-row"><strong>Pedido #:</strong> ${p.id}</div>
          <div class="pedido-detail-row"><strong>Estado:</strong> ${renderStatusBadge(p.payment_status)}</div>
          <div class="pedido-detail-row"><strong>ID Wompi:</strong> ${p.id_wompi || 'N/A'}</div>
          <div class="pedido-detail-row"><strong>Metodo de Pago:</strong> ${p.payment_method || 'N/A'}</div>
          <div class="pedido-detail-row"><strong>Fecha:</strong> ${formatDate(p.createdAt)}</div>
          ${p.updatedAt ? `<div class="pedido-detail-row"><strong>Actualizado:</strong> ${formatDate(p.updatedAt)}</div>` : ''}
        </div>
        <div class="pedido-detail-section">
          <h4>Datos del Cliente</h4>
          <div class="pedido-detail-row"><strong>Nombre:</strong> ${p.name || ''}</div>
          <div class="pedido-detail-row"><strong>NIT/Cedula:</strong> ${p.nit_id || ''}</div>
          <div class="pedido-detail-row"><strong>Email:</strong> ${p.email || ''}</div>
          <div class="pedido-detail-row"><strong>Telefono:</strong> ${p.phone || ''}</div>
          <div class="pedido-detail-row"><strong>Direccion:</strong> ${p.address || ''}</div>
          <div class="pedido-detail-row"><strong>Ciudad:</strong> ${p.city || ''}</div>
          ${p.notes ? `<div class="pedido-detail-row"><strong>Notas:</strong> ${p.notes}</div>` : ''}
        </div>
      </div>
      <div class="pedido-detail-section" style="margin-top:16px;">
        <h4>Totales</h4>
        <div class="pedido-totals">
          <div><strong>Subtotal:</strong> ${fmtCOP(p.subtotal)}</div>
          <div><strong>IVA:</strong> ${fmtCOP(p.iva)}</div>
          <div style="font-size:1.2rem;"><strong>Total:</strong> ${fmtCOP(p.total_value)}</div>
        </div>
      </div>
      <div class="pedido-detail-section">
        <h4>Productos del Pedido</h4>
        ${itemsHtml}
      </div>
    `;

    modal.style.display = 'flex';
  } catch (e) {
    console.error('viewPedido error', e);
    alert('Error cargando detalle del pedido');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Contactos
// ═══════════════════════════════════════════════════════════════════════════════
let contactsPage = 1;

async function loadContacts(page) {
  contactsPage = page || 1;
  try {
    const search = document.getElementById('contacts-filter-search')?.value || '';
    const params = new URLSearchParams({ page: contactsPage, limit: 15 });
    if (search) params.set('search', search);

    const r = await fetch(`/api/admin/contacts?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('Error cargando contactos');
    const data = await r.json();

    const tbody = document.getElementById('contacts-tbody');
    if (!tbody) return;

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--admin-text-muted);padding:32px;">No se encontraron contactos</td></tr>';
    } else {
      tbody.innerHTML = data.data.map(c => {
        const msg = (c.message || '').length > 80 ? c.message.slice(0, 80) + '...' : (c.message || '');
        let attachHtml = '';
        try {
          const atts = typeof c.attachments === 'string' ? JSON.parse(c.attachments) : (c.attachments || []);
          if (Array.isArray(atts) && atts.length) {
            attachHtml = atts.map(a => `<a href="${a.url || a}" target="_blank" style="color:var(--admin-kos-blue);font-size:0.8rem;">${a.name || 'Archivo'}</a>`).join(', ');
          }
        } catch { }
        return `<tr>
          <td>${c.id}</td>
          <td>${c.name || ''}</td>
          <td><a href="mailto:${c.email || ''}">${c.email || ''}</a></td>
          <td>${c.phone || ''}</td>
          <td title="${(c.message || '').replace(/"/g, '&quot;')}" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${msg}</td>
          <td>${attachHtml || '-'}</td>
          <td>${formatDate(c.createdAt)}</td>
        </tr>`;
      }).join('');
    }

    // Pagination
    const pagEl = document.getElementById('contacts-pagination');
    if (pagEl && data.pages > 1) {
      let html = '';
      for (let i = 1; i <= data.pages; i++) {
        html += `<button class="admin-page-btn ${i === data.page ? 'active' : ''}" onclick="window.__loadContactsPage(${i})">${i}</button>`;
      }
      pagEl.innerHTML = html;
    } else if (pagEl) {
      pagEl.innerHTML = '';
    }

  } catch (e) {
    console.error('loadContacts error', e);
    const tbody = document.getElementById('contacts-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--admin-danger);">Error cargando contactos</td></tr>';
  }
}

// ---- Bonos (promotional popup campaigns) ----

async function loadBonoCategoriaOptions() {
  const sel = document.getElementById('bono-categoria');
  if (!sel) return;
  const currentVal = sel.value;
  try {
    const r = await fetch('/api/categories', { cache: 'no-store' });
    const cats = r.ok ? await r.json() : [];
    // categoria_link must be the category NAME (matches p.category_name on the storefront filter),
    // not the numeric id used elsewhere for dbo.products.category.
    sel.innerHTML = '<option value="">(usar categoría por defecto del popup)</option>' +
      cats.map(c => {
        const label = c.descripcion || c.nombre || '';
        return `<option value="${label.replace(/"/g, '&quot;')}">${label}</option>`;
      }).join('');
    if (currentVal) sel.value = currentVal;
  } catch (e) { console.error('No se pudieron cargar categorías para bonos', e); }
}

async function loadBonosAdmin() {
  await loadBonoCategoriaOptions();
  const grid = document.getElementById('bonos-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/bonos', { cache: 'no-store' });
    const items = r.ok ? await r.json() : [];
    renderBonosGrid(items);
  } catch (e) {
    console.error('Error cargando bonos', e);
    grid.innerHTML = '<p>Error cargando bonos.</p>';
  }
}

function renderBonosGrid(items) {
  const grid = document.getElementById('bonos-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const b of items) {
    const card = document.createElement('div');
    card.className = 'glass-product-card';
    if (!b.activo) card.style.opacity = '0.6';

    const img = document.createElement('img');
    img.className = 'gpc-image';
    img.alt = b.nombre || 'Bono';
    img.loading = 'lazy';
    img.src = b.url || '/images/placeholder.svg';
    img.onerror = () => { img.src = '/images/placeholder.svg'; };

    const details = document.createElement('div');
    details.className = 'gpc-content';
    const activeBadge = b.activo
      ? '<span style="font-size:0.72rem; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:10px;">Activo</span>'
      : '<span style="font-size:0.72rem; font-weight:700; color:#555; background:#eee; padding:2px 8px; border-radius:10px;">Inactivo</span>';
    const pct = (b.porcentaje_descuento != null) ? `${b.porcentaje_descuento}% OFF` : '';

    details.innerHTML = `
      <h3 class="gpc-title">${b.nombre || ''}</h3>
      <div class="gpc-meta">
        ${activeBadge}
        ${pct ? `<span class="gpc-tag">${pct}</span>` : ''}
      </div>
      ${b.titulo ? `<div style="font-size:0.85rem; color:#555; margin-top:6px;">${b.titulo}</div>` : ''}
      <div class="gpc-actions">
        ${!b.activo ? `<button type="button" data-id="${b.id}" class="activate-bono gpc-btn-toggle-on">Activar</button>` : ''}
        <button type="button" data-id="${b.id}" class="edit-bono gpc-btn-edit">Editar</button>
        <button type="button" data-id="${b.id}" class="delete-bono gpc-btn-delete">Eliminar</button>
      </div>
    `;

    card.appendChild(img);
    card.appendChild(details);
    grid.appendChild(card);
  }

  grid.querySelectorAll('.activate-bono').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      try {
        const r = await fetch(`/api/bonos/${encodeURIComponent(id)}/activate`, { method: 'PATCH', credentials: 'same-origin' });
        if (!r.ok) return alert('Error activando bono');
        await loadBonosAdmin();
      } catch (err) { console.error(err); alert('Error activando bono'); }
    });
  });

  grid.querySelectorAll('.edit-bono').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const b = items.find(x => String(x.id) === String(id));
      if (!b) return;
      document.getElementById('bono-id').value = b.id;
      document.getElementById('bono-nombre').value = b.nombre || '';
      document.getElementById('bono-porcentaje').value = b.porcentaje_descuento != null ? b.porcentaje_descuento : '';
      document.getElementById('bono-titulo').value = b.titulo || '';
      document.getElementById('bono-titulo-en').value = b.titulo_en || '';
      document.getElementById('bono-texto-boton').value = b.texto_boton || '';
      document.getElementById('bono-texto-boton-en').value = b.texto_boton_en || '';
      document.getElementById('bono-categoria').value = b.categoria_link || '';
      document.getElementById('bono-imagen').value = '';
      document.getElementById('bono-status').textContent = '';
      document.querySelector('.admin-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  grid.querySelectorAll('.delete-bono').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (!confirm(`Eliminar bono #${id}?`)) return;
      try {
        const r = await fetch(`/api/bonos/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
        if (!r.ok) return alert('Error eliminando bono');
        await loadBonosAdmin();
      } catch (err) { console.error(err); alert('Error eliminando bono'); }
    });
  });
}

async function submitBonoForm(ev) {
  ev.preventDefault();
  const status = document.getElementById('bono-status');
  status.textContent = 'Guardando...';
  try {
    const id = document.getElementById('bono-id').value;
    const imgInput = document.getElementById('bono-imagen');
    if (!id && !imgInput.files[0]) {
      status.textContent = 'La imagen es obligatoria para crear un bono nuevo.';
      return;
    }

    const fd = new FormData();
    fd.append('nombre', document.getElementById('bono-nombre').value.trim());
    fd.append('porcentaje_descuento', document.getElementById('bono-porcentaje').value || '');
    fd.append('titulo', document.getElementById('bono-titulo').value.trim());
    fd.append('titulo_en', document.getElementById('bono-titulo-en').value.trim());
    fd.append('texto_boton', document.getElementById('bono-texto-boton').value.trim());
    fd.append('texto_boton_en', document.getElementById('bono-texto-boton-en').value.trim());
    fd.append('categoria_link', document.getElementById('bono-categoria').value || '');
    if (imgInput.files[0]) fd.append('imagen', imgInput.files[0]);

    const url = id ? `/api/bonos/${encodeURIComponent(id)}` : '/api/bonos';
    const method = id ? 'PUT' : 'POST';
    const r = await fetch(url, { method, body: fd, credentials: 'same-origin' });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      status.textContent = 'Error: ' + txt;
      return;
    }
    status.innerHTML = '<strong style="color:green">Bono guardado.</strong>';
    resetBonoForm();
    await loadBonosAdmin();
  } catch (e) {
    console.error(e);
    status.textContent = 'Error guardando el bono';
  }
}

function resetBonoForm() {
  document.getElementById('bono-form')?.reset();
  document.getElementById('bono-id').value = '';
  document.getElementById('bono-status').textContent = '';
}

// ---- Categorías (Inglés) — card grid + edit form ----
// Does not touch dbo.categories — only reads/writes the nombre_en/imagen_en
// overlay that the server joins into GET /api/categories and stores via
// POST /api/category-translations.
let ctAllCategories = [];
let ctCurrentImageUrl = null;

async function loadCategoriesEnList() {
  const grid = document.getElementById('categories-en-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/categories', { cache: 'no-store' });
    ctAllCategories = r.ok ? await r.json() : [];
    renderCategoriesEnGrid(ctAllCategories);
  } catch (e) {
    console.error('loadCategoriesEnList error', e);
    grid.innerHTML = '<p>Error cargando categorías.</p>';
  }
}

function renderCategoriesEnGrid(categories) {
  const grid = document.getElementById('categories-en-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const safe = (v) => (v == null ? '' : v);

  for (const c of categories) {
    const label = c.descripcion || c.nombre || '';
    const card = document.createElement('div');
    card.className = 'glass-product-card';

    const img = document.createElement('img');
    img.className = 'gpc-image';
    img.alt = label;
    img.loading = 'lazy';
    img.src = c.imagen_en || '/images/placeholder.svg';
    img.onerror = () => { img.src = '/images/placeholder.svg'; };

    const details = document.createElement('div');
    details.className = 'gpc-content';
    const isTranslated = !!(c.nombre_en || c.imagen_en);
    const statusBadge = isTranslated
      ? '<span style="font-size:0.72rem; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:10px;">Traducido</span>'
      : '<span style="font-size:0.72rem; font-weight:700; color:#92400e; background:#fef3c7; padding:2px 8px; border-radius:10px;">Sin traducir</span>';

    details.innerHTML = `
      <h3 class="gpc-title">${safe(label)}</h3>
      <div class="gpc-meta">${statusBadge}</div>
      ${c.nombre_en ? `<div style="font-size:0.85rem; color:#555; margin-top:6px;"><strong>EN:</strong> ${safe(c.nombre_en)}</div>` : ''}
      <div class="gpc-actions">
        <button type="button" data-id="${c.id}" class="fill-form-cat-en gpc-btn-edit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          Editar Inglés
        </button>
      </div>
    `;

    card.appendChild(img);
    card.appendChild(details);
    grid.appendChild(card);
  }

  grid.querySelectorAll('.fill-form-cat-en').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const cat = ctAllCategories.find(x => String(x.id) === String(id));
      if (cat) openCategoryEnForm(cat);
    });
  });
}

function openCategoryEnForm(cat) {
  document.getElementById('ct-category-id').value = cat.id;
  document.getElementById('ct-name-ref').value = cat.descripcion || cat.nombre || '';
  document.getElementById('ct-name-en').value = cat.nombre_en || '';
  document.getElementById('ct-image').value = '';
  document.getElementById('ct-new-preview').innerHTML = '';
  renderCtCurrentImage(cat.imagen_en || '');

  const deleteBtn = document.getElementById('ct-delete-btn');
  if (deleteBtn) deleteBtn.style.display = (cat.nombre_en || cat.imagen_en) ? 'inline-block' : 'none';
  document.getElementById('category-en-status').textContent = '';
  document.getElementById('category-en-form-container').style.display = 'block';
  document.querySelector('.admin-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeCategoryEnForm() {
  document.getElementById('category-en-form')?.reset();
  document.getElementById('ct-category-id').value = '';
  document.getElementById('ct-new-preview').innerHTML = '';
  document.getElementById('ct-current-image').innerHTML = '';
  document.getElementById('ct-delete-btn').style.display = 'none';
  document.getElementById('category-en-status').textContent = '';
  document.getElementById('category-en-form-container').style.display = 'none';
  ctCurrentImageUrl = null;
}

function renderCtCurrentImage(url) {
  const wrap = document.getElementById('ct-current-image');
  if (!wrap) return;
  wrap.innerHTML = '';
  ctCurrentImageUrl = url || null;
  if (!ctCurrentImageUrl) return;
  const item = document.createElement('div');
  item.className = 'admin-img-preview-item';
  item.innerHTML = `
    <img src="${ctCurrentImageUrl}" alt="">
    <div class="admin-img-preview-overlay">
      <button type="button" class="admin-btn-icon danger remove-ct-current" title="Quitar imagen">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  `;
  item.querySelector('.remove-ct-current').addEventListener('click', () => {
    renderCtCurrentImage('');
  });
  wrap.appendChild(item);
}

function renderCtNewPreview(files) {
  const wrap = document.getElementById('ct-new-preview');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!files || files.length === 0) return;
  const f = files[0];
  const url = URL.createObjectURL(f);
  const item = document.createElement('div');
  item.className = 'admin-img-preview-item';
  item.innerHTML = `
    <img src="${url}" alt="${f.name}">
    <div class="admin-img-preview-overlay">
      <span style="font-size:0.65rem; color:var(--admin-text-muted); font-weight:600;">NUEVA</span>
    </div>
  `;
  wrap.appendChild(item);
}

window.__loadContactsPage = (p) => loadContacts(p);
