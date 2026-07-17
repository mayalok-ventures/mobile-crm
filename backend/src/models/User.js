const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    unique: true,
  },
  // IMPORTANT: PHONE NORMALIZATION
  // All phone numbers must be stored in digits-only format.
  // Prevents duplicate leads and mismatched queries.
  phone: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
  },
  password: { type: String, required: true },

  // Auto-generated 7-character unique identifier (e.g. A7K9P2X)
  // Generated on registration. Never changes. Used for admin identification.
  username: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true,
    unique: true,
    immutable: true,
  },

  plan: {
    type: String,
    enum: ['free', 'starter', 'growth', 'pro'],
    default: 'free',
  },
  // CRITICAL: BILLING LOGIC
  // If planStartDate and planEndDate are not set here,
  // user will get unlimited access without expiry.
  // DO NOT REMOVE OR MODIFY WITHOUT CHECKING PLAN EXPIRY FLOW
  planStartDate: { type: Date, default: null },
  planEndDate: { type: Date, default: null },

  // Billing history/current plan pricing details
  billing: {
    originalPrice: { type: Number, default: 0 },
    discountedPrice: { type: Number, default: 0 },
    couponCodeUsed: { type: String, default: null },
  },

  isActive: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  lastLogin: { type: Date },

  // Suspension system:
  // Level 1 → 24 hours   (warning)
  // Level 2 → 7 days     (repeated abuse)
  // Level 3 → 30 days    (serious violation)
  // Level 4 → permanent  (suspendedUntil = null means permanent)
  suspension: {
    isSuspended: { type: Boolean, default: false },
    level: { type: Number, default: 0, min: 0, max: 4 },
    reason: { type: String, default: null },
    suspendedAt: { type: Date, default: null },
    suspendedUntil: { type: Date, default: null }, // null when isSuspended + level=4 = permanent
  },

  // Failed login tracking for abuse detection
  loginAttempts: { type: Number, default: 0 },
  lastFailedLogin: { type: Date, default: null },

  // Cumulative abuse score (incremented by abuse detector)
  abuseScore: { type: Number, default: 0 },

  // Share dashboard token
  shareToken: { type: String, default: null },
  shareTokenEnabled: { type: Boolean, default: false },
}, { timestamps: true });

// Indexes for fast lookups (unique:true already creates these)

// Validate: at least one of email or phone must be present
userSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    return next(new Error('At least one of email or phone is required'));
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
