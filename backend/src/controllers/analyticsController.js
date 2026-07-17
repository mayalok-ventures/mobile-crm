const Lead = require('../models/Lead');
const Template = require('../models/Template');
const Recording = require('../models/Recording');

// @desc  Analytics summary
// @route GET /api/analytics
// @access Private
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    const [
      totalLeads,
      statusCounts,
      totalTemplates,
      totalRecordings,
      todayFollowUps,
      recentLeads,
    ] = await Promise.all([
      // Total leads
      Lead.countDocuments({ userId }),

      // Leads by status (aggregation)
      Lead.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Templates count
      Template.countDocuments({ userId }),

      // Recordings count
      Recording.countDocuments({ userId }),

      // Today's follow-ups
      Lead.countDocuments({
        userId,
        followUpDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { $ne: 'closed' },
      }),

      // Last 7 days leads
      Lead.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Map status counts
    const byStatus = { new: 0, contacted: 0, follow_up: 0, closed: 0 };
    statusCounts.forEach((s) => {
      if (byStatus[s._id] !== undefined) byStatus[s._id] = s.count;
    });

    const conversionRate =
      totalLeads > 0 ? Math.round((byStatus.closed / totalLeads) * 100) : 0;

    res.json({
      totalLeads,
      byStatus,
      conversionRate,
      totalTemplates,
      totalRecordings,
      todayFollowUps,
      recentLeads, // last 7 days by day
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
