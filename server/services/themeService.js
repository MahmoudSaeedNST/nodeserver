const wordPressService = require('./wordpressService');

class ThemeService {
  constructor() {
    this.defaultTheme = 'light';
    this.supportedThemes = ['light', 'dark'];
  }

  /**
   * Get user's theme preference
   */
  async getUserTheme(userId, token) {
    try {
      // Get user meta data for theme preference
      const userMeta = await wordPressService.makeAuthenticatedRequest(
        `wp/v2/users/${userId}`,
        { method: 'GET' },
        token
      );

      // Check for theme preference in user meta
      const themePreference = userMeta.meta?.theme_preference || this.defaultTheme;
      
      return {
        theme: this.supportedThemes.includes(themePreference) ? themePreference : this.defaultTheme,
        supportedThemes: this.supportedThemes
      };
    } catch (error) {
      console.error('Get user theme error:', error);
      return {
        theme: this.defaultTheme,
        supportedThemes: this.supportedThemes
      };
    }
  }

  /**
   * Update user's theme preference
   */
  async updateUserTheme(userId, theme, token) {
    try {
      if (!this.supportedThemes.includes(theme)) {
        throw new Error(`Unsupported theme: ${theme}. Supported themes: ${this.supportedThemes.join(', ')}`);
      }

      // Update user meta with theme preference
      await wordPressService.makeAuthenticatedRequest(
        `wp/v2/users/${userId}`,
        {
          method: 'POST',
          data: {
            meta: {
              theme_preference: theme
            }
          }
        },
        token
      );

      return {
        success: true,
        theme: theme,
        message: 'Theme preference updated successfully'
      };
    } catch (error) {
      console.error('Update user theme error:', error);
      throw error;
    }
  }

  /**
   * Get theme configuration
   */
  getThemeConfig(theme = this.defaultTheme) {
    const themes = {
      light: {
        name: 'Light',
        colors: {
          primary: '#007AFF',
          secondary: '#5856D6',
          success: '#34C759',
          warning: '#FF9500',
          danger: '#FF3B30',
          info: '#5AC8FA',
          background: '#FFFFFF',
          surface: '#F8F9FA',
          text: '#000000',
          textSecondary: '#666666',
          border: '#E1E5E9',
          accent: '#007AFF'
        },
        spacing: {
          xs: 4,
          sm: 8,
          md: 16,
          lg: 24,
          xl: 32,
          xxl: 48
        },
        borderRadius: {
          sm: 4,
          md: 8,
          lg: 12,
          xl: 16,
          round: 50
        },
        shadows: {
          sm: '0 1px 3px rgba(0,0,0,0.1)',
          md: '0 4px 6px rgba(0,0,0,0.1)',
          lg: '0 10px 15px rgba(0,0,0,0.1)'
        }
      },
      dark: {
        name: 'Dark',
        colors: {
          primary: '#0A84FF',
          secondary: '#5E5CE6',
          success: '#30D158',
          warning: '#FF9F0A',
          danger: '#FF453A',
          info: '#64D2FF',
          background: '#000000',
          surface: '#1C1C1E',
          text: '#FFFFFF',
          textSecondary: '#EBEBF5',
          border: '#38383A',
          accent: '#0A84FF'
        },
        spacing: {
          xs: 4,
          sm: 8,
          md: 16,
          lg: 24,
          xl: 32,
          xxl: 48
        },
        borderRadius: {
          sm: 4,
          md: 8,
          lg: 12,
          xl: 16,
          round: 50
        },
        shadows: {
          sm: '0 1px 3px rgba(255,255,255,0.1)',
          md: '0 4px 6px rgba(255,255,255,0.1)',
          lg: '0 10px 15px rgba(255,255,255,0.1)'
        }
      }
    };

    return themes[theme] || themes[this.defaultTheme];
  }

  /**
   * Get all available theme configurations
   */
  getAllThemeConfigs() {
    const configs = {};
    this.supportedThemes.forEach(theme => {
      configs[theme] = this.getThemeConfig(theme);
    });
    return configs;
  }

  /**
   * Validate theme data
   */
  validateTheme(theme) {
    return {
      isValid: this.supportedThemes.includes(theme),
      supportedThemes: this.supportedThemes,
      defaultTheme: this.defaultTheme
    };
  }

  /**
   * Get system theme based on time (fallback)
   */
  getSystemTheme() {
    const hour = new Date().getHours();
    // Use dark theme between 6 PM and 6 AM
    return (hour >= 18 || hour < 6) ? 'dark' : 'light';
  }

  /**
   * Apply theme to response data
   */
  applyThemeToResponse(data, theme) {
    const themeConfig = this.getThemeConfig(theme);
    return {
      ...data,
      theme: {
        current: theme,
        config: themeConfig,
        supported: this.supportedThemes
      }
    };
  }
}

module.exports = new ThemeService();
