const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  data: Buffer,
  type: String,
  filename: String,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  codigo: { type: String, default: '', trim: true, index: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, default: '' },
  description: { type: String, default: '' },

  // Legacy (una sola imagen)
  imageData: { type: Buffer },
  imageType: { type: String },

  // Nuevo: múltiples imágenes
  images: { type: [imageSchema], default: [] }
}, { timestamps: true, collection: 'productos' });

productSchema.statics.nextId = async function () {
  const last = await this.findOne().sort({ id: -1 }).lean().exec();
  return (last?.id || 0) + 1;
};

module.exports = mongoose.model('Product', productSchema);