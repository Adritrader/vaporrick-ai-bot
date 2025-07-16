// Security hardening utilities for React Native app

import { apiLogger } from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SecurityConfig {
  enableJailbreakDetection: boolean;
  enableDebuggerDetection: boolean;
  enableSSLPinning: boolean;
  enableDataEncryption: boolean;
  enableBiometricAuth: boolean;
  sessionTimeout: number; // in milliseconds
  maxFailedAttempts: number;
  enableAuditLogging: boolean;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  event: 'login' | 'logout' | 'failed_auth' | 'security_violation' | 'data_access' | 'api_call' | 'system_init' | 'system_config_change';
  userId?: string;
  sessionId: string;
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  deviceFingerprint: string;
}

export interface SecurityViolation {
  type: 'jailbreak' | 'debugger' | 'tampering' | 'ssl_bypass' | 'unauthorized_access';
  detected: boolean;
  details: string;
  timestamp: number;
  actionTaken: string;
}

class SecurityManager {
  private config: SecurityConfig;
  private auditLogs: SecurityAuditLog[] = [];
  private failedAttempts = new Map<string, number>();
  private sessions = new Map<string, { userId: string; startTime: number; lastActivity: number }>();
  private deviceFingerprint: string;
  
  private readonly MAX_AUDIT_LOGS = 1000;
  private readonly STORAGE_KEY_CONFIG = 'security_config';
  private readonly STORAGE_KEY_LOGS = 'security_audit_logs';

  constructor() {
    this.config = this.getDefaultConfig();
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.initialize();
  }

  // Initialize security manager
  private async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.loadAuditLogs();
      
      if (this.config.enableJailbreakDetection) {
        await this.detectJailbreak();
      }
      
      if (this.config.enableDebuggerDetection) {
        this.detectDebugger();
      }
      
      // Start session cleanup interval
      setInterval(() => {
        this.cleanupExpiredSessions();
      }, 60000); // Check every minute
      
      apiLogger.info('SecurityManager initialized', {
        deviceFingerprint: this.deviceFingerprint,
        config: this.config,
      });
      
