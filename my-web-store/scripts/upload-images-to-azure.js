/**
 * Script para optimizar imágenes locales y subirlas a Azure Blob Storage.
 *
 * Uso:  node scripts/upload-images-to-azure.js
 *
 * - Convierte PNG/JPG a WebP (calidad 80, max 1200px de ancho)
 * - Sube a container "images" bajo la carpeta "site-assets/"
 * - Genera un JSON con el mapeo ruta-local -> URL de Azure
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'images';
const azureFolder = 'site-assets'; // carpeta en Azure para assets del sitio

if (!connectionString) {
  console.error('Falta AZURE_STORAGE_CONNECTION_STRING en .env');
  process.exit(1);
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

const IMAGES_DIR = path.resolve(__dirname, '..', 'src', 'images');
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;

// Archivos a excluir de la conversión (se suben tal cual)
const KEEP_ORIGINAL = new Set(['placeholder.svg']);

async function getImageFiles(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files = files.concat(await getImageFiles(fullPath, relPath));
    } else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)) {
      files.push({ fullPath, relPath, name: entry.name });
    }
  }
  return files;
}

async function optimizeAndUpload(file) {
  const { fullPath, relPath, name } = file;

  // SVG: subir tal cual
  if (KEEP_ORIGINAL.has(name) || name.endsWith('.svg')) {
    const buffer = fs.readFileSync(fullPath);
    const blobName = `${azureFolder}/${relPath}`;
    const blockClient = containerClient.getBlockBlobClient(blobName);
    await blockClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: 'image/svg+xml' },
    });
    const url = blockClient.url;
    console.log(`  [SVG] ${relPath} -> ${url}`);
    return { original: relPath, blobName, url, format: 'svg' };
  }

  // Raster: convertir a WebP
  const webpName = name.replace(/\.(png|jpe?g|gif)$/i, '.webp');
  const webpRelPath = relPath.replace(/\.(png|jpe?g|gif)$/i, '.webp');

  const image = sharp(fullPath);
  const metadata = await image.metadata();

  let pipeline = image;
  if (metadata.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  const buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();

  const originalSize = fs.statSync(fullPath).size;
  const saved = ((1 - buffer.length / originalSize) * 100).toFixed(1);

  const blobName = `${azureFolder}/${webpRelPath}`;
  const blockClient = containerClient.getBlockBlobClient(blobName);
  await blockClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: 'image/webp' },
  });
  const url = blockClient.url;

  console.log(`  [WebP] ${relPath} (${(originalSize / 1024).toFixed(0)}KB) -> ${(buffer.length / 1024).toFixed(0)}KB (-${saved}%) -> ${url}`);
  return { original: relPath, blobName, url, format: 'webp', originalSize, optimizedSize: buffer.length };
}

async function main() {
  console.log('Asegurando que el container existe...');
  try {
    await containerClient.createIfNotExists({ access: 'blob' });
  } catch (err) {
    console.warn('  Warning al crear container:', err.message);
  }

  console.log(`\nEscaneando imagenes en ${IMAGES_DIR}...\n`);
  const files = await getImageFiles(IMAGES_DIR);
  console.log(`Encontradas ${files.length} imágenes.\n`);

  const results = [];
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const file of files) {
    try {
      const result = await optimizeAndUpload(file);
      results.push(result);
      if (result.originalSize) {
        totalOriginal += result.originalSize;
        totalOptimized += result.optimizedSize;
      }
    } catch (err) {
      console.error(`  ERROR con ${file.relPath}:`, err.message);
    }
  }

  // Guardar mapeo para referencia
  const mappingPath = path.resolve(__dirname, 'image-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(results, null, 2));

  console.log(`\n--- Resumen ---`);
  console.log(`Imágenes procesadas: ${results.length}/${files.length}`);
  if (totalOriginal > 0) {
    console.log(`Tamaño original total:   ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Tamaño optimizado total: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Ahorro: ${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}%`);
  }
  console.log(`\nMapeo guardado en: ${mappingPath}`);
  console.log(`\nBase URL: https://datalakekos.blob.core.windows.net/${containerName}/${azureFolder}/`);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
