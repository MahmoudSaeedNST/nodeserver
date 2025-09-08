// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://192.168.1.91:3000',
  WORDPRESS_URL: 'https://olomak.com',
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      REFRESH: '/api/auth/refresh',
      VALIDATE: '/api/auth/validate',
      RESET_PASSWORD: '/api/auth/reset-password',
      VERIFY_CODE: '/api/auth/verify-code',
      SET_PASSWORD: '/api/auth/set-password',
      LOGOUT: '/api/auth/logout',
      XPROFILE_GROUPS: '/api/auth/xprofile-groups'
    },
    USER: {
      PROFILE: '/api/user/profile',
      ME: '/api/user/me',
      UPDATE_PROFILE: '/api/user/profile',
      UPLOAD_AVATAR: '/api/user/avatar',
      CHANGE_PASSWORD: '/api/user/change-password',
      NOTIFICATION_SETTINGS: '/api/user/notification-settings',
      DEACTIVATE: '/api/user/deactivate',
      DELETE: '/api/user/delete'
    },
    UPLOAD: {
      IMAGE: '/api/upload/image',
      VIDEO: '/api/upload/video',
      DOCUMENT: '/api/upload/document',
      PROGRESS: '/api/upload/progress',
      CANCEL: '/api/upload/cancel'
    },
    FILES: {
      INFO: '/api/files',
      DELETE: '/api/files',
      COMPRESS: '/api/files/compress-image',
      THUMBNAIL: '/api/files/thumbnail'
    },
    SOCIAL: {
      GOOGLE: '/api/auth/google',
      FACEBOOK: '/api/auth/facebook',
      APPLE: '/api/auth/apple',
      LINK_GOOGLE: '/api/user/link-google',
      LINK_FACEBOOK: '/api/user/link-facebook',
      LINK_APPLE: '/api/user/link-apple',
      SOCIAL_ACCOUNTS: '/api/user/social-accounts'
    },
    BUDDYBOSS: {
      ACTIVITY: '/wp-json/buddyboss/v1/activity',
      ACTIVITY_FAVORITE: '/wp-json/buddyboss/v1/activity/{id}/favorite',
      ACTIVITY_COMMENT: '/wp-json/buddyboss/v1/activity/{id}/comment',
      MEMBERS: '/wp-json/buddyboss/v1/members',
      MEMBERS_DETAIL: '/wp-json/buddyboss/v1/members/{id}/detail',
      FRIENDS: '/wp-json/buddyboss/v1/friends',
      MEDIA: '/wp-json/buddyboss/v1/media',
      MEDIA_UPLOAD: '/wp-json/buddyboss/v1/media/upload',
      NOTIFICATIONS: '/wp-json/buddyboss/v1/notifications',
      SEARCH: '/wp-json/buddyboss/v1/mention',
      USER_REACTIONS: '/wp-json/buddyboss/v1/user-reactions',
      // Profile Management
      XPROFILE_UPDATE: '/wp-json/buddyboss/v1/xprofile/update',
      XPROFILE_FIELDS: '/wp-json/buddyboss/v1/xprofile/fields/{id}',
      XPROFILE_GROUPS: '/wp-json/buddyboss/v1/xprofile/groups',
      USER_PROFILE: '/wp-json/buddyboss/v1/members/{id}',
      USER_AVATAR: '/wp-json/buddyboss/v1/members/{id}/avatar',
      USER_COVER: '/wp-json/buddyboss/v1/members/{id}/cover',
      // Security & Privacy
      USER_SETTINGS: '/wp-json/buddyboss/v1/settings',
      PRIVACY_SETTINGS: '/wp-json/buddyboss/v1/settings/privacy',
      BLOCKED_USERS: '/wp-json/buddyboss/v1/members/blocked',
      REPORT_USER: '/wp-json/buddyboss/v1/moderation'
    },
    WOOCOMMERCE: {
      // Customer & Profile
      CUSTOMERS: '/wp-json/wc/v3/customers',
      CUSTOMER_DETAIL: '/wp-json/wc/v3/customers/{id}',
      // Orders
      ORDERS: '/wp-json/wc/v3/orders',
      ORDER_DETAIL: '/wp-json/wc/v3/orders/{id}',
      // Payment Methods
      PAYMENT_METHODS: '/wp-json/wc/v3/payment_gateways',
      // Subscriptions (if using WooCommerce Subscriptions)
      SUBSCRIPTIONS: '/wp-json/wc/v1/subscriptions',
      SUBSCRIPTION_DETAIL: '/wp-json/wc/v1/subscriptions/{id}',
      // Billing
      BILLING_ADDRESS: '/wp-json/wc/v3/customers/{id}',
      PAYMENT_TOKENS: '/wp-json/wc/v3/customers/{id}/payment_methods',
      // Products (for course payments)
      PRODUCTS: '/wp-json/wc/v3/products',
      PRODUCT_DETAIL: '/wp-json/wc/v3/products/{id}',
    },
    SYSTEM: {
      HEALTH: '/health',
      PING: '/api/ping',
      STATUS: '/api/status',
      SERVER_INFO: '/api/server-info',
      TEST_CONNECTION: '/api/test-connection',
      VERSION: '/api/version',
      ERROR_REPORT: '/api/error-report',
      MAINTENANCE: '/api/maintenance'
    },
    SOCIAL_NETWORK: {
      FRIENDS: '/api/social-network/friends',
      FOLLOWERS: '/api/social-network/followers',
      FOLLOWING: '/api/social-network/following',
      SEARCH_USERS: '/api/social-network/users/search',
      BLOCK_USER: '/api/social-network/users/block',
      UNBLOCK_USER: '/api/social-network/users/unblock',
      BLOCKED_USERS: '/api/social-network/users/blocked',
      SEND_FRIEND_REQUEST: '/api/social-network/friends/request',
      ACCEPT_FRIEND_REQUEST: '/api/social-network/friends/accept',
      REJECT_FRIEND_REQUEST: '/api/social-network/friends/reject',
      REMOVE_FRIEND: '/api/social-network/friends/remove',
      FRIEND_REQUESTS: '/api/social-network/friends/requests',
      USER_STATUS: '/api/social-network/users/{userId}/status',
      UPDATE_STATUS: '/api/social-network/users/status'
    },
    CHAT: {
      // Core Messages API - Using custom WordPress endpoints (/wp-json/chat/v1/)
      SEND_MESSAGE: '/api/chat/messages/send',
      GET_CHATS: '/api/chat/chats',
      GET_MESSAGES: '/api/chat/messages', 
      MARK_MESSAGE_READ: '/api/chat/messages/mark-read',
      SEARCH_MESSAGES: '/api/chat/search/messages',
      SEARCH_RECIPIENTS: '/api/chat/search/recipients',
      
      // Contacts - Use BuddyBoss members API via Node.js middleware
      GET_CONTACTS: '/api/chat/contacts',
      
      // Enhanced WordPress features using custom /wp-json/chat/v1/ endpoints
      MARK_THREAD_READ: '/api/chat/threads/mark-read',
      ARCHIVE_THREAD: '/api/chat/threads/archive',
      GET_ARCHIVED_THREADS: '/api/chat/threads/archived',
      GET_STARRED_THREADS: '/api/chat/threads/starred',
      
      // Media & Voice uploads using custom WordPress endpoints
      UPLOAD_MEDIA: '/api/chat/media/upload',
      UPLOAD_VOICE: '/api/chat/voice/upload',
      UPLOAD_MULTIPLE_MEDIA: '/api/chat/media/upload/multiple',
      
      // Group messaging using custom WordPress endpoints with BuddyBoss groups integration
      GET_GROUP_MESSAGES: '/api/chat/groups/{id}/messages',
      SEND_GROUP_MESSAGE: '/api/chat/groups/{id}/messages',
      
      // Status Features using custom WordPress endpoints
      GET_STATUS_LIST: '/api/chat/status',
      CREATE_STATUS: '/api/chat/status',
      UPLOAD_STATUS_MEDIA: '/api/chat/status/upload',
      GET_STATUS: '/api/chat/status/{id}',
      MARK_STATUS_VIEWED: '/api/chat/status/{id}/view',
      GET_STATUS_VIEWERS: '/api/chat/status/{id}/viewers',
      GET_STATUS_ANALYTICS: '/api/chat/status/{id}/analytics',
      LIKE_STATUS: '/api/chat/status/{id}/like',
      GET_STATUS_LIKES: '/api/chat/status/{id}/likes',
      COMMENT_STATUS: '/api/chat/status/{id}/comment',
      GET_STATUS_COMMENTS: '/api/chat/status/{id}/comments',
      
      // Call System using custom WordPress endpoints
      INITIATE_CALL: '/api/chat/calls/initiate',
      UPDATE_CALL_STATUS: '/api/chat/calls/update-status',
      GET_CALL_LOGS: '/api/chat/calls/logs',
      CALL_HISTORY: '/api/chat/calls/history',
      MISSED_CALLS_COUNT: '/api/chat/calls/missed/count',
      MARK_MISSED_CALLS_SEEN: '/api/chat/calls/missed/mark-seen'
    }
  }
};

