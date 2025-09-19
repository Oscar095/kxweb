const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, default: '' },
  description: { type: String, default: '' },
  // Guardado en Mongo
  imageData: { type: Buffer },
  imageType: { type: String }
}, { timestamps: true, collection: 'productos' });

productSchema.statics.nextId = async function () {
  const last = await this.findOne().sort({ id: -1 }).lean().exec();
  return (last?.id || 0) + 1;
};

module.exports = mongoose.model('Product', productSchema);