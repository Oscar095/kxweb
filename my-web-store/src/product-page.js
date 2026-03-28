import { renderHeader } from './components/header.js?v=24.0';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from './services/cart-service.js';
import { formatMoney } from './utils/format.js';

function parseProductDescription(text) {
  if (!text) return { subtitle: '', specsHtml: '', recommendationsHtml: '', brandHtml: '', remainingHtml: '' };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { subtitle: '', specsHtml: '', recommendationsHtml: '', brandHtml: '', remainingHtml: '' };

  // 1. Breve inicial (primera línea)
  const subtitle = lines[0];
  let remainingLines = lines.slice(1);

  // Expresiones regulares para detectar las diferentes secciones
  const specRegex = /^(Material|Capacidad[\s\w]*|Cantidad por caja|Cantidad|Calibre):\s*(.*)$/i;
  const recomTitleRegex = /^Recomendaciones de uso:$/i;
  const brandRegex = /^Elegir KOS Colombia es elegir consciencia\.$/i;

  let specs = [];
  let recommendations = [];
  let hasRecommendationsTitle = false;
  let brandText = [];
  let otherText = [];

  let currentSection = 'normal'; // 'normal', 'recommendations', 'brand', 'material_specs'
  let currentSpecLabel = null;

  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i];

    // Detectar bloque de marca (KOS Colombia)
    if (brandRegex.test(line) || currentSection === 'brand') {
      currentSection = 'brand';
      brandText.push(line);
      continue;
    }

    // Detectar Inicio de Recomendaciones de uso
    if (recomTitleRegex.test(line)) {
      currentSection = 'recommendations';
      hasRecommendationsTitle = true;
      continue;
    }

    // Procesar lineas dentro de Recomendaciones
    if (currentSection === 'recommendations') {
      let recomLine = line.replace(/^-\s*/, '').trim();
      if (recomLine) recommendations.push(recomLine);
      continue;
    }

    // Detectar Especificaciones Técnicas (las principales)
    const specMatch = line.match(specRegex);
    if (specMatch && currentSection !== 'recommendations') {
      currentSpecLabel = specMatch[1];

      // Si el valor está en la misma línea lo guardamos
      let specValue = specMatch[2].trim();

      // Si el valor está en la línea siguiente (se dejó en blanco en esta línea)
      // Pero no avanzamos i todavía, solo "espiamos". OJO con viñetas.
      if (!specValue && (i + 1) < remainingLines.length) {
        let nextLine = remainingLines[i + 1];
        // Si la siguiente línea no es un subtítulo o viñeta, asumimos que es el valor
        if (!specRegex.test(nextLine) && !recomTitleRegex.test(nextLine) && !brandRegex.test(nextLine) && !nextLine.startsWith('-')) {
          specValue = nextLine;
          i++; // saltamos esa línea porque ya la procesamos
        }
      }

      specs.push({ label: currentSpecLabel, value: specValue, isSubItem: false });

      // Si la etiqueta era Material o similar, permitimos viñetas sub-items
      if (currentSpecLabel.toLowerCase() === 'material') {
        currentSection = 'material_specs';
      } else {
        currentSection = 'normal';
      }
      continue;
    }

    // Detectar viñetas dentro de especificaciones de Material (Ej: "- Plato de: 23cmx...")
    if (currentSection === 'material_specs' && line.startsWith('-')) {
      // Es un sub-item del material / empaque
      const cleanLine = line.replace(/^-\s*/, '').trim();

      // Intentar ver si tiene formato "Etiqueta: valor"
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1) {
        const subLabel = cleanLine.substring(0, colonIdx).trim();
        const subValue = cleanLine.substring(colonIdx + 1).trim();
        specs.push({ label: subLabel, value: subValue, isSubItem: true });
      } else {
        // Si no tiene dos puntos, lo toma como valor de algo sin etiqueta fuerte
        specs.push({ label: '', value: cleanLine, isSubItem: true });
      }
      continue;
    }

    // Si había una sección material_specs y aparece texto suelto... 
    // y no hizo `continue`, ¿es párrafo extra de Material o normal?
    // Según requerimiento de usuario, si material dice "Material:" vacío y luego "Polyboard...", se capta arriba en el 'espiar'.
    // Si quedan líneas extra, pasamos a normal.
    if (currentSection === 'material_specs') {
      currentSection = 'normal';
    }

    //Texto normal (no clasificado en lo anterior)
    otherText.push(line);
  }

  // --- Construcción de HTML ---

  let specsHtml = '';
  let capacityHtml = '';

  if (specs.length > 0) {
    specsHtml += `<div class="pd-tech-specs glass-panel">`;
    specsHtml += `<div class="pd-tech-specs-header">ESPECIFICACIONES TÉCNICAS</div>`;
    specsHtml += `<div class="pd-tech-specs-grid">`;
    specs.forEach(s => {
      if (s.isSubItem) {
        specsHtml += `
            <div class="pd-spec-item pd-spec-subitem" style="grid-column: 1 / -1; padding-left: 12px; border-left: 2px solid var(--primary, #009FE3); margin-top: -10px; margin-bottom: 8px;">
              <span class="pd-spec-label" style="font-size: 0.85rem;">${s.label ? s.label + ':' : ''}</span>
              <span class="pd-spec-value" style="font-size: 0.95rem;">${s.value}</span>
            </div>
          `;
      } else {
        specsHtml += `
            <div class="pd-spec-item">
              <span class="pd-spec-label">${s.label}</span>
              <span class="pd-spec-value">${s.value}</span>
            </div>
          `;
      }
    });
    specsHtml += `</div></div>`;
  }

  let recommendationsHtml = '';
  if (hasRecommendationsTitle || recommendations.length > 0) {
    recommendationsHtml += `<div class="pd-recommendations">`;
    if (hasRecommendationsTitle) {
      recommendationsHtml += `<h3>Recomendaciones de uso</h3>`;
    }
    if (recommendations.length > 0) {
      recommendationsHtml += `<ul>`;
      recommendations.forEach(r => {
        recommendationsHtml += `<li><span class="pd-rec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> <span class="pd-rec-text">${r}</span></li>`;
      });
      recommendationsHtml += `</ul>`;
    }
    recommendationsHtml += `</div>`;
  }

  let brandHtml = '';
  if (brandText.length > 0) {
    brandHtml += `<div class="pd-brand-block" style="margin-top: 32px;">`;
    if (brandRegex.test(brandText[0])) {
      brandHtml += `<h4>${brandText[0]}</h4>`;
      brandText = brandText.slice(1);
    }

    // Agrupar el resto en parrafos
    if (brandText.length > 0) {
      brandText.forEach(p => brandHtml += `<p>${p}</p>`);
    }
    brandHtml += `</div>`;
  }

  let remainingHtml = '';
  if (otherText.length > 0) {
    remainingHtml = `<div class="pd-other-text" style="margin-top:24px; font-weight: 500;"><p>${otherText.join('</p><p>')}</p></div>`;
  }

  return { subtitle, specsHtml, capacityHtml, recommendationsHtml, brandHtml, remainingHtml };
}

