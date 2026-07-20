const waSession = require('../services/waSession');

exports.connect = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // Check pairing cooldown
  const userId = req.user._id.toString();
  if (waSession.userCooldowns && waSession.userCooldowns[userId]) {
    const cooldownTime = waSession.userCooldowns[userId];
    if (Date.now() < cooldownTime) {
      console.log(`[WA] Blocking connect request for user ${userId} due to active 30-minute cooldown`);
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please try again after 30 minutes."
      });
    } else {
      // Cooldown expired, clean it up
      delete waSession.userCooldowns[userId];
    }
  }

  // Hard 35s request timeout \u2014 waSession.connect() has a 30s internal timeout,
  // so this fires only if something goes wrong beyond the internal guard.
  // Prevents Express from holding the connection open indefinitely on WS hangs.
  let responded = false;
  const reqTimeout = setTimeout(() => {
    if (!responded) {
      responded = true;
      console.error(`[WA] /connect request timed out for user ${req.user._id}`);
      res.status(504).json({ message: 'WhatsApp connection timed out. Please try again.' });
    }
  }, 35000);

  try {
    const pairingCode = await waSession.connect(req.user._id, phoneNumber);
    if (responded) return; // timeout already fired
    responded = true;
    clearTimeout(reqTimeout);

    // Log both userId and the code so we can debug UI issues without needing
    // access to the client device \u2014 match the code in the log to what the user sees.
    console.log(`[WA] Pairing code ready | user=${req.user._id} phone=${phoneNumber} code=${pairingCode}`);

    return res.json({
      message: 'Pairing code generated',
      pairingCode
    });
  } catch (err) {
    if (responded) return;
    responded = true;
    clearTimeout(reqTimeout);
    console.error(`[WA] connect() error for user ${req.user._id}:`, err.message);
    return res.status(500).json({ message: err.message });
  }
};


exports.getStatus = async (req, res) => {
  try {
    const status = waSession.getStatus(req.user._id);
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.disconnect = async (req, res) => {
  try {
    await waSession.disconnect(req.user._id);
    return res.json({ message: 'Disconnected successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const checkAndIncrementMessageCount = async (userId, plan, to) => {
  const Lead = require('../models/Lead');
  const cleanTo = to.replace(/\D/g, '');
  const lead = await Lead.findOne({ userId, phone: cleanTo });
  if (!lead) {
    throw new Error('Recipient is not an existing lead. Please add them as a lead first.');
  }

  if (plan === 'free' && lead.messageSentCount >= 1) {
    const limitError = new Error('Free plan limit: Only 1 message is allowed per lead. Please upgrade.');
    limitError.code = 'PLAN_LIMIT';
    throw limitError;
  }

  return lead;
};

exports.sendText = async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) {
    return res.status(400).json({ message: 'Recipient (to) and message text are required' });
  }

  try {
    const lead = await checkAndIncrementMessageCount(req.user._id, req.user.plan, to);
    await waSession.sendText(req.user._id, to, text);
    
    lead.messageSentCount = (lead.messageSentCount || 0) + 1;
    await lead.save();

    return res.json({ message: 'Message sent successfully' });
  } catch (err) {
    if (err.code === 'PLAN_LIMIT') {
      return res.status(403).json({ code: err.code, message: err.message });
    }
    if (err.message.includes('not an existing lead')) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message || 'Failed to send message' });
  }
};

exports.sendMedia = async (req, res) => {
  const { to, text, image, video, document } = req.body;
  if (!to) {
    return res.status(400).json({ message: 'Recipient (to) is required' });
  }

  try {
    const lead = await checkAndIncrementMessageCount(req.user._id, req.user.plan, to);
    await waSession.sendMedia(req.user._id, to, { text, image, video, document });
    
    lead.messageSentCount = (lead.messageSentCount || 0) + 1;
    await lead.save();

    return res.json({ message: 'Media message sent successfully' });
  } catch (err) {
    if (err.code === 'PLAN_LIMIT') {
      return res.status(403).json({ code: err.code, message: err.message });
    }
    if (err.message.includes('not an existing lead')) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message || 'Failed to send media' });
  }
};

exports.logCampaignSend = async (req, res) => {
  try {
    const CampaignLog = require('../models/CampaignLog');
    const Group = require('../models/Group');
    const { groupId, number, status, error, lastSentIndex, campaignStatus, campaignTemplate } = req.body;
    if (!groupId || !number || !status) {
      return res.status(400).json({ message: 'groupId, number, and status are required' });
    }

    const log = await CampaignLog.create({
      userId: req.user._id,
      groupId,
      number,
      status,
      error: error || null,
      timestamp: new Date()
    });

    const updateFields = {};
    if (lastSentIndex !== undefined) updateFields.lastSentIndex = lastSentIndex;
    if (campaignStatus !== undefined) updateFields.campaignStatus = campaignStatus;
    if (campaignTemplate !== undefined) updateFields.campaignTemplate = campaignTemplate;

    if (Object.keys(updateFields).length > 0) {
      await Group.updateOne(
        { _id: groupId, userId: req.user._id },
        { $set: updateFields }
      );
    }

    res.status(201).json(log);
  } catch (err) {
    console.error('Failed to log campaign send:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
