const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const editHistorySchema = new mongoose.Schema({
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changes: { type: mongoose.Schema.Types.Map, of: mongoose.Schema.Types.Mixed }
}, { _id: false });

const leadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  // IMPORTANT: PHONE NORMALIZATION
  // All phone numbers must be stored in digits-only format.
  // Prevents duplicate leads and mismatched queries.
  phone: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  company: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ['new', 'contacted', 'follow_up', 'closed'],
    default: 'new',
  },
  notes: [noteSchema],
  followUpDate: { type: Date, required: true }, // Crucially, next follow-up scheduling is now mandatory!
  followUpNotified: { type: Boolean, default: false },
  lastContactedAt: { type: Date, default: null },
  
  // Custom new fields
  location: { type: String, default: '' },
  profession: { type: String, default: '' },
  budget: { type: String, default: '' },
  areasOfInterest: [{ type: String, trim: true }],
  project: { type: String, default: '' },
  
  // Edit history tracking
  editHistory: [editHistorySchema],

  // Template usage tracking
  templateUsageCount: { type: Number, default: 0 },
  
  // CRITICAL: FREE PLAN MESSAGE LIMIT
  // Free users can send ONLY 1 message per lead.
  // This is enforced via messageSentCount.
  // DO NOT REMOVE OR FREE PLAN WILL BE ABUSED.
  messageSentCount: { type: Number, default: 0 },

  // Source
  source: {
    type: String,
    enum: ['manual', 'referral', 'organic', 'cold_call', 'walk_in', 'other'],
    default: 'manual',
  },
}, { timestamps: true });

// Indexes for fast queries
leadSchema.index({ userId: 1 });
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ userId: 1, tags: 1 });
leadSchema.index({ userId: 1, followUpDate: 1 });
// IMPORTANT — DATA INTEGRITY:
// The compound unique index below (userId + phone) is the DB-level guarantee
// that no user can have two leads with the same phone number.
// The application-level check in leadsController.js is the first line of defense,
// but this index is the last — it prevents race conditions and direct DB inserts.
// DO NOT remove this index. Without it, duplicate leads can silently corrupt
// analytics, campaign sends, and follow-up tracking.
leadSchema.index({ userId: 1, phone: 1 }, { unique: true });
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ name: 'text', phone: 'text', company: 'text', email: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
