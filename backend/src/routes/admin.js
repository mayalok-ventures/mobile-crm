const express = require('express');
const router = express.Router();
const { 
  getUsers, assignPlan, toggleUserStatus, deleteUser,
  getCoupons, createCoupon, deleteCoupon, sendCustomAlert,
  suspendUser, getAbuseLogs
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.get('/users', getUsers);
router.put('/users/:id/plan', assignPlan);
router.put('/users/:id/status', toggleUserStatus);
router.post('/users/:id/suspend', suspendUser);
router.delete('/users/:id', deleteUser);

// Coupons
router.route('/coupons').get(getCoupons).post(createCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Alerts
router.post('/alerts', sendCustomAlert);

// Abuse logs
router.get('/abuse-logs', getAbuseLogs);

module.exports = router;
