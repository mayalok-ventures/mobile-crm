const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['tag_based', 'manual'],
    default: 'manual',
  },
  // For tag-based groups
  tags: [{ type: String }],
  // For manual groups
  leadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
  lastSentIndex: { type: Number, default: -1 },
  campaignStatus: {
    type: String,
    enum: ['idle', 'sending', 'paused', 'completed'],
    default: 'idle',
  },
  campaignTemplate: { type: String, default: '' },
}, { timestamps: true });

groupSchema.index({ userId: 1 });
groupSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Group', groupSchema);

