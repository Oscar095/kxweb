const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Cargar variables desde la raíz del proyecto (independiente del cwd)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// switching to SQL Server + Azure Blob storage
const db = require('./db');
const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions, BlobServiceClient } = require('@azure/storage-blob');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes PNG/JPG/GIF/WebP'));
  }
});

const crypto = require('crypto');

const app = express();
app.use(express.json());

// helper: detectar MIME por firma
function detectImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

// helper: convertir lo que venga a Buffer real
function toBuffer(val) {
  if (!val) return null;
  if (Buffer.isBuffer(val)) return val;
  if (val.buffer && Buffer.isBuffer(val.buffer)) return val.buffer; // BSON Binary
  if (val.type === 'Buffer' && Array.isArray(val.data)) return Buffer.from(val.data); // JSON de Buffer
  try { return Buffer.from(val); } catch { return null; }
}

// Config
const PAYU_ENABLED = process.env.PAYU_ENABLED === 'true';
const PORT = process.env.PORT || 3000;

// Wompi
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY;
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-in-env';

// --- Auth helpers (cookie token HMAC) ---
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verifyToken(tok) {
  if (!tok || typeof tok !== 'string' || !tok.includes('.')) return null;
  const [body, mac] = tok.split('.');
  const exp = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(exp))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
function getCookies(req) {
  const c = req.headers.cookie || '';
  return Object.fromEntries(c.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
    const i = pair.indexOf('=');
    if (i < 0) return [pair, ''];
    return [decodeURIComponent(pair.slice(0, i)), decodeURIComponent(pair.slice(1 + i))];
  }));
}
function setCookie(res, name, value, opts = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (opts.path) parts.push(`Path=${opts.path}`); else parts.push('Path=/');
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`); else parts.push('SameSite=Lax');
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function requireAdmin(req, res, next) {
  const { adminToken } = getCookies(req);
  const data = verifyToken(adminToken);
  if (!data || data.sub !== 'admin') return res.status(401).json({ message: 'No autorizado' });
  next();
}

// --- Firma para Wompi ---
app.post('/api/wompi/signature', (req, res) => {
  try {
    if (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET) {
      return res.status(500).json({ message: 'WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET no configurados' });
    }

    const { reference, amountInCents, currency, redirectUrl } = req.body || {};
    if (!reference || typeof reference !== 'string') return res.status(400).json({ message: 'reference requerida' });

    const cents = Number(amountInCents);
    if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ message: 'amountInCents inválido' });

    const cur = (currency || 'COP').toUpperCase();
    const textToSign = `${reference}${cents}${cur}`;
    const integrity = crypto.createHmac('sha256', WOMPI_INTEGRITY_SECRET).update(textToSign).digest('hex');

    const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').toString().trim().replace(/\/$/, '');
    const fallbackBase = `${req.protocol}://${req.get('host')}`;
    const base = publicBaseUrl || fallbackBase;
    const finalRedirect = (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.trim())
      ? redirectUrl
      : `${base}/checkout.html`;

    return res.json({
      publicKey: WOMPI_PUBLIC_KEY,
      signature: { integrity },
      currency: cur,
      redirectUrl: finalRedirect
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error creando firma' });
  }
});
// --- fin firma ---

