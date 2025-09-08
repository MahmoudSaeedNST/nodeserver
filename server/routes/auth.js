const express = require('express');
const Joi = require('joi');
const wordPressService = require('../services/wordpressService');
const buddyBossService = require('../services/buddyBossService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6)
});

const registerSchema = Joi.object({
  username: Joi.string().required().min(3).max(50).alphanum(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  first_name: Joi.string().optional().max(50),
  last_name: Joi.string().optional().max(50),
  // Extended profile fields for BuddyBoss XProfile
  profile_fields: Joi.object({
    nickname: Joi.string().optional().max(50),
    phone_number: Joi.string().optional().max(20),
    birth_date: Joi.date().optional(),
    gender: Joi.string().optional().valid('male', 'female', 'other', 'prefer_not_to_say'),
    country: Joi.string().optional().max(50),
    passion: Joi.string().optional(),
    social_status: Joi.string().optional().valid('single', 'in_relationship', 'married', 'divorced', 'widowed', 'prefer_not_to_say'),
    occupation: Joi.string().optional().max(100),
    bio: Joi.string().optional().max(500)
  }).optional()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const verifyCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().required().length(6)
});

const setPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().required().length(6),
  password: Joi.string().required().min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
});

/**
 * POST /api/auth/login
 * Login user with WordPress credentials
 */
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { username, password } = value;

    // Login with WordPress
    const loginResult = await wordPressService.loginUser(username, password);

    if (!loginResult.token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get user profile
    const userProfile = await wordPressService.getUserProfile(loginResult.token);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: loginResult.token,
        refresh_token: loginResult.refresh_token || null,
        user: {
          id: userProfile.id,
          username: userProfile.username,
          email: userProfile.email,
          displayName: userProfile.name,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          avatar: userProfile.avatar_urls?.['96'] || null,
          role: userProfile.roles?.[0] || 'subscriber'
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.response?.status === 403) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user with BuddyBoss integration
 */
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { username, email, password, first_name, last_name, profile_fields } = value;

    // Prepare registration data for BuddyBoss
    const registrationData = {
      username,
      email,
      password,
      first_name: first_name || '',
      last_name: last_name || '',
    };

    // Add profile fields if provided
    if (profile_fields && Object.keys(profile_fields).length > 0) {
      registrationData.profile_fields = profile_fields;
    }

    // Register with BuddyBoss
    const registrationResult = await buddyBossService.registerUser(registrationData);

    // Login after registration to get token
    const loginResult = await wordPressService.loginUser(username, password);

    // If we have profile fields, update them via XProfile
    if (profile_fields && Object.keys(profile_fields).length > 0 && loginResult.token) {
      try {
        await buddyBossService.updateXProfileFields(
          registrationResult.id || loginResult.user_id, 
          profile_fields, 
          loginResult.token
        );
      } catch (profileError) {
        console.warn('Profile fields update failed after registration:', profileError);
        // Don't fail the registration if profile update fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token: loginResult.token,
        refresh_token: loginResult.refresh_token || null,
        user: {
          id: registrationResult.id || loginResult.user_id,
          username: registrationResult.username || username,
          email: registrationResult.email || email,
          displayName: registrationResult.display_name || `${first_name} ${last_name}`.trim(),
          firstName: registrationResult.first_name || first_name,
          lastName: registrationResult.last_name || last_name,
          avatar: registrationResult.avatar_urls?.['96'] || null,
          role: registrationResult.roles?.[0] || 'subscriber',
          profile_fields: profile_fields || {}
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.response.data.message || 'Registration failed'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const refreshResult = await wordPressService.refreshToken(refresh_token);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: refreshResult.token,
        refresh_token: refreshResult.refresh_token || refresh_token
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    res.status(401).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
});

/**
 * POST /api/auth/validate
 * Validate JWT token
 */
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    
    res.status(401).json({
      success: false,
      message: 'Token validation failed'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Request password reset
 */
router.post('/reset-password', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email } = value;

    await wordPressService.resetPassword(email);

    res.json({
      success: true,
      message: 'Password reset code sent to your email'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
});

/**
 * POST /api/auth/verify-code
 * Verify password reset code
 */
router.post('/verify-code', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = verifyCodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, code } = value;

    const verificationResult = await wordPressService.verifyResetCode(email, code);

    res.json({
      success: true,
      message: 'Reset code verified successfully',
      data: verificationResult
    });
  } catch (error) {
    console.error('Code verification error:', error);
    
    res.status(400).json({
      success: false,
      message: 'Invalid or expired code'
    });
  }
});

/**
 * POST /api/auth/set-password
 * Set new password
 */
router.post('/set-password', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = setPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, code, password } = value;

    await wordPressService.setNewPassword(email, code, password);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Set password error:', error);
    
    res.status(400).json({
      success: false,
      message: 'Failed to update password'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // WordPress JWT doesn't support server-side logout
    // Client should remove token from storage
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * GET /api/auth/xprofile-groups
 * Get XProfile groups and field structure for registration form
 */
router.get('/xprofile-groups', async (req, res) => {
  try {
    const groups = await buddyBossService.getXProfileGroups();

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('XProfile groups error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile fields'
    });
  }
});

module.exports = router;
