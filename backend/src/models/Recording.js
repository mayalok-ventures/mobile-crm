const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  publicId: { type: String, default: null },
  originalName: { type: String },
  mimetype: { type: String, default: 'audio/webm' },
  size: { type: Number },
  duration: { type: Number, default: 0 }, // seconds
}, { timestamps: true });

recordingSchema.index({ leadId: 1 });
recordingSchema.index({ userId: 1 });
recordingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Recording', recordingSchema);
