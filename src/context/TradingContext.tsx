import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface Asset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  type: 'stock' | 'crypto';
  lastUpdate: Date;
}

interface Portfolio {
  assets: Asset[];
  totalValue: number;
  totalChange: number;
  totalChangePercent: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  conditions: string[];
  createdAt: Date;
  performance?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
}

interface Alert {
  id: string;
  assetSymbol: string;
  condition: string;
  value: number;
  isActive: boolean;
  createdAt: Date;
}

interface TradingState {
  assets: Asset[];
  portfolio: Portfolio;
  watchlist: string[];
  strategies: Strategy[];
  alerts: Alert[];
  loading: boolean;
  error: string | null;
}

// Actions
type TradingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ASSETS'; payload: Asset[] }
  | { type: 'ADD_ASSET'; payload: Asset }
  | { type: 'REMOVE_ASSET'; payload: string }
  | { type: 'ADD_TO_WATCHLIST'; payload: string }
  | { type: 'REMOVE_FROM_WATCHLIST'; payload: string }
  | { type: 'ADD_STRATEGY'; payload: Strategy }
  | { type: 'UPDATE_STRATEGY'; payload: Strategy }
  | { type: 'DELETE_STRATEGY'; payload: string }
  | { type: 'ADD_ALERT'; payload: Alert }
  | { type: 'UPDATE_ALERT'; payload: Alert }
  | { type: 'DELETE_ALERT'; payload: string }
  | { type: 'UPDATE_PORTFOLIO'; payload: Portfolio };

// Initial state
const initialState: TradingState = {
  assets: [],
  portfolio: {
    assets: [],
    totalValue: 0,
    totalChange: 0,
    totalChangePercent: 0,
  },
  watchlist: [],
  strategies: [],
  alerts: [],
  loading: false,
  error: null,
};

// Reducer
const tradingReducer = (state: TradingState, action: TradingAction): TradingState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_ASSETS':
      return { ...state, assets: action.payload };
    case 'ADD_ASSET':
      return {
        ...state,
        assets: [...state.assets, action.payload],
      };
    case 'REMOVE_ASSET':
      return {
        ...state,
        assets: state.assets.filter(asset => asset.symbol !== action.payload),
      };
    case 'ADD_TO_WATCHLIST':
      return {
        ...state,
        watchlist: [...state.watchlist, action.payload],
      };
    case 'REMOVE_FROM_WATCHLIST':
      return {
        ...state,
        watchlist: state.watchlist.filter(symbol => symbol !== action.payload),
      };
    case 'ADD_STRATEGY':
      return {
        ...state,
        strategies: [...state.strategies, action.payload],
      };
    case 'UPDATE_STRATEGY':
      return {
        ...state,
        strategies: state.strategies.map(strategy =>
          strategy.id === action.payload.id ? action.payload : strategy
        ),
      };
    case 'DELETE_STRATEGY':
      return {
        ...state,
        strategies: state.strategies.filter(strategy => strategy.id !== action.payload),
      };
    case 'ADD_ALERT':
      return {
        ...state,
        alerts: [...state.alerts, action.payload],
      };
    case 'UPDATE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map(alert =>
          alert.id === action.payload.id ? action.payload : alert
        ),
      };
    case 'DELETE_ALERT':
      return {
        ...state,
        alerts: state.alerts.filter(alert => alert.id !== action.payload),
      };
    case 'UPDATE_PORTFOLIO':
      return {
        ...state,
        portfolio: action.payload,
      };
    default:
      return state;
  }
};

// Context
const TradingContext = createContext<{
  state: TradingState;
  dispatch: React.Dispatch<TradingAction>;
} | null>(null);

// Provider
export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(tradingReducer, initialState);

  // Load data from AsyncStorage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const watchlistData = await AsyncStorage.getItem('watchlist');
        const strategiesData = await AsyncStorage.getItem('strategies');
        const alertsData = await AsyncStorage.getItem('alerts');

        if (watchlistData) {
          const watchlist = JSON.parse(watchlistData);
          watchlist.forEach((symbol: string) => {
            dispatch({ type: 'ADD_TO_WATCHLIST', payload: symbol });
          });
        }

        if (strategiesData) {
          const strategies = JSON.parse(strategiesData);
          strategies.forEach((strategy: Strategy) => {
            dispatch({ type: 'ADD_STRATEGY', payload: strategy });
          });
        }

        if (alertsData) {
          const alerts = JSON.parse(alertsData);
          alerts.forEach((alert: Alert) => {
            dispatch({ type: 'ADD_ALERT', payload: alert });
          });
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // Save data to AsyncStorage on state changes
  useEffect(() => {
    AsyncStorage.setItem('watchlist', JSON.stringify(state.watchlist));
  }, [state.watchlist]);

  useEffect(() => {
    AsyncStorage.setItem('strategies', JSON.stringify(state.strategies));
  }, [state.strategies]);

  useEffect(() => {
    AsyncStorage.setItem('alerts', JSON.stringify(state.alerts));
  }, [state.alerts]);

  return (
    <TradingContext.Provider value={{ state, dispatch }}>
      {children}
    </TradingContext.Provider>
  );
};

// Hook
export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};

export type { Asset, Portfolio, Strategy, Alert, TradingState, TradingAction };
