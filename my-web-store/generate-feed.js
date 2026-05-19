#!/usr/bin/env node
/**
 * generate-feed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera un feed XML compatible con Google Merchant Center (RSS 2.0 + g: namespace).
 *
 * Fuentes de datos (en orden de prioridad):
 *   1. API live en http://localhost:3000/api/products  (si el servidor está corriendo)
 *   2. Fallback: data/products.json  (copia local de los productos)
 *
 * Uso:
 *   node generate-feed.js              → guarda en src/feed.xml  (ruta pública del sitio)
 *   node generate-feed.js --out path   → guarda en la ruta especificada
 *   node generate-feed.js --watch      → regenera automáticamente cuando cambia products.json
 *
 * El feed resultante valida en Google Merchant Center.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ─── Configuración ────────────────────────────────────────────────────────────

const BASE_URL        = 'https://kosxpress.com';
const STORE_TITLE     = 'KosXpress - Empaques Desechables';
const STORE_DESC      = 'Empaques desechables y biodegradables para empresas en Colombia. Vasos, platos, porta comidas y más.';
const BRAND           = 'KosXpress';
const CONDITION       = 'new';
const CURRENCY        = 'COP';

/** Ruta del JSON local (fallback / caché) */
const DATA_FILE = path.resolve(__dirname, 'data', 'products.json');

/** Ruta de salida del XML (dentro de src/ para que el servidor Express lo sirva) */
const DEFAULT_OUT = path.resolve(__dirname, 'src', 'feed.xml');

/** URL de la API local (cuando el servidor está corriendo) */
const API_URL = 'http://localhost:3000/api/products';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escapa caracteres XML especiales fuera de CDATA
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Envuelve texto en CDATA (y escapa el cierre de CDATA si aparece en el texto)
 */
function cdata(str) {
  if (!str) return '';
  // Divide secuencias "]]>" que romperían CDATA
  return `<![CDATA[${String(str).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

/**
 * Hace fetch por HTTP/HTTPS devolviendo una Promise<string>
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

/**
 * Intenta obtener los productos desde la API live.
 * Si falla, retorna null.
 */
async function fetchFromApi() {
  try {
    const body = await fetchUrl(API_URL);
    const data = JSON.parse(body);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[feed] ✓ ${data.length} productos obtenidos desde la API (${API_URL})`);
      return data;
    }
    return null;
  } catch (e) {
    console.warn(`[feed] API no disponible (${e.message}), usando fallback local.`);
    return null;
  }
}

/**
 * Lee los productos desde el JSON local.
 */
