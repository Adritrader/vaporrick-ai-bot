# VaporRick AI Trading Bot

A sophisticated React Native Expo trading application for stocks and cryptocurrencies with advanced AI-powered strategy generation and comprehensive backtesting capabilities.

## 🚀 Features

### Core Features
- **Real-time Market Data**: Track stocks and cryptocurrencies with live price updates
- **Advanced AI Strategy Generation**: Create symbol-specific strategies using TensorFlow.js
- **Comprehensive Backtesting**: Test strategies with detailed performance metrics
- **Technical Indicators**: RSI, MACD, SMA, EMA, Bollinger Bands, and more
- **Smart Price Alerts**: Custom alerts with background monitoring and notifications
- **Portfolio Management**: Track and manage your investments with AI analysis
- **Offline-First**: Local data storage with Realm Database

### Advanced AI Features
- **Symbol-Specific Strategies**: AI generates strategies tailored to individual assets
- **Multi-Strategy Types**: Mean Reversion, Breakout, Trend Following, and Balanced
- **Confidence Scoring**: AI provides confidence levels for generated strategies
- **Market Condition Analysis**: Real-time market analysis with predictions
- **Risk Assessment**: Automatic risk management parameter adjustment
- **Volatility Adaptation**: Strategies adapt to market volatility conditions

### Technical Features
- **Performance Optimized**: Web Workers for heavy computations
- **Modern UI**: Beautiful, responsive interface with React Native
- **TypeScript**: Full type safety throughout the application
- **Background Processing**: Alerts and data updates continue when app is closed
- **Smart Caching**: Intelligent API response caching to minimize requests
- **Error Handling**: Robust error handling for API failures and data inconsistencies

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- Yarn package manager
- Expo CLI
- React Native development environment

### Setup
1. Clone the repository
```bash
git clone https://github.com/yourusername/vaporrick-ai-bot.git
cd vaporrick-ai-bot
```

2. Install dependencies
```bash
yarn install
```

