const express = require('express');
const router = express.Router();
const { getShareDashboard, getNotifications, markAllRead } = require('../controllers/shareController');
const { protect } = require('../middleware/auth');

// Public share route
router.get('/share/:token', getShareDashboard);

// Notifications (private)
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read-all', protect, markAllRead);

module.exports = router;
