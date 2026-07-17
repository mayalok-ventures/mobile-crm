const express = require('express');
const router = express.Router();
const { getGroups, createGroup, updateGroup, deleteGroup, getGroupLeads } = require('../controllers/groupsController');
const { protect, checkPlanExpiry } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getGroups).post(checkPlanExpiry, createGroup);
router.route('/:id').put(checkPlanExpiry, updateGroup).delete(deleteGroup);
router.get('/:id/leads', getGroupLeads);

module.exports = router;
