import { renderHeader } from './components/header.js?v=999';
import { renderCartDrawer } from './components/cart-drawer.js';
import { cartService } from '../services/cart-service.js';
import { formatMoney } from '../utils/format.js';
import { SITE_CONFIG } from '../utils/config.js';
import { withEnglishCopy, withEnglishCopyList } from './utils/product-i18n.js';

function parseProductDescription(text) {
  if (!text) return { subtitle: '', specsHtml: '', recommendationsHtml: '', brandHtml: '', remainingHtml: '' };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { subtitle: '', specsHtml: '', recommendationsHtml: '', brandHtml: '', remainingHtml: '' };

  // 1. Initial short desc (first line)
  const subtitle = lines[0];
  let remainingLines = lines.slice(1);

  // Regex to detect different sections in the Spanish database values
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

    // Detect KOS brand block
    if (brandRegex.test(line) || currentSection === 'brand') {
      currentSection = 'brand';
      brandText.push(line);
      continue;
    }

    // Detect recommendations section start
    if (recomTitleRegex.test(line)) {
      currentSection = 'recommendations';
      hasRecommendationsTitle = true;
      continue;
    }

    // Process recommendation lines
    if (currentSection === 'recommendations') {
      let recomLine = line.replace(/^-\s*/, '').trim();
      if (recomLine) recommendations.push(recomLine);
      continue;
    }

    // Detect technical specs (main ones)
    const specMatch = line.match(specRegex);
    if (specMatch && currentSection !== 'recommendations') {
      currentSpecLabel = specMatch[1];

      // If value is on the same line, save it
      let specValue = specMatch[2].trim();

      // If value is on the next line (blank on this line)
      if (!specValue && (i + 1) < remainingLines.length) {
        let nextLine = remainingLines[i + 1];
        if (!specRegex.test(nextLine) && !recomTitleRegex.test(nextLine) && !brandRegex.test(nextLine) && !nextLine.startsWith('-')) {
          specValue = nextLine;
          i++; // skip next line as it was processed
        }
      }

      specs.push({ label: currentSpecLabel, value: specValue, isSubItem: false });

      if (currentSpecLabel.toLowerCase() === 'material') {
        currentSection = 'material_specs';
      } else {
        currentSection = 'normal';
      }
      continue;
    }

    // Detect bullet points in material / packaging specs
    if (currentSection === 'material_specs' && line.startsWith('-')) {
      const cleanLine = line.replace(/^-\s*/, '').trim();
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1) {
        const subLabel = cleanLine.substring(0, colonIdx).trim();
        const subValue = cleanLine.substring(colonIdx + 1).trim();
        specs.push({ label: subLabel, value: subValue, isSubItem: true });
      } else {
        specs.push({ label: '', value: cleanLine, isSubItem: true });
      }
      continue;
    }

    if (currentSection === 'material_specs') {
      currentSection = 'normal';
    }

    otherText.push(line);
  }

  // --- HTML Build ---

  let specsHtml = '';
  let capacityHtml = '';

  if (specs.length > 0) {
    specsHtml += `<div class="pd-tech-specs glass-panel">`;
    specsHtml += `<div class="pd-tech-specs-header">TECHNICAL SPECIFICATIONS</div>`;
    specsHtml += `<div class="pd-tech-specs-grid">`;
    specs.forEach(s => {
      // Translate the spec labels dynamically to English
      let label = s.label;
      if (label) {
        const lLower = label.toLowerCase();
        if (lLower === 'material') label = 'Material';
        else if (lLower.includes('capacidad')) label = 'Capacity';
        else if (lLower.includes('cantidad por caja')) label = 'Quantity per box';
        else if (lLower.includes('cantidad')) label = 'Quantity';
        else if (lLower.includes('calibre')) label = 'Gauge';
      }

      if (s.isSubItem) {
        specsHtml += `
            <div class="pd-spec-item pd-spec-subitem" style="grid-column: 1 / -1; padding-left: 12px; border-left: 2px solid var(--primary, #009FE3); margin-top: -10px; margin-bottom: 8px;">
              <span class="pd-spec-label" style="font-size: 0.85rem;">${label ? label + ':' : ''}</span>
              <span class="pd-spec-value" style="font-size: 0.95rem;">${s.value}</span>
            </div>
          `;
      } else {
        specsHtml += `
            <div class="pd-spec-item">
              <span class="pd-spec-label">${label}</span>
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
    recommendationsHtml += `<h3>Recommendations for use</h3>`;
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
    brandHtml += `<h4>Choosing KOS Colombia is choosing awareness.</h4>`;
    const brandBody = brandText.slice(1);
    if (brandBody.length > 0) {
      brandBody.forEach(p => brandHtml += `<p>${p}</p>`);
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
  try {
    const r = await fetch(`/api/products/${id}`);
    if (r.ok) return withEnglishCopy(await r.json());
  } catch (_) {}
  const list = await fetch('/api/products');
  if (!list.ok) throw new Error('Could not load product');
  const products = await list.json();
  const p = products.find(x => Number(x.id) === Number(id));
  if (!p) throw new Error('Product not found');
  return withEnglishCopy(p);
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
      addBtn.title = enabled ? '' : (reason || 'Not available');
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
    if (upstreamEstado == null) return;

    if (upstreamEstado !== 'En Existencia') {
      stock.textContent = 'Product out of stock';
      stock.className = 'pd-stock pd-stock--out';
      setCartEnabled(false, 'Product out of stock');
      return;
    }

    if (exceedsInventory()) {
      stock.textContent = 'Out of Stock';
      stock.className = 'pd-stock pd-stock--out';
      setCartEnabled(false, 'Out of Stock');
      return;
    }

    stock.textContent = 'In Stock';
    stock.className = 'pd-stock pd-stock--ok';
    setCartEnabled(true);
  };

  name.textContent = p.name || '';

  let categoriaNombre = '';
  if (typeof p.category === 'object' && p.category !== null) {
    categoriaNombre = p.category.name || p.category.nombre || p.category.id || '';
  } else {
    categoriaNombre = p.category_name || p.category_nombre || p.category || '';
  }
  const catLower = categoriaNombre.toLowerCase();
  let translatedCat = categoriaNombre;
  if (catLower.includes('vaso')) translatedCat = 'Cups';
  else if (catLower.includes('tapa')) translatedCat = 'Lids';
  else if (catLower.includes('contenedor')) translatedCat = 'Food Tubs';
  else if (catLower.includes('porta vaso') || catLower.includes('portavaso')) translatedCat = 'Cup Holders';
  else if (catLower.includes('empaque')) translatedCat = 'Packaging';

  cat.textContent = translatedCat ? `Category: ${translatedCat}` : '';

  const cantidadNum = (p.cantidad ?? p.Cantidad) ? Number(p.cantidad ?? p.Cantidad) : null;
  const unitarioRaw = p.price_unit ?? p.precio_unitario ?? null;
  const unitario = unitarioRaw != null ? Number(unitarioRaw) : (cantidadNum && p.price ? Number(p.price) / cantidadNum : null);
  const precioCajaInicial = (Number.isFinite(unitario) && cantidadNum) ? (unitario * cantidadNum) : Number(p.price || 0);
  const precioConIvaInicial = Math.round(precioCajaInicial * 1.19);
  const labelTextoTop = cantidadNum ? '/ ' + new Intl.NumberFormat('en-US').format(cantidadNum) + ' pcs box' : '/ box';
  price.innerHTML = '$' + formatMoney(precioConIvaInicial) + ` <span style="font-size:0.75rem;color:#666;">${labelTextoTop}</span> <span style="font-size:0.7rem;color:#4CAF50;font-weight:600;">VAT included</span>`;
  price.dataset.codigo = p.codigo || '';

  // SEO
  document.title = `${p.name || 'Product'} — KosXpress | Wholesale Packaging`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.content = `${p.name || 'Product'} — ${p.description ? p.description.substring(0, 120) : 'Disposable and biodegradable packaging'}. Buy wholesale at KosXpress.`;
  }
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogTitle) ogTitle.content = p.name || 'Product - KosXpress';
  if (ogDesc) ogDesc.content = p.description ? p.description.substring(0, 200) : 'Disposable and biodegradable packaging.';
  const mainImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || '');
  if (ogImg && mainImg) ogImg.content = mainImg;

  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.rel = 'canonical';
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.href = `https://kosxpress.com/en/product?id=${p.id}`;

  const existingSchema = document.getElementById('product-schema-ld');
  if (existingSchema) existingSchema.remove();
  const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || '').toString().trim();
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name || '',
    description: p.description ? p.description.substring(0, 300) : '',
    image: mainImg || '',
    sku: sku || undefined,
    brand: {
      '@type': 'Brand',
      name: 'KOS Colombia'
    },
    offers: {
      '@type': 'Offer',
      price: precioConIvaInicial,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'KosXpress'
      },
      url: window.location.href
    }
  };
  if (categoriaNombre) {
    schemaData.category = translatedCat;
  }
  const schemaScript = document.createElement('script');
  schemaScript.id = 'product-schema-ld';
  schemaScript.type = 'application/ld+json';
  schemaScript.textContent = JSON.stringify(schemaData);
  document.head.appendChild(schemaScript);

  const subtitleEl = document.getElementById('pd-subtitle');
  const descLeft = document.getElementById('pd-desc-left');

  // Delivery info badge
  const actionsRow = document.querySelector('.pd-actions-row');
  if (actionsRow && !document.querySelector('.pd-delivery-badge')) {
    const deliveryBadge = document.createElement('div');
    deliveryBadge.className = 'pd-delivery-badge';
    deliveryBadge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
      <span>Delivery <strong>${SITE_CONFIG.DELIVERY_TIME_EN}</strong> to ${SITE_CONFIG.DELIVERY_SCOPE_EN}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#4CAF50;"><polyline points="20 6 9 17 4 12"></polyline></svg>
    `;
    actionsRow.parentNode.insertBefore(deliveryBadge, actionsRow.nextSibling);
  }

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

  // Inventory by SKU
  if (stock) {
    const sku = (p.codigo_siesa || p.sku || p.SKU || p.item_ext || '').toString().trim();
    if (!sku) {
      stock.textContent = '';
      stock.className = 'pd-stock';
      upstreamEstado = null;
      inventarioExistencia = null;
      setCartEnabled(true);
    } else {
      stock.textContent = 'Checking inventory...';
      stock.className = 'pd-stock pd-stock--loading';
      upstreamEstado = null;
      inventarioExistencia = null;
      setCartEnabled(false, 'Checking inventory...');
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
            stock.textContent = 'Product out of stock';
            stock.className = 'pd-stock pd-stock--out';
            upstreamEstado = 'Agotado';
            setCartEnabled(false, 'Product out of stock');
          } else {
            upstreamEstado = 'Agotado';
            inventarioExistencia = Number(data?.inventario);
            renderStockAndCartState();
          }
        })
        .catch(() => {
          stock.textContent = 'Product out of stock';
          stock.className = 'pd-stock pd-stock--out';
          upstreamEstado = 'Agotado';
          setCartEnabled(false, 'Product out of stock');
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

  // --- Mobile Lightbox ---
  if (window.innerWidth <= 900) {
    const lightbox = document.getElementById('pd-lightbox');
    const lbImg = document.getElementById('pd-lightbox-img');
    const lbClose = document.getElementById('pd-lightbox-close');
    const lbPrev = document.getElementById('pd-lightbox-prev');
    const lbNext = document.getElementById('pd-lightbox-next');
    const lbCounter = document.getElementById('pd-lightbox-counter');
    let lbIdx = 0;

    const updateLightbox = () => {
      if (lbImg) lbImg.src = imgs[lbIdx] || '/images/placeholder.svg';
      if (lbCounter && imgs.length > 1) lbCounter.textContent = `${lbIdx + 1} / ${imgs.length}`;
      if (lbPrev) lbPrev.style.display = imgs.length > 1 ? 'flex' : 'none';
      if (lbNext) lbNext.style.display = imgs.length > 1 ? 'flex' : 'none';
    };

    const openLightbox = () => {
      lbIdx = idx;
      updateLightbox();
      if (lightbox) {
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
    };

    const closeLightbox = () => {
      if (lightbox) {
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    };

    if (wrap) {
      wrap.style.cursor = 'zoom-in';
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openLightbox();
      });

      const hint = document.createElement('div');
      hint.className = 'pd-zoom-hint';
      hint.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg> Tap to zoom`;
      wrap.appendChild(hint);
    }

    lbClose?.addEventListener('click', closeLightbox);

    lightbox?.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('pd-lightbox-img-container')) closeLightbox();
    });

    lbPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      lbIdx = (lbIdx - 1 + imgs.length) % imgs.length;
      updateLightbox();
    });
    lbNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      lbIdx = (lbIdx + 1) % imgs.length;
      updateLightbox();
    });
  }

  async function recalcDetail() {
    const codigo = price.dataset.codigo;
    if (!codigo) return;
    const mult = Number(qtyInput.value);
    if (!Number.isFinite(mult) || mult <= 0) return;
    try {
      price.classList.add('loading');
      const r = await fetch(`/api/precio?codigo=${encodeURIComponent(codigo)}&n=${encodeURIComponent(mult)}`);
      if (!r.ok) {
        price.classList.remove('loading');
        return;
      }
      const data = await r.json();
      const upbStr = price.getAttribute('data-cantidad') || p.cantidad || p.Cantidad;
      const BOX_SIZE = (Number.isFinite(Number(upbStr)) && Number(upbStr) > 0) ? Number(upbStr) : 1000;
      let unitario = Number(data.precioUnitario);
      if (!Number.isFinite(unitario) || unitario <= 0) {
        const totalEscalon = Number(data.precio);
        const escalon = Number(data.escalonUsado);
        if (Number.isFinite(totalEscalon) && Number.isFinite(escalon) && escalon > 0) {
          unitario = totalEscalon / escalon;
        }
      }
      if (!Number.isFinite(unitario) || unitario <= 0) {
        const basePrice = Number(p.price_unit ?? p.precio_unitario ?? ((p.price && p.cantidad) ? p.price / p.cantidad : p.price)) || 0;
        unitario = basePrice;
      }
      const precioCaja = unitario * BOX_SIZE;
      const precioConIva = Math.round(precioCaja * 1.19);
      const hasCantidadTop = !!(price.getAttribute('data-cantidad') || p.cantidad || p.Cantidad);
      const labelText = hasCantidadTop ? '/ ' + new Intl.NumberFormat('en-US').format(BOX_SIZE) + ' pcs box' : '/ box';
      price.innerHTML = '$' + formatMoney(precioConIva) + ` <span style="font-size:0.75rem;color:#666;">${labelText}</span> <span style="font-size:0.7rem;color:#4CAF50;font-weight:600;">VAT included</span>`;
      price.classList.remove('loading');
    } catch { price.classList.remove('loading'); }
  }
  qtyInput?.addEventListener('input', () => { clearTimeout(qtyInput._t); qtyInput._t = setTimeout(recalcDetail, 180); });
  qtyInput?.addEventListener('input', () => {
    renderStockAndCartState();
  });
  recalcDetail();

  addBtn?.addEventListener('click', () => {
    if (upstreamEstado !== 'En Existencia') {
      showToast('Product Out of Stock', 'error');
      return;
    }
    if (exceedsInventory()) {
      showToast('Product Out of Stock', 'error');
      renderStockAndCartState();
      return;
    }
    const qty = Math.max(1, Number(document.getElementById('pd-qty').value) || 1);
    cartService.add(p, qty);
    window.dispatchEvent(new Event('toggle-cart'));
    showToast('Added Successfully');
  });
}

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
  setTimeout(() => toast.classList.add('visible'), 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
};

