const express = require('express');
const router = express.Router();
const { uploadRecording, getRecordings, deleteRecording } = require('../controllers/recordingsController');
const { protect, checkPlanExpiry } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.post('/upload/:leadId', checkPlanExpiry, upload.single('audio'), uploadRecording);
router.get('/:leadId', getRecordings);
router.delete('/:id', deleteRecording);

module.exports = router;
