const waSession = require('../services/waSession');

exports.connect = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const pairingCode = await waSession.connect(req.user._id, phoneNumber);
    return res.json({
      message: 'Pairing code generated',
      pairingCode
    });
  } catch (err) {
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