// --- Pedidos (checkout) ---
app.post('/api/pedidos', async (req, res) => {
  try {
    const b = req.body || {};
    const nitId = String(b.nitId || b.nit_id || '').replace(/\D+/g, '').trim();
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim();
    const phone = String(b.phone || '').trim();
    const address = String(b.address || '').trim();
    const city = String(b.city || '').trim();
    const notes = (b.notes == null ? '' : String(b.notes)).trim();
    const paymentMethod = (b.paymentMethod == null ? '' : String(b.paymentMethod)).trim();

    if (!nitId) return res.status(400).json({ message: 'nitId requerido (numérico)' });
    if (!name || !email || !phone || !address || !city) {
      return res.status(400).json({ message: 'name, email, phone, address y city son requeridos' });
    }

    // Detectar tabla/columnas reales (por si la tabla fue creada manualmente con otros nombres)
    const tables = await db.query(
      `SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name]
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_TYPE = 'BASE TABLE' AND (TABLE_NAME = 'pedidos' OR TABLE_NAME = 'pedido');`
    );
    const found = (tables || []).find(t => String(t.name || '').toLowerCase() === 'pedidos') || (tables || [])[0];
    if (!found || !found.name || !found.schema) {
      return res.status(500).json({ message: 'Error guardando pedido', detail: 'Tabla pedidos/pedido no encontrada' });
    }
    const tableSchema = String(found.schema);
    const tableName = String(found.name);

    const cols = await db.query(
      `SELECT COLUMN_NAME AS [name]
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
       ORDER BY ORDINAL_POSITION;`,
      { schema: tableSchema, table: tableName }
    );
    const colSet = new Set((cols || []).map(c => String(c.name || '').toLowerCase()));

    const pick = (candidates) => {
      for (const c of candidates) {
        const key = String(c).toLowerCase();
        if (colSet.has(key)) return c;
      }
      return null;
    };

    const mapping = {
      nit: pick(['nit_id', 'nitid', 'nitId', 'nit', 'documento', 'document', 'id']),
      name: pick(['name', 'nombre']),
      email: pick(['email', 'correo']),
      phone: pick(['phone', 'telefono', 'celular']),
      address: pick(['address', 'direccion']),
      city: pick(['city', 'ciudad']),
      notes: pick(['notes', 'nota', 'notas', 'observaciones', 'observacion']),
      pay: pick(['payment_method', 'paymentmethod', 'paymentMethod', 'metodo_pago', 'metodopago'])
    };

    const missing = ['nit', 'name', 'email', 'phone', 'address', 'city']
      .filter(k => !mapping[k]);
    if (missing.length) {
      return res.status(500).json({
        message: 'Error guardando pedido',
        detail: `Faltan columnas requeridas en ${tableSchema}.${tableName}: ${missing.join(', ')}`
      });
    }

    const insertCols = [];
    const insertVals = [];
    const params = {};

    const add = (col, param, value) => {
      if (!col) return;
      insertCols.push(`[${col}]`);
      insertVals.push(`@${param}`);
      params[param] = value;
    };

    add(mapping.nit, 'nit', nitId);
    add(mapping.name, 'name', name);
    add(mapping.email, 'email', email);
    add(mapping.phone, 'phone', phone);
    add(mapping.address, 'address', address);
    add(mapping.city, 'city', city);
    add(mapping.notes, 'notes', notes);
    add(mapping.pay, 'pay', paymentMethod);

    // Intentar devolver id si existe columna id
    const idCol = pick(['id', 'Id', 'ID']);
    const output = idCol ? ` OUTPUT INSERTED.[${idCol}] AS id` : '';

    const sql = `INSERT INTO [${tableSchema}].[${tableName}] (${insertCols.join(', ')})${output} VALUES (${insertVals.join(', ')});`;
    const r = await db.query(sql, params);
    const id = r && r[0] && (r[0].id || r[0].Id);
    res.status(201).json({ ok: true, id: id ?? null });
  } catch (e) {
    console.error('POST /api/pedidos error', e);
    res.status(500).json({
      message: 'Error guardando pedido',
      detail: (e && e.message) ? String(e.message).slice(0, 300) : undefined
    });
  }
});

// --- Contactos API ---
const contactUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por archivo
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|gif|webp)$/.test(file.mimetype) || file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Solo se permiten imágenes (png, jpg, gif, webp) o PDF'));
  }
});

app.post('/api/contacts', contactUpload.array('attachments', 6), async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'name, email y message son requeridos' });
    }
    const id = await Contact.nextId();
    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map(f => ({ data: f.buffer, type: f.mimetype, filename: f.originalname, size: f.size }));
    const saved = await Contact.create({ id, name: String(name).trim(), email: String(email).trim(), phone: String(phone || '').trim(), message: String(message).trim(), attachments });
    res.status(201).json({ ok: true, id: saved.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error guardando contacto' });
  }
});

// --- Admin Auth API ---
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!ADMIN_PASSWORD) return res.status(500).json({ message: 'ADMIN_PASSWORD no configurada' });
    if ((username || ADMIN_USER) !== ADMIN_USER || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const token = signToken({ sub: 'admin', user: ADMIN_USER, iat: Date.now() });
    setCookie(res, 'adminToken', token, { httpOnly: true, sameSite: 'Lax' });
    res.json({ ok: true, user: ADMIN_USER });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error en login' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  setCookie(res, 'adminToken', '', { maxAge: 0 });
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  const { adminToken } = getCookies(req);
  const data = verifyToken(adminToken);
  if (!data || data.sub !== 'admin') return res.status(401).json({ ok: false });
  res.json({ ok: true, user: data.user });
});

// Servir frontend estático
const staticDir = path.resolve(__dirname, '..', 'src');
app.use(express.static(staticDir));

// Inicializar esquema SQL y conexión
db.ensureSchema().then(() => console.log('SQL Server schema ensured')).catch(err => console.error('Error asegurando esquema SQL', err));

