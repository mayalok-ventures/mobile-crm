const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  leadName: { type: String },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['follow_up', 'reminder', 'system', 'admin_alert'],
    default: 'follow_up',
  },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
