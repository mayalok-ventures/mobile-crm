const Template = require('../models/Template');
const fs = require('fs');
const path = require('path');

const cloudinary = require('cloudinary').v2;

const deleteFile = async (filename) => {
  if (!filename) return;
  if (filename.startsWith('crm_templates/') || filename.includes('/')) {
    try {
      let resourceType = 'image';
      if (filename.includes('video')) resourceType = 'video';
      else if (filename.includes('doc')) resourceType = 'raw';
      await cloudinary.uploader.destroy(filename, { resource_type: resourceType });
      console.log(`Deleted Cloudinary asset: ${filename}`);
    } catch (e) {
      console.error(`Failed to delete Cloudinary asset ${filename}:`, e);
    }
  } else {
    const filePath = path.join(__dirname, '../../uploads/templates', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error(`Failed to delete local file ${filename}:`, e);
      }
    }
  }
};

const getFileObject = (file, req) => {
  if (!file) return null;
  return {
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    url: file.url || file.filename
  };
};

// @desc  Get user templates
// @route GET /api/templates
// @access Private
exports.getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ userId: req.user._id })
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create template
// @route POST /api/templates
// @access Private
exports.createTemplate = async (req, res) => {
  try {
    const { title, text, tags } = req.body;
    if (!title || !text) return res.status(400).json({ message: 'Title and text are required' });

    let parsedTags = [];
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    const imageFile = req.files?.image ? getFileObject(req.files.image[0], req) : null;
    const videoFile = req.files?.video ? getFileObject(req.files.video[0], req) : null;
    const docFile = req.files?.doc ? getFileObject(req.files.doc[0], req) : null;

    const template = await Template.create({
      userId: req.user._id,
      title,
      text,
      imageFile,
      videoFile,
      docFile,
      tags: parsedTags,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Update template
// @route PUT /api/templates/:id
// @access Private
exports.updateTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.user._id });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const { title, text, tags, removeImage, removeVideo, removeDoc } = req.body;
    if (title) template.title = title;
    if (text) template.text = text;
    
    if (tags) {
      template.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    // Handle removals
    if (removeImage === 'true' || removeImage === true) {
      if (template.imageFile) {
        deleteFile(template.imageFile.filename);
        template.imageFile = null;
      }
    }
    if (removeVideo === 'true' || removeVideo === true) {
      if (template.videoFile) {
        deleteFile(template.videoFile.filename);
        template.videoFile = null;
      }
    }
    if (removeDoc === 'true' || removeDoc === true) {
      if (template.docFile) {
        deleteFile(template.docFile.filename);
        template.docFile = null;
      }
    }

    // Handle new uploads (overwriting if exists)
    if (req.files?.image) {
      if (template.imageFile) deleteFile(template.imageFile.filename);
      template.imageFile = getFileObject(req.files.image[0], req);
    }
    if (req.files?.video) {
      if (template.videoFile) deleteFile(template.videoFile.filename);
      template.videoFile = getFileObject(req.files.video[0], req);
    }
    if (req.files?.doc) {
      if (template.docFile) deleteFile(template.docFile.filename);
      template.docFile = getFileObject(req.files.doc[0], req);
    }

    await template.save();
    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete template
// @route DELETE /api/templates/:id
// @access Private
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.user._id });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    // Delete attached files from disk
    if (template.imageFile) deleteFile(template.imageFile.filename);
    if (template.videoFile) deleteFile(template.videoFile.filename);
    if (template.docFile) deleteFile(template.docFile.filename);

    await Template.findByIdAndDelete(template._id);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Increment usage count
// @route POST /api/templates/:id/use
// @access Private
exports.useTemplate = async (req, res) => {
  try {
    await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $inc: { usageCount: 1 } }
    );
    res.json({ message: 'ok' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
