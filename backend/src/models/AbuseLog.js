const mongoose = require('mongoose');

// SECURITY — ABUSE LOG:
// Records suspicious or abusive activity per user/IP.
// Used by the admin panel to review and take action.
//
// TTL: Documents auto-delete after 90 days (7,776,000 seconds).
// This keeps the collection small without manual cleanup.
//
// type definitions:
//   too_many_requests → rate limiter triggered
//   bulk_spam        → too many campaign sends in short window
//   invalid_login    → failed login attempt
//   suspicious_activity → admin-flagged manually
const abuseLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ip: { type: String, default: null },
  type: {
    type: String,
    enum: ['too_many_requests', 'bulk_spam', 'invalid_login', 'suspicious_activity'],
    required: true,
  },
  detail: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

// Auto-expire after 90 days
abuseLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });
// Query index for admin panel
abuseLogSchema.index({ userId: 1, type: 1, timestamp: -1 });
abuseLogSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('AbuseLog', abuseLogSchema);
