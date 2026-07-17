const express = require('express');
const router = express.Router();
const {
  getLeads, getLead, createLead, updateLead,
  addNote, deleteLead, getTodayFollowUps, getTags, trackMessage
} = require('../controllers/leadsController');
const { protect, checkPlanExpiry } = require('../middleware/auth');

router.use(protect);
router.get('/follow-ups/today', getTodayFollowUps);
router.get('/tags', getTags);
router.post('/:id/track-message', checkPlanExpiry, trackMessage);
router.route('/').get(getLeads).post(checkPlanExpiry, createLead);
router.route('/:id').get(getLead).put(checkPlanExpiry, updateLead).delete(deleteLead);
router.post('/:id/notes', checkPlanExpiry, addNote);

module.exports = router;