function readLocalProducts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[feed] ✓ ${data.length} productos leídos desde ${DATA_FILE}`);
      return data;
    }
    console.warn('[feed] products.json está vacío o no es un array.');
    return [];
  } catch (e) {
    console.error(`[feed] Error leyendo ${DATA_FILE}: ${e.message}`);
    return [];
  }
}

/**
 * Guarda los productos en el JSON local (para mantener caché actualizado)
 */
function saveLocalProducts(products) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`[feed] 💾 Caché local actualizado: ${DATA_FILE}`);
  } catch (e) {
    console.warn(`[feed] No se pudo guardar caché: ${e.message}`);
  }
}

/**
 * Normaliza un producto (tanto de la API como del JSON local) al formato del feed.
 */
function normalizeProduct(p) {
  // Precio: en la API es price_unit (precio por unidad COP)
  // El feed requiere precio total por caja cuando corresponda
  const priceUnit = Number(p.price_unit || p.price || 0);
  const cantidad  = Number(p.cantidad || 1);

  // Google Merchant requiere precio con 2 decimales + moneda
  const priceFormatted = `${priceUnit.toFixed(2)} ${CURRENCY}`;

  // Imagen principal
  let imageUrl = '';
  if (Array.isArray(p.images) && p.images.length > 0) {
    imageUrl = p.images[0];
  } else if (p.image) {
    imageUrl = p.image;
  }

  // Si la imagen no tiene protocolo (es relativa), la hacemos absoluta
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }

  // Disponibilidad
  const available = p.habilitado !== false; // default true si no existe
  const availability = available ? 'in_stock' : 'out_of_stock';

  // SKU/ID único: usar codigo_siesa si existe, sino id
  const sku = p.codigo_siesa
    ? String(p.codigo_siesa).trim()
    : `KXP-${p.id}`;

  // URL del producto individual
  const productUrl = `${BASE_URL}/product?id=${p.id}`;

  // Título limpio (sin HTML)
  const title = String(p.name || '').trim();

  // Descripción limpia (sin HTML)
  const rawDesc = String(p.description || '').trim();
  const description = rawDesc || title;

  // Categoría Google (google_product_category — usamos la categoría del producto)
  const category = String(p.category_name || p.category || 'Empaques').trim();

  return {
    id: sku,
    title,
    description,
    link: productUrl,
    imageLink: imageUrl,
    availability,
    price: priceFormatted,
    brand: BRAND,
    condition: CONDITION,
    category,
    productId: p.id
  };
}

/**
 * Genera el XML del feed.
 */
function buildXml(products) {
  const now = new Date().toUTCString();
  const items = products
    .filter(p => {
      // Solo productos habilitados y con precio válido
      const price = Number(p.price_unit || p.price || 0);
      return p.habilitado !== false && price > 0;
    })
    .map(normalizeProduct);

  if (items.length === 0) {
    console.warn('[feed] ⚠ No hay productos válidos para incluir en el feed.');
  }

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

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(STORE_TITLE)}</title>
    <link>${escapeXml(BASE_URL)}</link>
    <description>${escapeXml(STORE_DESC)}</description>
    <language>es-co</language>
    <lastBuildDate>${now}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
}

/**
 * Pipeline principal: obtiene productos → genera XML → guarda archivo.
 */
async function generate(outFile) {
  console.log('\n[feed] 🚀 Iniciando generación del feed...');

  // 1. Intentar API live primero
  let products = await fetchFromApi();

  // 2. Si la API falló, usar JSON local
  if (!products) {
    products = readLocalProducts();
  } else {
    // Si la API tuvo éxito, actualizar el JSON local como caché
    saveLocalProducts(products);
  }

  if (!products || products.length === 0) {
    console.error('[feed] ✗ No se encontraron productos. El feed NO fue generado.');
    process.exit(1);
  }

  // 3. Construir XML
  const xml = buildXml(products);

  // 4. Guardar
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, xml, 'utf8');

  const sizeKb = (Buffer.byteLength(xml, 'utf8') / 1024).toFixed(1);
  console.log(`[feed] ✅ feed.xml generado: ${outFile}`);
  console.log(`[feed]    Productos en feed: ${products.filter(p => p.habilitado !== false && Number(p.price_unit || p.price || 0) > 0).length}`);
  console.log(`[feed]    Tamaño: ${sizeKb} KB`);
  console.log(`[feed]    URL pública: ${BASE_URL}/feed.xml\n`);
}

// ─── Modo watch ───────────────────────────────────────────────────────────────

function startWatch(outFile) {
  console.log(`[feed] 👁  Modo watch activo — observando ${DATA_FILE}`);
  let debounce = null;

  const runGenerate = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => generate(outFile), 500);
  };

  // Observar el archivo JSON local
  try {
    fs.watchFile(DATA_FILE, { interval: 2000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log(`[feed] 🔄 Cambio detectado en products.json`);
        runGenerate();
      }
    });
    console.log(`[feed]    Ctrl+C para detener.\n`);
  } catch (e) {
    console.error(`[feed] Error iniciando watch: ${e.message}`);
  }
}

// ─── Entrada principal ────────────────────────────────────────────────────────

(async () => {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch') || args.includes('-w');
  const outIdx = args.indexOf('--out');
  const outFile = outIdx !== -1 && args[outIdx + 1]
    ? path.resolve(args[outIdx + 1])
    : DEFAULT_OUT;

  // Generar siempre al inicio
  await generate(outFile);

  // Si --watch, mantenerse observando cambios en el JSON local
  if (watchMode) {
    startWatch(outFile);
  }
})();
