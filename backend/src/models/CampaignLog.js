const mongoose = require('mongoose');

// IMPORTANT — SEPARATE FROM GROUP.JS:
// CampaignLog is the per-message delivery record.
// Previously embedded inside Group.js — now a dedicated collection.
// Enables proper pagination, querying, and analytics without loading the entire group.
//
// status: 'sent' = Baileys sendMessage() completed without error
// status: 'failed' = all retry attempts exhausted
// status: 'skipped' = lead was excluded (closed status etc.)
//
// DO NOT create CampaignLog records with number: 'paused_placeholder'.
// Pause state is tracked in Campaign.status — not in log records.
const campaignLogSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  number: { type: String, required: true },
  leadName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['sent', 'failed', 'skipped'],
    required: true,
  },
  error: { type: String, default: null },
  attemptCount: { type: Number, default: 1 },
  timestamp: { type: Date, default: Date.now },
});

campaignLogSchema.index({ campaignId: 1, timestamp: 1 });
campaignLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('CampaignLog', campaignLogSchema);
