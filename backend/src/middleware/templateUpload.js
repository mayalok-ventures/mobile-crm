const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary using process.env
if (process.env.CLOUDINARY_URL) {
  // Configured automatically via environment variable URL
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const tempDir = path.join(__dirname, '../../uploads/templates/temp');
const finalDir = path.join(__dirname, '../../uploads/templates');

// Ensure directories exist
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(finalDir)) {
  fs.mkdirSync(finalDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `temp-${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max overall
  },
});

// Helper function to upload to Cloudinary with retry
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
      console.warn(`[Cloudinary] Upload failed, retrying (${attempt}/${retries}). Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

const processTemplateUploads = async (req, res, next) => {
  if (!req.files) return next();

  const cleanupTemp = () => {
    Object.values(req.files).forEach(fileArray => {
      fileArray.forEach(file => {
        if (fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch (e) {}
        }
      });
    });
  };

  try {
    // Process image file (compress & convert to WebP)
    if (req.files.image && req.files.image[0]) {
      const imgFile = req.files.image[0];
      if (imgFile.size > 10 * 1024 * 1024) {
        throw new Error('Image file exceeds the 10MB limit.');
      }

      const uniqueName = `image-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const outPath = path.join(finalDir, uniqueName);

      // Convert using sharp
      await sharp(imgFile.path)
        .webp({ quality: 80 })
        .toFile(outPath);

      // Delete temp original image
      try { fs.unlinkSync(imgFile.path); } catch (e) {}

      // Upload to Cloudinary with retry
      const result = await uploadToCloudinaryWithRetry(outPath, {
        folder: 'crm_templates',
        resource_type: 'image'
      });

      // Delete final local WebP
      try { fs.unlinkSync(outPath); } catch (e) {}

      // Update file metadata for controller
      imgFile.filename = result.public_id;
      imgFile.url = result.secure_url;
      imgFile.mimetype = 'image/webp';
      imgFile.size = result.bytes || imgFile.size;
    }

    // Process video file
    if (req.files.video && req.files.video[0]) {
      const vidFile = req.files.video[0];
      if (vidFile.size > 50 * 1024 * 1024) {
        throw new Error('Video file exceeds the 50MB limit.');
      }

      // Upload to Cloudinary with retry
      const result = await uploadToCloudinaryWithRetry(vidFile.path, {
        folder: 'crm_templates',
        resource_type: 'video'
      });

      // Delete temp video
      try { fs.unlinkSync(vidFile.path); } catch (e) {}

      vidFile.filename = result.public_id;
      vidFile.url = result.secure_url;
      vidFile.size = result.bytes || vidFile.size;
    }

    // Process document file
    if (req.files.doc && req.files.doc[0]) {
      const docFile = req.files.doc[0];
      if (docFile.size > 20 * 1024 * 1024) {
        throw new Error('Document file exceeds the 20MB limit.');
      }

      // Upload to Cloudinary with retry
      const result = await uploadToCloudinaryWithRetry(docFile.path, {
        folder: 'crm_templates',
        resource_type: 'raw'
      });

      // Delete temp doc
      try { fs.unlinkSync(docFile.path); } catch (e) {}

      docFile.filename = result.public_id;
      docFile.url = result.secure_url;
      docFile.size = result.bytes || docFile.size;
    }

    next();
  } catch (err) {
    cleanupTemp();
    return res.status(400).json({ message: 'Error processing media uploads: ' + err.message });
  }
};

module.exports = {
  templateUpload: upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'doc', maxCount: 1 },
  ]),
  processTemplateUploads,
};
