const mongoose = require('mongoose');

// Escalones de cantidad (ej: 2000, 4000, 8000, 20000)
// id puede ser string o number; guardamos ambos para flexibilidad
const cantidadSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  cantidad: { type: Number, required: true, min: 1 }
}, { collection: 'Cantidad' });

module.exports = mongoose.model('EscalonCantidad', cantidadSchema);
