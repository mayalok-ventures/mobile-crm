const jwt = require('jsonwebtoken');
const User = require('../models/User');

// SECURITY — AUTHENTICATION MIDDLEWARE:
// This is the single source of truth for all authenticated requests.
// It validates the JWT, loads the user from DB (not just from token payload),
// and enforces plan expiry on write operations.
//
// IMPORTANT: User is always re-fetched from DB on each request (not from token cache).
// This ensures that suspended or deactivated accounts are blocked immediately
// without waiting for the JWT to expire.
// Performance trade-off: one DB read per authenticated request.
// Acceptable for V1. In V2, consider Redis user-session caching.
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password').lean();

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized, account inactive' });
    }

    // SECURITY: USER SUSPENSION CHECK
    // This runs on EVERY request.
    // If removed, suspended users will still access system.
    // DO NOT BYPASS THIS CHECK.
    if (user.suspension?.isSuspended) {
      const until = user.suspension.suspendedUntil;
      if (until && new Date() > new Date(until)) {
        await User.findByIdAndUpdate(user._id, {
          $set: {
            'suspension.isSuspended': false,
            'suspension.level': 0,
            'suspension.reason': null,
            'suspension.suspendedUntil': null,
          }
        });
      } else {
        const msg = until
          ? `Account suspended until ${new Date(until).toLocaleDateString()}. Reason: ${user.suspension.reason || 'Violation'}.`
          : `Account permanently banned. Reason: ${user.suspension.reason || 'Violation'}. Contact admin.`;
        return res.status(403).json({ code: 'SUSPENDED', message: msg, suspendedUntil: until });
      }
    }

    req.user = user;

    // CRITICAL — PLAN EXPIRY ENFORCEMENT:
    // This block is the backend enforcement of the billing system.
    // It runs on EVERY authenticated write request.
    // Allowed through even when expired:
    //   - All GET requests (read access preserved after expiry)
    //   - /apply-coupon and /validate-coupon (so users can self-renew)
    // Blocked on expiry:
    //   - POST, PUT, DELETE, PATCH — all write operations
    // Chain: applyCoupon (authController) sets planEndDate → this check enforces it
    if (!user.isAdmin && user.planEndDate && new Date() > new Date(user.planEndDate)) {
      const isCouponRoute = req.path.endsWith('/apply-coupon') || req.path.endsWith('/validate-coupon');
      if (req.method !== 'GET' && !isCouponRoute) {
        return res.status(403).json({
          code: 'PLAN_EXPIRED',
          message: 'Plan expired. Renew to continue.',
          expiryDate: user.planEndDate,
        });
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const checkPlanExpiry = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Not authorized' });
  if (user.isAdmin) return next();

  if (user.planEndDate && new Date() > new Date(user.planEndDate)) {
    const isCouponRoute = req.path.endsWith('/apply-coupon') || req.path.endsWith('/validate-coupon');
    if (req.method === 'GET' || isCouponRoute) {
      return next();
    }
    return res.status(403).json({
      code: 'PLAN_EXPIRED',
      message: 'Plan expired. Renew to continue.',
      expiryDate: user.planEndDate,
    });
  }

  next();
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

module.exports = { protect, adminOnly, checkPlanExpiry, generateToken };
