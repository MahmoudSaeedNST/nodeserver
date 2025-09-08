const jwt = require('jsonwebtoken');
const wordPressService = require('../services/wordpressService');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens with WordPress and attaches user info to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Auth middleware - Processing request:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      tokenLength: token?.length,
      tokenPreview: token
    });

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: 'NO_TOKEN'
      });
    }

    // Basic token format validation
    if (typeof token !== 'string' || token.trim().length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        error: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Clean the token
    const cleanToken = token.trim();

    // JWT token should have 3 parts
    const tokenParts = cleanToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('Malformed token detected:', {
        tokenLength: token.length,
        tokenParts: tokenParts.length,
        tokenStart: token.substring(0, 50),
        tokenEnd: token.substring(token.length - 50)
      });
      return res.status(401).json({
        success: false,
        message: 'Malformed token',
        error: 'MALFORMED_TOKEN'
      });
    }

    // Validate token with WordPress
    try {
      const validation = await wordPressService.validateToken(cleanToken);
      console.log('Token validation result:', validation);
      
      // Handle different response formats from WordPress JWT plugin
      let userData = null;
      
      if (validation.data && validation.data.user) {
        // Full user data response
        userData = validation.data.user;
      } else if (validation.data && validation.data.status === 200) {
        // Simple validation response - need to extract user from token
        try {
          const tokenParts = cleanToken.split('.');
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('Decoded token payload:', {
            iss: payload.iss,
            exp: payload.exp,
            iat: payload.iat,
            hasUserData: !!(payload.data && payload.data.user)
          });
          
          if (payload.data && payload.data.user && payload.data.user.id) {
            // Get user data from WordPress using the user ID
            const userResponse = await wordPressService.getUserById(payload.data.user.id, cleanToken);
            if (userResponse && userResponse.id) {
              userData = {
                id: userResponse.id,
                user_email: userResponse.email,
                user_login: userResponse.username || userResponse.slug,
                display_name: userResponse.name,
                roles: userResponse.roles || ['subscriber']
              };
            }
          }
        } catch (decodeError) {
          console.error('Error decoding token payload:', decodeError);
        }
      }
      
      if (!userData || !userData.id) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token - no user data',
          error: 'INVALID_TOKEN'
        });
      }

      // Attach user info to request
      req.user = {
        id: userData.id,
        user_id: userData.id,  // For backward compatibility
        email: userData.user_email,
        user_email: userData.user_email,  // For backward compatibility
        username: userData.user_login,
        user_login: userData.user_login,  // For backward compatibility
        displayName: userData.display_name,
        display_name: userData.display_name,  // For backward compatibility
        role: userData.roles?.[0] || 'subscriber',
        token: cleanToken  // Add token to user object for service calls
      };
      
      req.token = cleanToken;
      
      next();
    } catch (error) {
      console.error('Token validation error:', {
        message: error.message,
        stack: error.stack,
        tokenLength: cleanToken?.length,
        tokenPreview: cleanToken
      });
      return res.status(401).json({
        success: false,
        message: 'Token validation failed',
        error: 'VALIDATION_FAILED'
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user info if token is valid, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const validation = await wordPressService.validateToken(token);
        
        // Handle different response formats from WordPress JWT plugin
        let userData = null;
        
        if (validation.data && validation.data.user) {
          // Full user data response
          userData = validation.data.user;
        } else if (validation.data && validation.data.status === 200) {
          // Simple validation response - need to extract user from token
          try {
            const tokenParts = token.split('.');
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            if (payload.data && payload.data.user && payload.data.user.id) {
              // Get user data from WordPress using the user ID
              const userResponse = await wordPressService.getUserById(payload.data.user.id, cleanToken);
              if (userResponse && userResponse.id) {
                userData = {
                  id: userResponse.id,
                  user_email: userResponse.email,
                  user_login: userResponse.username || userResponse.slug,
                  display_name: userResponse.name,
                  roles: userResponse.roles || ['subscriber']
                };
              }
            }
          } catch (decodeError) {
            console.error('Error decoding token payload:', decodeError);
          }
        }
        
        if (userData && userData.id) {
          req.user = {
            id: userData.id,
            user_id: userData.id,  // For backward compatibility
            email: userData.user_email,
            user_email: userData.user_email,  // For backward compatibility
            username: userData.user_login,
            user_login: userData.user_login,  // For backward compatibility
            displayName: userData.display_name,
            display_name: userData.display_name,  // For backward compatibility
            role: userData.roles?.[0] || 'subscriber',
            token: token  // Add token to user object for service calls
          };
        }
      } catch (error) {
        // Continue without authentication
        console.log('Optional auth failed:', error.message);
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Role-based Authorization Middleware
 * Requires specific roles to access routes
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NO_AUTH'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole
};
