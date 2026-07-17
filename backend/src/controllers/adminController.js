const User = require('../models/User');
const Lead = require('../models/Lead');

// @desc  List all users (admin)
// @route GET /api/admin/users
// @access Admin
exports.getUsers = async (req, res) => {
  try {
    const { search, plan, page = 1, limit = 20 } = req.query;
    const query = {};
    if (plan) query.plan = plan;
    if (search) {
      // SECURITY: Escape all special regex characters before compiling.
      // Prevents ReDoS attacks via crafted search inputs.
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [
        { email: rx },
        { phone: rx },
        { name: rx },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(query),
    ]);

    // Add lead count per user
    const userIds = users.map((u) => u._id);
    const leadCounts = await Lead.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const leadMap = {};
    leadCounts.forEach((l) => { leadMap[l._id.toString()] = l.count; });

    const enriched = users.map((u) => ({
      ...u,
      leadCount: leadMap[u._id.toString()] || 0,
    }));

    res.json({ users: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Assign plan to user (manual activation)
// @route PUT /api/admin/users/:id/plan
// @access Admin
exports.assignPlan = async (req, res) => {
  try {
    const { plan, expiryDate, durationDays } = req.body;
    const validPlans = ['free', 'starter', 'growth', 'pro'];
    if (!validPlans.includes(plan)) return res.status(400).json({ message: 'Invalid plan' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { PLAN_PRICES } = require('../utils/planLimits');
    const price = PLAN_PRICES[plan] || 0;

    // ADMIN OVERRIDE
    // Admin can assign plans manually.
    // Ensure billing is still recorded to avoid inconsistencies.
    user.plan = plan;
    if (plan === 'free') {
      user.planStartDate = null;
      user.planEndDate = null;
      user.billing = {
        originalPrice: 0,
        discountedPrice: 0,
        couponCodeUsed: null,
      };
    } else {
      user.planStartDate = new Date();
      if (expiryDate) {
        user.planEndDate = new Date(expiryDate);
      } else if (durationDays) {
        user.planEndDate = new Date(Date.now() + parseInt(durationDays) * 24 * 60 * 60 * 1000);
      } else {
        user.planEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      user.billing = {
        originalPrice: price,
        discountedPrice: price,
        couponCodeUsed: 'MANUAL',
      };
    }

    await user.save({ validateBeforeSave: false });

    const returnedUser = user.toObject();
    delete returnedUser.password;

    res.json({ message: `Plan updated to ${plan}`, user: returnedUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Activate / deactivate user
// @route PUT /api/admin/users/:id/status
// @access Admin
//
// NOTE — SUSPENSION LEVELS (when V2 suspension system is implemented):
// Level 1 → 24 hours (warning)
// Level 2 → 7 days (repeated abuse)
// Level 3 → 30 days (serious violation)
// Level 4 → permanent ban (no recovery)
//
// This function currently toggles isActive (blunt instrument).
// V2 will add granular suspension: user.suspension.isSuspended + suspendedUntil + level.
// See implementation_plan.md → Admin Control System
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete user
// @route DELETE /api/admin/users/:id
// @access Admin
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get all coupons
// @route GET /api/admin/coupons
// @access Admin
exports.getCoupons = async (req, res) => {
  try {
    const Coupon = require('../models/Coupon');
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create coupon code
// @route POST /api/admin/coupons
// @access Admin
exports.createCoupon = async (req, res) => {
  try {
    const Coupon = require('../models/Coupon');
    const { code, plan, maxUses, expiresAt, discountPercent } = req.body;
    if (!code || !plan) {
      return res.status(400).json({ message: 'Code and plan are required' });
    }

    const exists = await Coupon.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      plan,
      maxUses: maxUses || 1,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      discountPercent: parseInt(discountPercent) || 0,
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete coupon code
// @route DELETE /api/admin/coupons/:id
// @access Admin
exports.deleteCoupon = async (req, res) => {
  try {
    const Coupon = require('../models/Coupon');
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Send custom message alert to one or all users
// @route POST /api/admin/alerts
// @access Admin
exports.sendCustomAlert = async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const { targetUserId, message } = req.body; // if targetUserId is null or "all", send to all

    if (!message) {
      return res.status(400).json({ message: 'Alert message is required' });
    }

    let userIds = [];
    if (!targetUserId || targetUserId === 'all') {
      const allUsers = await User.find({ isActive: true }).select('_id').lean();
      userIds = allUsers.map(u => u._id);
    } else {
      userIds = [targetUserId];
    }

    const notifications = userIds.map(uid => ({
      userId: uid,
      message: `📢 Admin Alert: ${message}`,
      type: 'admin_alert',
      isRead: false
    }));

    // IMPORTANT: Batch insertMany in chunks of 500 to avoid MongoDB document limit
    // and prevent a single call from blocking the DB for large user bases.
    const CHUNK = 500;
    for (let i = 0; i < notifications.length; i += CHUNK) {
      await Notification.insertMany(notifications.slice(i, i + CHUNK), { ordered: false });
    }

    res.json({ message: `Alert sent to ${userIds.length} users successfully.` });
  } catch (error) {
    console.error('Custom alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Suspend user with granular levels
// @route POST /api/admin/users/:id/suspend
// @access Admin
exports.suspendUser = async (req, res) => {
  try {
    const { isSuspended, level, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!isSuspended) {
      // Lift suspension
      user.suspension = {
        isSuspended: false,
        level: 0,
        reason: null,
        suspendedAt: null,
        suspendedUntil: null,
      };
      await user.save({ validateBeforeSave: false });
      return res.json({ message: 'User suspension lifted', user });
    }

    const lvl = parseInt(level) || 1;
    let durationMs = 0;
    if (lvl === 1) durationMs = 24 * 60 * 60 * 1000; // 24 hours
    else if (lvl === 2) durationMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    else if (lvl === 3) durationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    // level 4 is permanent, duration remains 0 (suspendedUntil = null)

    const now = new Date();
    const suspendedUntil = lvl === 4 ? null : new Date(now.getTime() + durationMs);

    user.suspension = {
      isSuspended: true,
      level: lvl,
      reason: reason || 'Violation of terms',
      suspendedAt: now,
      suspendedUntil,
    };

    // If level 4 or active toggle, deactivate WhatsApp sessions too
    if (lvl === 4) {
      const waSession = require('../services/waSession');
      await waSession.disconnect(user._id).catch(() => {});
    }

    await user.save({ validateBeforeSave: false });
    res.json({ message: `User suspended at Level ${lvl}`, user });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get abuse logs
// @route GET /api/admin/abuse-logs
// @access Admin
exports.getAbuseLogs = async (req, res) => {
  try {
    const AbuseLog = require('../models/AbuseLog');
    const { type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AbuseLog.find(query)
        .populate('userId', 'name email phone username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AbuseLog.countDocuments(query),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get abuse logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

