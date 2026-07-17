const Campaign = require('../models/Campaign');
const CampaignLog = require('../models/CampaignLog');
const Group = require('../models/Group');
const Lead = require('../models/Lead');
const { PLAN_LIMITS } = require('../utils/planLimits');
const waSession = require('../services/waSession');

// @desc  Create and queue a new campaign
// @route POST /api/campaigns
// @access Private
exports.createCampaign = async (req, res) => {
  try {
    const { groupId, template, name } = req.body;
    if (!groupId || !template?.trim() || !name?.trim()) {
      return res.status(400).json({ message: 'groupId, name, and template are required' });
    }

    const plan = req.user.plan || 'free';
    const limits = PLAN_LIMITS[plan];

    if (!limits?.canStartCampaign) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: 'Bulk messaging is not available on the free plan. Please upgrade.',
      });
    }

    // WhatsApp must be connected
    const waStatus = waSession.getStatus(req.user._id);
    if (waStatus.status !== 'connected') {
      return res.status(400).json({
        message: 'WhatsApp is not connected. Please connect WhatsApp before starting a campaign.',
      });
    }

    const group = await Group.findOne({ _id: groupId, userId: req.user._id }).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Resolve lead count
    let totalLeads;
    if (group.type === 'tag_based' && group.tags.length > 0) {
      totalLeads = await Lead.countDocuments({
        userId: req.user._id,
        tags: { $in: group.tags },
        status: { $ne: 'closed' },
      });
    } else {
      totalLeads = await Lead.countDocuments({
        _id: { $in: group.leadIds },
        userId: req.user._id,
      });
    }

    if (totalLeads === 0) {
      return res.status(400).json({ message: 'No leads found in this group.' });
    }

    // Enforce recipient limit per campaign
    if (totalLeads > limits.maxRecipientsPerCampaign) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: `Your ${plan} plan allows max ${limits.maxRecipientsPerCampaign} recipients per campaign. This group has ${totalLeads} leads.`,
      });
    }

    // Enforce concurrent campaign limit
    const activeCount = await Campaign.countDocuments({
      userId: req.user._id,
      status: { $in: ['queued', 'running'] },
    });
    if (activeCount >= limits.maxConcurrentCampaigns) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: `Your ${plan} plan allows max ${limits.maxConcurrentCampaigns} concurrent campaign(s). Please pause or wait for existing campaigns to finish.`,
      });
    }

    const campaign = await Campaign.create({
      userId: req.user._id,
      groupId,
      name: name.trim(),
      template: template.trim(),
      totalLeads,
      status: 'queued',
    });

    res.status(201).json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  List user campaigns
// @route GET /api/campaigns
// @access Private
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get single campaign with progress
// @route GET /api/campaigns/:id
// @access Private
exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Pause a running/queued campaign
// @route POST /api/campaigns/:id/pause
// @access Private
exports.pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['queued', 'running'] },
      },
      { status: 'paused', pausedAt: new Date() },
      { new: true }
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or already paused/completed' });
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Resume a paused campaign
// @route POST /api/campaigns/:id/resume
// @access Private
exports.resumeCampaign = async (req, res) => {
  try {
    const waStatus = waSession.getStatus(req.user._id);
    if (waStatus.status !== 'connected') {
      return res.status(400).json({
        message: 'WhatsApp is not connected. Please reconnect before resuming.',
      });
    }

    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: 'paused' },
      { status: 'queued' },
      { new: true }
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or not in paused state' });
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Cancel a campaign
// @route DELETE /api/campaigns/:id
// @access Private
exports.cancelCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['queued', 'running', 'paused'] },
      },
      { status: 'cancelled' },
      { new: true }
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or already completed/cancelled' });
    }
    res.json({ message: 'Campaign cancelled', campaign });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get campaign delivery logs
// @route GET /api/campaigns/:id/logs
// @access Private
exports.getCampaignLogs = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const { page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await CampaignLog.find({ campaignId: req.params.id })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await CampaignLog.countDocuments({ campaignId: req.params.id });

    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
