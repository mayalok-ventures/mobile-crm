const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/campaignController');

router.get('/', protect, c.getCampaigns);
router.post('/', protect, c.createCampaign);
router.get('/:id', protect, c.getCampaign);
router.post('/:id/pause', protect, c.pauseCampaign);
router.post('/:id/resume', protect, c.resumeCampaign);
router.delete('/:id', protect, c.cancelCampaign);
router.get('/:id/logs', protect, c.getCampaignLogs);

module.exports = router;
