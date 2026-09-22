#!/usr/bin/env node
/**
 * generate-feed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera un feed XML compatible con Google Merchant Center (RSS 2.0 + g: namespace).
 *
 * Fuentes de datos (en orden de prioridad):
 *   1. SQL Server directo  → lee TODOS los productos activos sin ningún límite
 *   2. API live            → http://localhost:3000/api/products (si el server está corriendo)
 *   3. Fallback local      → data/products.json (última caché guardada)
 *
 * La consulta SQL NO tiene TOP, LIMIT, ni slice — devuelve la tabla completa.
 *
 * Uso:
 *   node generate-feed.js              → guarda en src/feed.xml
 *   node generate-feed.js --out <ruta> → salida personalizada
 *   node generate-feed.js --watch      → regenera cuando cambia products.json
 *   node generate-feed.js --source api → fuerza uso de la API (omite SQL directo)
 *   node generate-feed.js --source json→ fuerza uso del JSON local
 *   node generate-feed.js --dry-run    → imprime resumen sin escribir feed.xml
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const https = require('https');

// ─── Configuración ────────────────────────────────────────────────────────────

const BASE_URL    = 'https://kosxpress.com';
const STORE_TITLE = 'KosXpress - Empaques Desechables';
const STORE_DESC  = 'Empaques desechables y biodegradables para empresas en Colombia. Vasos, platos, porta comidas y más.';
const BRAND       = 'KosXpress';
const CONDITION   = 'new';
const CURRENCY    = 'COP';

const DATA_FILE   = path.resolve(__dirname, 'data', 'products.json');
const DEFAULT_OUT = path.resolve(__dirname, 'src', 'feed.xml');
const API_URL     = 'http://localhost:3000/api/products';

// ─── Helpers XML ─────────────────────────────────────────────────────────────

function escapeXml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(str) {
  if (!str) return '';
  // Neutraliza cualquier "]]>" dentro del texto para no romper CDATA
  return `<![CDATA[${String(str).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

// ─── Fuente 1: SQL Server directo ─────────────────────────────────────────────

/**
 * Lee TODOS los productos activos directamente desde SQL Server.
 * Sin TOP, sin LIMIT, sin paginación — tabla completa.
 *
 * Consulta verificada:
 *   SELECT p.*, c.descripcion AS category_name, te.descripcion AS empaque_descripcion
 *   FROM dbo.products p
 *   LEFT JOIN dbo.categories c ON p.category = c.Id
 *   LEFT JOIN dbo.tipos_empaques te ON p.row_empaque = te.id
 *   WHERE p.habilitado = 1 AND p.price_unit > 0
 *   ORDER BY p.id
 *
 * No hay TOP, LIMIT, FETCH NEXT, ni ninguna cláusula de restricción de filas.
 */
async function fetchFromDb() {
  let sql;
  try {
    sql = require('mssql');
  } catch (e) {
    console.warn('[feed] mssql no disponible, omitiendo fuente DB directa.');
    return null;
  }

  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '.env.local') });
  dotenv.config({ path: path.resolve(__dirname, '.env') });

  const config = {
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server:   process.env.SERVER,
    database: process.env.DB_NAME,
    options:  { encrypt: true, enableArithAbort: true },
    pool:     { max: 3, min: 0, idleTimeoutMillis: 10000 },
    connectionTimeout: 15000,
    requestTimeout:    30000
  };

  if (!config.user || !config.server || !config.database) {
    console.warn('[feed] Variables DB_USER / SERVER / DB_NAME no configuradas, omitiendo DB directa.');
    return null;
  }

  let pool;
  try {
    console.log(`[feed] 🔌 Conectando a SQL Server: ${config.server} / ${config.database}`);
    pool = await sql.connect(config);

    // ── CONSULTA COMPLETA SIN NINGÚN LÍMITE ──────────────────────────────────
    // No hay TOP, LIMIT, FETCH NEXT ni OFFSET.
    // WHERE filtra solo productos habilitados y con precio mayor a 0.
    // ORDER BY p.id garantiza orden estable.
    const result = await pool.request().query(`
      SELECT
        p.id,
        p.codigo_siesa,
        p.name,
        p.price_unit,
        p.description,
        p.images,
        p.image2,
        p.image3,
        p.image4,
        p.habilitado,
        p.es_personalizado,
        p.category,
        p.row_empaque,
        c.descripcion  AS category_name,
        te.descripcion AS empaque_descripcion,
        q.cantidad     AS cantidad
      FROM dbo.products p
      LEFT JOIN dbo.categories      c  ON p.category   = c.Id
      LEFT JOIN dbo.tipos_empaques  te ON p.row_empaque = te.id
      LEFT JOIN dbo.cantidad        q  ON q.id          = 1
      WHERE p.habilitado = 1
        AND p.price_unit > 0
      ORDER BY p.id
    `);
    // ─────────────────────────────────────────────────────────────────────────

    const rows = result.recordset || [];

    console.log(`[feed] ✓ SQL Server → ${rows.length} productos activos (habilitado=1, price_unit>0)`);
    console.log(`[feed]   (sin TOP, sin LIMIT, sin slice — tabla completa)`);

    // Mapear al mismo formato que devuelve la API
    const products = rows.map(d => {
      let imgs = [];
      if (d.images) {
        try { imgs = JSON.parse(d.images); } catch { imgs = []; }
      }
      if (d.image2 && !imgs.includes(d.image2)) imgs.push(d.image2);
      if (d.image3 && !imgs.includes(d.image3)) imgs.push(d.image3);
      if (d.image4 && !imgs.includes(d.image4)) imgs.push(d.image4);

      return {
        id:               d.id,
        codigo_siesa:     d.codigo_siesa || '',
        name:             d.name || '',
        price_unit:       d.price_unit != null ? Number(d.price_unit) : null,
        cantidad:         d.cantidad   != null ? Number(d.cantidad)   : null,
        category:         d.category,
        category_name:    d.category_name || '',
        empaque_descripcion: d.empaque_descripcion || '',
        description:      d.description || '',
        habilitado:       !!d.habilitado,
        es_personalizado: !!d.es_personalizado,
        images:           imgs,
        image:            imgs[0] || '',
        image2:           d.image2 || '',
        image3:           d.image3 || '',
        image4:           d.image4 || ''
      };
    });

    return products;

  } catch (e) {
    console.warn(`[feed] Error conectando a SQL Server: ${e.message}`);
    return null;
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
}

