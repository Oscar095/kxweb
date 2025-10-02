const express = require('express');
const path = require('path');
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Contact = require('./models/Contact');

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

    const finalRedirect = redirectUrl || `${req.protocol}://${req.get('host')}/checkout.html`;

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

// Conexión Mongo
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB', err));

// API Products
// GET listado: incluye array images y mantiene 'image' como la primera
app.get('/api/products', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== 'all') {
      filter.category = String(req.query.category);
    }
    const docs = await Product.find(filter).sort({ id: 1 }).lean().exec();
    const out = docs.map(d => {
      const hasImagesArr = Array.isArray(d.images) && d.images.length > 0;
      const ver = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
      const arr = hasImagesArr
        ? d.images.map((_, i) => `/api/products/${d.id}/images/${i}?v=${ver}`)
        : (d.imageData ? [`/api/products/${d.id}/image?v=${ver}`] : (d.image ? [d.image] : []));
      return {
        id: d.id,
        codigo: d.codigo || '',
        name: d.name,
        price: d.price,
        category: d.category,
        description: d.description,
        image: arr[0] || '/images/placeholder.svg',
        images: arr
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
    const d = await Product.findOne({ id }).lean().exec();
    if (!d) return res.status(404).json({ message: 'Producto no encontrado' });
    const hasImagesArr = Array.isArray(d.images) && d.images.length > 0;
    const ver = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
    const arr = hasImagesArr
      ? d.images.map((_, i) => `/api/products/${d.id}/images/${i}?v=${ver}`)
      : (d.imageData ? [`/api/products/${d.id}/image?v=${ver}`] : (d.image ? [d.image] : []));
    const out = {
      id: d.id,
      codigo: d.codigo || '',
      name: d.name,
      price: d.price,
      category: d.category,
      description: d.description,
      image: arr[0] || '/images/placeholder.svg',
      images: arr
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
    const cats = await Category.find().sort({ id: 1 }).lean().exec();
    res.json(cats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error listando categorías' });
  }
});

// Imagen principal (legacy o la 0 del array)
app.get('/api/products/:id/image', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).send('ID inválido');

    const doc = await Product.findOne({ id }).select('imageData imageType images updatedAt').exec();
    if (!doc) return res.status(404).send('Sin imagen');

    let buf, ctype;
    if (doc.imageData) {
      buf = Buffer.isBuffer(doc.imageData) ? doc.imageData : Buffer.from(doc.imageData);
      ctype = doc.imageType || detectImageMime(buf) || 'image/jpeg';
    } else if (doc.images && doc.images.length > 0) {
      const it = doc.images[0];
      buf = Buffer.isBuffer(it.data) ? it.data : Buffer.from(it.data);
      ctype = it.type || detectImageMime(buf) || 'image/jpeg';
    } else {
      return res.status(404).send('Sin imagen');
    }

    res.set('Content-Type', ctype);
    res.set('Content-Length', String(buf.length));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(buf);
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

    const doc = await Product.findOne({ id }).select('images updatedAt').exec();
    if (!doc || !doc.images || !doc.images[idx]) return res.status(404).send('Imagen no encontrada');

    const it = doc.images[idx];
    const buf = Buffer.isBuffer(it.data) ? it.data : Buffer.from(it.data);
    const ctype = it.type || detectImageMime(buf) || 'image/jpeg';

    res.set('Content-Type', ctype);
    res.set('Content-Length', String(buf.length));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(buf);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error obteniendo imagen');
  }
});

// Crear/actualizar producto: acepta múltiples imágenes
app.post('/api/products',
  requireAdmin,
  upload.fields([{ name: 'images', maxCount: 6 }, { name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
  const { id, name, price, category, description, codigo } = req.body || {};
      const numericPrice = Number(price);
      if (!name || Number.isNaN(numericPrice)) {
        return res.status(400).json({ message: 'Nombre y precio son requeridos' });
      }

      const newId = (id == null || id === '') ? await Product.nextId() : Number(id);
      if (Number.isNaN(newId)) return res.status(400).json({ message: 'ID inválido' });

      const doc = {
        id: newId,
        codigo: (codigo == null ? '' : String(codigo).trim()),
        name: String(name).trim(),
        price: numericPrice,
        category: category || '',
        description: description || ''
      };

      // Construir imágenes desde los archivos si llegaron
      const imgs = [];
      const many = (req.files?.images || []);
      const single = (req.files?.image || []);
      for (const f of [...many, ...single]) {
        imgs.push({ data: f.buffer, type: f.mimetype, filename: f.originalname });
      }
      if (imgs.length > 0) {
        doc.images = imgs;
        // opcional: limpiar legacy para no duplicar almacenamiento
        doc.imageData = undefined;
        doc.imageType = undefined;
      }

      const saved = await Product.findOneAndUpdate(
        { id: newId },
        { $set: doc },
        { new: true, upsert: true }
      ).lean();

      res.status(201).json({ ok: true, id: saved.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Error creando producto' });
    }
  }
);

app.delete('/api/products/:id', async (req, res) => {
  // proteger borrado
  const { adminToken } = getCookies(req);
  const data = verifyToken(adminToken);
  if (!data || data.sub !== 'admin') return res.status(401).json({ message: 'No autorizado' });
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });

    const r = await Product.deleteOne({ id });
    if (r.deletedCount === 0) return res.status(404).json({ message: 'Producto no encontrado' });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error eliminando producto' });
  }
});

// --- API Payments (mantener tus endpoints existentes) ---

app.listen(PORT, () => console.log(`API server listening on ${PORT}`));