// Parse storage connection string for account name/key
function parseConnectionString(conn) {
  const mName = conn ? conn.match(/AccountName=([^;]+)/) : null;
  const mKey = conn ? conn.match(/AccountKey=([^;]+)/) : null;
  return { accountName: mName ? mName[1] : null, accountKey: mKey ? mKey[1] : null };
}

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const { accountName, accountKey } = parseConnectionString(connStr);
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'images';
const rootPath = (process.env.AZURE_ADLS_ROOT_PATH || '').replace(/^\//, '').replace(/\/$/, '');

const blobServiceClient = connStr ? BlobServiceClient.fromConnectionString(connStr) : null;

// Helper: generate read SAS for a blob URL (if accountKey available)
function generateReadSasForBlob(blobUrl) {
  if (!accountName || !accountKey || !blobUrl) return blobUrl;
  try {
    // blobUrl is like https://{account}.blob.core.windows.net/{container}/{path}
    const parts = new URL(blobUrl);
    const path = parts.pathname.replace(/^\//, ''); // container/segment/...
    const idx = path.indexOf('/');
    if (idx < 0) return blobUrl;
    const container = path.slice(0, idx);
    const blobName = path.slice(idx + 1);
    // blobName from URL may contain percent-escaped segments (e.g. '%2F'); decode to get the actual blob name
    const decodedBlobName = decodeURIComponent(blobName);

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const permissions = BlobSASPermissions.parse('r');
    const expiresOn = new Date(Date.now() + (parseInt(process.env.AZURE_SAS_EXPIRY_MIN || '15', 10) * 60 * 1000));
    const sas = generateBlobSASQueryParameters({ containerName: container, blobName: decodedBlobName, permissions, expiresOn }, credential).toString();
    const blobPathEscaped = decodedBlobName.split('/').map(encodeURIComponent).join('/');
    return `https://${accountName}.blob.core.windows.net/${container}/${blobPathEscaped}?${sas}`;
  } catch (e) {
    console.error('generateReadSasForBlob error', e);
    return blobUrl;
  }
}

app.get('/api/upload-sas', async (req, res) => {
  try {
    if (!accountName || !accountKey) return res.status(500).json({ error: 'missing_storage_credentials' });
    const originalName = req.query.name || `upload-${Date.now()}`;
    const contentType = req.query.contentType || 'application/octet-stream';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${originalName}`;
    const blobName = rootPath ? `${rootPath}/${filename}` : filename;

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const permissions = BlobSASPermissions.parse('cw'); // create + write
    const expiresOn = new Date(Date.now() + (parseInt(process.env.AZURE_SAS_EXPIRY_MIN || '15', 10) * 60 * 1000));

    const sasToken = generateBlobSASQueryParameters({ containerName, blobName, permissions, expiresOn }, credential).toString();
    const blobPathEscaped = blobName.split('/').map(encodeURIComponent).join('/');
    const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPathEscaped}?${sasToken}`;
    const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPathEscaped}`;
    res.json({ uploadUrl, blobUrl, contentType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed_to_create_sas' });
  }
});

// API Products
// GET listado: incluye array images y mantiene 'image' como la primera
app.get('/api/products', async (req, res) => {
  try {
    // JOIN para obtener el nombre de la categoría
    const sqlQuery = `SELECT p.*, c.descripcion AS category_name FROM dbo.products p LEFT JOIN dbo.categories c ON p.category = c.Id ORDER BY p.id`;
    const rows = await db.query(sqlQuery);
    const out = rows.map(d => {
      const imgs = d.images ? (() => { try { return JSON.parse(d.images); } catch { return []; } })() : [];
      if (d.image2) { const v = d.image2.toString(); if (v && !imgs.includes(v)) imgs.push(v); }
      if (d.image3) { const v = d.image3.toString(); if (v && !imgs.includes(v)) imgs.push(v); }
      if (d.image4) { const v = d.image4.toString(); if (v && !imgs.includes(v)) imgs.push(v); }
      return {
        id: d.id,
        codigo_siesa: d.codigo_siesa || '',
        name: d.name || '',
        price_unit: d.price_unit != null ? d.price_unit : null,
        cantidad: d.cantidad != null ? d.cantidad : null,
        category: d.category != null ? d.category : null,
        category_name: d.category_name || '',
        category_desc: d.category_desc || '',
        description: d.description || '',
        images: imgs,
        image: imgs[0] || '/images/placeholder.svg',
        image2: d.image2 || '',
        image3: d.image3 || '',
        image4: d.image4 || ''
      };
    });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error listando productos' });
  }
});

// GET detalle de un producto por id
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    // JOIN para obtener el nombre de la categoría
    const rows = await db.query('SELECT p.*, c.descripcion AS category_name FROM dbo.products p LEFT JOIN dbo.categories c ON p.category = c.Id WHERE p.id = @id', { id });
    const d = rows[0];
    if (!d) return res.status(404).json({ message: 'Producto no encontrado' });
    const imgs = d.images ? (() => { try { return JSON.parse(d.images); } catch { return []; } })() : [];
    if (d.image2) { const v = d.image2.toString(); if (v && !imgs.includes(v)) imgs.push(v); }
    if (d.image3) { const v = d.image3.toString(); if (v && !imgs.includes(v)) imgs.push(v); }
    if (d.image4) { const v = d.image4.toString(); if (v && !imgs.includes(v)) imgs.push(v); }
    const out = {
      id: d.id,
      codigo_siesa: d.codigo_siesa || '',
      name: d.name || '',
      price_unit: d.price_unit != null ? d.price_unit : null,
      cantidad: d.cantidad != null ? d.cantidad : null,
      category: d.category != null ? d.category : null,
      category_name: d.category_name || '',
      description: d.description || '',
      image: (Array.isArray(imgs) && imgs[0]) || '/images/placeholder.svg',
      images: imgs,
      image2: d.image2 || '',
      image3: d.image3 || '',
      image4: d.image4 || ''
    };
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error obteniendo producto' });
  }
});

// API Categories
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM dbo.categories ORDER BY Id');
    const cats = (rows || []).map(r => ({
      id: (r.Id || r.id || r.ID || null),
      nombre: (r.nombre || r.Nombre || r.name || ''),
      descripcion: (r.descripcion || r.Descripcion || r.description || '')
    }));
    res.json(cats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error listando categorías' });
  }
});

// Create category
app.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const descripcion = (b.descripcion || b.description || b.nombre || b.name || '').toString().trim();
    if (!descripcion) return res.status(400).json({ message: 'descripcion requerida' });
    const r = await db.query('INSERT INTO dbo.categories (descripcion) OUTPUT INSERTED.Id VALUES (@descripcion);', { descripcion });
    const newId = r && r[0] && r[0].Id;
    res.status(201).json({ ok: true, id: newId });
  } catch (e) {
    console.error('/api/categories POST error', e);
    res.status(500).json({ message: 'Error creando categoría' });
  }
});

// Update category
app.put('/api/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    const b = req.body || {};
    const descripcion = (b.descripcion || b.description || b.nombre || b.name || '').toString().trim();
    if (!descripcion) return res.status(400).json({ message: 'descripcion requerida' });
    const r = await db.query('UPDATE dbo.categories SET descripcion = @descripcion WHERE Id = @id; SELECT @@ROWCOUNT AS affected;', { id, descripcion });
    const affected = r && r[0] && r[0].affected ? Number(r[0].affected) : 0;
    if (affected === 0) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (e) {
    console.error('/api/categories PUT error', e);
    res.status(500).json({ message: 'Error actualizando categoría' });
  }
});

// Delete category
app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    // optionally check FK constraints: let SQL handle it
    const r = await db.query('DELETE FROM dbo.categories WHERE Id = @id; SELECT @@ROWCOUNT AS affected;', { id });
    const affected = r && r[0] && r[0].affected ? Number(r[0].affected) : 0;
    if (affected === 0) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (e) {
    console.error('/api/categories DELETE error', e);
    res.status(500).json({ message: 'Error eliminando categoría' });
  }
});

// --- Biblioteca de imágenes ---
// Listar biblioteca (metadatos)
app.get('/api/biblioteca', async (req, res) => {
  try {
    const rows = await db.query('SELECT id,nombre,url FROM dbo.library ORDER BY id');
    const out = rows.map(r => ({ id: r.id, nombre: r.nombre, url: process.env.AZURE_STORAGE_PUBLIC === 'true' ? r.url : generateReadSasForBlob(r.url) }));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error listando biblioteca' });
  }
});

// Obtener binario de imagen de biblioteca
app.get('/api/biblioteca/:id/imagen', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).send('ID inválido');
    const rows = await db.query('SELECT url FROM dbo.library WHERE id = @id', { id });
    const row = rows[0];
    if (!row || !row.url) return res.status(404).send('No encontrada');
    // Redirect to blob URL
    return res.redirect(row.url);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error obteniendo imagen');
  }
});

// Crear elemento de biblioteca (protegido)
const libUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes PNG/JPG/GIF/WebP'));
  }
});

app.post('/api/biblioteca', requireAdmin, libUpload.single('imagen'), async (req, res) => {
  try {
    const { nombre } = req.body || {};
    console.log('[POST /api/biblioteca] request received', { nombre: nombre || null, file: req.file ? { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : null });
    if (!nombre || !req.file) return res.status(400).json({ message: 'nombre e imagen son requeridos' });
    if (!blobServiceClient) return res.status(500).json({ message: 'Storage not configured' });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${req.file.originalname}`;
    const blobName = rootPath ? `${rootPath}/${filename}` : filename;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    try {
      // ensure container exists and set public access (blob) so blobs are readable anonymously
      await containerClient.createIfNotExists({ access: 'blob' });
      try {
        await containerClient.setAccessPolicy('blob');
      } catch (errSet) {
        // setAccessPolicy may fail due to permissions; log but continue
        console.warn('[POST /api/biblioteca] setAccessPolicy warning', errSet && errSet.message);
      }
    } catch (errCreate) {
      console.error('[POST /api/biblioteca] createIfNotExists error', errCreate);
      // continue, maybe already exists or permission issue will surface on upload
    }

    const blockClient = containerClient.getBlockBlobClient(blobName);
    try {
      await blockClient.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
      // verify
      const props = await blockClient.getProperties();
      console.log('[POST /api/biblioteca] uploaded blob', { blobName, contentLength: props.contentLength, contentType: props.contentType });
    } catch (errUpload) {
      console.error('[POST /api/biblioteca] upload error', errUpload);
      return res.status(500).json({ message: 'Error subiendo a Blob Storage', detail: errUpload.message || String(errUpload) });
    }

    const blobPathEscaped = blobName.split('/').map(encodeURIComponent).join('/');
    const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPathEscaped}`;
    try {
      const resIns = await db.query(`INSERT INTO dbo.library (nombre,url) OUTPUT INSERTED.id VALUES (@nombre,@url);`, { nombre: String(nombre).trim(), url: blobUrl });
      const newId = resIns[0] && resIns[0].id;
      console.log('[POST /api/biblioteca] metadata saved id=', newId);
    } catch (errDb) {
      console.error('[POST /api/biblioteca] DB insert error (library)', errDb);
      // continue to try inserting into banco_imagenes
    }

    try {
      console.log('[POST /api/biblioteca] inserting banco_imagenes', { nombre: String(nombre).trim(), url: blobUrl });
      const resBanco = await db.query(`INSERT INTO dbo.banco_imagenes (nombre_imagen,url_blob) OUTPUT INSERTED.id VALUES (@nombre,@url);`, { nombre: String(nombre).trim(), url: blobUrl });
      console.log('[POST /api/biblioteca] banco insert result raw=', resBanco);
      const bancoId = resBanco[0] && resBanco[0].id;
      console.log('[POST /api/biblioteca] banco_imagenes inserted id=', bancoId);
      return res.status(201).json({ ok: true, id: bancoId, url: blobUrl });
    } catch (errBanco) {
      console.error('[POST /api/biblioteca] DB insert error (banco_imagenes)', errBanco && (errBanco.message || errBanco));
      return res.status(500).json({ message: 'Error guardando metadata en DB', detail: errBanco && (errBanco.message || String(errBanco)) });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error creando elemento de biblioteca' });
  }
});

// Debug: listar banco_imagenes
app.get('/api/banco_imagenes', async (req, res) => {
  try {
    const rows = await db.query('SELECT TOP(100) id,nombre_imagen,url_blob,createdAt FROM dbo.banco_imagenes ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    console.error('GET /api/banco_imagenes error', e && (e.message || e));
    res.status(500).json({ message: 'error' });
  }
});

// Eliminar elemento de biblioteca (protegido)
app.delete('/api/biblioteca/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    // find URL
    const rows = await db.query('SELECT url FROM dbo.library WHERE id = @id', { id });
    const row = rows[0];
    const url = row && row.url;
    if (url) {
      try {
        // attempt to delete blob
        if (blobServiceClient) {
          const u = new URL(url);
          const path = u.pathname.replace(/^\//, '');
          const idx = path.indexOf('/');
          if (idx >= 0) {
              const cont = path.slice(0, idx);
              const blobName = path.slice(idx + 1);
              const decodedBlobName = decodeURIComponent(blobName);
              const containerClient = blobServiceClient.getContainerClient(cont);
              const blockClient = containerClient.getBlockBlobClient(decodedBlobName);
              await blockClient.deleteIfExists();
          }
        }
      } catch (delErr) {
        console.warn('[DELETE /api/biblioteca] blob delete warning', delErr && delErr.message);
      }
    }

    // delete metadata rows
    await db.query('DELETE FROM dbo.library WHERE id = @id', { id });
    if (url) {
      await db.query('DELETE FROM dbo.banco_imagenes WHERE url_blob = @url', { url });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error eliminando elemento de biblioteca' });
  }
});

// Imagen principal (legacy o la 0 del array)
app.get('/api/products/:id/image', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).send('ID inválido');
    const rows = await db.query('SELECT images FROM dbo.products WHERE id = @id', { id });
    const d = rows[0];
    if (!d) return res.status(404).send('Sin imagen');
    const imgs = d.images ? JSON.parse(d.images) : [];
    if (!imgs || imgs.length === 0) return res.status(404).send('Sin imagen');
    const target = process.env.AZURE_STORAGE_PUBLIC === 'true' ? imgs[0] : generateReadSasForBlob(imgs[0]);
    return res.redirect(target);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error obteniendo imagen');
  }
});

// Imagen por índice del array
app.get('/api/products/:id/images/:idx', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = Number(req.params.idx);
    if (Number.isNaN(id) || Number.isNaN(idx) || idx < 0) return res.status(400).send('Parámetros inválidos');
    const rows = await db.query('SELECT images FROM dbo.products WHERE id = @id', { id });
    const d = rows[0];
    if (!d) return res.status(404).send('Imagen no encontrada');
    const imgs = d.images ? JSON.parse(d.images) : [];
    if (!imgs || !imgs[idx]) return res.status(404).send('Imagen no encontrada');
    const target = process.env.AZURE_STORAGE_PUBLIC === 'true' ? imgs[idx] : generateReadSasForBlob(imgs[idx]);
    return res.redirect(target);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error obteniendo imagen');
  }
});

// Helper numérico seguro
function asNumber(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Resolve category input (id or textual) to numeric Id in dbo.categories
async function resolveCategory(input) {
  if (input == null || input === '') return null;
  // handle clients that send the literal string 'undefined' or 'null'
  if (typeof input === 'string') {
    const t = input.trim().toLowerCase();
    if (!t || t === 'undefined' || t === 'null') return null;
  }
  const asNum = Number(input);
  if (Number.isFinite(asNum)) {
    try {
      const rows = await db.query('SELECT Id FROM dbo.categories WHERE Id = @id', { id: asNum });
      if (rows && rows.length) return asNum;
      return null;
    } catch (e) {
      console.warn('resolveCategory warning', e && (e.message || e));
      return null;
    }
  }
}

// Crear producto (con sanitización de numéricos)
app.post('/api/products', requireAdmin, async (req, res) => {
    try {
      // Support JSON body with images array (URLs).
      const b = req.body || {};
      const codigo_siesa = (b.codigo_siesa || b.codigo || '').toString().trim();
      const name = (b.name || b.Nombre || '').toString().trim();
      // Resolve category (id or textual) to numeric Id
      const categoryParam = await resolveCategory(b.category);
      const description = (b.description || b.Descripcion || '').toString().trim();
      const price_unit = (b.price_unit != null ? Number(b.price_unit) : (b.precio_unitario != null ? Number(b.precio_unitario) : null));
      const cantidad = (b.cantidad != null ? Number(b.cantidad) : (b.Cantidad != null ? Number(b.Cantidad) : null));
      if (!name) return res.status(400).json({ message: 'Nombre requerido' });

      // images: can be array or JSON string
      let images = [];
      if (b.images) {
        if (typeof b.images === 'string') {
          try { images = JSON.parse(b.images); } catch { images = [b.images]; }
        } else if (Array.isArray(b.images)) images = b.images;
      }
      // Enforce max 4 images
      if (images.length > 4) return res.status(400).json({ message: 'Máximo 4 imágenes permitido' });

      // map to image2..image4 (image1 stored in images[0] inside images JSON)
      const img2 = images[1] || '';
      const img3 = images[2] || '';
      const img4 = images[3] || '';

      // Validate categoryParam resolved and exists (FK)
      if (categoryParam == null) return res.status(400).json({ message: 'category requerido o inválida' });
      console.log('[POST /api/products] inserting', { codigo_siesa, name, categoryParam, imagesCount: images.length, cantidad });
      const resIns = await db.query(`INSERT INTO dbo.products (codigo_siesa,name,price_unit,cantidad,category,description,images,image2,image3,image4) 
        OUTPUT INSERTED.id
        VALUES (@codigo_siesa,@name,@price_unit,@cantidad,@category,@description,@images,@image2,@image3,@image4);`, {
        codigo_siesa, name, price_unit, cantidad, category: categoryParam, description, images: JSON.stringify(images), image2: img2, image3: img3, image4: img4
      });
      const newId = resIns[0] && resIns[0].id;
      res.status(201).json({ ok: true, id: newId });
    } catch (e) {
      console.error('POST /api/products error', e);
      res.status(500).json({ message: 'Error creando producto' });
    }
  });
app.delete('/api/products/:id', async (req, res) => {
  // proteger borrado
  const { adminToken } = getCookies(req);
  const data = verifyToken(adminToken);
  if (!data || data.sub !== 'admin') return res.status(401).json({ message: 'No autorizado' });
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });

    const r = await db.query('DELETE FROM dbo.products WHERE id = @id; SELECT @@ROWCOUNT AS affected;', { id });
    const affected = r[0] && r[0].affected ? Number(r[0].affected) : 0;
    if (affected === 0) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error eliminando producto' });
  }
});

// --- API Payments (mantener tus endpoints existentes) ---

// --- Precio dinámico por código y cantidad ---
// Query params: codigo (string/number), n (cantidad base que se multiplicará * 1000)
// Regla:
//  - cantidadReal = n * 1000
//  - tomar escalón <= cantidadReal (floor). Si no hay menor, usar el menor disponible si existe exacto? (aquí devolver 0)
//  - si cantidadReal supera todos, usar escalón máximo
//  - buscar producto por { Codigo|codigo: codigo, Cantidad|cantidad: escalon }
//  - devolver: precio = (precio_unitario del producto) * cantidadReal
app.get('/api/precio', async (req, res) => {
  try {
    const { codigo, n, debugPrecio } = req.query || {};
    if (!codigo) return res.status(400).json({ message: 'codigo requerido' });
    const mult = Number(n);
    if (!Number.isFinite(mult) || mult <= 0) return res.status(400).json({ message: 'n inválido' });

    const cantidadReal = mult * 1000; // Regla fija

    // Obtener escalones desde colección Cantidad o derivarlos de productos si no hay
    let escalones = [];
    try {
      const rows = await db.query('SELECT cantidad FROM dbo.cantidad ORDER BY cantidad');
      escalones = rows.map(r => r.cantidad).filter(c => Number.isFinite(c));
    } catch (err) { escalones = []; }
    if (!escalones.length) {
      // Derivar escalones de los productos con este código
      const codigoStr = String(codigo);
      const prodDocs = await db.query('SELECT cantidad FROM dbo.products WHERE codigo = @codigo', { codigo: codigoStr });
      escalones = prodDocs.map(p => p.cantidad).filter(Number.isFinite).map(Number);
    }
    escalones = escalones.filter(c => Number.isFinite(c)).sort((a,b) => a-b);
    if (!escalones.length) return res.status(404).json({ message: 'No hay escalones disponibles para el código', codigo });

    // Selección floor
    let escalon = escalones.filter(c => c <= cantidadReal).pop();
    if (escalon == null) escalon = escalones[0]; // si todos son mayores, tomar el menor (aunque será > cantidadReal)
    if (cantidadReal > escalones[escalones.length - 1]) {
      escalon = escalones[escalones.length - 1]; // escala más alta
    }

    // Buscar producto que coincida con el escalón elegido
    const codigoStr = String(codigo);
    const codigoNum = Number(codigo);
    const escalonNum = Number(escalon);
    const query = {
      $and: [
        { $or: [
          { codigo: codigoStr }, { Codigo: codigoStr },
          ...(Number.isFinite(codigoNum) ? [ { codigo: codigoNum }, { Codigo: codigoNum } ] : [])
        ] },
        { $or: [
          { cantidad: escalonNum }, { Cantidad: escalonNum },
          { cantidad: String(escalonNum) }, { Cantidad: String(escalonNum) }
        ] }
      ]
    };
    // try direct match in SQL
    const prodRows = await db.query(`SELECT * FROM dbo.products WHERE codigo = @codigo AND cantidad = @escalon`, { codigo: codigoStr, escalon: escalonNum });
    let prod = prodRows[0];
    if (debugPrecio === 'true') {
      console.log('[DEBUG /api/precio]', { codigo, cantidadReal, escalon, found: !!prod });
    }
    let chosen = prod;
    if (!chosen) {
      // Fallback: buscar el producto con mayor Cantidad <= escalon (ya debería ser escalon) o el máximo disponible para el código
      const allCode = await db.query('SELECT * FROM dbo.products WHERE codigo = @codigo', { codigo: codigoStr });
      const withQty = allCode.map(p => ({ doc: p, qty: Number(p.cantidad) })).filter(x => Number.isFinite(x.qty));
      const floorCandidates = withQty.filter(x => x.qty <= escalonNum).sort((a,b) => b.qty - a.qty);
      if (floorCandidates.length) chosen = floorCandidates[0].doc; else if (withQty.length) {
        // usar el menor o mayor según regla? usamos mayor (último escalón) consistente con política previa
        chosen = withQty.sort((a,b) => b.qty - a.qty)[0].doc;
      }
      if (!chosen) {
        return res.status(404).json({ message: 'Sin productos asociados al código', codigo: codigoStr });
      }
      if (debugPrecio === 'true') console.log('[DEBUG /api/precio] fallback producto', { codigo: codigoStr, escalon, chosenQty: chosen.cantidad ?? chosen.Cantidad });
    }

    // Precio total almacenado para ese escalón (preferimos el guardado, NO escalamos a cantidadReal)
    const precioEscalon = (chosen.price != null ? chosen.price : null);
    const qtyChosen = chosen.cantidad;
    const precioUnitario = chosen.precio_unitario ?? ((precioEscalon && qtyChosen) ? (precioEscalon / qtyChosen) : null);
    if (precioEscalon == null) {
      return res.status(500).json({ message: 'Producto sin Precio total en el escalón', productoId: chosen.id, escalon });
    }

    return res.json({
      codigo: String(codigo),
      solicitado: cantidadReal,
      multiplicadorBase: mult,
      escalonUsado: escalon,
      precioEscalon, // Precio total del escalón seleccionado
      precio: precioEscalon, // Alias para el frontend existente
      precioUnitario: precioUnitario != null ? precioUnitario : null,
      productoId: chosen.id,
      qtyProducto: qtyChosen
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error calculando precio' });
  }
});

// --- Inventario por SKU (proxy hacia Azure Webservice) ---
// GET /api/inventario/:sku
// Lógica:
//  - consulta https://kx-endpoints.azurewebsites.net/inventario/{sku}
//  - si inventario > 1000 => "En Existencia"
//  - si inventario <= 1000 => "Agotado"
app.get('/api/inventario/:sku', async (req, res) => {
  try {
    const skuRaw = (req.params.sku || '').toString().trim();
    if (!skuRaw) return res.status(400).json({ message: 'sku requerido' });

    const baseUrl = 'https://kx-endpoints.azurewebsites.net';
    const url = `${baseUrl}/inventario/${encodeURIComponent(skuRaw)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      method: 'GET',
      headers: { 'accept': 'application/json,text/plain;q=0.9,*/*;q=0.8' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(502).json({ message: 'inventario_upstream_error', sku: skuRaw, status: r.status, body: text.slice(0, 500) });
    }

    const contentType = (r.headers.get('content-type') || '').toLowerCase();
    const bodyText = await r.text();

    const tryExtractNumber = (val) => {
      if (val == null) return null;
      if (typeof val === 'number') return Number.isFinite(val) ? val : null;
      if (typeof val === 'string') {
        const n = Number(val.replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) ? n : null;
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          const n = tryExtractNumber(item);
          if (Number.isFinite(n)) return n;
        }
        return null;
      }
      if (typeof val === 'object') {
        // intentar claves típicas primero
        for (const k of ['inventario', 'inventory', 'stock', 'cantidad', 'qty', 'existencia', 'available']) {
          if (k in val) {
            const n = tryExtractNumber(val[k]);
            if (Number.isFinite(n)) return n;
          }
        }
        // fallback: primer número encontrable
        for (const k of Object.keys(val)) {
          const n = tryExtractNumber(val[k]);
          if (Number.isFinite(n)) return n;
        }
      }
      return null;
    };

    let inventario = null;
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(bodyText);
        inventario = tryExtractNumber(parsed);
      } catch {
        inventario = tryExtractNumber(bodyText);
      }
    } else {
      // texto plano (ej: "1234")
      inventario = tryExtractNumber(bodyText);
    }

    if (!Number.isFinite(inventario)) {
      return res.status(502).json({ message: 'inventario_parse_error', sku: skuRaw, raw: bodyText.slice(0, 500) });
    }

    const statusText = inventario > 1000 ? 'En Existencia' : 'Agotado';
    res.json({ sku: skuRaw, inventario, estado: statusText });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      return res.status(504).json({ message: 'inventario_timeout' });
    }
    console.error(e);
    res.status(500).json({ message: 'Error consultando inventario' });
  }
});