// --- Complementary Products ---
async function renderComplementaryProducts(currentProduct) {
  const container = document.getElementById('pd-complementary');
  if (!container) return;

  try {
    const res = await fetch('/api/products');
    if (!res.ok) return;
    const allProducts = withEnglishCopyList(await res.json());

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

    if (related.length === 0) {
      related = candidates.filter(x => {
        const cn = (x.category?.nombre || x.category_name || '').toLowerCase();
        return cn === catName;
      });
    }

    related.sort(() => Math.random() - 0.5);
    related = related.slice(0, 2);

    if (related.length === 0) return;

    let html = `
      <div class="pd-comp-header">Complete your purchase</div>
      <div class="pd-comp-grid">
    `;

    related.forEach(p => {
      const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || '/images/placeholder.svg');
      const name = p.name || 'Product';
      let priceText = '';
      if (p.price) {
        priceText = '$' + formatMoney(Math.round(Number(p.price) * 1.19));
      }

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
    console.error("Error loading complementary products:", err);
  }
}

async function init() {
  renderHeader(document.getElementById('site-header'));
  renderCartDrawer(document.getElementById('cart-drawer'));
  const id = getIdFromQuery();
  if (!Number.isFinite(id)) {
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">Invalid ID</div>';
    return;
  }
  try {
    const p = await loadProduct(id);
    renderProduct(p);
    renderComplementaryProducts(p);

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
        if (window.innerWidth <= 900) return;
        if (e.target.closest('button')) return;
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        showLens();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchmove', (e) => {
        if (window.innerWidth <= 900) return;
        if (e.target.closest('button')) return;
        const t = e.touches[0];
        if (!t) return; e.preventDefault();
        moveLens(t.clientX, t.clientY);
      }, { passive: false });
      wrap.addEventListener('touchend', () => { if (window.innerWidth <= 900) return; hideLens(); });
    }
  } catch (e) {
    console.error(e);
    document.querySelector('main').innerHTML = '<div style="padding:16px;color:red;">Product not found</div>';
  }
}

init();

if (typeof window !== 'undefined' && !window._qtyStepperGlobalListener) {
  window._qtyStepperGlobalListener = true;
  document.addEventListener('click', (e) => {
    const control = e.target.closest('.qty-control-premium');
    if (control) {
      e.stopPropagation();
      const minus = e.target.closest('.qty-btn-minus');
      const plus = e.target.closest('.qty-btn-plus');
      if (minus) {
        const input = minus.parentElement.querySelector('input');
        if (input) {
          input.value = Math.max(1, Number(input.value) - 1);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (plus) {
        const input = plus.parentElement.querySelector('input');
        if (input) {
          input.value = Number(input.value) + 1;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  });
}
