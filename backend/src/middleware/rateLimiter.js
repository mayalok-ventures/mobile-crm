const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const AbuseLog = require('../models/AbuseLog');

// Track and apply automatic suspensions based on cumulative abuse
const handleAbuse = async (req, type, detail) => {
  try {
    const userId = req.user?._id || null;
    const ip = req.ip;

    // Log abuse event in DB with 90-day TTL
    await AbuseLog.create({
      userId,
      ip,
      type,
      detail: `${detail} (IP: ${ip})`,
    });

    if (userId) {
      // Check if user is admin to bypass
      const checkAdmin = await User.findById(userId).lean();
      if (checkAdmin && checkAdmin.isAdmin) {
        console.log(`Bypassing abuse score increment and suspension for Admin: ${userId}`);
        return;
      }

      // Increment user abuse score
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { abuseScore: 1 } },
        { new: true }
      );

      if (user) {
        let suspendLevel = 0;
        let durationMs = 0;
        const reason = `Automated system block: ${detail}`;

        if (user.abuseScore >= 8) {
          suspendLevel = 4; // Permanent
        } else if (user.abuseScore >= 5) {
          suspendLevel = 2; // 7 days
          durationMs = 7 * 24 * 60 * 60 * 1000;
        } else if (user.abuseScore >= 3) {
          suspendLevel = 1; // 24 hours
          durationMs = 24 * 60 * 60 * 1000;
        }

        if (suspendLevel > 0) {
          const now = new Date();
          const suspendedUntil = suspendLevel === 4 ? null : new Date(now.getTime() + durationMs);

          await User.findByIdAndUpdate(userId, {
            $set: {
              'suspension.isSuspended': true,
              'suspension.level': suspendLevel,
              'suspension.reason': reason,
              'suspension.suspendedAt': now,
              'suspension.suspendedUntil': suspendedUntil,
            }
          });

          if (suspendLevel === 4) {
            const waSession = require('../services/waSession');
            await waSession.disconnect(userId).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('handleAbuse error:', err);
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  handler: async (req, res, next, options) => {
    // Record rate limit violation
    await handleAbuse(req, 'too_many_requests', 'API rate limit exceeded');
    res.status(options.statusCode).send(options.message);
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again in 15 minutes.' },
  handler: async (req, res, next, options) => {
    // Record login spam violation
    await handleAbuse(req, 'invalid_login', 'Login limit exceeded');
    res.status(options.statusCode).send(options.message);
  }
});

const bulkSendGuard = async (req, res, next) => {
  const userId = req.user?._id?.toString();
  if (!userId) return next();
  if (req.user?.isAdmin) return next();

  // MongoDB-backed bulk send protection to make it horizontally scalable
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  try {
    const CampaignLog = require('../models/CampaignLog');
    const recentSends = await CampaignLog.countDocuments({
      userId,
      timestamp: { $gte: tenMinutesAgo }
    });

    const maxSends = 100;
    if (recentSends >= maxSends) {
      await handleAbuse(req, 'bulk_spam', `Sent ${recentSends} messages in 10 minutes`);
      return res.status(429).json({
        message: `Anti-spam: You've sent ${recentSends} messages in the last 10 minutes. Limit is ${maxSends}. Please wait before sending more.`,
      });
    }
    next();
  } catch (error) {
    console.error('bulkSendGuard error:', error);
    next();
  }
};

module.exports = { apiLimiter, authLimiter, bulkSendGuard };
