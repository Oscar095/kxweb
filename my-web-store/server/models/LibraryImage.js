const mongoose = require('mongoose');

const imagenSchema = new mongoose.Schema({
  data: Buffer,
  type: String,
  filename: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const libraryImageSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  nombre: { type: String, required: true, trim: true },
  imagen: { type: imagenSchema, required: true }
}, { timestamps: true, collection: 'Biblioteca' });

libraryImageSchema.statics.nextId = async function () {
  const last = await this.findOne().sort({ id: -1 }).lean().exec();
  return (last?.id || 0) + 1;
};

module.exports = mongoose.model('LibraryImage', libraryImageSchema);
