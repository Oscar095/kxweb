const express = require('express');
const path = require('path');
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Contact = require('./models/Contact');
const LibraryImage = require('./models/LibraryImage');
const EscalonCantidad = require('./models/Cantidad');

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
      filter.$or = [ { category: String(req.query.category) }, { Categoria: String(req.query.category) } ];
    }
    const docs = await Product.find(filter).sort({ codigo: 1, Codigo: 1, cantidad: 1, Cantidad: 1 }).lean().exec();

    // Agrupar por código (normalizado)
    const map = new Map();
    for (const d of docs) {
      const code = (d.codigo || d.Codigo || '').toString();
      if (!code) continue; // omitir sin código
      const existing = map.get(code);
      const qty = Number(d.cantidad ?? d.Cantidad) || 0;
      const hasImagesArr = Array.isArray(d.images) && d.images.length > 0;
      const ver = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
      const arr = hasImagesArr
        ? d.images.map((_, i) => `/api/products/${d.id}/images/${i}?v=${ver}`)
        : (d.imageData ? [`/api/products/${d.id}/image?v=${ver}`] : (d.image ? [d.image] : []));
      const baseObj = {
        id: d.id, // se conservará el id del primer documento (o el menor escalón)
        codigo: code,
        name: d.name || d.Nombre || '',
        price: (d.price != null ? d.price : d.Precio) ?? 0,
        precio_unitario: (d.precio_unitario != null ? d.precio_unitario : d['Precio Unitario']) ?? null,
        cantidad: (d.cantidad != null ? d.cantidad : d.Cantidad) ?? null,
        category: d.category || d.Categoria || '',
        linea: d.linea || d.Linea || '',
        description: d.description || d.Descripcion || '',
        image: arr[0] || '/images/placeholder.svg',
        images: arr,
        _escalones: [qty]
      };
      if (!existing) {
        map.set(code, baseObj);
      } else {
        // Mantener el de menor cantidad como representativo
        const existingQty = Number(existing.cantidad) || 0;
        if (qty > 0 && (existingQty === 0 || qty < existingQty)) {
          baseObj._escalones = Array.from(new Set([...existing._escalones, qty]));
          map.set(code, baseObj);
        } else {
          existing._escalones = Array.from(new Set([...existing._escalones, qty]));
        }
      }
    }

    // Si hubo productos sin código, podríamos opcionalmente incluirlos
    const codeLess = docs.filter(d => !(d.codigo || d.Codigo));
    for (const d of codeLess) {
      const hasImagesArr = Array.isArray(d.images) && d.images.length > 0;
      const ver = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
      const arr = hasImagesArr
        ? d.images.map((_, i) => `/api/products/${d.id}/images/${i}?v=${ver}`)
        : (d.imageData ? [`/api/products/${d.id}/image?v=${ver}`] : (d.image ? [d.image] : []));
      map.set(`__id_${d.id}`, {
        id: d.id,
        codigo: '',
        name: d.name || d.Nombre || '',
        price: (d.price != null ? d.price : d.Precio) ?? 0,
        precio_unitario: (d.precio_unitario != null ? d.precio_unitario : d['Precio Unitario']) ?? null,
        cantidad: (d.cantidad != null ? d.cantidad : d.Cantidad) ?? null,
        category: d.category || d.Categoria || '',
        linea: d.linea || d.Linea || '',
        description: d.description || d.Descripcion || '',
        image: arr[0] || '/images/placeholder.svg',
        images: arr,
        _escalones: [Number(d.cantidad ?? d.Cantidad) || 0]
      });
    }

    const out = Array.from(map.values());
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
      codigo: d.codigo || d.Codigo || '',
      name: d.name || d.Nombre || '',
      price: (d.price != null ? d.price : d.Precio) ?? 0,
      precio_unitario: (d.precio_unitario != null ? d.precio_unitario : d['Precio Unitario']) ?? null,
      cantidad: (d.cantidad != null ? d.cantidad : d.Cantidad) ?? null,
      category: d.category || d.Categoria || '',
      linea: d.linea || d.Linea || '',
      description: d.description || d.Descripcion || '',
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

