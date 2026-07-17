const Recording = require('../models/Recording');
const Lead = require('../models/Lead');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// CLOUDINARY UPLOAD — MANUAL UPLOAD ONLY:
// This function handles user-uploaded voice notes and call recordings.
//
// IMPORTANT — AUTO-RECORDING IS NOT IMPLEMENTED AND CANNOT BE:
// Automatic capture of phone call audio is NOT possible on iOS or Android
// without native OS-level hooks (impossible in a web app).
// This system is manual upload only. Do NOT add any fake "auto-record" claims.
//
// Files are stored on Cloudinary under the 'crm_recordings' folder.
// Audio files use resource_type: 'video' — this is Cloudinary's classification
// for any media with an audio track (not a mistake).
//
// Retry logic: 3 total attempts (initial + 2 retries) with 1s delay between attempts.
// If all attempts fail, the local temp file is cleaned up and a 500 is returned.
// Local temp file is ALWAYS deleted after upload (success or fail) to prevent disk bloat.
const uploadToCloudinaryWithRetry = async (filePath, options, retries = 2) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const result = await cloudinary.uploader.upload(filePath, options);
      return result;
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        throw err;
      }
      console.warn(`[Cloudinary Recording] Upload failed, retrying (${attempt}/${retries}). Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

// @desc  Upload recording for a lead
// @route POST /api/recordings/upload/:leadId
// @access Private
exports.uploadRecording = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Verify file size limit (20MB) before upload
    const MAX_SIZE = 20 * 1024 * 1024;
    if (req.file.size > MAX_SIZE) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'File too large. Max size is 20MB.' });
    }

    const lead = await Lead.findOne({ _id: req.params.leadId, userId: req.user._id }).lean();
    if (!lead) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Upload to Cloudinary with retry (max 3 attempts total)
    // NOTE: resource_type 'video' is correct for audio files — Cloudinary's API
    // classifies all media with audio tracks under the 'video' resource type.
    // Changing this to 'image' or 'raw' will cause the upload to fail.
    let uploadResult;
    try {
      uploadResult = await uploadToCloudinaryWithRetry(req.file.path, {
        folder: 'crm_recordings',
        resource_type: 'video',
      });
    } catch (uploadError) {
      // Cleanup local file
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Cloudinary recording upload failed:', uploadError);
      return res.status(500).json({ message: 'Failed to upload audio to cloud storage.' });
    }

    // Cleanup local temp file
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const recording = await Recording.create({
      leadId: req.params.leadId,
      userId: req.user._id,
      filename: uploadResult.secure_url, // Storing full URL in filename for frontend compatibility
      publicId: uploadResult.public_id,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: uploadResult.bytes || req.file.size,
    });

    res.status(201).json(recording);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get recordings for a lead
// @route GET /api/recordings/:leadId
// @access Private
exports.getRecordings = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.leadId, userId: req.user._id }).lean();
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const recordings = await Recording.find({ leadId: req.params.leadId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(recordings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Delete recording
// @route DELETE /api/recordings/:id
// @access Private
exports.deleteRecording = async (req, res) => {
  try {
    const recording = await Recording.findOne({ _id: req.params.id, userId: req.user._id });
    if (!recording) return res.status(404).json({ message: 'Recording not found' });

    // Delete from Cloudinary if publicId exists, otherwise fall back to local disk
    if (recording.publicId) {
      try {
        await cloudinary.uploader.destroy(recording.publicId, { resource_type: 'video' });
      } catch (cloudinaryError) {
        console.error(`Failed to delete Cloudinary asset ${recording.publicId}:`, cloudinaryError);
      }
    } else {
      const filePath = path.join(__dirname, '../../uploads/recordings', recording.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await recording.deleteOne();
    res.json({ message: 'Recording deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
