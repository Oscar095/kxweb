const express = require('express');
const path = require('path');
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('./models/Product');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

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
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || 'pub_test_placeholder';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_secret_placeholder';

// Servir frontend estático
const staticDir = path.resolve(__dirname, '..', 'src');
app.use(express.static(staticDir));

// Conexión Mongo
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB', err));

// API Products
app.get('/api/products', async (req, res) => {
  try {
    const docs = await Product.find().sort({ id: 1 }).lean().exec();
    const out = docs.map(d => {
      const hasImage = !!d.imageData;
      const ver = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
      return {
        id: d.id,
        name: d.name,
        price: d.price,
        category: d.category,
        description: d.description,
        image: hasImage
          ? `/api/products/${d.id}/image?v=${ver}`
          : (d.image ? d.image : '/images/placeholder.svg')
      };
    });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error listando productos' });
  }
});

// Imagen binaria desde Mongo
app.get('/api/products/:id/image', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).send('ID inválido');

    // IMPORTANTE: no usar .lean() para preservar Buffer nativo
    const doc = await Product.findOne({ id }).select('imageData imageType updatedAt').exec();
    if (!doc || !doc.imageData) return res.status(404).send('Sin imagen');

    const buf = toBuffer(doc.imageData);
    if (!buf || buf.length === 0) return res.status(404).send('Imagen vacía');

    const ctype = doc.imageType || detectImageMime(buf) || 'image/jpeg';

    console.log('img', id, 'len=', buf.length, 'type=', ctype); // tEMPORAL

    res.set('Content-Type', ctype);
    res.set('Content-Length', String(buf.length));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(buf);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error obteniendo imagen');
  }
});

// Crear/actualizar producto (multipart/form-data)
app.post('/api/products', upload.single('image'), async (req, res) => {
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

    if (req.file) {
      doc.imageData = req.file.buffer;
      doc.imageType = req.file.mimetype; // ej. image/png, image/jpeg
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
});

// --- API Payments (mantener tus endpoints existentes) ---

app.listen(PORT, () => console.log(`API server listening on ${PORT}`));