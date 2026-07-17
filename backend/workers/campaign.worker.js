/**
 * CAMPAIGN WORKER — BullMQ Job Processor
 *
 * IMPORTANT — ARCHITECTURE DECISION:
 * Campaign execution runs here, in a separate background worker process,
 * NOT in the Express API server, NOT in the frontend browser.
 *
 * WHY A WORKER AND NOT A SIMPLE LOOP?
 * 1. Resumable: Jobs persist in Redis. Server restart = jobs continue from where they stopped.
 * 2. Non-blocking: Worker runs in a separate process. Express API stays responsive.
 * 3. Retryable: BullMQ handles automatic retry with configurable backoff.
 * 4. Auditable: Every job attempt is logged. Progress is visible via campaign.sentCount.
 * 5. Pausable: Worker checks campaign.status before each send. If paused, it exits cleanly.
 *
 * DO NOT convert this to a synchronous loop inside an API controller.
 * DO NOT move any sending logic to the frontend.
 * DO NOT use window.open or wa.me redirects for bulk sends.
 *
 * NOTE — RESTART RECOVERY:
 * Jobs persist in Redis across server restarts.
 * When the worker process boots, BullMQ automatically picks up any jobs
 * that were in 'active' state when the server went down.
 * DO NOT clear Redis queues unless you intentionally want to reset all campaigns.
 * Redis flush = all pending campaigns lost = users lose progress.
 *
 * PAUSE MECHANISM:
 * The worker checks Group/Campaign document's 'campaignStatus' field before each send.
 * If status is 'paused', the worker saves lastSentIndex and exits the job.
 * Resume = re-enqueue job starting at lastSentIndex.
 *
 * ANTI-SPAM DELAYS:
 * - 2-5 second random delay between each message send (Baileys/WA protection)
 * - Auto-pause every 50 sends (10 second cooling break)
 * - Max 3 retry attempts per individual message before logging as 'failed'
 *
 * TODO: Implement this file using the design in implementation_plan.md → Queue System Design
 */

// const { Worker } = require('bullmq');
// const { redisConnection } = require('../src/config/redis');
// const waSession = require('../src/services/waSession');
// const Campaign = require('../src/models/Campaign');
// const CampaignLog = require('../src/models/CampaignLog');
// const Group = require('../src/models/Group');

// const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// const worker = new Worker('campaign-queue', async (job) => {
//   const { campaignId, userId, leads, template, startIndex = 0 } = job.data;
//
//   // Set campaign to running
//   await Campaign.findByIdAndUpdate(campaignId, { status: 'running', startedAt: new Date() });
//
//   let sentCount = startIndex;
//
//   for (let i = startIndex; i < leads.length; i++) {
//     // IMPORTANT: Check pause signal before each send
//     const campaign = await Campaign.findById(campaignId).lean();
//     if (!campaign || campaign.status === 'paused' || campaign.status === 'cancelled') {
//       await Campaign.findByIdAndUpdate(campaignId, { lastSentIndex: i - 1 });
//       return; // Exit cleanly — BullMQ will not retry (job succeeded from queue perspective)
//     }
//
//     const lead = leads[i];
//     let attempts = 0;
//     let sent = false;
//
//     while (!sent && attempts < 3) {
//       try {
//         const text = template.replace(/{name}/gi, lead.name).replace(/{phone}/gi, lead.phone);
//         await waSession.sendText(userId, lead.phone, text);
//         sent = true;
//       } catch (err) {
//         attempts++;
//         if (attempts >= 3) {
//           await CampaignLog.create({ campaignId, userId, number: lead.phone, status: 'failed', error: err.message });
//         } else {
//           await sleep(2000);
//         }
//       }
//     }
//
//     if (sent) {
//       sentCount++;
//       await Campaign.findByIdAndUpdate(campaignId, { sentCount, lastSentIndex: i });
//       await CampaignLog.create({ campaignId, userId, number: lead.phone, leadId: lead._id, status: 'sent' });
//
//       // Anti-spam: pause 10s every 50 sends
//       if (sentCount > 0 && sentCount % 50 === 0 && i < leads.length - 1) {
//         await sleep(10000);
//       }
//     }
//
//     // Random 2-5s delay between sends
//     if (i < leads.length - 1) {
//       await sleep(2000 + Math.random() * 3000);
//     }
//   }
//
//   await Campaign.findByIdAndUpdate(campaignId, { status: 'completed', completedAt: new Date() });
//
// }, { connection: redisConnection, concurrency: 5 });

// worker.on('failed', async (job, err) => {
//   console.error(`[CampaignWorker] Job ${job.id} failed:`, err.message);
//   await Campaign.findByIdAndUpdate(job.data.campaignId, { status: 'failed' });
// });

// module.exports = worker;

console.log('[campaign.worker.js] Stub file — implementation pending. See implementation_plan.md.');
