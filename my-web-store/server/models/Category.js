const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  nombre: { type: String, required: true, trim: true }
}, { collection: 'Categorias' });

module.exports = mongoose.model('Category', categorySchema);
