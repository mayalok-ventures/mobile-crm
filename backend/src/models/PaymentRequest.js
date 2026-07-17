const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
  },
  planSelected: {
    type: String,
    enum: ['starter', 'growth', 'pro'],
    required: true,
  },
  originalPrice: {
    type: Number,
    required: true,
  },
  finalPrice: {
    type: Number,
    required: true,
  },
  couponCodeUsed: {
    type: String,
    default: null,
  },
  utrNumber: {
    type: String,
    required: true,
    unique: true,
    minlength: 10,
    trim: true,
  },
  screenshotUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

paymentRequestSchema.index({ userId: 1 });
paymentRequestSchema.index({ status: 1 });

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
