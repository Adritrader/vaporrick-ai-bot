// Intelligent notification system with priority, scheduling, and user preferences

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogger } from './logger';

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum NotificationType {
  PRICE_ALERT = 'price_alert',
  STRATEGY_SIGNAL = 'strategy_signal',
  SYSTEM_UPDATE = 'system_update',
  TRADE_EXECUTION = 'trade_execution',
  PORTFOLIO_CHANGE = 'portfolio_change',
  NEWS_ALERT = 'news_alert',
  ERROR_ALERT = 'error_alert',
  MAINTENANCE = 'maintenance',
}

export interface NotificationConfig {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  scheduledFor?: number; // Timestamp for scheduled notifications
  expiresAt?: number; // Timestamp for notification expiry
  sound?: boolean;
  vibration?: boolean;
  badge?: boolean;
  persistent?: boolean; // Whether notification persists until dismissed
  actions?: NotificationAction[];
  tags?: string[]; // For grouping and filtering
}

export interface NotificationAction {
  id: string;
  title: string;
  type: 'button' | 'input' | 'link';
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  enabled: boolean;
  types: Record<NotificationType, boolean>;
  priorities: Record<NotificationPriority, boolean>;
  quiet_hours: {
    enabled: boolean;
    start: string; // "HH:MM" format
    end: string; // "HH:MM" format
  };
  sound: boolean;
  vibration: boolean;
  badge: boolean;
  frequency_limits: {
    max_per_hour: number;
    max_per_day: number;
    cooldown_minutes: number;
  };
}

export interface NotificationStats {
  total_sent: number;
  sent_by_type: Record<NotificationType, number>;
  sent_by_priority: Record<NotificationPriority, number>;
  delivery_rate: number;
  last_sent: number | null;
  queue_size: number;
}

class NotificationManager {
  private preferences: NotificationPreferences;
  private notificationQueue: NotificationConfig[] = [];
  private sentNotifications: NotificationConfig[] = [];
  private stats: NotificationStats;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  // Preference storage keys
  private readonly PREFERENCES_KEY = 'notification_preferences';
  private readonly STATS_KEY = 'notification_stats';
  private readonly QUEUE_KEY = 'notification_queue';

  constructor() {
    this.preferences = this.getDefaultPreferences();
    this.stats = this.getDefaultStats();
    this.initialize();
  }

  // Initialize notification manager
  private async initialize(): Promise<void> {
    try {
      // Load preferences
      await this.loadPreferences();
      
      // Load stats
      await this.loadStats();
      
      // Load persisted queue
      await this.loadQueue();
      
      // Start processing queue
      this.startQueueProcessing();
      
      apiLogger.info('NotificationManager initialized', {
        preferencesEnabled: this.preferences.enabled,
        queueSize: this.notificationQueue.length,
        totalSent: this.stats.total_sent,
      });
    } catch (error) {
      apiLogger.error('Failed to initialize NotificationManager', { error: error as Error });
    }
  }

