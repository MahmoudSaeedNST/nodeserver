const axios = require('axios');

class WordPressService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL || 'https://olomak.com';
    this.apiVersion = process.env.WORDPRESS_API_VERSION || 'wp/v2';
    this.jwtEndpoint = process.env.JWT_ENDPOINT || 'jwt-auth/v1';
    this.initialized = false;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(`WordPress API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('WordPress API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('WordPress API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize WordPress service
   */
  async initialize() {
    try {
      console.log('Initializing WordPress service...');
      
      // Test connection to WordPress
      const response = await this.axiosInstance.get('/wp-json');
      
      if (response.data && response.data.name) {
        console.log(`Connected to WordPress site: ${response.data.name}`);
        this.initialized = true;
        return true;
      } else {
        throw new Error('Invalid WordPress response');
      }
    } catch (error) {
      console.error('Failed to initialize WordPress service:', error.message);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Make authenticated request to WordPress API
   */
  async makeAuthenticatedRequest(endpoint, options = {}, token = null) {
    if (!this.initialized) {
      throw new Error('WordPress service not initialized');
    }

    try {
      const config = {
        ...options,
        headers: {
          ...options.headers,
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };

      const response = await this.axiosInstance.request({
        url: `/wp-json/${this.apiVersion}/${endpoint}`,
        ...config
      });

      return response.data;
    } catch (error) {
      console.error('WordPress API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Make JWT authentication request
   */
  async makeJWTRequest(endpoint, options = {}) {
    if (!this.initialized) {
      throw new Error('WordPress service not initialized');
    }

    try {
      const response = await this.axiosInstance.request({
        url: `/wp-json/${this.jwtEndpoint}/${endpoint}`,
        ...options
      });

      return response.data;
    } catch (error) {
      console.error('WordPress JWT request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Authenticate user with WordPress JWT
   */
  async authenticateUser(credentials) {
    return await this.makeJWTRequest('token', {
      method: 'POST',
      data: credentials
    });
  }

  /**
   * Validate JWT token
   */
  async validateToken(token) {
    // Validate token format before making request
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token format');
    }

    // Clean the token
    const cleanToken = token.trim();

    // JWT tokens should have 3 parts separated by dots
    const tokenParts = cleanToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Wrong number of segments');
    }

    // Validate base64 encoding of each part
    try {
      JSON.parse(Buffer.from(tokenParts[0], 'base64').toString()); // header
      JSON.parse(Buffer.from(tokenParts[1], 'base64').toString()); // payload
      // signature is just bytes, not JSON
    } catch (error) {
      throw new Error('Invalid token encoding');
    }

    return await this.makeJWTRequest('token/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`
      }
    });
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(token) {
    return await this.makeJWTRequest('token/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Get user data by ID
   */
  async getUserById(userId, token) {
    return await this.makeAuthenticatedRequest(`users/${userId}`, {
      method: 'GET'
    }, token);
  }

  /**
   * Update user data
   */
  async updateUser(userId, userData, token) {
    return await this.makeAuthenticatedRequest(`users/${userId}`, {
      method: 'POST',
      data: userData
    }, token);
  }

  /**
   * Get WordPress site info
   */
  async getSiteInfo() {
    if (!this.initialized) {
      throw new Error('WordPress service not initialized');
    }

    try {
      const response = await this.axiosInstance.get('/wp-json');
      return response.data;
    } catch (error) {
      console.error('Failed to get site info:', error.message);
      throw error;
    }
  }

  /**
   * Login user with WordPress JWT
   */
  async loginUser(username, password) {
    if (!this.initialized) {
      throw new Error('WordPress service not initialized');
    }

    try {
      const response = await this.axiosInstance.post(`/wp-json/${this.jwtEndpoint}/token`, {
        username,
        password
      });

      if (response.data && response.data.token) {
        return {
          token: response.data.token,
          user: response.data.user_display_name,
          email: response.data.user_email,
          userId: response.data.user_id
        };
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      console.error('WordPress login failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  /**
   * Get user profile data
   */
  async getUserProfile(token) {
    if (!this.initialized) {
      throw new Error('WordPress service not initialized');
    }

    try {
      const response = await this.axiosInstance.get('/wp-json/wp/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data) {
        console.log('User profile fetched successfully:', response.data);
        return {
          id: response.data.id,
          username: response.data.username || response.data.slug,
          email: response.data.email,
          displayName: response.data.name,
          firstName: response.data.first_name || '',
          lastName: response.data.last_name || '',
          avatar: response.data.avatar_urls ? response.data.avatar_urls['96'] : null,
          roles: response.data.roles || []
        };
      } else {
        throw new Error('Invalid user profile response');
      }
    } catch (error) {
      console.error('WordPress get user profile failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get user profile');
    }
  }

  /**
   * Health check for WordPress connection
   */
  async healthCheck() {
    try {
      const response = await this.axiosInstance.get('/wp-json', {
        timeout: 5000
      });
      
      return {
        status: 'healthy',
        connected: true,
        siteName: response.data?.name || 'Unknown',
        responseTime: response.headers?.['x-response-time'] || 'Unknown'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get WordPress posts
   */
  async getPosts(params = {}, token = null) {
    return await this.makeAuthenticatedRequest('posts', {
      method: 'GET',
      params
    }, token);
  }

  /**
   * Create WordPress post
   */
  async createPost(postData, token) {
    return await this.makeAuthenticatedRequest('posts', {
      method: 'POST',
      data: postData
    }, token);
  }

  /**
   * Get WordPress media
   */
  async getMedia(mediaId, token = null) {
    return await this.makeAuthenticatedRequest(`media/${mediaId}`, {
      method: 'GET'
    }, token);
  }

  /**
   * Upload media to WordPress
   */
  async uploadMedia(mediaData, token) {
    return await this.makeAuthenticatedRequest('media', {
      method: 'POST',
      data: mediaData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }, token);
  }
}

module.exports = new WordPressService();
