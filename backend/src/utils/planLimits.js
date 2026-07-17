/**
 * PLAN LIMITS — Single Source of Truth
 *
 * IMPORTANT:
 * All plan feature limits are defined HERE and only here.
 * Do NOT hardcode limits inside individual controllers.
 * If you change a limit in one place and not others, they will drift.
 *
 * REFERENCE TABLE:
 * ┌──────────────┬────────────┬──────────────────────────┬───────────────────┬────────────┐
 * │ Plan         │ Max Leads  │ Max Groups               │ Max Recipients    │ Concurrent │
 * ├──────────────┼────────────┼──────────────────────────┼───────────────────┼────────────┤
 * │ free         │ 5          │ 0 (no bulk messaging)    │ 0                 │ 0          │
 * │ starter      │ unlimited  │ 5                        │ 100 per campaign  │ 1 job      │
 * │ pro          │ unlimited  │ 15                       │ 500 per campaign  │ 3 jobs     │
 * │ enterprise   │ unlimited  │ unlimited                │ 1000 per campaign │ 10 jobs    │
 * └──────────────┴────────────┴──────────────────────────┴───────────────────┴────────────┘
 *
 * HOW TO USE:
 *   const { PLAN_LIMITS } = require('../utils/planLimits');
 *   const limits = PLAN_LIMITS[req.user.plan];
 *   if (currentGroupCount >= limits.maxGroups) → 403
 *
 * ADDING A NEW PLAN:
 * 1. Add it here in PLAN_LIMITS
 * 2. Add it to User.js schema enum
 * 3. Update adminController.js validPlans array
 * 4. Update plans/page.js PLANS array on frontend
 */

// SINGLE SOURCE OF TRUTH FOR ALL PLAN LIMITS
// Any change here impacts lead limits, group limits, campaign access
// DO NOT HARD-CODE LIMITS ANYWHERE ELSE
const PLAN_LIMITS = {
  free: {
    maxLeads: 10,
    maxGroups: 1,
    maxRecipientsPerCampaign: 0,
    maxConcurrentCampaigns: 0,
    canStartCampaign: false,
    canCreateGroup: true,
  },
  starter: {
    maxLeads: 200,
    maxGroups: 5,
    maxRecipientsPerCampaign: 100,
    maxConcurrentCampaigns: 1,
    canStartCampaign: true,
    canCreateGroup: true,
  },
  growth: {
    maxLeads: 1000,
    maxGroups: 15,
    maxRecipientsPerCampaign: 500,
    maxConcurrentCampaigns: 3,
    canStartCampaign: true,
    canCreateGroup: true,
  },
  pro: {
    maxLeads: Infinity,
    maxGroups: Infinity,
    maxRecipientsPerCampaign: 10000,
    maxConcurrentCampaigns: 10,
    canStartCampaign: true,
    canCreateGroup: true,
  },
};

// Plan Prices Map
const PLAN_PRICES = {
  free: 0,
  starter: 199,
  growth: 499,
  pro: 999,
};

module.exports = { PLAN_LIMITS, PLAN_PRICES };

