const User = require('../models/User');
const AbuseLog = require('../models/AbuseLog');
const { generateToken } = require('../middleware/auth');
const { generateUniqueUsername } = require('../utils/generateUsername');

// @desc  Register new user
// @route POST /api/auth/register
// @access Public
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ message: 'At least one of email or phone is required' });
    }

    // IMPORTANT: PHONE NORMALIZATION
    // All phone numbers must be stored in digits-only format.
    // Prevents duplicate leads and mismatched queries.
    const cleanPhone = phone ? phone.replace(/\D/g, '') : undefined;

    // Anti-duplicate check
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() }).lean();
      if (emailExists) {
        return res.status(400).json({ message: 'This email is already registered.' });
      }
    }
    if (cleanPhone) {
      const phoneExists = await User.findOne({ phone: cleanPhone }).lean();
      if (phoneExists) {
        return res.status(400).json({ message: 'This phone number is already registered.' });
      }
    }

    // Generate unique 7-character username
    const username = await generateUniqueUsername(User);

    const user = await User.create({
      name,
      email: email ? email.toLowerCase() : undefined,
      phone: cleanPhone || undefined,
      password,
      username,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      plan: user.plan,
      isAdmin: user.isAdmin,
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'account';
      return res.status(400).json({
        message: `This ${field === 'phone' ? 'phone number' : field} is already registered.`,
      });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Login (email OR phone)
// @route POST /api/auth/login
// @access Public
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier (email/phone) and password are required' });
    }

    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: identifier.replace(/\D/g, '') };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      // Track failed login attempts for abuse detection
      await User.findByIdAndUpdate(user._id, {
        $inc: { loginAttempts: 1 },
        lastFailedLogin: new Date(),
      });
      await AbuseLog.create({
        userId: user._id,
        ip: req.ip,
        type: 'invalid_login',
        detail: `Failed login attempt for ${identifier}`,
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated. Contact admin.' });
    }

    // Check suspension — auto-lift if suspendedUntil has passed
    if (user.suspension?.isSuspended) {
      const until = user.suspension.suspendedUntil;
      if (until && new Date() > new Date(until)) {
        // Auto-lift expired suspension
        user.suspension.isSuspended = false;
        user.suspension.level = 0;
        user.suspension.reason = null;
        user.suspension.suspendedUntil = null;
        await user.save({ validateBeforeSave: false });
      } else {
        const msg = until
          ? `Account suspended until ${new Date(until).toLocaleDateString()}. Reason: ${user.suspension.reason || 'Violation'}.`
          : `Account permanently banned. Reason: ${user.suspension.reason || 'Violation'}. Contact admin.`;
        return res.status(403).json({ code: 'SUSPENDED', message: msg, suspendedUntil: until });
      }
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      plan: user.plan,
      isAdmin: user.isAdmin,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get current user
// @route GET /api/auth/me
// @access Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isExpired = user.plan !== 'free' && user.planEndDate && new Date() > new Date(user.planEndDate);
    const planActive = user.plan !== 'free' && !isExpired;
    const daysRemaining = user.planEndDate ? Math.max(0, Math.ceil((new Date(user.planEndDate) - new Date()) / (1000 * 60 * 60 * 24))) : null;

    res.json({
      ...user,
      planActive,
      isExpired,
      daysRemaining,
      planStatus: {
        active: planActive,
        isExpired,
        daysRemaining
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Update profile (add missing email/phone — cannot change existing)
// @route PUT /api/auth/profile
// @access Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { email, phone, name } = req.body;

    // Allow name update
    if (name) user.name = name;

    // Allow adding missing fields ONLY — cannot change once set
    if (email && !user.email) {
      const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (exists) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase();
    } else if (email && user.email && email.toLowerCase() !== user.email) {
      return res.status(400).json({ message: 'Email cannot be changed once set' });
    }

    if (phone && !user.phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const exists = await User.findOne({ phone: cleanPhone, _id: { $ne: user._id } });
      if (exists) return res.status(400).json({ message: 'Phone already in use' });
      user.phone = cleanPhone;
    } else if (phone && user.phone && phone.replace(/\D/g, '') !== user.phone) {
      return res.status(400).json({ message: 'Phone cannot be changed once set' });
    }

    await user.save();
    const updated = user.toObject();
    delete updated.password;
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Change password
// @route PUT /api/auth/change-password
// @access Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Generate/toggle share token
// @route POST /api/auth/share-token
// @access Private
exports.toggleShareToken = async (req, res) => {
  try {
    const crypto = require('crypto');
    const user = await User.findById(req.user._id);

    if (user.shareTokenEnabled && user.shareToken) {
      // Disable
      user.shareTokenEnabled = false;
      await user.save({ validateBeforeSave: false });
      return res.json({ enabled: false, shareToken: null });
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    user.shareToken = token;
    user.shareTokenEnabled = true;
    await user.save({ validateBeforeSave: false });

    res.json({ enabled: true, shareToken: token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Apply coupon code to upgrade user plan
// @route POST /api/auth/apply-coupon
// @access Private
//
// CRITICAL — BILLING LOGIC:
// planStartDate AND planEndDate MUST always be set together when applying a coupon.
// Missing planEndDate = no expiry check = unlimited free access forever.
//
// CRITICAL — RACE CONDITION FIXED:
// Atomic findOneAndUpdate with $inc prevents two concurrent users from both
// claiming the last use of a coupon. Non-atomic check-then-increment is gone.
exports.applyCoupon = async (req, res) => {
  try {
    const Coupon = require('../models/Coupon');
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Atomically claim one use — only succeeds if coupon is valid, active, not expired, and has uses left
    const coupon = await Coupon.findOneAndUpdate(
      {
        code: code.toUpperCase(),
        isActive: true,
        $expr: { $lt: ['$usedCount', '$maxUses'] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );

    if (!coupon) {
      return res.status(400).json({ message: 'Invalid, expired, or fully used coupon code' });
    }

    // Deactivate coupon if now fully used
    if (coupon.usedCount >= coupon.maxUses) {
      await Coupon.findByIdAndUpdate(coupon._id, { isActive: false });
    }

    const { PLAN_PRICES } = require('../utils/planLimits');
    const originalPrice = PLAN_PRICES[coupon.plan] || 0;
    const discount = coupon.discountPercent || 0;
    const discountedPrice = Math.round(originalPrice * (1 - discount / 100));

    // CRITICAL: COUPON APPLICATION
    // Must update billing.originalPrice, discountedPrice, couponCodeUsed
    // If not saved, revenue tracking and analytics break.
    user.plan = coupon.plan;
    user.planStartDate = new Date();
    user.planEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    user.billing = {
      originalPrice,
      discountedPrice,
      couponCodeUsed: coupon.code,
    };
    await user.save({ validateBeforeSave: false });

    res.json({
      message: `Coupon applied successfully! Plan upgraded to ${coupon.plan}.`,
      plan: coupon.plan,
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// @desc  Validate coupon code
// @route POST /api/auth/validate-coupon
// @access Private
exports.validateCoupon = async (req, res) => {
  try {
    const Coupon = require('../models/Coupon');
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return res.status(400).json({ message: 'Invalid or inactive coupon code' });

    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      coupon.isActive = false;
      await coupon.save();
      return res.status(400).json({ message: 'Coupon code has expired' });
    }

    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    res.json({
      message: 'Coupon code is valid!',
      code: coupon.code,
      plan: coupon.plan,
      discountPercent: coupon.discountPercent || 0,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