// App Colors
export const AppColors = {
  primary: '#3C75C1',
  white: '#FFFFFF',
  lightGray: '#FCFDFE',
  softBlue: '#EAF0F8',
  veryLightBlue: '#F4F7FB',
  mutedBlue: '#DCE6F4',
  paleBlue: '#C7D7ED',
  skyBlue: '#CBDAEE',
  // Additional colors used in the UI
  darkBlue: '#2463BE',
  primaryBlue: '#3772E6',
  textDark: '#23242A',
  textSecondary: '#66759A',
  textMuted: '#5C6B8A',
  yellow: '#F3C934',
  backgroundLight: '#F6F9FF',
  cardBackground: '#D6E0F6',
  bundleBackground: '#D3E5FB',
};

// Social Media Constants
export const SOCIAL_MEDIA = {
  ACTIVITY_TYPES: {
    ACTIVITY_UPDATE: 'activity_update',
    ACTIVITY_PHOTO: 'activity_photo',
    ACTIVITY_VIDEO: 'activity_video',
    ACTIVITY_LINK: 'activity_link'
  },
  PRIVACY_LEVELS: {
    PUBLIC: 'public',
    FRIENDS: 'friends',
    PRIVATE: 'private'
  },
  PAGINATION: {
    ACTIVITY_FEED: 10,
    COMMENTS: 5,
    FRIENDS: 20
  },
  MEDIA_TYPES: {
    IMAGE: 'image',
    VIDEO: 'video',
    DOCUMENT: 'document'
  }
};

