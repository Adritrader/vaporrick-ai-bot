# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a React Native Expo trading app for stocks and cryptocurrencies analysis with AI-powered strategy generation and backtesting capabilities.

## Architecture
- **Frontend**: React Native with Expo
- **State Management**: Context API + useReducer
- **Database**: Realm Database (local, offline-first)
- **AI Processing**: TensorFlow.js for strategy generation
- **APIs**: Alpha Vantage (stocks), CoinGecko (crypto), Yahoo Finance (historical data)
- **Charts**: Victory Native for data visualization
- **Notifications**: Expo Notifications for alerts

## Key Features
- Real-time stock/crypto price tracking
- Technical indicators calculation
- AI-powered strategy generation
- Backtesting engine with performance metrics
- Alert system for price/indicator conditions
- Local data persistence without external costs

## Code Guidelines
- Use TypeScript for type safety
- Follow React Native best practices
- Implement proper error handling for API calls
- Use async/await for asynchronous operations
- Optimize performance for large datasets
- Cache API responses to minimize requests
- Use Web Workers for heavy computations (backtesting)

## File Structure
- `/src/components` - Reusable UI components
- `/src/screens` - Screen components
- `/src/services` - API services and data fetching
- `/src/utils` - Utility functions and helpers
- `/src/database` - Realm database models and operations
- `/src/context` - Context providers and state management
- `/src/ai` - TensorFlow.js models and AI logic
- `/src/backtesting` - Backtesting engine and calculations
- `/src/workers` - Web Workers for heavy computations
