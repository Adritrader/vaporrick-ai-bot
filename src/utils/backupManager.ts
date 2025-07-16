// Backup and recovery system for React Native trading app

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogger } from './logger';
import { securityManager } from './securityManager';

export interface BackupData {
  id: string;
  timestamp: number;
  version: string;
  checksum: string;
  size: number;
  metadata: BackupMetadata;
  data: {
    userSettings: Record<string, any>;
    portfolios: Record<string, any>;
    watchlists: Record<string, any>;
    alerts: Record<string, any>;
    strategies: Record<string, any>;
    performance: Record<string, any>;
    preferences: Record<string, any>;
  };
}

export interface BackupMetadata {
  appVersion: string;
  platform: 'ios' | 'android';
  deviceModel: string;
  userId: string;
  totalItems: number;
  categories: string[];
  encrypted: boolean;
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  autoBackupInterval: number; // in milliseconds
  maxBackups: number;
  enableEncryption: boolean;
  enableCompression: boolean;
  backupLocation: 'local' | 'cloud' | 'both';
  includeCategories: string[];
}

export interface RestoreOptions {
  overwriteExisting: boolean;
  selectiveRestore: boolean;
  selectedCategories?: string[];
  validateChecksum: boolean;
  createBackupBeforeRestore: boolean;
}

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dataIntegrity: number; // percentage
  missingCategories: string[];
}

class BackupManager {
  private config: BackupConfig;
  private backups: BackupData[] = [];
  private autoBackupTimer?: NodeJS.Timeout;
  
  private readonly STORAGE_PREFIX = 'backup_';
  private readonly CONFIG_KEY = 'backup_config';
  private readonly BACKUP_LIST_KEY = 'backup_list';
  private readonly DEFAULT_CATEGORIES = [
    'userSettings',
    'portfolios', 
    'watchlists',
    'alerts',
    'strategies',
    'performance',
    'preferences'
  ];

  constructor() {
    this.config = this.getDefaultConfig();
    this.initialize();
  }

  // Initialize backup manager
  private async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.loadBackupList();
      
      if (this.config.autoBackupEnabled) {
        this.startAutoBackup();
      }

