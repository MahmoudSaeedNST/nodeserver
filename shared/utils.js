/**
 * Utility functions for the Olomak app
 */

import { 
  ERROR_MESSAGES, 
  VALIDATION_RULES, 
  TIME_CONSTANTS,
  HTTP_STATUS 
} from './constants';

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  if (!email) return ERROR_MESSAGES.EMAIL_REQUIRED;
  if (!VALIDATION_RULES.EMAIL.test(email)) return ERROR_MESSAGES.EMAIL_INVALID;
  return null;
};

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  if (!password) return ERROR_MESSAGES.PASSWORD_REQUIRED;
  if (password.length < 6) return ERROR_MESSAGES.PASSWORD_MIN_LENGTH;
  if (!VALIDATION_RULES.PASSWORD.test(password)) return ERROR_MESSAGES.PASSWORD_PATTERN;
  return null;
};

/**
 * Validate username format
 */
export const validateUsername = (username) => {
  if (!username) return ERROR_MESSAGES.USERNAME_REQUIRED;
  if (username.length < 3) return ERROR_MESSAGES.USERNAME_MIN_LENGTH;
  if (!VALIDATION_RULES.USERNAME.test(username)) return ERROR_MESSAGES.USERNAME_PATTERN;
  return null;
};

/**
 * Validate name format
 */
export const validateName = (name) => {
  if (!name) return ERROR_MESSAGES.NAME_REQUIRED;
  if (!VALIDATION_RULES.NAME.test(name)) return ERROR_MESSAGES.NAME_PATTERN;
  return null;
};

/**
 * Format date to readable string
 */
export const formatDate = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return new Date(date).toLocaleDateString('en-US', defaultOptions);
};

/**
 * Format time to readable string
 */
export const formatTime = (date, options = {}) => {
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return new Date(date).toLocaleTimeString('en-US', defaultOptions);
};

/**
 * Get relative time (e.g., "2 hours ago")
 */
export const getRelativeTime = (date) => {
  const now = new Date();
  const diffTime = now - new Date(date);
  
  if (diffTime < TIME_CONSTANTS.MINUTE) {
    return 'just now';
  } else if (diffTime < TIME_CONSTANTS.HOUR) {
    const minutes = Math.floor(diffTime / TIME_CONSTANTS.MINUTE);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffTime < TIME_CONSTANTS.DAY) {
    const hours = Math.floor(diffTime / TIME_CONSTANTS.HOUR);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffTime < TIME_CONSTANTS.WEEK) {
    const days = Math.floor(diffTime / TIME_CONSTANTS.DAY);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return formatDate(date);
  }
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitalize first letter of string
 */
export const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Format file size to human readable string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate random ID
 */
export const generateId = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
};

/**
 * Debounce function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Check if string is empty or whitespace
 */
export const isEmpty = (str) => {
  return !str || str.trim().length === 0;
};

/**
 * Parse API error response
 */
export const parseError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        return data.message || ERROR_MESSAGES.VALIDATION_ERROR;
      case HTTP_STATUS.UNAUTHORIZED:
        return ERROR_MESSAGES.INVALID_CREDENTIALS;
      case HTTP_STATUS.FORBIDDEN:
        return ERROR_MESSAGES.PERMISSION_DENIED;
      case HTTP_STATUS.NOT_FOUND:
        return 'Resource not found';
      case HTTP_STATUS.CONFLICT:
        return data.message || ERROR_MESSAGES.USER_EXISTS;
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        return ERROR_MESSAGES.UNEXPECTED_ERROR;
      default:
        return data.message || ERROR_MESSAGES.UNEXPECTED_ERROR;
    }
  } else if (error.request) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  } else {
    return error.message || ERROR_MESSAGES.UNEXPECTED_ERROR;
  }
};

/**
 * Format currency
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Get initials from name
 */
export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

/**
 * Check if device is tablet
 */
export const isTablet = (width, height) => {
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  return minDimension >= 768 && maxDimension >= 1024;
};

/**
 * Generate avatar URL from name
 */
export const generateAvatarUrl = (name) => {
  const initials = getInitials(name);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=3C75C1&color=fff&size=96`;
};

/**
 * Validate form data
 */
export const validateForm = (data, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = data[field];
    const rule = rules[field];
    
    if (rule.required && isEmpty(value)) {
      errors[field] = `${capitalizeFirst(field)} is required`;
      return;
    }
    
    if (value && rule.validator) {
      const error = rule.validator(value);
      if (error) {
        errors[field] = error;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Convert hex color to rgba
 */
export const hexToRgba = (hex, alpha = 1) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? 
    `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : 
    hex;
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(delay * Math.pow(2, i));
    }
  }
};

/**
 * Convert snake_case to camelCase
 */
export const toCamelCase = (str) => {
  return str.replace(/([-_][a-z])/gi, (match) => {
    return match.toUpperCase().replace('-', '').replace('_', '');
  });
};

/**
 * Convert camelCase to snake_case
 */
export const toSnakeCase = (str) => {
  return str.replace(/[A-Z]/g, (match) => '_' + match.toLowerCase());
};