app.listen(PORT, () => console.log(`API server listening on ${PORT}`));

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    const b = req.body || {};
    const codigo_siesa = (b.codigo_siesa || b.codigo || '').toString().trim();
    const name = (b.name || '').toString().trim();
    // resolve category if provided (id or textual)
    const categoryResolved = await resolveCategory(b.category);
    const description = (b.description || '').toString().trim();
    const price_unit = (b.price_unit != null ? Number(b.price_unit) : (b.precio_unitario != null ? Number(b.precio_unitario) : null));
    const cantidad = (b.cantidad != null ? Number(b.cantidad) : (b.Cantidad != null ? Number(b.Cantidad) : null));
    let images = [];
    if (b.images) {
      if (typeof b.images === 'string') {
        try { images = JSON.parse(b.images); } catch { images = [b.images]; }
      } else if (Array.isArray(b.images)) images = b.images;
    }
    // Enforce max 4 images
    if (images.length > 4) return res.status(400).json({ message: 'Máximo 4 imágenes permitido' });

    // Build update set dynamically
    const sets = [];
    const params = { id };
    if (codigo_siesa !== '') { sets.push('codigo_siesa = @codigo_siesa'); params.codigo_siesa = codigo_siesa; }
    if (name !== '') { sets.push('name = @name'); params.name = name; }
    if (price_unit != null) { sets.push('price_unit = @price_unit'); params.price_unit = price_unit; }
    if (cantidad != null) { sets.push('cantidad = @cantidad'); params.cantidad = cantidad; }
    if (categoryResolved != null) { sets.push('category = @category'); params.category = categoryResolved; }
    if (description !== '') { sets.push('description = @description'); params.description = description; }
    if (images && images.length >= 0) {
      sets.push('images = @images'); params.images = JSON.stringify(images);
      params.image2 = images[1] || '';
      params.image3 = images[2] || '';
      params.image4 = images[3] || '';
      sets.push('image2 = @image2'); sets.push('image3 = @image3'); sets.push('image4 = @image4');
    }

    if (sets.length === 0) return res.status(400).json({ message: 'Nada para actualizar' });

    const sql = `UPDATE dbo.products SET ${sets.join(', ')} WHERE id = @id; SELECT @@ROWCOUNT as affected;`;
    const r = await db.query(sql, params);
    const affected = r[0] && r[0].affected ? Number(r[0].affected) : 0;
    if (affected === 0) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/products/:id error', e);
    res.status(500).json({ message: 'Error actualizando producto' });
  }
});

// Upload file via server (avoids CORS issues when uploading directly from browser)
const directUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
app.post('/api/upload-file', requireAdmin, directUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    if (!blobServiceClient) return res.status(500).json({ error: 'storage_not_configured' });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${req.file.originalname}`;
    const blobName = rootPath ? `${rootPath}/${filename}` : filename;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    try { await containerClient.createIfNotExists({ access: 'blob' }); } catch (err) { /* ignore */ }
    const blockClient = containerClient.getBlockBlobClient(blobName);
    await blockClient.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
    const blobPathEscaped = blobName.split('/').map(encodeURIComponent).join('/');
    const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobPathEscaped}`;
    return res.json({ ok: true, blobUrl });
  } catch (e) {
    console.error('/api/upload-file error', e);
    res.status(500).json({ error: 'upload_failed' });
  }
});