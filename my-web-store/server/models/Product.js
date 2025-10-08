const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  data: Buffer,
  type: String,
  filename: String,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },

  // Campos en minúsculas (estándar interno)
  codigo: { type: String, default: '', trim: true, index: true },
  name: { type: String, trim: true },
  price: { type: Number, min: 0 }, // Precio total
  precio_unitario: { type: Number, min: 0 },
  cantidad: { type: Number, min: 0 },
  category: { type: String, default: '' },
  linea: { type: String, default: '' },
  description: { type: String, default: '' },

  // Variantes en español con mayúsculas / espacios para compatibilidad con documentos existentes
  Codigo: { type: String, trim: true },
  Nombre: { type: String, trim: true },
  Precio: { type: Number, min: 0 },
  'Precio Unitario': { type: Number, min: 0 },
  Cantidad: { type: Number, min: 0 },
  Categoria: { type: String, trim: true },
  Linea: { type: String, trim: true },
  Descripcion: { type: String, trim: true },

  // Legacy (una sola imagen)
  imageData: { type: Buffer },
  imageType: { type: String },

  // Nuevo: múltiples imágenes
  images: { type: [imageSchema], default: [] }
}, { timestamps: true, collection: 'productos', strict: false });

// Sincroniza campos antes de validar/guardar para mantener ambas variantes
productSchema.pre('save', function syncFields() {
  // Helper copiar si origen tiene valor y destino está vacío / undefined
  const copy = (fromKey, toKey) => {
    if (this[fromKey] != null && this[toKey] == null) this[toKey] = this[fromKey];
  };

  copy('codigo', 'Codigo'); copy('Codigo', 'codigo');
  copy('name', 'Nombre'); copy('Nombre', 'name');
  copy('price', 'Precio'); copy('Precio', 'price');
  copy('precio_unitario', 'Precio Unitario'); copy('Precio Unitario', 'precio_unitario');
  copy('cantidad', 'Cantidad'); copy('Cantidad', 'cantidad');
  copy('category', 'Categoria'); copy('Categoria', 'category');
  copy('linea', 'Linea'); copy('Linea', 'linea');
  copy('description', 'Descripcion'); copy('Descripcion', 'description');

  // Si no hay price (Precio total) pero sí cantidad y precio_unitario, calcularlo
  if ((this.price == null || Number.isNaN(this.price)) && this.cantidad != null && this.precio_unitario != null) {
    const p = Number(this.cantidad) * Number(this.precio_unitario);
    if (Number.isFinite(p)) {
      this.price = p;
      if (this.Precio == null) this.Precio = p;
    }
  }
});

productSchema.statics.nextId = async function () {
  const last = await this.findOne().sort({ id: -1 }).lean().exec();
  return (last?.id || 0) + 1;
};

module.exports = mongoose.model('Product', productSchema);