const express = require('express');
const path = require('path');
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('./models/Product');

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
    const docs = await Product.find().sort({ id: 1 }).lean().exec();
    const out = docs.map(d => {
      const hasImagesArr = Array.isArray(d.images) && d.images.length > 0;
      const ver = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
      const arr = hasImagesArr
        ? d.images.map((_, i) => `/api/products/${d.id}/images/${i}?v=${ver}`)
        : (d.imageData ? [`/api/products/${d.id}/image?v=${ver}`] : (d.image ? [d.image] : []));
      return {
        id: d.id,
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
  upload.fields([{ name: 'images', maxCount: 6 }, { name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { id, name, price, category, description } = req.body || {};
      const numericPrice = Number(price);
      if (!name || Number.isNaN(numericPrice)) {
        return res.status(400).json({ message: 'Nombre y precio son requeridos' });
      }

      const newId = (id == null || id === '') ? await Product.nextId() : Number(id);
      if (Number.isNaN(newId)) return res.status(400).json({ message: 'ID inválido' });

      const doc = {
        id: newId,
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