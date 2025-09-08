const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Enhanced Upload Middleware for Group Messaging
 * Supports all media types with proper validation and progress tracking
 * Includes specific support for group message media uploads
 */

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Enhanced storage configuration with group-specific organization
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let destDir = uploadDir;
    
    // Organize uploads by type and group
    if (req.route.path.includes('/groups/')) {
      destDir = path.join(uploadDir, 'groups');
    } else if (req.route.path.includes('/media/')) {
      destDir = path.join(uploadDir, 'media');
    } else if (req.route.path.includes('/voice/')) {
      destDir = path.join(uploadDir, 'voice');
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    // Enhanced filename generation with group context
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    
    let prefix = 'file';
    if (req.route.path.includes('/groups/')) {
      prefix = 'group';
    } else if (req.route.path.includes('/voice/')) {
      prefix = 'voice';
    } else if (file.mimetype.startsWith('image/')) {
      prefix = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      prefix = 'video';
    }
    
    const filename = `${prefix}-${timestamp}-${random}${ext}`;
    cb(null, filename);
  }
});

// Enhanced file filter with comprehensive media type support
const fileFilter = (req, file, cb) => {
  console.log(`🔍 Upload: Validating file type: ${file.mimetype}`);
  
  // Comprehensive list of allowed media types
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    
    // Videos
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv',
    'video/m4v', 'video/3gp', 'video/quicktime',
    
    // Audio/Voice
    'audio/mp3', 'audio/wav', 'audio/wave', 'audio/aac', 'audio/ogg', 'audio/m4a', 'audio/flac',
    'audio/wma', 'audio/amr', 'audio/opus', 'audio/mpeg',
    
    // Documents
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    console.log(`✅ Upload: File type allowed: ${file.mimetype}`);
    cb(null, true);
  } else {
    console.log(`❌ Upload: File type not allowed: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Please upload a supported media file.`), false);
  }
};

// Enhanced size limits based on file type
const getSizeLimit = (req) => {
  const route = req.route?.path || req.url;
  
  if (route.includes('/voice/')) {
    return 25 * 1024 * 1024; // 25MB for voice messages
  } else if (route.includes('/video/')) {
    return 200 * 1024 * 1024; // 200MB for videos
  } else if (route.includes('/image/')) {
    return 50 * 1024 * 1024; // 50MB for images
  } else {
    return 100 * 1024 * 1024; // 100MB default
  }
};

// Base upload configuration
const baseUploadConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB maximum
    files: 5 // Maximum 5 files at once
  }
};

// Dynamic multer configuration that adjusts limits based on request
const createUpload = (options = {}) => {
  return (req, res, next) => {
    const sizeLimit = getSizeLimit(req);
    
    const config = {
      ...baseUploadConfig,
      limits: {
        ...baseUploadConfig.limits,
        fileSize: options.maxSize || sizeLimit
      }
    };
    
    const upload = multer(config);
    
    // Handle single file upload
    if (options.single) {
      return upload.single(options.single)(req, res, next);
    }
    
    // Handle multiple file upload
    if (options.array) {
      return upload.array(options.array, options.maxCount || 5)(req, res, next);
    }
    
    // Handle form fields with files
    if (options.fields) {
      return upload.fields(options.fields)(req, res, next);
    }
    
    // Default single file upload
    return upload.single('file')(req, res, next);
  };
};

// Specific upload configurations for different use cases

// Standard media upload (images, videos, documents)
const mediaUpload = createUpload({
  single: 'file',
  maxSize: 100 * 1024 * 1024 // 100MB
});

// Voice message upload (audio files)
const voiceUpload = createUpload({
  single: 'file',
  maxSize: 25 * 1024 * 1024 // 25MB
});

// Group media upload (multiple files)
const groupMediaUpload = createUpload({
  array: 'files',
  maxCount: 5,
  maxSize: 100 * 1024 * 1024 // 100MB per file
});

// Mixed upload (media + voice)
const mixedUpload = createUpload({
  fields: [
    { name: 'media', maxCount: 3 },
    { name: 'voice', maxCount: 1 },
    { name: 'documents', maxCount: 5 }
  ]
});

// Error handling middleware for upload errors
const handleUploadError = (error, req, res, next) => {
  console.error('❌ Upload Error:', error);
  
  // Clean up any uploaded files on error
  if (req.file && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }
  
  if (req.files) {
    Object.values(req.files).flat().forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
  }
  
  // Return appropriate error response
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Please upload a smaller file.',
      maxSize: '200MB'
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      success: false,
      message: 'Too many files. Maximum 5 files allowed.',
      maxFiles: 5
    });
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(415).json({
      success: false,
      message: error.message,
      allowedTypes: 'Images, Videos, Audio, Documents'
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'Upload failed. Please try again.',
    error: error.message
  });
};

// File validation utilities
const validateMediaFile = (file) => {
  const validations = {
    size: file.size <= 200 * 1024 * 1024, // 200MB
    type: file.mimetype && file.mimetype.length > 0,
    name: file.originalname && file.originalname.length > 0
  };
  
  return Object.values(validations).every(Boolean);
};

const getFileInfo = (file) => {
  return {
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    type: file.mimetype.split('/')[0], // image, video, audio, etc.
    extension: path.extname(file.originalname)
  };
};

// Progress tracking for large uploads (placeholder for future WebRTC implementation)
const trackUploadProgress = (req, res, next) => {
  const startTime = Date.now();
  
  // Add progress tracking metadata to request
  req.uploadProgress = {
    startTime,
    sessionId: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stage: 'started'
  };
  
  // Log upload start
  console.log(`🚀 Upload Progress: Started session ${req.uploadProgress.sessionId}`);
  
  // Override res.json to track completion
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    console.log(`✅ Upload Progress: Completed session ${req.uploadProgress.sessionId} in ${duration}ms`);
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = {
  // Main upload configurations
  mediaUpload,
  voiceUpload,
  groupMediaUpload,
  mixedUpload,
  
  // Custom upload creator
  createUpload,
  
  // Middleware
  handleUploadError,
  trackUploadProgress,
  
  // Utilities
  validateMediaFile,
  getFileInfo,
  
  // Storage configuration
  storage,
  fileFilter,
  
  // Legacy exports for compatibility
  upload: mediaUpload // Default upload middleware
};
