const { PLAN_LIMITS } = require('../utils/planLimits');

/**
 * PLAN GUARD MIDDLEWARE — Feature Gate Enforcement
 *
 * Checks if the user's plan allows access to a specific feature.
 * This is separate from plan EXPIRY (handled in auth.js protect middleware).
 *
 * Usage:
 *   router.post('/groups', protect, planGuard('canCreateGroup'), createGroup);
 *   router.post('/campaigns', protect, planGuard('canStartCampaign'), createCampaign);
 *
 * PLAN LIMITS (from utils/planLimits.js — single source of truth):
 *   free:       no groups, no bulk messaging, max 5 leads
 *   starter:    5 groups, 100 recipients/campaign, 1 concurrent campaign
 *   pro:        15 groups, 500 recipients/campaign, 3 concurrent campaigns
 *   enterprise: unlimited groups, 1000 recipients/campaign, 10 concurrent campaigns
 *
 * IMPORTANT: Do NOT hardcode limits in individual controllers.
 * Always reference PLAN_LIMITS from planLimits.js.
 */
const planGuard = (feature) => (req, res, next) => {
  const plan = req.user?.plan || 'free';
  const limits = PLAN_LIMITS[plan];

  if (!limits) {
    return res.status(403).json({
      code: 'PLAN_UNKNOWN',
      message: 'Unknown plan. Please contact support.',
    });
  }

  if (!limits[feature]) {
    return res.status(403).json({
      code: 'PLAN_LIMIT',
      message: `This feature is not available on the ${plan} plan. Please upgrade to access it.`,
      feature,
      currentPlan: plan,
    });
  }

  req.planLimits = limits;
  next();
};

module.exports = { planGuard };