// --- Biblioteca de imágenes ---
// Listar biblioteca (metadatos)
app.get('/api/biblioteca', async (req, res) => {
  try {
    const docs = await LibraryImage.find().sort({ id: 1 }).lean().exec();
    const ver = Date.now();
    const out = docs.map(d => ({
      id: d.id,
      nombre: d.nombre,
      url: `/api/biblioteca/${d.id}/imagen?v=${ver}`
    }));
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
    const doc = await LibraryImage.findOne({ id }).select('imagen').exec();
    if (!doc || !doc.imagen || !doc.imagen.data) return res.status(404).send('No encontrada');
    const buf = Buffer.isBuffer(doc.imagen.data) ? doc.imagen.data : Buffer.from(doc.imagen.data);
    const ctype = doc.imagen.type || detectImageMime(buf) || 'image/jpeg';
    res.set('Content-Type', ctype);
    res.set('Content-Length', String(buf.length));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(buf);
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
    if (!nombre || !req.file) {
      return res.status(400).json({ message: 'nombre e imagen son requeridos' });
    }
    const id = await LibraryImage.nextId();
    const imagen = { data: req.file.buffer, type: req.file.mimetype, filename: req.file.originalname, size: req.file.size };
    const saved = await LibraryImage.create({ id, nombre: String(nombre).trim(), imagen });
    res.status(201).json({ ok: true, id: saved.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error creando elemento de biblioteca' });
  }
});

// Eliminar elemento de biblioteca (protegido)
app.delete('/api/biblioteca/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    const r = await LibraryImage.deleteOne({ id });
    if (r.deletedCount === 0) return res.status(404).json({ message: 'No encontrado' });
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

// Helper numérico seguro
function asNumber(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Crear producto (con sanitización de numéricos)
app.post('/api/products',
  requireAdmin,
  upload.array('images', 6),
  async (req, res) => {
    try {
      const b = req.body || {};

      // Campos string
      const codigo = (b.codigo || b.Codigo || '').toString().trim();
      const name = (b.name || b.Nombre || '').toString().trim();
      const linea = (b.linea || b.Linea || '').toString().trim();
      const category = (b.category || b.Categoria || '').toString().trim();
      const description = (b.description || b.Descripcion || '').toString().trim();

      // Numéricos con conversión segura
      const cantidad = asNumber(b.cantidad ?? b.Cantidad);
      const precioUnit = asNumber(b.precio_unitario ?? b['Precio Unitario']);
      let price = asNumber(b.price ?? b.Precio);

      if (!name) return res.status(400).json({ message: 'Nombre requerido' });

      if (price === undefined && cantidad !== undefined && precioUnit !== undefined) {
        const mult = Number(cantidad) * Number(precioUnit);
        if (Number.isFinite(mult)) price = mult;
      }

      // ID
      let idNum = asNumber(b.id);
      if (!idNum) idNum = await Product.nextId();

      // Imágenes desde archivos
      const files = req.files || [];
      const images = files.map(f => ({
        data: f.buffer,
        type: f.mimetype,
        filename: f.originalname
      }));

      // Construir doc sin campos inválidos
      const doc = {
        id: idNum,
        codigo, Codigo: codigo,
        name, Nombre: name,
        linea, Linea: linea,
        category, Categoria: category,
        description, Descripcion: description,
        cantidad, Cantidad: cantidad,
        precio_unitario: precioUnit, 'Precio Unitario': precioUnit,
        price, Precio: price,
        images
      };

      // Limpia undefined para evitar CastError
      Object.keys(doc).forEach(k => doc[k] === undefined && delete doc[k]);

      const created = await Product.create(doc);
      res.status(201).json({ ok: true, id: created.id });
    } catch (e) {
      console.error('POST /api/products error', e);
      // Si es validación de mongoose, responder 400
      if (e.name === 'ValidationError' || e.name === 'CastError') {
        return res.status(400).json({ message: 'Datos inválidos', detail: e.message });
      }
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
    let escalonesDocs = await EscalonCantidad.find().lean().exec();
    let escalones = escalonesDocs.map(e => e.cantidad).filter(c => Number.isFinite(c));
    if (!escalones.length) {
      // Derivar escalones de los productos con este código
      const codigoStr = String(codigo);
      const prodDocs = await Product.find({ $or: [ { codigo: codigoStr }, { Codigo: codigoStr } ] }).lean().exec();
      escalones = prodDocs.map(p => p.cantidad ?? p.Cantidad).filter(c => Number.isFinite(Number(c))).map(Number);
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
    const prod = await Product.findOne(query).lean().exec();
    if (debugPrecio === 'true') {
      console.log('[DEBUG /api/precio]', { codigo, cantidadReal, escalon, query, found: !!prod });
    }

    let chosen = prod;
    if (!chosen) {
      // Fallback: buscar el producto con mayor Cantidad <= escalon (ya debería ser escalon) o el máximo disponible para el código
      const allCode = await Product.find({ $or: [ { codigo: codigoStr }, { Codigo: codigoStr } ] }).lean().exec();
      const withQty = allCode.map(p => ({ doc: p, qty: Number(p.cantidad ?? p.Cantidad) })).filter(x => Number.isFinite(x.qty));
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
    const precioEscalon = (chosen.price != null ? chosen.price : chosen.Precio);
    const qtyChosen = chosen.cantidad ?? chosen.Cantidad;
    const precioUnitario = chosen.precio_unitario ?? chosen['Precio Unitario'] ?? ((precioEscalon && qtyChosen) ? (precioEscalon / qtyChosen) : null);
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

app.listen(PORT, () => console.log(`API server listening on ${PORT}`));

app.put('/api/products/:id',
  requireAdmin,
  upload.array('images', 6),
  async (req, res) => {
    try {
      const key = (req.params.id || '').trim();

      // Buscar por _id (ObjectId) o por id numérico
      let product = null;
      if (mongoose.Types.ObjectId.isValid(key)) {
        product = await Product.findById(key);
      }
      if (!product && !Number.isNaN(Number(key))) {
        product = await Product.findOne({ id: Number(key) });
      }
      if (!product) return res.status(404).json({ message: 'No encontrado' });

      const b = req.body || {};
      const asNumber = v => (v === '' || v == null ? undefined : (Number.isFinite(Number(v)) ? Number(v) : undefined));

      // Strings
      product.codigo = product.Codigo = (b.codigo || b.Codigo || '').toString().trim();
      product.name = product.Nombre = (b.name || b.Nombre || '').toString().trim();
      product.linea = product.Linea = (b.linea || b.Linea || '').toString().trim();
      product.category = product.Categoria = (b.category || b.Categoria || '').toString().trim();
      product.description = product.Descripcion = (b.description || b.Descripcion || '').toString().trim();

      // Números
      const cantidad = asNumber(b.cantidad ?? b.Cantidad);
      const pu = asNumber(b.precio_unitario ?? b['Precio Unitario']);
      let price = asNumber(b.price ?? b.Precio);
      if (price === undefined && cantidad !== undefined && pu !== undefined) {
        const mult = Number(cantidad) * Number(pu);
        if (Number.isFinite(mult)) price = mult;
      }
      if (cantidad !== undefined) product.cantidad = product.Cantidad = cantidad;
      if (pu !== undefined) product.precio_unitario = product['Precio Unitario'] = pu;
      if (price !== undefined) product.price = product.Precio = price;

      // Adjuntar nuevas imágenes (binario en memoria)
      const files = req.files || [];
      for (const f of files) {
        product.images.push({ data: f.buffer, type: f.mimetype, filename: f.originalname });
      }
      if (files.length > 0) {
        product.imageData = undefined;
        product.imageType = undefined;
      }

      await product.save();
      res.json({ ok: true, id: product.id, _id: product._id });
    } catch (e) {
      console.error('PUT /api/products/:id error', e);
      if (e.name === 'ValidationError' || e.name === 'CastError') {
        return res.status(400).json({ message: 'Datos inválidos', detail: e.message });
      }
      res.status(500).json({ message: 'Error actualizando producto' });
    }
  }
);