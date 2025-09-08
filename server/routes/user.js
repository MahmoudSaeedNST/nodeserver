const express = require('express');
const Joi = require('joi');
const wordPressService = require('../services/wordpressService');
const buddyBossService = require('../services/buddyBossService');
const wooCommerceService = require('../services/wooCommerceService');
const themeService = require('../services/themeService');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  first_name: Joi.string().optional().max(50),
  last_name: Joi.string().optional().max(50),
  description: Joi.string().optional().max(500),
  nickname: Joi.string().optional().max(50)
});

const updateXProfileSchema = Joi.object({
  fields: Joi.object().required()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().min(6),
  newPassword: Joi.string().required().min(6),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
});

const updateSettingsSchema = Joi.object({
  notifications: Joi.object().optional(),
  privacy: Joi.object().optional(),
  security: Joi.object().optional()
});

const updateThemeSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark').required()
});

const blockUserSchema = Joi.object({
  userId: Joi.number().required()
});

const reportUserSchema = Joi.object({
  userId: Joi.number().required(),
  reason: Joi.string().required().max(500)
});

/**
 * GET /api/user/profile
 * Get user profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userProfile = await wordPressService.getUserProfile(req.token);

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: userProfile.id,
          username: userProfile.username,
          email: userProfile.email,
          displayName: userProfile.name,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          description: userProfile.description,
          nickname: userProfile.nickname,
          avatar: userProfile.avatar_urls?.['96'] || null,
          role: userProfile.roles?.[0] || 'subscriber',
          registeredDate: userProfile.registered_date
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile'
    });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const updatedProfile = await wordPressService.updateUserProfile(
      req.user.id,
      value,
      req.token
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedProfile.id,
          username: updatedProfile.username,
          email: updatedProfile.email,
          displayName: updatedProfile.name,
          firstName: updatedProfile.first_name,
          lastName: updatedProfile.last_name,
          description: updatedProfile.description,
          nickname: updatedProfile.nickname,
          avatar: updatedProfile.avatar_urls?.['96'] || null,
          role: updatedProfile.roles?.[0] || 'subscriber'
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

/**
 * GET /api/user/me
 * Get current user info (same as profile but simpler response)
 */
router.get('/me', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'User info retrieved successfully',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user info'
    });
  }
});

/**
 * GET /api/user/xprofile
 * Get user XProfile fields
 */
router.get('/xprofile', async (req, res) => {
  try {
    const xProfileFields = await buddyBossService.getXProfileFields(req.user.id, req.token);

    res.json({
      success: true,
      message: 'XProfile fields retrieved successfully',
      data: xProfileFields
    });
  } catch (error) {
    console.error('Get XProfile fields error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve XProfile fields'
    });
  }
});

/**
 * PUT /api/user/xprofile
 * Update user XProfile fields
 */
router.put('/xprofile', async (req, res) => {
  try {
    const { error, value } = updateXProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const updatedFields = await buddyBossService.updateXProfileFields(
      req.user.id,
      value.fields,
      req.token
    );

    res.json({
      success: true,
      message: 'XProfile fields updated successfully',
      data: updatedFields
    });
  } catch (error) {
    console.error('Update XProfile fields error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update XProfile fields'
    });
  }
});

/**
 * POST /api/user/avatar
 * Upload user avatar
 */
router.post('/avatar', async (req, res) => {
  try {
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({
        success: false,
        message: 'No avatar file provided'
      });
    }

    const avatarResult = await buddyBossService.uploadAvatar(
      req.user.id,
      req.files.avatar,
      req.token
    );

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: avatarResult
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar'
    });
  }
});

/**
 * DELETE /api/user/avatar
 * Delete user avatar
 */
router.delete('/avatar', async (req, res) => {
  try {
    await buddyBossService.deleteAvatar(req.user.id, req.token);

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete avatar'
    });
  }
});

/**
 * PUT /api/user/password
 * Change user password
 */
router.put('/password', async (req, res) => {
  try {
    const { error, value } = updatePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Verify current password by attempting login
    try {
      await wordPressService.loginUser(req.user.username, value.currentPassword);
    } catch (loginError) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password using WordPress API
    await wordPressService.updateUserProfile(
      req.user.id,
      { password: value.newPassword },
      req.token
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update password'
    });
  }
});

