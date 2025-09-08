const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Simple Upload Middleware - No JSON conflicts
 * Basic file upload handling that completely bypasses JSON parsing issues
 */

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads/simple');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Simple storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Simple file filter - accept all common media types
const fileFilter = (req, file, cb) => {
  // Accept images, videos, audio, and documents
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mov', 'video/avi', 'video/webm',
    'audio/mp3', 'audio/wav', 'audio/aac', 'audio/m4a', 'audio/ogg',
    'audio/mpeg', 'audio/mp4', // Add support for MPEG audio files
    'audio/3gpp', 'video/3gpp', // Add support for 3GP audio files (common in mobile recordings)
    'audio/amr', 'audio/amr-wb', // Add support for AMR audio files
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/rtf'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log('❌ Simple Upload: Rejected file type:', file.mimetype);
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

// Simple multer configuration
const simpleUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    fieldSize: 10 * 1024 * 1024   // 10MB max field size
  }
}).single('file'); // Expect a single file with field name 'file'

// Simple upload middleware wrapper with error handling
const simpleUploadMiddleware = (req, res, next) => {
  console.log('📤 Simple Upload: Middleware called');
  console.log('📤 Simple Upload: Content-Type:', req.headers['content-type']);
  console.log('📤 Simple Upload: Headers:', Object.keys(req.headers));
  
  simpleUpload(req, res, (err) => {
    if (err) {
      console.error('❌ Simple Upload Error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload failed'
      });
    }
    
    console.log('✅ Simple Upload: Multer processing completed');
    console.log('📤 Simple Upload: File details:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename
    } : 'NO FILE RECEIVED BY MULTER');
    console.log('📤 Simple Upload: Body fields:', Object.keys(req.body || {}));
    
    next();
  });
};

module.exports = {
  simpleUploadMiddleware,
  uploadDir
};
