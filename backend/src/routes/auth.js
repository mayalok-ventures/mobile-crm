const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, toggleShareToken, applyCoupon, validateCoupon } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);
router.get('/user', protect, getMe); // Alias route as requested
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/share-token', protect, toggleShareToken);
router.post('/apply-coupon', protect, applyCoupon);
router.post('/validate-coupon', protect, validateCoupon);

module.exports = router;