/**
 * POST /api/user/change-password
 * Change user password (alternative endpoint for mobile compatibility)
 */
router.post('/change-password', async (req, res) => {
  try {
    const { error, value } = updatePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Verify current password by attempting login
    try {
      await wordPressService.loginUser(req.user.username, value.currentPassword);
    } catch (loginError) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password using WordPress API
    await wordPressService.updateUserProfile(
      req.user.id,
      { password: value.newPassword },
      req.token
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update password'
    });
  }
});

/**
 * GET /api/user/settings
 * Get user settings
 */
router.get('/settings', async (req, res) => {
  try {
    const [userSettings, notificationSettings, privacySettings] = await Promise.all([
      buddyBossService.getUserSettings(req.user.id, req.token),
      buddyBossService.getNotificationSettings(req.user.id, req.token),
      buddyBossService.getPrivacySettings(req.user.id, req.token)
    ]);

    res.json({
      success: true,
      message: 'User settings retrieved successfully',
      data: {
        user: userSettings,
        notifications: notificationSettings,
        privacy: privacySettings
      }
    });
  } catch (error) {
    console.error('Get user settings error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user settings'
    });
  }
});

/**
 * PUT /api/user/settings
 * Update user settings
 */
router.put('/settings', async (req, res) => {
  try {
    const { error, value } = updateSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const updatePromises = [];

    if (value.notifications) {
      updatePromises.push(
        buddyBossService.updateNotificationSettings(req.user.id, value.notifications, req.token)
      );
    }

    if (value.privacy) {
      updatePromises.push(
        buddyBossService.updatePrivacySettings(req.user.id, value.privacy, req.token)
      );
    }

    if (value.security) {
      updatePromises.push(
        buddyBossService.updateUserSettings(req.user.id, value.security, req.token)
      );
    }

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'User settings updated successfully'
    });
  } catch (error) {
    console.error('Update user settings error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update user settings'
    });
  }
});

/**
 * GET /api/user/theme
 * Get user theme preference
 */
router.get('/theme', async (req, res) => {
  try {
    const themeData = await themeService.getUserTheme(req.user.id, req.token);

    res.json({
      success: true,
      message: 'Theme preference retrieved successfully',
      data: themeData
    });
  } catch (error) {
    console.error('Get user theme error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve theme preference'
    });
  }
});

/**
 * PUT /api/user/theme
 * Update user theme preference
 */
router.put('/theme', async (req, res) => {
  try {
    const { error, value } = updateThemeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const themeResult = await themeService.updateUserTheme(req.user.id, value.theme, req.token);

    res.json({
      success: true,
      message: 'Theme preference updated successfully',
      data: themeResult
    });
  } catch (error) {
    console.error('Update user theme error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update theme preference'
    });
  }
});

/**
 * GET /api/user/blocked
 * Get blocked users list
 */
router.get('/blocked', async (req, res) => {
  try {
    const blockedUsers = await buddyBossService.getBlockedUsers(req.user.id, req.token);

    res.json({
      success: true,
      message: 'Blocked users retrieved successfully',
      data: blockedUsers
    });
  } catch (error) {
    console.error('Get blocked users error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blocked users'
    });
  }
});

/**
 * POST /api/user/block
 * Block a user
 */
router.post('/block', async (req, res) => {
  try {
    const { error, value } = blockUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    await buddyBossService.blockUser(req.user.id, value.userId, req.token);

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Block user error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
});

/**
 * POST /api/user/unblock
 * Unblock a user
 */
router.post('/unblock', async (req, res) => {
  try {
    const { error, value } = blockUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    await buddyBossService.unblockUser(req.user.id, value.userId, req.token);

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
});

/**
 * POST /api/user/report
 * Report a user
 */
router.post('/report', async (req, res) => {
  try {
    const { error, value } = reportUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    await buddyBossService.reportUser(req.user.id, value.userId, value.reason, req.token);

    res.json({
      success: true,
      message: 'User reported successfully'
    });
  } catch (error) {
    console.error('Report user error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to report user'
    });
  }
});

module.exports = router;
