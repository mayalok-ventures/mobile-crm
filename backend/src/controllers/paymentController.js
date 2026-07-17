const PaymentRequest = require('../models/PaymentRequest');
const User = require('../models/User');
const waSession = require('../services/waSession');

// @desc  Create a new manual payment request
// @route POST /api/payments
// @access Private
exports.createPaymentRequest = async (req, res) => {
  try {
    const { planSelected, originalPrice, finalPrice, utrNumber, couponCodeUsed } = req.body;
    const screenshotUrl = req.screenshotUrl; // from paymentUpload middleware

    if (!planSelected || !originalPrice || !finalPrice || !utrNumber) {
      return res.status(400).json({ message: 'All payment verification fields are required' });
    }

    const trimmedUTR = utrNumber.trim();
    if (trimmedUTR.length < 10) {
      return res.status(400).json({ message: 'UTR number must be at least 10 characters long' });
    }

    // 1. Limit 1 pending payment request per user
    const pendingRequest = await PaymentRequest.findOne({ userId: req.user._id, status: 'pending' });
    if (pendingRequest) {
      return res.status(400).json({ message: 'You already have a pending payment request. Please wait for admin approval.' });
    }

    // 2. Prevent duplicate UTR submissions
    const duplicateUTR = await PaymentRequest.findOne({ utrNumber: trimmedUTR });
    if (duplicateUTR) {
      return res.status(400).json({ message: 'This UTR number has already been submitted.' });
    }

    // Create record
    const paymentRequest = await PaymentRequest.create({
      userId: req.user._id,
      username: req.user.name,
      planSelected,
      originalPrice: Number(originalPrice),
      finalPrice: Number(finalPrice),
      couponCodeUsed: couponCodeUsed || null,
      utrNumber: trimmedUTR,
      screenshotUrl,
      status: 'pending'
    });

    // 3. Send WhatsApp notification to ADMIN number
    const adminNumber = process.env.WA_BUSINESS_NUMBER || '918796475107';
    const couponText = couponCodeUsed ? couponCodeUsed : 'NONE';
    const messageText = `🚨 New Payment Request\n\n` +
      `User: ${req.user.name}\n` +
      `Plan: ${planSelected.toUpperCase()}\n` +
      `Price: ₹${finalPrice}\n` +
      `Coupon: ${couponText}\n` +
      `UTR: ${trimmedUTR}\n\n` +
      `Check Admin Panel`;

    try {
      // Attempt to send using current user's session if active, otherwise fallback to any active session
      const userState = waSession.getStatus(req.user._id);
      let sent = false;
      if (userState && userState.status === 'connected') {
        await waSession.sendText(req.user._id, adminNumber, messageText);
        sent = true;
      } else {
        sent = await waSession.sendFromAnyActiveSession(adminNumber, messageText);
      }
      if (!sent) {
        console.warn(`[Payments] Notification not sent: No active WhatsApp session available.`);
      }
    } catch (waErr) {
      console.error('[Payments] Failed to send WhatsApp notification to admin:', waErr);
    }

    res.status(201).json({
      message: 'Verification in progress (5–15 mins). Our admins are verifying your payment.',
      paymentRequest
    });
  } catch (error) {
    console.error('[Payments] Create error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get current user's latest payment request status
// @route GET /api/payments/my-request
// @access Private
exports.getUserPaymentRequest = async (req, res) => {
  try {
    const latestRequest = await PaymentRequest.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(latestRequest || null);
  } catch (error) {
    console.error('[Payments] Get user request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get all payment requests for admin panel
// @route GET /api/payments/admin
// @access AdminOnly
exports.getAdminPaymentRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await PaymentRequest.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(requests);
  } catch (error) {
    console.error('[Payments] Get admin requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Approve a payment request manually
// @route PUT /api/payments/admin/:id/approve
// @access AdminOnly
exports.approvePaymentRequest = async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id);
    if (!paymentRequest) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ message: `Payment request is already processed (Status: ${paymentRequest.status})` });
    }

    // Update User plan & start/end dates
    const user = await User.findById(paymentRequest.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + 30); // 30 days from now

    user.plan = paymentRequest.planSelected;
    user.planStartDate = now;
    user.planEndDate = expiry;
    user.billing = {
      originalPrice: paymentRequest.originalPrice,
      discountedPrice: paymentRequest.finalPrice,
      couponCodeUsed: paymentRequest.couponCodeUsed || null
    };

    await user.save();

    // Update PaymentRequest status
    paymentRequest.status = 'approved';
    await paymentRequest.save();

    res.json({ message: 'Payment request approved and plan activated successfully!', paymentRequest });
  } catch (error) {
    console.error('[Payments] Approve error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Reject a payment request manually
// @route PUT /api/payments/admin/:id/reject
// @access AdminOnly
exports.rejectPaymentRequest = async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id);
    if (!paymentRequest) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ message: `Payment request is already processed (Status: ${paymentRequest.status})` });
    }

    paymentRequest.status = 'rejected';
    await paymentRequest.save();

    res.json({ message: 'Payment request rejected.', paymentRequest });
  } catch (error) {
    console.error('[Payments] Reject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