3. Configure API keys
```bash
# Replace with your actual API keys in src/services/marketDataService.ts
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

4. Start the development server
```bash
yarn start
```

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

### Core Components

#### AI Strategy Generator
- **Multiple AI Personalities**: Conservative, Balanced, and Aggressive
- **Symbol-Specific Logic**: Strategies tailored to individual assets
- **Advanced Pattern Recognition**: Volatility, trends, and seasonality analysis
- **Confidence Scoring**: AI-generated confidence levels for strategies

#### Backtesting Engine
- **Comprehensive Metrics**: 15+ performance indicators
- **Trade Simulation**: Realistic trade execution with commissions
- **Risk Analysis**: Drawdown, Sharpe ratio, and risk-adjusted returns
- **Monthly Analysis**: Detailed monthly performance breakdown

#### Alert System
- **Background Monitoring**: Continues monitoring when app is closed
- **Multiple Conditions**: Price, change percentage, and volume alerts
- **Smart Notifications**: Configurable notification channels
- **Development Build Support**: Enhanced notifications for production apps

## 📊 API Integration

### Alpha Vantage (Stocks)
- **Free Tier**: 500 requests/day
- **Endpoints**: Real-time quotes, historical data, company information
- **Rate Limiting**: Built-in request queuing and caching
- **Error Handling**: Robust handling of missing data fields

### CoinGecko (Cryptocurrency)
- **Free Tier**: 10,000 calls/month
- **Endpoints**: Price data, market charts, coin information
- **Rate Limiting**: 50 requests/minute with smart caching

## 🤖 AI Strategy Generation

The app uses advanced TensorFlow.js models to analyze historical data and generate sophisticated trading strategies:

### Strategy Types
- **Mean Reversion**: RSI-based oversold/overbought signals with volatility adjustment
- **Breakout**: Price breakout strategies with volume confirmation
- **Trend Following**: Moving average crossovers with momentum analysis
- **Balanced**: Adaptive strategies that change based on market conditions

### AI Features
- **Pattern Recognition**: Advanced analysis of price patterns and market structure
- **Volatility Analysis**: Dynamic adjustment based on market volatility
- **Risk Assessment**: Automatic risk management parameter calculation
- **Seasonality Detection**: Monthly performance pattern recognition
- **Confidence Scoring**: AI-generated confidence levels for strategy reliability

### Symbol-Specific Strategies
- **Individual Asset Analysis**: Each strategy is tailored to specific assets
- **Asset Type Optimization**: Different parameters for stocks vs. cryptocurrencies
- **Historical Data Analysis**: Minimum 30 days of data for reliable strategy generation
- **Metadata Tracking**: Comprehensive strategy metadata and performance tracking

## 🔧 Development

### Running Tests
```bash
yarn test
```

### Building for Production
```bash
yarn build
```

### Development Build (for notifications)
```bash
# Create development build for full notification support
expo build:android
expo build:ios
```

## 🔐 Security & Privacy

- **Local Data Storage**: All data stored locally with Realm Database
- **No External Costs**: No subscription fees or hidden costs
- **API Key Security**: Secure API key management
- **Data Encryption**: Local data encryption for sensitive information

## 📱 Usage

### Getting Started
1. Launch the app and allow notification permissions
2. Browse the default portfolio or add custom assets
3. Set up price alerts for your favorite assets
4. Generate AI strategies for specific symbols
5. Backtest strategies with historical data

### Creating AI Strategies
1. Go to the Strategies tab
2. Select a symbol from the AI generation section
3. Click "Generate AI Strategy" for your chosen symbol
4. Review the strategy details and confidence score
5. Run backtests to validate performance

### Managing Alerts
1. Navigate to the Alerts tab
2. Create custom price or percentage alerts
3. Toggle alerts on/off as needed
4. Receive notifications when conditions are met

## 🚨 Limitations & Considerations

### API Rate Limits
- Alpha Vantage: 500 requests/day (free tier)
- CoinGecko: 50 requests/minute (free tier)
- Implemented request queuing and intelligent caching

### Data Accuracy
- Real-time data may have slight delays
- Historical data limited to available API ranges
- Cryptocurrency data is more volatile than stocks

### Battery Usage
- Background tasks optimized for battery life
- Alert checking intervals configurable
- Automatic throttling during low battery conditions

### Notifications
- Full notification support requires development build
- Expo Go has limited notification functionality
- Background fetch may be limited by OS restrictions

## 🔮 Future Enhancements

### Version 2.0 Planned Features
- [ ] Social trading features and strategy sharing
- [ ] Advanced portfolio analytics and risk metrics
- [ ] Multi-timeframe analysis (1m, 5m, 1h, 1d)
- [ ] Options and futures trading support
- [ ] Paper trading mode for strategy testing
- [ ] News sentiment analysis integration
- [ ] Advanced chart patterns recognition
- [ ] Comprehensive risk management tools

### AI Improvements
- [ ] Deep learning models for price prediction
- [ ] Ensemble strategies combining multiple models
- [ ] Reinforcement learning for strategy optimization
- [ ] Market regime detection and adaptation
- [ ] Real-time sentiment analysis integration
- [ ] Multi-asset correlation analysis

## 🛠️ Technical Specifications

### Dependencies
- React Native with Expo SDK 53+
- TypeScript for type safety
- TensorFlow.js for AI processing
- Realm Database for local storage
- Victory Native for chart visualization
- Expo Notifications for alerts

### Performance
- Web Workers for heavy computations
- Efficient data caching and storage
- Optimized rendering for large datasets
- Background task management

## 📚 Documentation

### API Documentation
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)
- [CoinGecko API](https://www.coingecko.com/api/documentation)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

### Development Resources
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [TensorFlow.js](https://www.tensorflow.org/js)

## 🐛 Known Issues

### Fixed Issues
- ✅ Notification handler compatibility with Expo SDK 53+
- ✅ Duplicate key warnings in FlatList components
- ✅ API error handling for missing data fields
- ✅ Background fetch limitations in Expo Go
- ✅ Strategy generation for symbol-specific trading

### Current Limitations
- Expo Go has limited notification and background fetch support
- Development build required for full notification functionality
- API rate limits may affect real-time data updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Alpha Vantage for stock market data
- CoinGecko for cryptocurrency data
- Expo team for the amazing development platform
- TensorFlow.js team for AI capabilities
- React Native community for continuous innovation

---

**Note**: This is a trading analysis tool and should not be considered as financial advice. Always do your own research and consult with financial professionals before making investment decisions.