      this.logSecurityEvent('system_init', 'low', {
        securityFeatures: this.getEnabledFeatures(),
      });
      
    } catch (error) {
      apiLogger.error('Failed to initialize SecurityManager', { error: error as Error });
    }
  }

  // Detect jailbreak/root
  private async detectJailbreak(): Promise<SecurityViolation> {
    // Mock implementation - in real app use react-native-jailbreak-detection
    const jailbreakPaths = [
      '/Applications/Cydia.app',
      '/usr/sbin/sshd',
      '/etc/apt',
      '/private/var/lib/apt/',
      '/private/var/lib/cydia',
      '/usr/bin/ssh',
      '/var/cache/apt',
      '/Library/MobileSubstrate/MobileSubstrate.dylib',
      '/bin/bash',
      '/usr/bin/sshd',
      '/etc/ssh/sshd_config',
    ];

    const violation: SecurityViolation = {
      type: 'jailbreak',
      detected: false, // Mock: would check actual paths in real implementation
      details: 'Jailbreak detection scan completed',
      timestamp: Date.now(),
      actionTaken: 'logged',
    };

    if (violation.detected) {
      apiLogger.critical('Jailbreak detected!', { violation });
      this.logSecurityEvent('security_violation', 'critical', {
        violationType: 'jailbreak',
        details: violation.details,
      });
      
      // In a real app, you might disable certain features or exit
      violation.actionTaken = 'features_disabled';
    }

    return violation;
  }

  // Detect debugger
  private detectDebugger(): SecurityViolation {
    const violation: SecurityViolation = {
      type: 'debugger',
      detected: __DEV__, // Simple check - in development mode
      details: 'Debugger detection check',
      timestamp: Date.now(),
      actionTaken: 'logged',
    };

    if (violation.detected && !__DEV__) {
      // Only act if we're in production but debugger is detected
      apiLogger.warn('Debugger detected in production', { violation });
      this.logSecurityEvent('security_violation', 'high', {
        violationType: 'debugger',
        details: violation.details,
      });
    }

    return violation;
  }

  // Encrypt sensitive data
  async encryptData(data: string, key?: string): Promise<string> {
    if (!this.config.enableDataEncryption) {
      return data;
    }

    // Mock implementation - in real app use react-native-keychain or similar
    // For real encryption, use libraries like:
    // - react-native-aes-crypto
    // - react-native-rsa-native
    // - @react-native-async-storage/async-storage with encryption
    
    try {
      const encryptionKey = key || this.deviceFingerprint;
      const encrypted = this.simpleEncrypt(data, encryptionKey);
      
      this.logSecurityEvent('data_access', 'low', {
        operation: 'encrypt',
        dataSize: data.length,
        encrypted: true,
      });
      
      return encrypted;
    } catch (error) {
      apiLogger.error('Encryption failed', { error: error as Error });
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  async decryptData(encryptedData: string, key?: string): Promise<string> {
    if (!this.config.enableDataEncryption) {
      return encryptedData;
    }

    try {
      const encryptionKey = key || this.deviceFingerprint;
      const decrypted = this.simpleDecrypt(encryptedData, encryptionKey);
      
      this.logSecurityEvent('data_access', 'low', {
        operation: 'decrypt',
        dataSize: decrypted.length,
        encrypted: false,
      });
      
      return decrypted;
    } catch (error) {
      apiLogger.error('Decryption failed', { error: error as Error });
      throw new Error('Failed to decrypt data');
    }
  }

  // Simple encryption (for demo - use proper encryption in production)
  private simpleEncrypt(text: string, key: string): string {
    const keyHash = this.simpleHash(key);
    let encrypted = '';
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ keyHash.charCodeAt(i % keyHash.length);
      encrypted += String.fromCharCode(charCode);
    }
    
    return btoa(encrypted); // Base64 encode
  }

  // Simple decryption (for demo - use proper decryption in production)
  private simpleDecrypt(encryptedText: string, key: string): string {
    const keyHash = this.simpleHash(key);
    const encrypted = atob(encryptedText); // Base64 decode
    let decrypted = '';
    
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ keyHash.charCodeAt(i % keyHash.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    return decrypted;
  }

  // Simple hash function (for demo - use proper hashing in production)
  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Validate session
  validateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logSecurityEvent('failed_auth', 'medium', {
        reason: 'invalid_session',
        sessionId,
      });
      return false;
    }

    const now = Date.now();
    const sessionAge = now - session.startTime;
    const lastActivity = now - session.lastActivity;

    // Check session timeout
    if (sessionAge > this.config.sessionTimeout || lastActivity > this.config.sessionTimeout) {
      this.sessions.delete(sessionId);
      this.logSecurityEvent('logout', 'low', {
        reason: 'session_timeout',
        sessionId,
        userId: session.userId,
      });
      return false;
    }

    // Update last activity
    session.lastActivity = now;
    this.sessions.set(sessionId, session);
    
    return true;
  }

  // Create new session
  createSession(userId: string): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    this.sessions.set(sessionId, {
      userId,
      startTime: now,
      lastActivity: now,
    });

    this.logSecurityEvent('login', 'low', {
      userId,
      sessionId,
    });

    apiLogger.info('New session created', { userId, sessionId });
    return sessionId;
  }

  // Destroy session
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logSecurityEvent('logout', 'low', {
        sessionId,
        userId: session.userId,
        reason: 'manual_logout',
      });
    }
  }

  // Track failed authentication attempts
  trackFailedAttempt(identifier: string): boolean {
    const attempts = this.failedAttempts.get(identifier) || 0;
    const newAttempts = attempts + 1;
    
    this.failedAttempts.set(identifier, newAttempts);
    
    this.logSecurityEvent('failed_auth', 'medium', {
      identifier,
      attempts: newAttempts,
      maxAttempts: this.config.maxFailedAttempts,
    });

    if (newAttempts >= this.config.maxFailedAttempts) {
      this.logSecurityEvent('security_violation', 'high', {
        violationType: 'max_failed_attempts',
        identifier,
        attempts: newAttempts,
      });
      
      // In a real app, you might temporarily lock the account
      apiLogger.warn('Max failed attempts reached', { identifier, attempts: newAttempts });
      return true; // Account should be locked
    }

    return false;
  }

  // Reset failed attempts (on successful auth)
  resetFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }

  // Log security event
  private logSecurityEvent(
    event: SecurityAuditLog['event'],
    riskLevel: SecurityAuditLog['riskLevel'],
    details: Record<string, any>,
    userId?: string
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditLog: SecurityAuditLog = {
      id: this.generateAuditId(),
      timestamp: Date.now(),
      event,
      userId,
      sessionId: this.getCurrentSessionId(),
      details,
      riskLevel,
      deviceFingerprint: this.deviceFingerprint,
    };

    this.auditLogs.push(auditLog);
    
    // Maintain size limit
    if (this.auditLogs.length > this.MAX_AUDIT_LOGS) {
      this.auditLogs = this.auditLogs.slice(-this.MAX_AUDIT_LOGS);
    }

    // Save critical events immediately
    if (riskLevel === 'critical' || riskLevel === 'high') {
      this.saveAuditLogs();
    }

    apiLogger.debug('Security event logged', {
      event,
      riskLevel,
      auditId: auditLog.id,
    });
  }

  // Generate device fingerprint
  private generateDeviceFingerprint(): string {
    // In a real app, this would include:
    // - Device ID
    // - Model
    // - OS version
    // - App version
    // - Screen resolution
    // - Timezone
    // - Language
    
    const factors = [
      'react-native', // Platform
      '1.0.0', // App version
      Date.now().toString().substring(0, -6), // Date factor for uniqueness
      Math.random().toString(36).substring(2, 8), // Random component
    ];
    
    return this.simpleHash(factors.join('|'));
  }

  // Get current session ID (mock implementation)
  private getCurrentSessionId(): string {
    // In a real app, this would get the current active session
    return Array.from(this.sessions.keys())[0] || 'no_session';
  }

  // Clean up expired sessions
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - session.startTime;
      const lastActivity = now - session.lastActivity;
      
      if (sessionAge > this.config.sessionTimeout || lastActivity > this.config.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        
        this.logSecurityEvent('logout', 'low', {
          sessionId,
          userId: session.userId,
          reason: 'session_cleanup',
        });
      }
    }
    
    if (cleanedCount > 0) {
      apiLogger.debug('Expired sessions cleaned', { count: cleanedCount });
    }
  }

  // Get enabled security features
  private getEnabledFeatures(): string[] {
    const features: string[] = [];
    
    if (this.config.enableJailbreakDetection) features.push('jailbreak_detection');
    if (this.config.enableDebuggerDetection) features.push('debugger_detection');
    if (this.config.enableSSLPinning) features.push('ssl_pinning');
    if (this.config.enableDataEncryption) features.push('data_encryption');
    if (this.config.enableBiometricAuth) features.push('biometric_auth');
    if (this.config.enableAuditLogging) features.push('audit_logging');
    
    return features;
  }

  // Generate unique audit ID
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get default configuration
  private getDefaultConfig(): SecurityConfig {
    return {
      enableJailbreakDetection: !__DEV__, // Only in production
      enableDebuggerDetection: !__DEV__, // Only in production
      enableSSLPinning: !__DEV__, // Only in production
      enableDataEncryption: true,
      enableBiometricAuth: false, // Would need additional setup
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxFailedAttempts: 5,
      enableAuditLogging: true,
    };
  }

  // Update security configuration
  async updateConfig(config: Partial<SecurityConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
    
    apiLogger.info('Security config updated', { config: this.config });
    this.logSecurityEvent('system_config_change', 'medium', {
      newConfig: config,
    });
  }

  // Get security statistics
  getSecurityStats(): {
    activeSessions: number;
    totalAuditLogs: number;
    recentViolations: SecurityAuditLog[];
    failedAttemptsByIdentifier: Record<string, number>;
    deviceFingerprint: string;
  } {
    const recentViolations = this.auditLogs
      .filter(log => log.event === 'security_violation' && log.timestamp > Date.now() - 24 * 60 * 60 * 1000)
      .slice(-10);

    return {
      activeSessions: this.sessions.size,
      totalAuditLogs: this.auditLogs.length,
      recentViolations,
      failedAttemptsByIdentifier: Object.fromEntries(this.failedAttempts),
      deviceFingerprint: this.deviceFingerprint,
    };
  }

  // Get audit logs
  getAuditLogs(limit?: number): SecurityAuditLog[] {
    const logs = [...this.auditLogs].reverse(); // Most recent first
    return limit ? logs.slice(0, limit) : logs;
  }

  // Save configuration
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch (error) {
      apiLogger.error('Failed to save security config', { error: error as Error });
    }
  }

  // Load configuration
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      apiLogger.error('Failed to load security config', { error: error as Error });
    }
  }

  // Save audit logs
  private async saveAuditLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY_LOGS, JSON.stringify(this.auditLogs));
    } catch (error) {
      apiLogger.error('Failed to save audit logs', { error: error as Error });
    }
  }

  // Load audit logs
  private async loadAuditLogs(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY_LOGS);
      if (stored) {
        this.auditLogs = JSON.parse(stored);
      }
    } catch (error) {
      apiLogger.error('Failed to load audit logs', { error: error as Error });
    }
  }
}

// Export singleton instance
export const securityManager = new SecurityManager();

// Helper functions
export const encryptSensitiveData = (data: string) => {
  return securityManager.encryptData(data);
};

export const decryptSensitiveData = (encryptedData: string) => {
  return securityManager.decryptData(encryptedData);
};

export const createSecureSession = (userId: string) => {
  return securityManager.createSession(userId);
};

export const validateUserSession = (sessionId: string) => {
  return securityManager.validateSession(sessionId);
};

export { SecurityManager };
export default securityManager;
