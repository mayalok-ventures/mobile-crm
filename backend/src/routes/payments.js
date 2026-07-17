const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { paymentUpload, processPaymentUpload } = require('../middleware/paymentUpload');
const {
  createPaymentRequest,
  getUserPaymentRequest,
  getAdminPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest
} = require('../controllers/paymentController');

// User payments endpoints
router.post('/', protect, paymentUpload, processPaymentUpload, createPaymentRequest);
router.get('/my-request', protect, getUserPaymentRequest);

// Admin payments endpoints
router.get('/admin', protect, adminOnly, getAdminPaymentRequests);
router.put('/admin/:id/approve', protect, adminOnly, approvePaymentRequest);
router.put('/admin/:id/reject', protect, adminOnly, rejectPaymentRequest);

module.exports = router;
