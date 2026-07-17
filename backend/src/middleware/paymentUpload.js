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

const tempDir = path.join(__dirname, '../../uploads/payments/temp');
const finalDir = path.join(__dirname, '../../uploads/payments');

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
    fileSize: 10 * 1024 * 1024, // 10MB max screenshot size
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
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

const processPaymentUpload = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Screenshot file is required' });
  }

  const cleanupTemp = () => {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
  };

  try {
    const imgFile = req.file;
    const uniqueName = `payment-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outPath = path.join(finalDir, uniqueName);

    // Convert using sharp
    await sharp(imgFile.path)
      .webp({ quality: 80 })
      .toFile(outPath);

    // Delete temp original image
    cleanupTemp();

    // Upload to Cloudinary
    const result = await uploadToCloudinaryWithRetry(outPath, {
      folder: 'crm_payments',
      resource_type: 'image'
    });

    // Delete final local WebP
    if (fs.existsSync(outPath)) {
      try { fs.unlinkSync(outPath); } catch (e) {}
    }

    // Attach resulting URL to the request object
    req.screenshotUrl = result.secure_url;
    next();
  } catch (err) {
    cleanupTemp();
    return res.status(400).json({ message: 'Error processing screenshot upload: ' + err.message });
  }
};

module.exports = {
  paymentUpload: upload.single('screenshot'),
  processPaymentUpload,
};
