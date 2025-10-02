const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  data: Buffer,
  type: String,
  filename: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const contactSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  message: { type: String, required: true, trim: true },
  attachments: { type: [attachmentSchema], default: [] }
}, { timestamps: true, collection: 'Contactos' });

contactSchema.statics.nextId = async function () {
  const last = await this.findOne().sort({ id: -1 }).lean().exec();
  return (last?.id || 0) + 1;
};

module.exports = mongoose.model('Contact', contactSchema);
