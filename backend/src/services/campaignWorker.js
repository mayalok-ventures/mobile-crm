/**
 * CAMPAIGN WORKER — MongoDB-Backed Job Processor
 *
 * ARCHITECTURE:
 * No Redis/BullMQ required. Uses MongoDB as the persistent job store.
 * Polls Campaign collection every 5 seconds for queued jobs.
 * Multiple campaigns can run concurrently (up to planLimits.maxConcurrentCampaigns).
 *
 * RESTART RECOVERY:
 * On startup, all 'running' campaigns are reset to 'queued'.
 * This re-queues any campaigns interrupted by a server crash.
 * The worker picks them up and resumes from lastSentIndex + 1.
 *
 * REAL MESSAGE DELIVERY:
 * Sends via Baileys waSession.sendText(). This is a real WhatsApp send.
 * NOT window.open. NOT wa.me redirect. Actual programmatic delivery.
 *
 * PAUSE MECHANISM:
 * Worker checks Campaign.status before each send.
 * If status becomes 'paused' or 'cancelled', worker exits cleanly.
 * lastSentIndex is saved so resume can continue from the correct position.
 *
 * ANTI-SPAM:
 * - 3–5s random delay between sends
 * - 10s pause every 30 sends
 * - Max 3 retry attempts per message before logging as 'failed'
 *
 * DO NOT convert this to a synchronous loop. DO NOT move this to frontend.
 */

const Campaign = require('../models/Campaign');
const CampaignLog = require('../models/CampaignLog');
const Lead = require('../models/Lead');
const Group = require('../models/Group');
const waSession = require('./waSession');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const POLL_INTERVAL_MS = 5000;      // Check for new jobs every 5s
const DELAY_BETWEEN_SENDS_MS = 3000; // Base delay between messages
const DELAY_JITTER_MS = 2000;        // Random additional delay (anti-pattern detection)
const ANTI_SPAM_BATCH = 30;          // Pause every N sends
const ANTI_SPAM_PAUSE_MS = 10000;    // Duration of anti-spam pause
const MAX_RETRIES = 3;               // Max attempts per individual message

// Track currently processing campaign IDs (prevents double-processing same campaign)
const runningCampaigns = new Set();

/**
 * Process a single campaign end-to-end.
 * Sends real WhatsApp messages via Baileys.
 * Resumable from lastSentIndex after pause/restart.
 */
const processCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || campaign.status !== 'running') {
      runningCampaigns.delete(campaignId.toString());
      return;
    }

    // Resolve leads from group
    const group = await Group.findOne({ _id: campaign.groupId, userId: campaign.userId }).lean();
    if (!group) {
      await Campaign.findByIdAndUpdate(campaignId, { status: 'failed' });
      runningCampaigns.delete(campaignId.toString());
      return;
    }

    let leads;
    if (group.type === 'tag_based' && group.tags.length > 0) {
      leads = await Lead.find({
        userId: campaign.userId,
        tags: { $in: group.tags },
        status: { $ne: 'closed' },
      }).limit(1000).lean();
    } else {
      leads = await Lead.find({
        _id: { $in: group.leadIds },
        userId: campaign.userId,
      }).limit(1000).lean();
    }

    if (leads.length === 0) {
      await Campaign.findByIdAndUpdate(campaignId, { status: 'completed', completedAt: new Date() });
      runningCampaigns.delete(campaignId.toString());
      return;
    }

    // Update totalLeads (may differ from initial count if tag-based group changed)
    await Campaign.findByIdAndUpdate(campaignId, { totalLeads: leads.length });

    const startIndex = campaign.lastSentIndex + 1;

    for (let i = startIndex; i < leads.length; i++) {
      // Check pause/cancel signal (re-read from DB before each send)
      const fresh = await Campaign.findById(campaignId).select('status').lean();
      if (!fresh || fresh.status === 'paused' || fresh.status === 'cancelled') {
        // Save last known position before exiting
        await Campaign.findByIdAndUpdate(campaignId, { lastSentIndex: i - 1 });
        runningCampaigns.delete(campaignId.toString());
        return;
      }

      // Check WhatsApp session is still alive
      const waStatus = waSession.getStatus(campaign.userId);
      if (waStatus.status !== 'connected') {
        await Campaign.findByIdAndUpdate(campaignId, {
          status: 'paused',
          pausedAt: new Date(),
          lastSentIndex: i - 1,
        });
        runningCampaigns.delete(campaignId.toString());
        console.log(`[CampaignWorker] Campaign ${campaignId} paused — WhatsApp disconnected`);
        return;
      }

      const lead = leads[i];

      // Personalize template
      const text = campaign.template
        .replace(/{name}/gi, lead.name || '')
        .replace(/{phone}/gi, lead.phone || '')
        .replace(/{company}/gi, lead.company || '')
        .trim();

      // Attempt send with retries
      let sent = false;
      let attempts = 0;
      let lastError = null;

      while (!sent && attempts < MAX_RETRIES) {
        try {
          await waSession.sendText(campaign.userId, lead.phone, text);
          sent = true;
        } catch (err) {
          attempts++;
          lastError = err.message;
          if (attempts < MAX_RETRIES) {
            await sleep(2000);
          }
        }
      }

      // Log delivery result
      await CampaignLog.create({
        campaignId,
        userId: campaign.userId,
        groupId: campaign.groupId,
        leadId: lead._id,
        number: lead.phone,
        leadName: lead.name || '',
        status: sent ? 'sent' : 'failed',
        error: sent ? null : lastError,
        attemptCount: attempts,
      });

      // Update campaign progress atomically
      const update = { lastSentIndex: i };
      if (sent) update.$inc = { sentCount: 1 };
      else update.$inc = { failedCount: 1 };
      await Campaign.findByIdAndUpdate(campaignId, update);

      // Anti-spam: pause every ANTI_SPAM_BATCH sends
      const batchPosition = (i - startIndex + 1);
      if (batchPosition % ANTI_SPAM_BATCH === 0 && i < leads.length - 1) {
        console.log(`[CampaignWorker] Anti-spam pause for campaign ${campaignId}`);
        await sleep(ANTI_SPAM_PAUSE_MS);
      } else if (i < leads.length - 1) {
        // Random delay between sends
        await sleep(DELAY_BETWEEN_SENDS_MS + Math.random() * DELAY_JITTER_MS);
      }
    }

    // All leads processed
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'completed',
      completedAt: new Date(),
    });
    console.log(`[CampaignWorker] Campaign ${campaignId} completed`);

  } catch (err) {
    console.error(`[CampaignWorker] Campaign ${campaignId} fatal error:`, err.message);
    await Campaign.findByIdAndUpdate(campaignId, { status: 'failed' }).catch(() => {});
  } finally {
    runningCampaigns.delete(campaignId.toString());
  }
};

/**
 * Reset any campaigns stuck in 'running' state from before the last server restart.
 * Without this, interrupted campaigns would never be picked up again.
 */
const resetStaleCampaigns = async () => {
  const result = await Campaign.updateMany(
    { status: 'running' },
    { status: 'queued' }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CampaignWorker] Reset ${result.modifiedCount} stale running campaign(s) to queued`);
  }
};

/**
 * Main worker loop. Polls MongoDB every POLL_INTERVAL_MS for queued campaigns.
 * Processes up to 3 campaigns concurrently.
 * Uses atomic findOneAndUpdate to prevent two workers from claiming the same campaign.
 */
const startWorker = () => {
  // Reset stale campaigns first
  resetStaleCampaigns().catch(err =>
    console.error('[CampaignWorker] Failed to reset stale campaigns:', err.message)
  );

  setInterval(async () => {
    try {
      // Find queued campaigns not already being processed
      const queued = await Campaign.find({ status: 'queued' }).limit(3).lean();

      for (const campaign of queued) {
        const id = campaign._id.toString();
        if (runningCampaigns.has(id)) continue;

        // Atomic claim — prevents two server instances from both processing same campaign
        const claimed = await Campaign.findOneAndUpdate(
          { _id: campaign._id, status: 'queued' },
          { status: 'running', startedAt: new Date() },
          { new: true }
        );
        if (!claimed) continue; // Another process already claimed it

        runningCampaigns.add(id);

        // Run campaign async — does not block the poll loop
        processCampaign(campaign._id).catch(err => {
          console.error(`[CampaignWorker] Unhandled error for campaign ${id}:`, err.message);
          runningCampaigns.delete(id);
        });
      }
    } catch (err) {
      console.error('[CampaignWorker] Poll loop error:', err.message);
    }
  }, POLL_INTERVAL_MS);

  console.log(`[CampaignWorker] Started. Polling every ${POLL_INTERVAL_MS / 1000}s for queued campaigns.`);
};

module.exports = { startWorker };
