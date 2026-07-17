const express = require('express');
const router = express.Router();
const { getTemplates, createTemplate, updateTemplate, deleteTemplate, useTemplate } = require('../controllers/templatesController');
const { protect, checkPlanExpiry } = require('../middleware/auth');
const { templateUpload, processTemplateUploads } = require('../middleware/templateUpload');

router.use(protect);
router.route('/')
  .get(getTemplates)
  .post(checkPlanExpiry, templateUpload, processTemplateUploads, createTemplate);

router.route('/:id')
  .put(checkPlanExpiry, templateUpload, processTemplateUploads, updateTemplate)
  .delete(deleteTemplate);

router.post('/:id/use', useTemplate);

module.exports = router;
