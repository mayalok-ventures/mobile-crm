const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  url: { type: String, required: true }
}, { _id: false });

const templateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  text: { type: String, required: true },
  imageFile: { type: fileSchema, default: null },
  videoFile: { type: fileSchema, default: null },
  docFile: { type: fileSchema, default: null },
  tags: [{ type: String }],
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

templateSchema.index({ userId: 1 });
templateSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Template', templateSchema);