// ─── Fuente 2: API live ────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function fetchFromApi() {
  try {
    console.log(`[feed] 🌐 Intentando API: ${API_URL}`);
    const body = await fetchUrl(API_URL);
    const data = JSON.parse(body);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[feed] ✓ API → ${data.length} productos recibidos`);
      return data;
    }
    console.warn('[feed] API devolvió array vacío.');
    return null;
  } catch (e) {
    console.warn(`[feed] API no disponible: ${e.message}`);
    return null;
  }
}

// ─── Fuente 3: JSON local ─────────────────────────────────────────────────────

function readLocalProducts() {
  try {
    const raw  = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[feed] 📄 JSON local → ${data.length} productos en ${DATA_FILE}`);
      return data;
    }
    console.warn('[feed] products.json vacío o no es array.');
    return [];
  } catch (e) {
    console.error(`[feed] Error leyendo ${DATA_FILE}: ${e.message}`);
    return [];
  }
}

function saveLocalCache(products) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`[feed] 💾 Caché local actualizado: ${DATA_FILE}`);
  } catch (e) {
    console.warn(`[feed] No se pudo guardar caché: ${e.message}`);
  }
}

// ─── Normalización de producto ────────────────────────────────────────────────

function normalizeProduct(p) {
  const priceUnit      = Number(p.price_unit || p.price || 0);
  const priceFormatted = `${priceUnit.toFixed(2)} ${CURRENCY}`;

  // ── Imagen principal ──────────────────────────────────────────────────────
  let imageUrl = '';
  if (Array.isArray(p.images) && p.images.length > 0) {
    // Tomar la primera imagen del array (ya incluye image2/3/4)
    imageUrl = p.images.find(u => u && String(u).startsWith('http')) || p.images[0] || '';
  }
  if (!imageUrl && p.image) imageUrl = p.image;

  // Si es relativa, convertir a absoluta
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }

  // ── Disponibilidad ────────────────────────────────────────────────────────
  const availability = (p.habilitado !== false) ? 'in_stock' : 'out_of_stock';

  // ── ID / SKU único ────────────────────────────────────────────────────────
  // Preferir codigo_siesa; si está vacío usar KXP-{id}
  const sku = (p.codigo_siesa && String(p.codigo_siesa).trim())
    ? String(p.codigo_siesa).trim()
    : `KXP-${p.id}`;

  // ── URLs de producto ──────────────────────────────────────────────────────
  // Formato: https://kosxpress.com/product?id=<id>
  const productUrl = `${BASE_URL}/product?id=${p.id}`;

  // ── Textos ────────────────────────────────────────────────────────────────
  const title       = String(p.name || '').trim();
  const description = String(p.description || '').trim() || title;
  const category    = String(p.category_name || p.category || 'Empaques').trim();

  return {
    id:           sku,
    title,
    description,
    link:         productUrl,
    imageLink:    imageUrl,
    availability,
    price:        priceFormatted,
    brand:        BRAND,
    condition:    CONDITION,
    category,
    // para logging
    _productId:  p.id,
    _rawPrice:   priceUnit,
    _hasImage:   !!imageUrl
  };
}

// ─── Construcción del XML ─────────────────────────────────────────────────────