// Animation Constants
export const ANIMATION_CONSTANTS = {
  LIKE_ANIMATION_DURATION: 300,
  SCROLL_ANIMATION_DURATION: 250,
  FADE_ANIMATION_DURATION: 200
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  LAST_LOGIN: 'last_login',
  TOKEN_EXPIRY: 'token_expiry',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  FIRST_LAUNCH: 'first_launch',
  NOTIFICATION_SETTINGS: 'notification_settings',
  THEME_SETTINGS: 'theme_settings',
  THEME_PREFERENCE: 'theme_preference'
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  PHONE: /^[\+]?[1-9][\d]{0,15}$/,
  NAME: /^[a-zA-Z\s]{2,30}$/
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  USER_EXISTS: 'An account with this email already exists.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  PERMISSION_DENIED: 'Permission denied. Please check your account settings.',
  EMAIL_REQUIRED: 'Email is required',
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters',
  PASSWORD_PATTERN: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  EMAIL_INVALID: 'Please enter a valid email address',
  USERNAME_REQUIRED: 'Username is required',
  USERNAME_MIN_LENGTH: 'Username must be at least 3 characters',
  USERNAME_PATTERN: 'Username can only contain letters, numbers, and underscores',
  NAME_REQUIRED: 'Name is required',
  NAME_PATTERN: 'Name can only contain letters and spaces'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful!',
  REGISTER_SUCCESS: 'Registration successful!',
  LOGOUT_SUCCESS: 'Logged out successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  PASSWORD_RESET_SENT: 'Password reset code sent to your email',
  PASSWORD_UPDATED: 'Password updated successfully',
  CODE_VERIFIED: 'Code verified successfully'
};

// App Configuration
export const APP_CONFIG = {
  NAME: 'Olomak',
  VERSION: '1.0.0',
  DESCRIPTION: 'Social Learning Platform',
  SUPPORT_EMAIL: 'support@olomak.com',
  WEBSITE: 'https://olomak.com',
  PRIVACY_POLICY: 'https://olomak.com/privacy-policy',
  TERMS_OF_SERVICE: 'https://olomak.com/terms-of-service'
};

// Screen Names
export const SCREEN_NAMES = {
  // Auth Stack
  SPLASH: 'Splash',
  LOGIN: 'Login',
  REGISTER: 'Register',
  FORGOT_PASSWORD: 'ForgotPassword',
  VERIFY_CODE: 'VerifyCode',
  SET_PASSWORD: 'SetPassword',
  
  // Main Stack
  HOME: 'Home',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',
  NOTIFICATIONS: 'Notifications',
  COURSES: 'Courses',
  COURSE_DETAIL: 'CourseDetail',
  CHAT: 'Chat',
  CALL: 'Call',
  
  // Bottom Tab Names
  HOME_TAB: 'HomeTab',
  COURSES_TAB: 'CoursesTab',
  NOTIFICATIONS_TAB: 'NotificationsTab',
  PROFILE_TAB: 'ProfileTab'
};

// Theme Configuration
export const THEME_CONFIG = {
  BORDER_RADIUS: {
    SMALL: 8,
    MEDIUM: 12,
    LARGE: 16,
    EXTRA_LARGE: 24
  },
  SHADOWS: {
    SMALL: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2
    },
    MEDIUM: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4
    },
    LARGE: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8
    }
  },
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48
  },
  TYPOGRAPHY: {
    SIZES: {
      XS: 10,
      SM: 12,
      MD: 14,
      LG: 16,
      XL: 18,
      XXL: 20,
      XXXL: 24,
      HEADING: 28
    },
    WEIGHTS: {
      REGULAR: '400',
      MEDIUM: '500',
      SEMI_BOLD: '600',
      BOLD: '700'
    }
  }
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Loading States
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Social Login Providers
export const SOCIAL_PROVIDERS = {
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
  APPLE: 'apple',
  TWITTER: 'twitter'
};

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  QUALITY: 0.8
};

// Time Constants
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  TOKEN_VALIDITY_PERIOD: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
};

// WebRTC Configuration
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
  ]
};

// Socket Events
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  MESSAGE: 'message',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
  CALL_REQUEST: 'call_request',
  CALL_ANSWER: 'call_answer',
  CALL_REJECT: 'call_reject',
  CALL_END: 'call_end'
};
