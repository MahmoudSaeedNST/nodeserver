/**
 * Theme utility functions shared between mobile and server
 */

// Light theme configuration
export const lightTheme = {
  primary: '#3C75C1',
  white: '#FFFFFF',
  lightGray: '#FCFDFE',
  softBlue: '#EAF0F8',
  veryLightBlue: '#F4F7FB',
  mutedBlue: '#DCE6F4',
  paleBlue: '#C7D7ED',
  skyBlue: '#CBDAEE',
  darkBlue: '#2463BE',
  primaryBlue: '#3772E6',
  textDark: '#23242A',
  textSecondary: '#66759A',
  textMuted: '#5C6B8A',
  yellow: '#F3C934',
  backgroundLight: '#F6F9FF',
  cardBackground: '#D6E0F6',
  bundleBackground: '#D3E5FB',
  error: '#FF6B6B',
  success: '#4ECDC4',
  warning: '#FFE66D',
  // Status bar styles
  statusBarStyle: 'dark-content',
  // Additional theme properties
  shadowColor: '#000',
  borderColor: '#DCE6F4',
  inputBackground: '#F4F7FB',
  modalBackground: 'rgba(0, 0, 0, 0.5)',
};

// Dark theme configuration
export const darkTheme = {
  primary: '#4A8BDB',
  white: '#1E1E1E',
  lightGray: '#2A2A2A',
  softBlue: '#252B36',
  veryLightBlue: '#2D3748',
  mutedBlue: '#3A4A5C',
  paleBlue: '#4A5568',
  skyBlue: '#5A6B7D',
  darkBlue: '#6B8DD6',
  primaryBlue: '#5B8DEF',
  textDark: '#F7FAFC',
  textSecondary: '#A0AEC0',
  textMuted: '#718096',
  yellow: '#F6E05E',
  backgroundLight: '#121212',
  cardBackground: '#2D3748',
  bundleBackground: '#2A4A5C',
  error: '#FF6B6B',
  success: '#48BB78',
  warning: '#ED8936',
  // Status bar styles
  statusBarStyle: 'light-content',
  // Additional theme properties
  shadowColor: '#000',
  borderColor: '#3A4A5C',
  inputBackground: '#2D3748',
  modalBackground: 'rgba(0, 0, 0, 0.8)',
};

/**
 * Get theme based on preference
 */
export const getTheme = (isDarkMode = false) => {
  return isDarkMode ? darkTheme : lightTheme;
};

/**
 * Theme utility functions
 */
export const themeUtils = {
  /**
   * Get contrasting text color
   */
  getContrastColor: (backgroundColor, theme) => {
    // Simple contrast detection
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    return brightness > 128 ? theme.textDark : theme.white;
  },

  /**
   * Apply opacity to color
   */
  withOpacity: (color, opacity) => {
    if (color.includes('rgba')) {
      return color.replace(/[\d\.]+\)$/g, `${opacity})`);
    }
    
    if (color.includes('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
    }
    
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  },

  /**
   * Lighten or darken a color
   */
  adjustBrightness: (color, amount) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  },

  /**
   * Generate color variants
   */
  generateColorVariants: (baseColor) => {
    return {
      50: themeUtils.adjustBrightness(baseColor, 200),
      100: themeUtils.adjustBrightness(baseColor, 150),
      200: themeUtils.adjustBrightness(baseColor, 100),
      300: themeUtils.adjustBrightness(baseColor, 50),
      400: themeUtils.adjustBrightness(baseColor, 25),
      500: baseColor,
      600: themeUtils.adjustBrightness(baseColor, -25),
      700: themeUtils.adjustBrightness(baseColor, -50),
      800: themeUtils.adjustBrightness(baseColor, -100),
      900: themeUtils.adjustBrightness(baseColor, -150),
    };
  }
};

/**
 * Theme constants for consistency
 */
export const THEME_CONSTANTS = {
  THEME_TYPES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  },
  
  TRANSITION_DURATION: 300,
  
  BORDER_RADIUS: {
    SMALL: 8,
    MEDIUM: 12,
    LARGE: 16,
    EXTRA_LARGE: 24
  },
  
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48
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
  }
};