function buildXml(products) {
  const now = new Date().toUTCString();

  // Filtro de seguridad (la DB ya filtra, pero por si viene de la API o del JSON)
  const valid = products.filter(p => {
    const price = Number(p.price_unit || p.price || 0);
    return p.habilitado !== false && price > 0;
  });

  const skipped = products.length - valid.length;
  if (skipped > 0) {
    console.log(`[feed]   Filtrados ${skipped} productos sin precio o deshabilitados.`);
  }

  const items = valid.map(normalizeProduct);

  // ── Log de verificación de URLs e imágenes ────────────────────────────────
  const sinImagen = items.filter(i => !i._hasImage);
  if (sinImagen.length > 0) {
    console.warn(`[feed] ⚠ ${sinImagen.length} producto(s) sin imagen:`);
    sinImagen.forEach(i => console.warn(`       → id=${i._productId} "${i.title}"`));
  } else {
    console.log(`[feed]   Todos los productos tienen imagen ✓`);
  }

  console.log(`[feed]   Muestra de URLs generadas:`);
  items.slice(0, 3).forEach(i => {
    console.log(`         [id=${i._productId}] link=${i.link}`);
    console.log(`                  image=${i.imageLink || '(sin imagen)'}`);
  });

  const itemsXml = items.map(item => `
    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:title>${cdata(item.title)}</g:title>
      <g:description>${cdata(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:availability>${escapeXml(item.availability)}</g:availability>
      <g:price>${escapeXml(item.price)}</g:price>
      <g:brand>${escapeXml(item.brand)}</g:brand>
      <g:condition>${escapeXml(item.condition)}</g:condition>
      <g:google_product_category>${escapeXml(item.category)}</g:google_product_category>
    </item>`
  ).join('\n');

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(STORE_TITLE)}</title>
    <link>${escapeXml(BASE_URL)}</link>
    <description>${escapeXml(STORE_DESC)}</description>
    <language>es-co</language>
    <lastBuildDate>${now}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`,
    count: items.length
  };
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

async function generate(outFile, opts = {}) {
  const { dryRun = false, forceSource = null } = opts;

  console.log('\n[feed] ════════════════════════════════════════════════════');
  console.log('[feed] 🚀 Generando feed Google Merchant Center...');
  console.log(`[feed]    Salida: ${outFile}`);
  console.log('[feed] ════════════════════════════════════════════════════');

  let products   = null;
  let sourceUsed = '';

  if (forceSource === 'json') {
    products   = readLocalProducts();
    sourceUsed = 'JSON local (forzado)';

  } else if (forceSource === 'api') {
    products   = await fetchFromApi();
    sourceUsed = 'API live (forzado)';
    if (products) saveLocalCache(products);

  } else {
    // Orden de prioridad: DB directa → API → JSON local
    products = await fetchFromDb();
    if (products) {
      sourceUsed = 'SQL Server directo';
      saveLocalCache(products);
    } else {
      products = await fetchFromApi();
      if (products) {
        sourceUsed = 'API live';
        saveLocalCache(products);
      } else {
        products   = readLocalProducts();
        sourceUsed = 'JSON local (fallback)';
      }
    }
  }

  if (!products || products.length === 0) {
    console.error('[feed] ✗ Sin productos. El feed NO fue generado.');
    process.exit(1);
  }

  console.log(`[feed]   Fuente usada: ${sourceUsed}`);
  console.log(`[feed]   Total de productos recibidos: ${products.length}`);

  const { xml, count } = buildXml(products);

  if (dryRun) {
    console.log('\n[feed] 🔍 DRY-RUN — feed.xml NO escrito.');
    console.log(`[feed]    Items que se generarían: ${count}`);
    return;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, xml, 'utf8');

  const sizeKb = (Buffer.byteLength(xml, 'utf8') / 1024).toFixed(1);

  console.log('\n[feed] ════════════════════════════════════════════════════');
  console.log(`[feed] ✅ feed.xml generado correctamente`);
  console.log(`[feed]    Archivo  : ${outFile}`);
  console.log(`[feed]    Items    : ${count} productos`);
  console.log(`[feed]    Tamaño   : ${sizeKb} KB`);
  console.log(`[feed]    URL pública: ${BASE_URL}/feed.xml`);
  console.log('[feed] ════════════════════════════════════════════════════\n');
}

// ─── Modo watch ────────────────────────────────────────────────────────────────

function startWatch(outFile, opts) {
  console.log(`[feed] 👁  Modo watch — observando: ${DATA_FILE}`);
  console.log('[feed]    Ctrl+C para detener.\n');
  let debounce = null;
  fs.watchFile(DATA_FILE, { interval: 2000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('[feed] 🔄 Cambio detectado en products.json — regenerando...');
      clearTimeout(debounce);
      debounce = setTimeout(() => generate(outFile, opts), 500);
    }
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

(async () => {
  const args        = process.argv.slice(2);
  const watchMode   = args.includes('--watch') || args.includes('-w');
  const dryRun      = args.includes('--dry-run');
  const srcIdx      = args.indexOf('--source');
  const forceSource = srcIdx !== -1 ? args[srcIdx + 1] : null;
  const outIdx      = args.indexOf('--out');
  const outFile     = outIdx !== -1 && args[outIdx + 1]
    ? path.resolve(args[outIdx + 1])
    : DEFAULT_OUT;

  const opts = { dryRun, forceSource };

  await generate(outFile, opts);

  if (watchMode) startWatch(outFile, opts);
})();
