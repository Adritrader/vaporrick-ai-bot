// Professional dark theme with modern trading aesthetics
export const theme = {
  // Primary colors
  primary: '#00E676',        // Bright green for profits/buy
  primaryDark: '#00C853',    // Darker green
  secondary: '#FF5252',      // Red for losses/sell
  secondaryDark: '#F44336',  // Darker red
  accent: '#2196F3',         // Blue for neutral/info
  accentDark: '#1976D2',     // Darker blue

  // Background colors
  background: '#0D1117',     // Very dark background
  surface: '#161B22',        // Card/surface background
  surfaceVariant: '#21262D', // Elevated surfaces
  overlay: 'rgba(0, 0, 0, 0.8)', // Modal overlay

  // Text colors
  textPrimary: '#F0F6FC',    // Primary text
  textSecondary: '#8B949E',  // Secondary text
  textMuted: '#6E7681',      // Muted text
  textInverse: '#24292F',    // Text on light backgrounds

  // Border colors
  border: '#30363D',         // Default borders
  borderLight: '#21262D',    // Light borders
  borderFocus: '#388BFD',    // Focused borders

  // Status colors
  success: '#238636',        // Success states
  successBright: '#2EA043', // Bright success
  warning: '#D29922',        // Warning states
  warningBright: '#FB8500',  // Bright warning
  error: '#DA3633',          // Error states
  errorBright: '#F85149',    // Bright error
  info: '#0969DA',           // Info states

  // Chart colors
  chart: {
    bullish: '#00E676',      // Green candles/lines
    bearish: '#FF5252',      // Red candles/lines
    volume: '#6E7681',       // Volume bars
    ma: '#FFB74D',           // Moving averages
    rsi: '#9C27B0',          // RSI indicator
    macd: '#FF9800',         // MACD indicator
    grid: '#30363D',         // Chart grid lines
    background: '#0D1117',   // Chart background
  },

  // Gradients
  gradients: {
    primary: ['#00E676', '#00C853'],
    secondary: ['#FF5252', '#F44336'],
    background: ['#0D1117', '#161B22'],
    card: ['#161B22', '#21262D'],
    success: ['#238636', '#2EA043'],
    error: ['#DA3633', '#F85149'],
  },

  // Shadows
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.44,
      shadowRadius: 10.32,
      elevation: 16,
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border radius
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    round: 50,
  },

  // Typography
  typography: {
    h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
    h2: { fontSize: 28, fontWeight: '600', lineHeight: 36 },
    h3: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
    h4: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
    h5: { fontSize: 18, fontWeight: '500', lineHeight: 26 },
    h6: { fontSize: 16, fontWeight: '500', lineHeight: 24 },
    body1: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    body2: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
    overline: { fontSize: 10, fontWeight: '400', lineHeight: 14 },
  },
};

export type Theme = typeof theme;