  // Get default preferences
  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      types: {
        [NotificationType.PRICE_ALERT]: true,
        [NotificationType.STRATEGY_SIGNAL]: true,
        [NotificationType.SYSTEM_UPDATE]: true,
        [NotificationType.TRADE_EXECUTION]: true,
        [NotificationType.PORTFOLIO_CHANGE]: true,
        [NotificationType.NEWS_ALERT]: false,
        [NotificationType.ERROR_ALERT]: true,
        [NotificationType.MAINTENANCE]: true,
      },
      priorities: {
        [NotificationPriority.LOW]: true,
        [NotificationPriority.MEDIUM]: true,
        [NotificationPriority.HIGH]: true,
        [NotificationPriority.CRITICAL]: true,
      },
      quiet_hours: {
        enabled: false,
        start: "22:00",
        end: "08:00",
      },
      sound: true,
      vibration: true,
      badge: true,
      frequency_limits: {
        max_per_hour: 20,
        max_per_day: 100,
        cooldown_minutes: 5,
      },
    };
  }

  // Get default stats
  private getDefaultStats(): NotificationStats {
    return {
      total_sent: 0,
      sent_by_type: Object.values(NotificationType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<NotificationType, number>),
      sent_by_priority: Object.values(NotificationPriority).reduce((acc, priority) => {
        acc[priority] = 0;
        return acc;
      }, {} as Record<NotificationPriority, number>),
      delivery_rate: 100,
      last_sent: null,
      queue_size: 0,
    };
  }

  // Schedule a notification
  async scheduleNotification(config: Omit<NotificationConfig, 'id'>): Promise<string> {
    const notification: NotificationConfig = {
      ...config,
      id: this.generateNotificationId(),
    };

    // Check if notifications are enabled
    if (!this.preferences.enabled) {
      apiLogger.debug('Notifications disabled, skipping', { id: notification.id });
      return notification.id;
    }

    // Check type and priority preferences
    if (!this.preferences.types[notification.type] || !this.preferences.priorities[notification.priority]) {
      apiLogger.debug('Notification type/priority disabled', {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
      });
      return notification.id;
    }

    // Check frequency limits
    if (!this.checkFrequencyLimits(notification)) {
      apiLogger.warn('Frequency limit exceeded, queuing for later', { id: notification.id });
      // Schedule for later (implement exponential backoff)
      notification.scheduledFor = Date.now() + (this.preferences.frequency_limits.cooldown_minutes * 60 * 1000);
    }

    // Add to queue
    this.notificationQueue.push(notification);
    this.sortQueue();
    await this.saveQueue();

    apiLogger.debug('Notification scheduled', {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor).toISOString() : 'immediate',
    });

    return notification.id;
  }

  // Send immediate notification
  async sendNotification(config: Omit<NotificationConfig, 'id'>): Promise<boolean> {
    const id = await this.scheduleNotification({
      ...config,
      scheduledFor: Date.now(), // Send immediately
    });

    // Process the queue immediately for this notification
    await this.processQueue();

    return this.sentNotifications.some(n => n.id === id);
  }

  // Cancel a scheduled notification
  async cancelNotification(id: string): Promise<boolean> {
    const index = this.notificationQueue.findIndex(n => n.id === id);
    if (index >= 0) {
      this.notificationQueue.splice(index, 1);
      await this.saveQueue();
      
      apiLogger.debug('Notification cancelled', { id });
      return true;
    }
    
    return false;
  }

  // Update notification preferences
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...preferences };
    await this.savePreferences();
    
    apiLogger.info('Notification preferences updated', { preferences });
  }

  // Get current preferences
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // Get notification stats
  getStats(): NotificationStats {
    return {
      ...this.stats,
      queue_size: this.notificationQueue.length,
    };
  }

  // Process notification queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const now = Date.now();

    try {
      // Filter notifications ready to be sent
      const readyNotifications = this.notificationQueue.filter(notification => {
        // Check if scheduled time has passed
        if (notification.scheduledFor && notification.scheduledFor > now) {
          return false;
        }

        // Check if expired
        if (notification.expiresAt && notification.expiresAt < now) {
          return false;
        }

        // Check quiet hours
        if (this.isQuietHours() && notification.priority !== NotificationPriority.CRITICAL) {
          return false;
        }

        return true;
      });

      // Remove expired notifications
      this.notificationQueue = this.notificationQueue.filter(notification => {
        if (notification.expiresAt && notification.expiresAt < now) {
          apiLogger.debug('Notification expired', { id: notification.id });
          return false;
        }
        return true;
      });

      // Send ready notifications
      for (const notification of readyNotifications) {
        try {
          await this.deliverNotification(notification);
          
          // Remove from queue
          const index = this.notificationQueue.findIndex(n => n.id === notification.id);
          if (index >= 0) {
            this.notificationQueue.splice(index, 1);
          }

          // Add to sent list
          this.sentNotifications.push(notification);
          
          // Update stats
          this.updateStats(notification);

        } catch (error) {
          apiLogger.error('Failed to deliver notification', {
            id: notification.id,
            error: error as Error,
          });
        }
      }

      // Save updated queue
      await this.saveQueue();
      await this.saveStats();

    } finally {
      this.isProcessing = false;
    }
  }

  // Deliver notification to the platform
  private async deliverNotification(notification: NotificationConfig): Promise<void> {
    // Mock implementation - in a real app, this would use Expo Notifications
    // or React Native's PushNotificationIOS/react-native-push-notification
    
    apiLogger.info('Delivering notification', {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
    });

    // Simulate platform-specific notification
    if (__DEV__) {
      console.log(`🔔 [${notification.priority.toUpperCase()}] ${notification.title}: ${notification.message}`);
    }

    // In production, you would call something like:
    // await Notifications.scheduleNotificationAsync({
    //   content: {
    //     title: notification.title,
    //     body: notification.message,
    //     data: notification.data,
    //     sound: notification.sound && this.preferences.sound,
    //     badge: notification.badge && this.preferences.badge ? 1 : undefined,
    //   },
    //   trigger: null, // Send immediately
    // });
  }

  // Check if we're in quiet hours
  private isQuietHours(): boolean {
    if (!this.preferences.quiet_hours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { start, end } = this.preferences.quiet_hours;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }
    
    // Handle same-day quiet hours (e.g., 12:00 to 14:00)
    return currentTime >= start && currentTime <= end;
  }

  // Check frequency limits
  private checkFrequencyLimits(notification: NotificationConfig): boolean {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Count recent notifications
    const recentNotifications = this.sentNotifications.filter(n => {
      return new Date(n.scheduledFor || 0).getTime() > oneHourAgo;
    });

    const dailyNotifications = this.sentNotifications.filter(n => {
      return new Date(n.scheduledFor || 0).getTime() > oneDayAgo;
    });

    // Check limits
    if (recentNotifications.length >= this.preferences.frequency_limits.max_per_hour) {
      return false;
    }

    if (dailyNotifications.length >= this.preferences.frequency_limits.max_per_day) {
      return false;
    }

    // Check cooldown for same type
    const lastSameType = this.sentNotifications
      .filter(n => n.type === notification.type)
      .sort((a, b) => (b.scheduledFor || 0) - (a.scheduledFor || 0))[0];

    if (lastSameType) {
      const timeSinceLastSameType = now - (lastSameType.scheduledFor || 0);
      const cooldownMs = this.preferences.frequency_limits.cooldown_minutes * 60 * 1000;
      
      if (timeSinceLastSameType < cooldownMs && notification.priority !== NotificationPriority.CRITICAL) {
        return false;
      }
    }

    return true;
  }

  // Sort queue by priority and scheduled time
  private sortQueue(): void {
    const priorityOrder = {
      [NotificationPriority.CRITICAL]: 4,
      [NotificationPriority.HIGH]: 3,
      [NotificationPriority.MEDIUM]: 2,
      [NotificationPriority.LOW]: 1,
    };

    this.notificationQueue.sort((a, b) => {
      // First, sort by priority
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // Then by scheduled time
      const aTime = a.scheduledFor || 0;
      const bTime = b.scheduledFor || 0;
      
      return aTime - bTime; // Earlier time first
    });
  }

  // Update statistics
  private updateStats(notification: NotificationConfig): void {
    this.stats.total_sent++;
    this.stats.sent_by_type[notification.type]++;
    this.stats.sent_by_priority[notification.priority]++;
    this.stats.last_sent = Date.now();
  }

  // Generate unique notification ID
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start queue processing interval
  private startQueueProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process queue every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue().catch(error => {
        apiLogger.error('Queue processing error', { error: error as Error });
      });
    }, 30000);
  }

  // Persistence methods
  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      apiLogger.error('Failed to save notification preferences', { error: error as Error });
    }
  }

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      apiLogger.error('Failed to load notification preferences', { error: error as Error });
    }
  }

  private async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(this.stats));
    } catch (error) {
      apiLogger.error('Failed to save notification stats', { error: error as Error });
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STATS_KEY);
      if (stored) {
        this.stats = { ...this.stats, ...JSON.parse(stored) };
      }
    } catch (error) {
      apiLogger.error('Failed to load notification stats', { error: error as Error });
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.notificationQueue));
    } catch (error) {
      apiLogger.error('Failed to save notification queue', { error: error as Error });
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.QUEUE_KEY);
      if (stored) {
        this.notificationQueue = JSON.parse(stored);
        this.sortQueue();
      }
    } catch (error) {
      apiLogger.error('Failed to load notification queue', { error: error as Error });
    }
  }

  // Cleanup resources
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    apiLogger.info('NotificationManager destroyed');
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

// Helper functions for common notification types
export const sendPriceAlert = (symbol: string, price: number, change: number) => {
  return notificationManager.sendNotification({
    type: NotificationType.PRICE_ALERT,
    priority: NotificationPriority.HIGH,
    title: `Price Alert: ${symbol}`,
    message: `${symbol} is now $${price.toFixed(2)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`,
    data: { symbol, price, change },
    sound: true,
    vibration: true,
    tags: ['price', symbol],
  });
};

export const sendErrorNotification = (error: string, context?: any) => {
  return notificationManager.sendNotification({
    type: NotificationType.ERROR_ALERT,
    priority: NotificationPriority.HIGH,
    title: 'Application Error',
    message: error,
    data: context,
    persistent: true,
    tags: ['error'],
  });
};

export const sendTradeNotification = (action: string, symbol: string, amount: number) => {
  return notificationManager.sendNotification({
    type: NotificationType.TRADE_EXECUTION,
    priority: NotificationPriority.MEDIUM,
    title: `Trade ${action}`,
    message: `${action} ${amount} ${symbol}`,
    data: { action, symbol, amount },
    sound: true,
    tags: ['trade', symbol],
  });
};

export { NotificationManager };
export default notificationManager;
