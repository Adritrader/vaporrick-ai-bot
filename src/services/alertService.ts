// Background service for monitoring alerts
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { fetchMultipleAssets } from '../services/marketDataService';
import { Alert } from '../context/TradingContext';

const BACKGROUND_FETCH_TASK = 'background-fetch-alerts';

// Configure notification handler for SDK 53+
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Check if running in development environment
const isDevelopment = __DEV__;

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('Background task: Checking alerts...');
    
    const alertsData = await AsyncStorage.getItem('alerts');
    if (!alertsData) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const alerts: Alert[] = JSON.parse(alertsData);
    const activeAlerts = alerts.filter(alert => alert.isActive);
    
    if (activeAlerts.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Get unique symbols from alerts
    const symbols = [...new Set(activeAlerts.map(alert => alert.assetSymbol))];
    
    // Fetch current market data
    const assets = await fetchMultipleAssets(symbols);
    
    // Check each alert condition
    for (const alert of activeAlerts) {
      const asset = assets.find(a => a.symbol === alert.assetSymbol);
      if (!asset) continue;

      let shouldTrigger = false;
      let message = '';

      switch (alert.condition) {
        case 'price_above':
          shouldTrigger = asset.price > alert.value;
          message = `${asset.symbol} price is now $${asset.price.toFixed(2)}, above your alert level of $${alert.value}`;
          break;
        case 'price_below':
          shouldTrigger = asset.price < alert.value;
          message = `${asset.symbol} price is now $${asset.price.toFixed(2)}, below your alert level of $${alert.value}`;
          break;
        case 'change_above':
          shouldTrigger = asset.changePercent > alert.value;
          message = `${asset.symbol} is up ${asset.changePercent.toFixed(2)}%, above your alert level of ${alert.value}%`;
          break;
        case 'change_below':
          shouldTrigger = asset.changePercent < alert.value;
          message = `${asset.symbol} is down ${Math.abs(asset.changePercent).toFixed(2)}%, below your alert level of ${alert.value}%`;
          break;
      }

      if (shouldTrigger) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🚨 Price Alert: ${asset.symbol}`,
            body: message,
            data: { alertId: alert.id, symbol: asset.symbol },
          },
          trigger: null, // Show immediately
        });

        // Deactivate the alert to prevent spam
        const updatedAlerts = alerts.map(a => 
          a.id === alert.id ? { ...a, isActive: false } : a
        );
        await AsyncStorage.setItem('alerts', JSON.stringify(updatedAlerts));
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export class AlertService {
  static async registerBackgroundFetch() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      
      if (isRegistered) {
        console.log('Background fetch already registered');
        return;
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 5 * 60, // 5 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      console.log('Background fetch registered successfully');
    } catch (error) {
      console.error('Failed to register background fetch:', error);
    }
  }

  static async unregisterBackgroundFetch() {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('Background fetch unregistered');
    } catch (error) {
      console.error('Failed to unregister background fetch:', error);
    }
  }

  static async getBackgroundFetchStatus() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      const statusMap: { [key: number]: string } = {
        [BackgroundFetch.BackgroundFetchStatus.Restricted]: 'Restricted',
        [BackgroundFetch.BackgroundFetchStatus.Denied]: 'Denied',
        [BackgroundFetch.BackgroundFetchStatus.Available]: 'Available',
      };
      return statusMap[status] || 'Unknown';
    } catch (error) {
      console.error('Failed to get background fetch status:', error);
      return 'Error';
    }
  }

  static async checkAlertsManually() {
    try {
      const alertsData = await AsyncStorage.getItem('alerts');
      if (!alertsData) return [];

      const alerts: Alert[] = JSON.parse(alertsData);
      const activeAlerts = alerts.filter(alert => alert.isActive);
      
      if (activeAlerts.length === 0) return [];

      const symbols = [...new Set(activeAlerts.map(alert => alert.assetSymbol))];
      const assets = await fetchMultipleAssets(symbols);
      
      const triggeredAlerts: Array<{
        alert: Alert;
        asset: any;
        message: string;
      }> = [];

      for (const alert of activeAlerts) {
        const asset = assets.find(a => a.symbol === alert.assetSymbol);
        if (!asset) continue;

        let shouldTrigger = false;
        let message = '';

        switch (alert.condition) {
          case 'price_above':
            shouldTrigger = asset.price > alert.value;
            message = `Price: $${asset.price.toFixed(2)} > $${alert.value}`;
            break;
          case 'price_below':
            shouldTrigger = asset.price < alert.value;
            message = `Price: $${asset.price.toFixed(2)} < $${alert.value}`;
            break;
          case 'change_above':
            shouldTrigger = asset.changePercent > alert.value;
            message = `Change: ${asset.changePercent.toFixed(2)}% > ${alert.value}%`;
            break;
          case 'change_below':
            shouldTrigger = asset.changePercent < alert.value;
            message = `Change: ${asset.changePercent.toFixed(2)}% < ${alert.value}%`;
            break;
        }

        if (shouldTrigger) {
          triggeredAlerts.push({
            alert,
            asset,
            message,
          });
        }
      }

      return triggeredAlerts;
    } catch (error) {
      console.error('Error checking alerts manually:', error);
      return [];
    }
  }

  static async scheduleNotification(title: string, body: string, data: any = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  // Enhanced notification setup for development and production
  static async setupNotifications(): Promise<boolean> {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return false;
      }

      // Get push token for development builds
      if (isDevelopment) {
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'your-project-id', // Replace with your project ID
          });
          console.log('Expo push token:', tokenData.data);
        } catch (tokenError) {
          console.warn('Could not get push token:', tokenError);
        }
      }

      // Configure notification categories for better organization
      await Notifications.setNotificationCategoryAsync('price-alert', [
        {
          identifier: 'view-details',
          buttonTitle: 'View Details',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'snooze',
          buttonTitle: 'Snooze',
          options: {
            opensAppToForeground: false,
          },
        },
      ]);

      // Set up notification channels for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('price-alerts', {
          name: 'Price Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      console.log('Notifications setup completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to setup notifications:', error);
      return false;
    }
  }
}

// Price monitoring utilities
export class PriceMonitor {
  private static intervals: Map<string, NodeJS.Timeout> = new Map();

  static startMonitoring(symbol: string, callback: (price: number) => void, intervalMs: number = 60000) {
    // Stop existing monitoring for this symbol
    this.stopMonitoring(symbol);

    const interval = setInterval(async () => {
      try {
        const assets = await fetchMultipleAssets([symbol]);
        if (assets.length > 0) {
          callback(assets[0].price);
        }
      } catch (error) {
        console.error(`Error monitoring ${symbol}:`, error);
      }
    }, intervalMs);

    this.intervals.set(symbol, interval);
  }

  static stopMonitoring(symbol: string) {
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
    }
  }

  static stopAllMonitoring() {
    for (const [symbol, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  static isMonitoring(symbol: string): boolean {
    return this.intervals.has(symbol);
  }
}

// Market hours utility
export class MarketHours {
  static isMarketOpen(type: 'stock' | 'crypto' = 'stock'): boolean {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay();

    if (type === 'crypto') {
      return true; // Crypto markets are always open
    }

    // Stock market hours (NYSE/NASDAQ): 9:30 AM - 4:00 PM ET (14:30 - 21:00 UTC)
    // Weekend check (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    const currentTimeInMinutes = utcHours * 60 + utcMinutes;
    const marketOpen = 14 * 60 + 30; // 14:30 UTC
    const marketClose = 21 * 60; // 21:00 UTC

    return currentTimeInMinutes >= marketOpen && currentTimeInMinutes < marketClose;
  }

  static getNextMarketOpen(type: 'stock' | 'crypto' = 'stock'): Date {
    if (type === 'crypto') {
      return new Date(); // Crypto never closes
    }

    const now = new Date();
    const nextOpen = new Date();
    
    // Set to next 9:30 AM ET (14:30 UTC)
    nextOpen.setUTCHours(14, 30, 0, 0);
    
    // If it's already past market open today, move to next day
    if (now.getTime() >= nextOpen.getTime()) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    
    // Skip weekends
    const dayOfWeek = nextOpen.getUTCDay();
    if (dayOfWeek === 0) { // Sunday
      nextOpen.setDate(nextOpen.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      nextOpen.setDate(nextOpen.getDate() + 2);
    }
    
    return nextOpen;
  }

  static getTimeUntilMarketOpen(type: 'stock' | 'crypto' = 'stock'): number {
    if (type === 'crypto') {
      return 0; // Crypto never closes
    }

    const nextOpen = this.getNextMarketOpen(type);
    return Math.max(0, nextOpen.getTime() - Date.now());
  }
}
