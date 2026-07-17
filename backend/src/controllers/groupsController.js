const Group = require('../models/Group');
const Lead = require('../models/Lead');
const { PLAN_LIMITS } = require('../utils/planLimits');

// @desc  Get user groups
// @route GET /api/groups
// @access Private
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ userId: req.user._id }).lean();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create group
// @route POST /api/groups
// @access Private
exports.createGroup = async (req, res) => {
  try {
    const { name, type, tags, leadIds, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const plan = req.user.plan || 'free';
    const limits = PLAN_LIMITS[plan];

    if (!limits || !limits.canCreateGroup) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: `Your ${plan} plan does not support creating groups. Please upgrade.`,
      });
    }

    // Check existing groups count
    const existingCount = await Group.countDocuments({ userId: req.user._id });
    if (existingCount >= limits.maxGroups) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: `Your ${plan} plan limits you to a maximum of ${limits.maxGroups} groups. Please upgrade to create more.`,
      });
    }

    const group = await Group.create({
      userId: req.user._id,
      name,
      type: type || 'manual',
      tags: tags || [],
      leadIds: leadIds || [],
      description,
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Update group
// @route PUT /api/groups/:id
// @access Private
exports.updateGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, userId: req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const { name, tags, leadIds, description } = req.body;
    if (name) group.name = name;
    if (tags) group.tags = tags;
    if (leadIds) group.leadIds = leadIds;
    if (description !== undefined) group.description = description;

    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete group
// @route DELETE /api/groups/:id
// @access Private
exports.deleteGroup = async (req, res) => {
  try {
    const g = await Group.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!g) return res.status(404).json({ message: 'Group not found' });
    res.json({ message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Resolve group leads (returns phone numbers for bulk WA)
// @route GET /api/groups/:id/leads
// @access Private
exports.getGroupLeads = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    let leads;
    if (group.type === 'tag_based' && group.tags.length > 0) {
      leads = await Lead.find({
        userId: req.user._id,
        tags: { $in: group.tags },
        status: { $ne: 'closed' },
      })
        .limit(50)
        .select('name phone status tags')
        .lean();
    } else {
      leads = await Lead.find({
        _id: { $in: group.leadIds },
        userId: req.user._id,
      })
        .limit(50)
        .select('name phone status tags')
        .lean();
    }

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
