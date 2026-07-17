const Lead = require('../models/Lead');
const Notification = require('../models/Notification');

// @desc  Get all leads (paginated, filtered)
// @route GET /api/leads?page=1&limit=20&status=new&tag=vip&search=john
// @access Private
exports.getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, tag, search } = req.query;
    const query = { userId: req.user._id };

    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cap = Math.min(parseInt(limit), 50); // max 50 per request

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(cap)
        .lean(),
      Lead.countDocuments(query),
    ]);

    res.json({
      leads,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / cap),
        limit: cap,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get single lead with notes + recordings count
// @route GET /api/leads/:id
// @access Private
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create lead
// @route POST /api/leads
// @access Private
exports.createLead = async (req, res) => {
  try {
    const { 
      name, phone, email, company, tags, status, source, followUpDate,
      location, profession, budget, areasOfInterest, project 
    } = req.body;
    
    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    if (!followUpDate) return res.status(400).json({ message: 'Next follow-up date is mandatory when scheduling a lead' });

    // IMPORTANT: PHONE NORMALIZATION
    // All phone numbers must be stored in digits-only format.
    // Prevents duplicate leads and mismatched queries.
    const cleanPhone = phone.replace(/\D/g, '');

    // Prevent duplicate leads per user
    const phoneExists = await Lead.findOne({ userId: req.user._id, phone: cleanPhone });
    if (phoneExists) {
      return res.status(400).json({ message: 'A lead with this phone number already exists.' });
    }

    // Dynamic plan lead limit check (e.g. max 10 leads for free plan)
    const { PLAN_LIMITS } = require('../utils/planLimits');
    const plan = req.user.plan || 'free';
    const limits = PLAN_LIMITS[plan];
    const maxLeads = limits?.maxLeads || 10;

    if (maxLeads !== Infinity) {
      const count = await Lead.countDocuments({ userId: req.user._id });
      if (count >= maxLeads) {
        return res.status(403).json({
          code: 'LIMIT_REACHED',
          message: `You have reached the limit of ${maxLeads} leads on the ${plan} plan. Please upgrade to a paid plan to add more leads.`
        });
      }
    }

    const lead = await Lead.create({
      userId: req.user._id,
      name,
      phone: cleanPhone,
      email,
      company,
      tags: tags || [],
      status: status || 'new',
      source: source || 'manual',
      followUpDate,
      location: location || '',
      profession: profession || '',
      budget: budget || '',
      areasOfInterest: areasOfInterest || [],
      project: project || '',
    });

    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Update lead
// @route PUT /api/leads/:id
// @access Private
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // IMPORTANT: PHONE NORMALIZATION
    // All phone numbers must be stored in digits-only format.
    // Prevents duplicate leads and mismatched queries.
    if (req.body.phone) {
      const cleanPhone = req.body.phone.replace(/\D/g, '');
      if (cleanPhone !== lead.phone) {
        const phoneExists = await Lead.findOne({
          userId: req.user._id,
          phone: cleanPhone,
          _id: { $ne: lead._id }
        });
        if (phoneExists) {
          return res.status(400).json({ message: 'Another lead with this phone number already exists.' });
        }
        req.body.phone = cleanPhone;
      }
    }

    const trackFields = [
      'name', 'phone', 'email', 'company', 'tags', 'status', 'followUpDate',
      'source', 'location', 'profession', 'budget', 'areasOfInterest', 'project'
    ];
    
    const changes = {};
    let hasChanges = false;

    trackFields.forEach(field => {
      if (req.body[field] !== undefined) {
        const oldVal = lead[field];
        const newVal = req.body[field];

        const isArrayEqual = (a, b) => {
          if (!Array.isArray(a) || !Array.isArray(b)) return false;
          if (a.length !== b.length) return false;
          return a.every((v, i) => String(v) === String(b[i]));
        };

        const isTimeEqual = (a, b) => {
          if (a instanceof Date || (typeof a === 'string' && !isNaN(Date.parse(a)))) {
            return new Date(a).getTime() === new Date(b).getTime();
          }
          return false;
        };

        let isEqual = false;
        if (Array.isArray(oldVal)) {
          isEqual = isArrayEqual(oldVal, newVal);
        } else if (oldVal instanceof Date || (field === 'followUpDate' && oldVal)) {
          isEqual = isTimeEqual(oldVal, newVal);
        } else {
          isEqual = String(oldVal || '') === String(newVal || '');
        }

        if (!isEqual) {
          changes[field] = { old: oldVal, new: newVal };
          lead[field] = newVal;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      // Add entry to edit history
      lead.editHistory.push({
        updatedAt: new Date(),
        updatedBy: req.user._id,
        changes: changes
      });
      
      if (lead.editHistory.length > 50) {
        lead.editHistory.splice(0, lead.editHistory.length - 50);
      }
      
      // Update specific triggers
      if (changes.status && req.body.status === 'contacted') {
        lead.lastContactedAt = new Date();
      }
      if (changes.followUpDate) {
        lead.followUpNotified = false;
      }
    }

    await lead.save();
    res.json(lead);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Add note to lead
// @route POST /api/leads/:id/notes
// @access Private
exports.addNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Note text is required' });

    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.notes.push({ text, createdAt: new Date() });
    await lead.save();
    res.json(lead.notes[lead.notes.length - 1]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete lead
// @route DELETE /api/leads/:id
// @access Private
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get today's follow-ups
// @route GET /api/leads/follow-ups/today
// @access Private
exports.getTodayFollowUps = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const leads = await Lead.find({
      userId: req.user._id,
      followUpDate: { $gte: start, $lte: end },
      status: { $ne: 'closed' },
    })
      .sort({ followUpDate: 1 })
      .lean();

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get all unique tags for user
// @route GET /api/leads/tags
// @access Private
exports.getTags = async (req, res) => {
  try {
    const tags = await Lead.distinct('tags', { userId: req.user._id });
    res.json(tags.filter(Boolean));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// TRACK MESSAGE API
// Used for BOTH manual (wa.me) and direct API sends
// Ensures message limits are enforced centrally
exports.trackMessage = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (req.user.plan === 'free' && lead.messageSentCount >= 1) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: 'Free plan limit: Only 1 message is allowed per lead. Please upgrade.'
      });
    }

    lead.messageSentCount = (lead.messageSentCount || 0) + 1;
    await lead.save();

    res.json({ success: true, messageSentCount: lead.messageSentCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

