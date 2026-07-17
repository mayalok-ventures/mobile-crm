const mongoose = require('mongoose');

// IMPORTANT — CAMPAIGN MODEL:
// This is the source of truth for campaign execution state.
// The campaign worker (services/campaignWorker.js) polls this collection every 5s.
// Status transitions:
//   queued → running (worker picks it up)
//   running → paused (user pauses OR WA disconnects)
//   running → completed (all leads processed)
//   running → failed (unrecoverable error)
//   paused → queued (user resumes → worker re-picks)
//   any → cancelled (user cancels)
//
// RESTART RECOVERY:
// On server start, campaignWorker resets all 'running' → 'queued'.
// This re-queues any campaigns that were interrupted by a crash.
// lastSentIndex tells the worker where to resume from.
const campaignSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  name: { type: String, required: true, trim: true },
  template: { type: String, required: true },
  status: {
    type: String,
    enum: ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'queued',
  },
  totalLeads: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  lastSentIndex: { type: Number, default: -1 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
}, { timestamps: true });

// Index for worker polling (status: queued)
campaignSchema.index({ status: 1 });
// Index for user campaign list
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