      apiLogger.info('BackupManager initialized', {
        config: this.config,
        existingBackups: this.backups.length,
      });
      
    } catch (error) {
      apiLogger.error('Failed to initialize BackupManager', { error: error as Error });
    }
  }

  // Create full backup
  async createBackup(includeCategories?: string[]): Promise<string> {
    const backupId = this.generateBackupId();
    
    try {
      apiLogger.info('Creating backup', { backupId, includeCategories });
      
      const categories = includeCategories || this.config.includeCategories;
      const data = await this.collectBackupData(categories);
      
      const metadata: BackupMetadata = {
        appVersion: '1.0.0', // Would come from app config
        platform: 'android', // Would detect actual platform
        deviceModel: 'Unknown', // Would get from device info
        userId: 'current_user', // Would get from auth context
        totalItems: this.countDataItems(data),
        categories,
        encrypted: this.config.enableEncryption,
      };

      const backup: BackupData = {
        id: backupId,
        timestamp: Date.now(),
        version: '1.0',
        checksum: '',
        size: 0,
        metadata,
        data,
      };

      // Calculate checksum and size
      const serializedData = JSON.stringify(backup.data);
      backup.checksum = this.calculateChecksum(serializedData);
      backup.size = new Blob([serializedData]).size;

      // Encrypt if enabled
      if (this.config.enableEncryption) {
        backup.data = await this.encryptBackupData(backup.data);
      }

      // Save backup
      await this.saveBackup(backup);
      
      // Add to backup list
      this.backups.push({
        ...backup,
        data: {
          userSettings: {},
          portfolios: {},
          watchlists: {},
          alerts: {},
          strategies: {},
          performance: {},
          preferences: {},
        }, // Don't keep full data in memory
      });

      // Maintain backup limit
      await this.enforceBackupLimit();
      
      await this.saveBackupList();

      apiLogger.info('Backup created successfully', {
        backupId,
        size: backup.size,
        categories: categories.length,
        encrypted: backup.metadata.encrypted,
      });

      return backupId;
      
    } catch (error) {
      apiLogger.error('Failed to create backup', { 
        backupId, 
        error: error as Error 
      });
      throw new Error(`Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Restore from backup
  async restoreFromBackup(backupId: string, options?: RestoreOptions): Promise<void> {
    const opts: RestoreOptions = {
      overwriteExisting: true,
      selectiveRestore: false,
      validateChecksum: true,
      createBackupBeforeRestore: true,
      ...options,
    };

    try {
      apiLogger.info('Starting restore', { backupId, options: opts });

      // Create backup before restore if requested
      if (opts.createBackupBeforeRestore) {
        const preRestoreBackup = await this.createBackup();
        apiLogger.info('Pre-restore backup created', { 
          preRestoreBackupId: preRestoreBackup 
        });
      }

      // Load backup data
      const backup = await this.loadBackup(backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Validate backup
      if (opts.validateChecksum) {
        const validation = await this.validateBackup(backup);
        if (!validation.isValid) {
          throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Decrypt if needed
      let data = backup.data;
      if (backup.metadata.encrypted) {
        data = await this.decryptBackupData(data);
      }

      // Determine what to restore
      const categoriesToRestore = opts.selectiveRestore && opts.selectedCategories
        ? opts.selectedCategories
        : Object.keys(data);

      // Restore data
      for (const category of categoriesToRestore) {
        if (data[category as keyof typeof data]) {
          await this.restoreCategory(category, data[category as keyof typeof data], opts.overwriteExisting);
        }
      }

      apiLogger.info('Restore completed successfully', {
        backupId,
        categoriesRestored: categoriesToRestore,
      });

    } catch (error) {
      apiLogger.error('Restore failed', { 
        backupId, 
        error: error as Error 
      });
      throw new Error(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate backup integrity
  async validateBackup(backup: BackupData): Promise<BackupValidationResult> {
    const result: BackupValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      dataIntegrity: 100,
      missingCategories: [],
    };

    try {
      // Check version compatibility
      if (backup.version !== '1.0') {
        result.warnings.push(`Backup version ${backup.version} may not be fully compatible`);
      }

      // Validate checksum
      const serializedData = JSON.stringify(backup.data);
      const calculatedChecksum = this.calculateChecksum(serializedData);
      
      if (backup.checksum !== calculatedChecksum) {
        result.errors.push('Checksum validation failed - data may be corrupted');
        result.isValid = false;
        result.dataIntegrity = 0;
      }

      // Check required categories
      const expectedCategories = this.DEFAULT_CATEGORIES;
      const availableCategories = Object.keys(backup.data);
      
      for (const category of expectedCategories) {
        if (!availableCategories.includes(category)) {
          result.missingCategories.push(category);
          result.warnings.push(`Missing category: ${category}`);
        }
      }

      // Calculate data integrity percentage
      if (result.isValid) {
        const completeness = (availableCategories.length / expectedCategories.length) * 100;
        result.dataIntegrity = Math.min(100, completeness);
      }

      // Check data structure
      for (const [category, categoryData] of Object.entries(backup.data)) {
        if (categoryData === null || categoryData === undefined) {
          result.warnings.push(`Category ${category} contains no data`);
        }
      }

      apiLogger.debug('Backup validation completed', {
        backupId: backup.id,
        isValid: result.isValid,
        integrity: result.dataIntegrity,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  // Get backup list
  getBackups(): Omit<BackupData, 'data'>[] {
    return this.backups.map(backup => ({
      id: backup.id,
      timestamp: backup.timestamp,
      version: backup.version,
      checksum: backup.checksum,
      size: backup.size,
      metadata: backup.metadata,
    }));
  }

  // Delete backup
  async deleteBackup(backupId: string): Promise<void> {
    try {
      // Remove from storage
      await AsyncStorage.removeItem(`${this.STORAGE_PREFIX}${backupId}`);
      
      // Remove from list
      this.backups = this.backups.filter(backup => backup.id !== backupId);
      await this.saveBackupList();

      apiLogger.info('Backup deleted', { backupId });
    } catch (error) {
      apiLogger.error('Failed to delete backup', { 
        backupId, 
        error: error as Error 
      });
      throw error;
    }
  }

  // Update configuration
  async updateConfig(newConfig: Partial<BackupConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();

    // Restart auto backup if settings changed
    if (newConfig.autoBackupEnabled !== undefined || newConfig.autoBackupInterval) {
      this.stopAutoBackup();
      if (this.config.autoBackupEnabled) {
        this.startAutoBackup();
      }
    }

    apiLogger.info('Backup config updated', { config: this.config });
  }

  // Start automatic backup
  private startAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
    }

    this.autoBackupTimer = setInterval(async () => {
      try {
        await this.createBackup();
        apiLogger.info('Auto-backup completed');
      } catch (error) {
        apiLogger.error('Auto-backup failed', { error: error as Error });
      }
    }, this.config.autoBackupInterval);

    apiLogger.info('Auto-backup started', { 
      interval: this.config.autoBackupInterval 
    });
  }

  // Stop automatic backup
  private stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = undefined;
      apiLogger.info('Auto-backup stopped');
    }
  }

  // Collect data for backup
  private async collectBackupData(categories: string[]): Promise<BackupData['data']> {
    const data: BackupData['data'] = {
      userSettings: {},
      portfolios: {},
      watchlists: {},
      alerts: {},
      strategies: {},
      performance: {},
      preferences: {},
    };

    for (const category of categories) {
      try {
        const categoryData = await this.getCategoryData(category);
        data[category as keyof BackupData['data']] = categoryData;
      } catch (error) {
        apiLogger.warn(`Failed to collect data for category ${category}`, { 
          error: error as Error 
        });
        data[category as keyof BackupData['data']] = {};
      }
    }

    return data;
  }

  // Get data for specific category
  private async getCategoryData(category: string): Promise<Record<string, any>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const categoryKeys = keys.filter(key => key.startsWith(`${category}_`));
      
      if (categoryKeys.length === 0) {
        return {};
      }

      const items = await AsyncStorage.multiGet(categoryKeys);
      const categoryData: Record<string, any> = {};

      for (const [key, value] of items) {
        if (value) {
          try {
            categoryData[key] = JSON.parse(value);
          } catch {
            categoryData[key] = value; // Store as string if not JSON
          }
        }
      }

      return categoryData;
    } catch (error) {
      apiLogger.error(`Failed to get data for category ${category}`, { 
        error: error as Error 
      });
      return {};
    }
  }

  // Restore category data
  private async restoreCategory(
    category: string, 
    data: Record<string, any>, 
    overwrite: boolean
  ): Promise<void> {
    try {
      const entries = Object.entries(data);
      
      for (const [key, value] of entries) {
        const shouldRestore = overwrite || !(await AsyncStorage.getItem(key));
        
        if (shouldRestore) {
          const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
          await AsyncStorage.setItem(key, serializedValue);
        }
      }

      apiLogger.debug(`Category ${category} restored`, { 
        items: entries.length,
        overwrite 
      });
    } catch (error) {
      apiLogger.error(`Failed to restore category ${category}`, { 
        error: error as Error 
      });
      throw error;
    }
  }

  // Encrypt backup data
  private async encryptBackupData(data: BackupData['data']): Promise<BackupData['data']> {
    const encrypted: BackupData['data'] = {
      userSettings: {},
      portfolios: {},
      watchlists: {},
      alerts: {},
      strategies: {},
      performance: {},
      preferences: {},
    };

    for (const [category, categoryData] of Object.entries(data)) {
      const serialized = JSON.stringify(categoryData);
      const encryptedData = await securityManager.encryptData(serialized);
      encrypted[category as keyof BackupData['data']] = { encrypted: encryptedData };
    }

    return encrypted;
  }

  // Decrypt backup data
  private async decryptBackupData(data: BackupData['data']): Promise<BackupData['data']> {
    const decrypted: BackupData['data'] = {
      userSettings: {},
      portfolios: {},
      watchlists: {},
      alerts: {},
      strategies: {},
      performance: {},
      preferences: {},
    };

    for (const [category, categoryData] of Object.entries(data)) {
      try {
        if (categoryData && typeof categoryData === 'object' && 'encrypted' in categoryData) {
          const decryptedData = await securityManager.decryptData(categoryData.encrypted as string);
          decrypted[category as keyof BackupData['data']] = JSON.parse(decryptedData);
        } else {
          decrypted[category as keyof BackupData['data']] = categoryData;
        }
      } catch (error) {
        apiLogger.error(`Failed to decrypt category ${category}`, { 
          error: error as Error 
        });
        decrypted[category as keyof BackupData['data']] = {};
      }
    }

    return decrypted;
  }

  // Save backup to storage
  private async saveBackup(backup: BackupData): Promise<void> {
    const key = `${this.STORAGE_PREFIX}${backup.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(backup));
  }

  // Load backup from storage
  private async loadBackup(backupId: string): Promise<BackupData | null> {
    try {
      const key = `${this.STORAGE_PREFIX}${backupId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      apiLogger.error(`Failed to load backup ${backupId}`, { 
        error: error as Error 
      });
      return null;
    }
  }

  // Calculate checksum
  private calculateChecksum(data: string): string {
    // Simple checksum - in production use proper hashing like SHA-256
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Count data items
  private countDataItems(data: BackupData['data']): number {
    let total = 0;
    for (const categoryData of Object.values(data)) {
      if (categoryData && typeof categoryData === 'object') {
        total += Object.keys(categoryData).length;
      }
    }
    return total;
  }

  // Generate backup ID
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Enforce backup limit
  private async enforceBackupLimit(): Promise<void> {
    if (this.backups.length > this.config.maxBackups) {
      // Sort by timestamp (oldest first)
      const sortedBackups = [...this.backups].sort((a, b) => a.timestamp - b.timestamp);
      
      // Delete oldest backups
      const toDelete = sortedBackups.slice(0, this.backups.length - this.config.maxBackups);
      
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }

      apiLogger.info('Backup limit enforced', { 
        deleted: toDelete.length,
        remaining: this.backups.length 
      });
    }
  }

  // Get default configuration
  private getDefaultConfig(): BackupConfig {
    return {
      autoBackupEnabled: true,
      autoBackupInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxBackups: 10,
      enableEncryption: true,
      enableCompression: false, // Not implemented
      backupLocation: 'local',
      includeCategories: this.DEFAULT_CATEGORIES,
    };
  }

  // Save configuration
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      apiLogger.error('Failed to save backup config', { error: error as Error });
    }
  }

  // Load configuration
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.CONFIG_KEY);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      apiLogger.error('Failed to load backup config', { error: error as Error });
    }
  }

  // Save backup list
  private async saveBackupList(): Promise<void> {
    try {
      const listData = this.backups.map(backup => ({
        id: backup.id,
        timestamp: backup.timestamp,
        version: backup.version,
        checksum: backup.checksum,
        size: backup.size,
        metadata: backup.metadata,
      }));
      await AsyncStorage.setItem(this.BACKUP_LIST_KEY, JSON.stringify(listData));
    } catch (error) {
      apiLogger.error('Failed to save backup list', { error: error as Error });
    }
  }

  // Load backup list
  private async loadBackupList(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.BACKUP_LIST_KEY);
      if (stored) {
        const listData = JSON.parse(stored);
        this.backups = listData.map((item: any) => ({ 
          ...item, 
          data: {
            userSettings: {},
            portfolios: {},
            watchlists: {},
            alerts: {},
            strategies: {},
            performance: {},
            preferences: {},
          }
        }));
      }
    } catch (error) {
      apiLogger.error('Failed to load backup list', { error: error as Error });
    }
  }

  // Get backup statistics
  getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup?: number;
    newestBackup?: number;
    autoBackupEnabled: boolean;
    nextAutoBackup?: number;
  } {
    const stats = {
      totalBackups: this.backups.length,
      totalSize: this.backups.reduce((sum, backup) => sum + backup.size, 0),
      autoBackupEnabled: this.config.autoBackupEnabled,
      oldestBackup: undefined as number | undefined,
      newestBackup: undefined as number | undefined,
      nextAutoBackup: undefined as number | undefined,
    };

    if (this.backups.length > 0) {
      const timestamps = this.backups.map(b => b.timestamp);
      stats.oldestBackup = Math.min(...timestamps);
      stats.newestBackup = Math.max(...timestamps);
      
      if (this.config.autoBackupEnabled) {
        stats.nextAutoBackup = stats.newestBackup + this.config.autoBackupInterval;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const backupManager = new BackupManager();

// Helper functions
export const createAppBackup = () => {
  return backupManager.createBackup();
};

export const restoreAppData = (backupId: string, options?: RestoreOptions) => {
  return backupManager.restoreFromBackup(backupId, options);
};

export const validateAppBackup = (backup: BackupData) => {
  return backupManager.validateBackup(backup);
};

export { BackupManager };
export default backupManager;