function getIdFromQuery() {
  const u = new URL(location.href);
  return Number(u.searchParams.get('id'));
}

async function loadProduct(id) {
  // Intenta endpoint de detalle
  try {
    const r = await fetch(`/api/products/${id}`);
    if (r.ok) return r.json();
  } catch (_) { /* fallback abajo */ }
  // Fallback: carga listado y busca por id (útil si el server no se reinició aún)
  const list = await fetch('/api/products');
  if (!list.ok) throw new Error('No se pudo cargar el producto');
  const products = await list.json();
  const p = products.find(x => Number(x.id) === Number(id));
  if (!p) throw new Error('Producto no encontrado');
  return p;
}

function renderProduct(p) {
  const main = document.getElementById('pd-main');
  const wrap = main.closest('.product-img-wrap');
  const lens = wrap?.querySelector('.img-lens');
  const prevBtn = wrap?.querySelector('.img-prev');
  const nextBtn = wrap?.querySelector('.img-next');
  const thumbs = document.getElementById('pd-thumbs');
  const name = document.getElementById('pd-name');
  const cat = document.getElementById('pd-category');
  const price = document.getElementById('pd-price');
  const stock = document.getElementById('pd-stock');
  const desc = document.getElementById('pd-desc');
  const addBtn = document.getElementById('pd-add');
  const qtyInput = document.getElementById('pd-qty');

  let upstreamEstado = null; // 'En Existencia' | 'Agotado' | null
  let inventarioExistencia = null; // number (unidades)

  const setCartEnabled = (enabled, reason) => {
    if (addBtn) {
      addBtn.disabled = !enabled;
      addBtn.title = enabled ? '' : (reason || 'No disponible');
      if (!enabled) {
        addBtn.style.setProperty('opacity', '0.5', 'important');
        addBtn.style.setProperty('pointer-events', 'none', 'important');
        addBtn.style.setProperty('cursor', 'not-allowed', 'important');
      } else {
        addBtn.style.removeProperty('opacity');
        addBtn.style.removeProperty('pointer-events');
        addBtn.style.removeProperty('cursor');
      }
    }
  };

  const getUnitsPerBox = () => {
    const raw = p.cantidad ?? p.Cantidad ?? 1000;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 1000;
  };

  const getRequestedBoxes = () => {
    const n = Number(qtyInput?.value);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.floor(n);
  };

  const exceedsInventory = () => {
    if (!Number.isFinite(inventarioExistencia)) return false;
    const boxes = getRequestedBoxes();
    const unitsPerBox = getUnitsPerBox();
    const requestedUnits = boxes * unitsPerBox;
    return requestedUnits > inventarioExistencia;
  };

  const renderStockAndCartState = () => {
    if (!stock) return;

    // Sin inventario consultado aún
    if (upstreamEstado == null) return;

    // Upstream dice agotado
    if (upstreamEstado !== 'En Existencia') {
      stock.textContent = 'Producto agotado';
      stock.className = 'pd-stock pd-stock--out';
      setCartEnabled(false, 'Producto agotado');
      return;
    }

    // Hay inventario: validar cantidad solicitada
    if (exceedsInventory()) {
      stock.textContent = 'Agotado';
      stock.className = 'pd-stock pd-stock--out';
      setCartEnabled(false, 'Agotado');
      return;
    }

    stock.textContent = 'En Existencia';
    stock.className = 'pd-stock pd-stock--ok';
    setCartEnabled(true);
  };

  name.textContent = p.name || '';
  // Mostrar el nombre de la categoría si está disponible
  let categoriaNombre = '';
  if (typeof p.category === 'object' && p.category !== null) {
    categoriaNombre = p.category.name || p.category.nombre || p.category.id || '';
  } else {
    categoriaNombre = p.category_name || p.category_nombre || p.category || '';
  }
  cat.textContent = categoriaNombre ? `Categoría: ${categoriaNombre}` : '';
  // Mostrar precio por caja = precio unitario * cantidad (si está disponible)
  const cantidadNum = (p.cantidad ?? p.Cantidad) ? Number(p.cantidad ?? p.Cantidad) : null;
  const unitarioRaw = p.price_unit ?? p.precio_unitario ?? null;
  const unitario = unitarioRaw != null ? Number(unitarioRaw) : (cantidadNum && p.price ? Number(p.price) / cantidadNum : null);
  const precioCajaInicial = (Number.isFinite(unitario) && cantidadNum) ? (unitario * cantidadNum) : Number(p.price || 0);
  const precioConIvaInicial = Math.round(precioCajaInicial * 1.19);
  price.innerHTML = '$' + formatMoney(precioConIvaInicial) + ' <span style="font-size:0.75rem;color:#666;">/ caja</span> <span style="font-size:0.7rem;color:#4CAF50;font-weight:600;">IVA incluido</span>';
  price.dataset.codigo = p.codigo || '';

  const subtitleEl = document.getElementById('pd-subtitle');
  const descLeft = document.getElementById('pd-desc-left');

  if (p.description) {
    const parsed = parseProductDescription(p.description);

    if (subtitleEl) {
      subtitleEl.textContent = parsed.subtitle;
    }

    desc.innerHTML = `
        ${parsed.specsHtml}
        ${parsed.remainingHtml}
      `;

    if (descLeft) {
      descLeft.innerHTML = `
        ${parsed.recommendationsHtml}
        ${parsed.brandHtml}
      `;
    }
  } else {
    desc.textContent = '';
    if (subtitleEl) subtitleEl.textContent = '';
    if (descLeft) descLeft.innerHTML = '';
  }

  // Inventario por SKU (codigo_siesa)
  if (stock) {
    const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || '').toString().trim();
    if (!sku) {
      stock.textContent = '';
      stock.className = 'pd-stock';
      upstreamEstado = null;
      inventarioExistencia = null;
      setCartEnabled(true);
    } else {
      stock.textContent = 'Consultando inventario...';
      stock.className = 'pd-stock pd-stock--loading';
      upstreamEstado = null;
      inventarioExistencia = null;
      setCartEnabled(false, 'Consultando inventario...');
      fetch(`/api/inventario/${encodeURIComponent(sku)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('inventario_error');
          return r.json();
        })
        .then((data) => {
          const estado = (data && (data.estado || data.status || '')).toString();
          if (estado === 'En Existencia') {
            upstreamEstado = 'En Existencia';
            inventarioExistencia = Number(data?.inventario);
            renderStockAndCartState();
          } else if (data.error === 'upstream_error' || data.error === 'timeout') {
            // En caso de error de servidor, bloquear por seguridad
            stock.textContent = 'Producto agotado';
            stock.className = 'pd-stock pd-stock--out';
            upstreamEstado = 'Agotado';
            setCartEnabled(false, 'Producto agotado');
          } else {
            upstreamEstado = 'Agotado';
            inventarioExistencia = Number(data?.inventario);
            renderStockAndCartState();
          }
        })
        .catch(() => {
          stock.textContent = 'Producto agotado';
          stock.className = 'pd-stock pd-stock--out';
          upstreamEstado = 'Agotado';
          setCartEnabled(false, 'Producto agotado');
        });
    }
  }

  const imgs = Array.isArray(p.images) && p.images.length ? p.images : [p.image || '/images/placeholder.svg'];
  let idx = 0;
  main.src = imgs[idx];
  main.onerror = () => { main.src = '/images/placeholder.svg'; };
  if (lens) lens.style.backgroundImage = `url("${main.src}")`;

  thumbs.innerHTML = imgs.map((src, i) => `<img data-index="${i}" src="${src}" alt="${p.name || ''} ${i + 1}" />`).join('');
  thumbs.addEventListener('click', (e) => {
    const im = e.target.closest('img');
    if (!im || !thumbs.contains(im)) return;
    idx = Number(im.dataset.index || 0);
    main.src = imgs[idx];
    if (lens) lens.style.backgroundImage = `url("${main.src}")`;
  });

  // Prev/Next navigation
  const updateMain = () => {
    main.src = imgs[idx];
    if (lens) lens.style.backgroundImage = `url("${main.src}")`;
  };
  prevBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    idx = (idx - 1 + imgs.length) % imgs.length;
    updateMain();
  });
  nextBtn?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    idx = (idx + 1) % imgs.length;
    updateMain();
  });

  async function recalcDetail() {
    const codigo = price.dataset.codigo;
    if (!codigo) return; // sin código no recalcula
    const mult = Number(qtyInput.value);
    if (!Number.isFinite(mult) || mult <= 0) return;
    try {
      price.classList.add('loading');
      const r = await fetch(`/api/precio?codigo=${encodeURIComponent(codigo)}&n=${encodeURIComponent(mult)}`);
      if (!r.ok) {
        try { const e = await r.json(); console.warn('Detalle precio dinámico error', e); } catch { }
        price.classList.remove('loading');
        return;
      }
      const data = await r.json();
      const BOX_SIZE = 1000;
      let unitario = Number(data.precioUnitario);
      if (!Number.isFinite(unitario) || unitario <= 0) {
        const totalEscalon = Number(data.precio);
        const escalon = Number(data.escalonUsado);
        if (Number.isFinite(totalEscalon) && Number.isFinite(escalon) && escalon > 0) {
          unitario = totalEscalon / escalon;
        }
      }
      if (!Number.isFinite(unitario) || unitario <= 0) {
        // fallback: usar p.price / BOX_SIZE
        unitario = Number(p.price) / BOX_SIZE;
      }
      const precioCaja = unitario * BOX_SIZE;
      const precioConIva = Math.round(precioCaja * 1.19);
      price.innerHTML = '$' + formatMoney(precioConIva) + ' <span style="font-size:0.75rem;color:#666;">/ caja</span> <span style="font-size:0.7rem;color:#4CAF50;font-weight:600;">IVA incluido</span>';
      price.classList.remove('loading');
    } catch { price.classList.remove('loading'); }
  }
  qtyInput?.addEventListener('input', () => { clearTimeout(qtyInput._t); qtyInput._t = setTimeout(recalcDetail, 180); });
  qtyInput?.addEventListener('input', () => {
    // Revalidar disponibilidad en base a inventario
    // (si el usuario pide más cajas que la existencia en unidades)
    renderStockAndCartState();
  });
  recalcDetail();

  addBtn?.addEventListener('click', () => {
    // Chequeo final antes de agregar
    if (upstreamEstado !== 'En Existencia') {
      showToast('Producto Agotado', 'error');
      return;
    }
    if (exceedsInventory()) {
      showToast('Producto Agotado', 'error');
      renderStockAndCartState();
      return;
    }
    const qty = Math.max(1, Number(document.getElementById('pd-qty').value) || 1);
    cartService.add(p, qty);
    window.dispatchEvent(new Event('toggle-cart'));
    showToast('Agregado Exitosamente');
  });
}

// Toast notification system
const showToast = (msg, type = 'success') => {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  toast.className = type === 'error' ? 'toast-error' : 'toast-success';
  toast.textContent = msg;

  root.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('visible'), 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
};

// --- Productos Complementarios ---
async function renderComplementaryProducts(currentProduct) {
  const container = document.getElementById('pd-complementary');
  if (!container) return;

  try {
    const res = await fetch('/api/products');
    if (!res.ok) return;
    const allProducts = await res.json();

    // Excluir el actual y agotados/inactivos
    const candidates = allProducts.filter(x =>
      Number(x.id) !== Number(currentProduct.id) &&
      x.active !== false &&
      x.estado !== 'Agotado'
    );

    let catName = '';
    if (typeof currentProduct.category === 'object' && currentProduct.category !== null) {
      catName = currentProduct.category.name || currentProduct.category.nombre || currentProduct.category.id || '';
    } else {
      catName = currentProduct.category_name || currentProduct.category_nombre || currentProduct.category || '';
    }
    catName = catName.toString().toLowerCase();

    let related = [];
    // Heurística de complementariedad
    if (catName.includes('vaso')) {
      related = candidates.filter(x => {
        const cn = (x.category?.nombre || x.category_name || '').toLowerCase();
        return cn.includes('tapa') || cn.includes('portavaso');
      });
    } else if (catName.includes('tapa')) {
      related = candidates.filter(x => {
        const cn = (x.category?.nombre || x.category_name || '').toLowerCase();
        return cn.includes('vaso') || cn.includes('contenedor');
      });
    } else if (catName.includes('contenedor') || catName.includes('plato')) {
      related = candidates.filter(x => {
        const cn = (x.category?.nombre || x.category_name || '').toLowerCase();
        return cn.includes('tapa') || cn.includes('cubierto') || cn.includes('empaque');
      });
    }

    // Fallback: misma categoría si no hay complementos específicos
    if (related.length === 0) {
      related = candidates.filter(x => {
        const cn = (x.category?.nombre || x.category_name || '').toLowerCase();
        return cn === catName;
      });
    }

    // Mezclar aleatoriamente y tomar máximo 2
    related.sort(() => Math.random() - 0.5);
    related = related.slice(0, 2);

    if (related.length === 0) return;

    let html = `
      <div class="pd-comp-header">Complementa tu compra</div>
      <div class="pd-comp-grid">
    `;

    related.forEach(p => {
      const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || '/images/placeholder.svg');
      const name = p.name || 'Producto';
      // Precio unitario aproximado o precio base
      let priceText = '';
      if (p.price) {
        priceText = '$' + formatMoney(Math.round(Number(p.price) * 1.19));
      }

      // Enlace: asume que la vista de producto es product.html
      html += `
        <a href="product.html?id=${p.id}" class="pd-comp-card">
          <div class="pd-comp-img">
            <img src="${img}" alt="${name}" loading="lazy" />
          </div>
          <div class="pd-comp-info">
            <h4 class="pd-comp-name">${name}</h4>
            <div class="pd-comp-price">${priceText}</div>
          </div>
        </a>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

  } catch (err) {
    console.error("Error cargando complementarios:", err);
  }
}

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));
  const id = getIdFromQuery();
  if (!Number.isFinite(id)) {
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">ID inválido</div>';
    return;
  }
  try {
    const p = await loadProduct(id);
    renderProduct(p);
    renderComplementaryProducts(p);
    // Setup lens effects on detail page
    const wrap = document.querySelector('.pd-gallery .product-img-wrap');
    const main = document.getElementById('pd-main');
    const lens = wrap?.querySelector('.img-lens');
    if (wrap && main && lens) {
      const showLens = () => { lens.style.display = 'block'; lens.style.backgroundImage = `url("${main.src}")`; };
      const hideLens = () => { lens.style.display = 'none'; };
      const moveLens = (clientX, clientY) => {
        const wrapRect = wrap.getBoundingClientRect();
        const imgRect = main.getBoundingClientRect();
        const lw = lens.offsetWidth;
        const lh = lens.offsetHeight;
        let left = clientX - wrapRect.left - lw / 2;
        let top = clientY - wrapRect.top - lh / 2;
        left = Math.max(0, Math.min(left, wrapRect.width - lw));
        top = Math.max(0, Math.min(top, wrapRect.height - lh));
        lens.style.left = left + 'px';
        lens.style.top = top + 'px';
        let relX = clientX - imgRect.left;
        let relY = clientY - imgRect.top;
        relX = Math.max(0, Math.min(relX, imgRect.width));
        relY = Math.max(0, Math.min(relY, imgRect.height));
        const pctX = (relX / imgRect.width) * 100;
        const pctY = (relY / imgRect.height) * 100;
        lens.style.backgroundPosition = pctX + '% ' + pctY + '%';
      };

      wrap.addEventListener('mouseover', () => showLens());
      wrap.addEventListener('mouseout', (e) => {
        if (wrap.contains(e.relatedTarget)) return;
        hideLens();
      });
      wrap.addEventListener('mousemove', (e) => moveLens(e.clientX, e.clientY));
      wrap.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        showLens();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchmove', (e) => {
        if (e.target.closest('button')) return;
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchend', () => hideLens());
    }
  } catch (e) {
    console.error(e);
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">Producto no encontrado</div>';
  }
}

init();
