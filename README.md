# VaporRick AI Trading Bot

A comprehensive React Native trading application with AI-powered strategy generation, backtesting, and real-time market analysis.

## 🚀 Features

### Core Features
- **Real-time Market Data**: Track stocks and cryptocurrencies with live price updates
- **AI Strategy Generation**: Generate trading strategies using TensorFlow.js
- **Advanced Backtesting**: Test strategies with comprehensive performance metrics
- **Technical Indicators**: RSI, MACD, SMA, EMA, Bollinger Bands, and more
- **Price Alerts**: Custom alerts with background monitoring
- **Portfolio Management**: Track and manage your investments
- **Offline-First**: Local data storage with Realm Database

### Technical Features
- **Performance Optimized**: Web Workers for heavy computations
- **Modern UI**: Beautiful, responsive interface with React Native
- **TypeScript**: Type-safe development
- **Background Processing**: Alerts and data updates continue when app is closed
- **Caching**: Smart API response caching to minimize requests

## 📱 Screenshots

*Screenshots will be added here*

## 🛠️ Tech Stack

### Frontend
- React Native with Expo
- TypeScript
- Context API + useReducer for state management
- React Native Vector Icons
- Custom UI components

### Backend & Data
- Realm Database (local storage)
- AsyncStorage for app preferences
- Alpha Vantage API (stocks)
- CoinGecko API (cryptocurrencies)

### AI & Analysis
- TensorFlow.js for AI models
- Custom technical indicators library
- Monte Carlo simulations
- Advanced backtesting engine

### Notifications & Background
- Expo Notifications
- Background Fetch
- Task Manager for scheduled tasks

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- Yarn package manager
- Expo CLI
- Android Studio or Xcode (for development)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/vaporrick-ai-bot.git
cd vaporrick-ai-bot
```

2. Install dependencies
```bash
yarn install
```

3. Set up API keys
Create a `.env` file in the root directory:
```env
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

4. Start the development server
```bash
yarn start
```

5. Run on your device
```bash
yarn android  # For Android
yarn ios      # For iOS
```

## 📊 API Integration

### Alpha Vantage (Stocks)
- **Free Tier**: 500 requests/day
- **Endpoints**: Real-time quotes, historical data, company information
- **Rate Limiting**: Built-in request queuing

### CoinGecko (Cryptocurrency)
- **Free Tier**: 10,000 calls/month
- **Endpoints**: Price data, market charts, coin information
- **Rate Limiting**: 50 requests/minute

## 🤖 AI Strategy Generation

The app uses TensorFlow.js to analyze historical data and generate trading strategies:

### Strategy Types
- **Mean Reversion**: RSI-based oversold/overbought signals
- **Trend Following**: Moving average crossovers
- **Momentum**: MACD and volume-based signals
- **Custom**: AI-generated based on market patterns

### AI Features
- Pattern recognition in price data
- Volatility analysis
- Risk assessment
- Performance optimization

## 📈 Backtesting Engine

Comprehensive backtesting with professional metrics:

### Performance Metrics
- Total Return
- Sharpe Ratio
- Maximum Drawdown
- Win Rate
- Profit Factor
- Calmar Ratio

### Risk Management
- Position sizing
- Stop-loss orders
- Take-profit levels
- Portfolio diversification

## 🔔 Alert System

Smart price alerts with background monitoring:

### Alert Types
- Price above/below threshold
- Percentage change alerts
- Volume spike alerts
- Technical indicator signals

### Background Processing
- Continues working when app is closed
- Battery-optimized with configurable intervals
- Push notifications for immediate alerts

## 🏗️ Architecture

### Project Structure
```
src/
├── ai/                     # AI models and strategy generation
│   └── strategyGenerator.ts
├── backtesting/           # Backtesting engine
│   └── BacktestEngine.ts
├── components/            # Reusable UI components
├── context/              # React Context providers
│   └── TradingContext.tsx
├── database/             # Database models and operations
├── screens/              # Screen components
│   ├── AssetListScreen.tsx
│   ├── StrategyScreen.tsx
│   └── AlertsScreen.tsx
├── services/             # API and external services
│   ├── alertService.ts
│   └── marketDataService.ts
├── utils/                # Utility functions
│   └── technicalIndicators.ts
└── workers/              # Background processing
    └── BacktestWorker.ts
```

### State Management
- **Context API**: Global app state
- **useReducer**: Predictable state updates
- **AsyncStorage**: Persistent storage
- **Realm Database**: Complex data relationships

## 🔧 Configuration

### Environment Variables
```env
# API Keys
ALPHA_VANTAGE_API_KEY=your_key_here

# App Configuration
CACHE_DURATION_MS=300000
MAX_WATCHLIST_SIZE=50
BACKTEST_MAX_DAYS=365

# Background Tasks
ALERT_CHECK_INTERVAL_MS=300000
MARKET_UPDATE_INTERVAL_MS=60000
```

### Build Configuration
```javascript
// app.json
{
  "expo": {
    "name": "VaporRick AI Trading Bot",
    "slug": "vaporrick-ai-bot",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## 📱 Usage

### Adding Assets to Watchlist
1. Tap the "Add" button on the Assets screen
2. Search for stocks (e.g., "AAPL") or crypto (e.g., "bitcoin")
3. Select from search results
4. Asset will appear in your watchlist with real-time data

### Creating Trading Strategies
1. Navigate to the Strategies screen
2. Choose from sample strategies or create custom ones
3. Run backtests to evaluate performance
4. Save successful strategies for future use

### Setting Up Alerts
1. Go to the Alerts screen
2. Tap "Add Alert"
3. Configure asset, condition, and trigger value
4. Enable background notifications for real-time monitoring

## 🚨 Limitations & Considerations

### API Rate Limits
- Alpha Vantage: 500 requests/day (free tier)
- CoinGecko: 50 requests/minute (free tier)
- Implemented request queuing and caching

### Data Accuracy
- Real-time data may have slight delays
- Historical data is limited to available API ranges
- Cryptocurrency data is more volatile

### Battery Usage
- Background tasks are optimized for battery life
- Alert checking intervals can be configured
- Automatic throttling during low battery

## 🔮 Future Enhancements

### Version 2.0 Planned Features
- [ ] Social trading features
- [ ] Advanced portfolio analytics
- [ ] Multi-timeframe analysis
- [ ] Options and futures support
- [ ] Paper trading mode
- [ ] News sentiment analysis
- [ ] Advanced chart patterns
- [ ] Risk management tools

### AI Improvements
- [ ] Deep learning models
- [ ] Ensemble strategies
- [ ] Reinforcement learning
- [ ] Market regime detection
- [ ] Sentiment analysis integration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style
- Use TypeScript for type safety
- Follow React Native best practices
- Use meaningful variable names
- Add comments for complex logic
- Follow the existing project structure

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Alpha Vantage API Documentation](https://www.alphavantage.co/documentation/)
- [CoinGecko API Documentation](https://www.coingecko.com/en/api)
- [TensorFlow.js Documentation](https://js.tensorflow.org/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)

## 🙏 Acknowledgments

- Alpha Vantage for providing free stock market data
- CoinGecko for cryptocurrency market data
- TensorFlow.js team for AI capabilities
- React Native community for excellent tooling
- Expo team for simplifying mobile development

## 📞 Support

For support, email support@vaporrick.com or join our Discord community.

---

**Disclaimer**: This application is for educational and research purposes only. It should not be used as the sole basis for investment decisions. Always consult with a qualified financial advisor before making investment decisions. Trading involves risk of loss.
