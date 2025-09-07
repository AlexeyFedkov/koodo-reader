/**
 * User-friendly notification service for AI Illustration features
 * Provides contextual feedback and status updates to users
 */

import toast from "react-hot-toast";
import { AIIllustrationLogger } from './logger';
import { ConfigService } from '../../assets/lib/kookit-extra-browser.min';
import i18n from '../../i18n';

export interface NotificationOptions {
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  style?: React.CSSProperties;
  className?: string;
  icon?: string;
  id?: string;
  dismissible?: boolean;
}

export interface NotificationConfig {
  enabled: boolean;
  showProgress: boolean;
  showErrors: boolean;
  showSuccess: boolean;
  showWarnings: boolean;
  position: string;
  duration: number;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  LOADING = 'loading'
}

export class AIIllustrationNotificationService {
  private logger: AIIllustrationLogger;
  private config: NotificationConfig;
  private activeNotifications: Map<string, string> = new Map();
  private notificationQueue: Array<{ type: NotificationType; message: string; options: NotificationOptions }> = [];
  private isProcessingQueue = false;

  constructor() {
    this.logger = new AIIllustrationLogger('NotificationService');
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): NotificationConfig {
    try {
      return {
        enabled: ConfigService.getReaderConfig('aiIllustrationsNotifications') !== 'no',
        showProgress: ConfigService.getReaderConfig('aiIllustrationsShowProgress') !== 'no',
        showErrors: ConfigService.getReaderConfig('aiIllustrationsShowErrors') !== 'no',
        showSuccess: ConfigService.getReaderConfig('aiIllustrationsShowSuccess') !== 'no',
        showWarnings: ConfigService.getReaderConfig('aiIllustrationsShowWarnings') !== 'no',
        position: ConfigService.getReaderConfig('aiIllustrationsNotificationPosition') || 'bottom-right',
        duration: parseInt(ConfigService.getReaderConfig('aiIllustrationsNotificationDuration')) || 3000
      };
    } catch (error) {
      this.logger.warn('Error loading notification configuration, using defaults', error);
      return {
        enabled: true,
        showProgress: true,
        showErrors: true,
        showSuccess: false, // Default to not showing success to avoid spam
        showWarnings: true,
        position: 'bottom-right',
        duration: 3000
      };
    }
  }

  private shouldShowNotification(type: NotificationType): boolean {
    if (!this.config.enabled) {
      return false;
    }

    switch (type) {
      case NotificationType.ERROR:
        return this.config.showErrors;
      case NotificationType.SUCCESS:
        return this.config.showSuccess;
      case NotificationType.WARNING:
        return this.config.showWarnings;
      case NotificationType.LOADING:
        return this.config.showProgress;
      case NotificationType.INFO:
        return true; // Always show info messages if notifications are enabled
      default:
        return true;
    }
  }

  private getDefaultOptions(type: NotificationType): NotificationOptions {
    const baseOptions: NotificationOptions = {
      duration: this.config.duration,
      position: this.config.position as any,
      dismissible: true
    };

    switch (type) {
      case NotificationType.SUCCESS:
        return {
          ...baseOptions,
          icon: '✅',
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '14px',
            borderRadius: '8px',
            padding: '12px 16px'
          }
        };

      case NotificationType.ERROR:
        return {
          ...baseOptions,
          duration: 5000, // Longer duration for errors
          icon: '❌',
          style: {
            background: '#EF4444',
            color: 'white',
            fontSize: '14px',
            borderRadius: '8px',
            padding: '12px 16px'
          }
        };

      case NotificationType.WARNING:
        return {
          ...baseOptions,
          icon: '⚠️',
          style: {
            background: '#F59E0B',
            color: 'white',
            fontSize: '14px',
            borderRadius: '8px',
            padding: '12px 16px'
          }
        };

      case NotificationType.LOADING:
        return {
          ...baseOptions,
          duration: 0, // Loading notifications don't auto-dismiss
          icon: '🎨',
          style: {
            background: '#3B82F6',
            color: 'white',
            fontSize: '14px',
            borderRadius: '8px',
            padding: '12px 16px'
          }
        };

      case NotificationType.INFO:
      default:
        return {
          ...baseOptions,
          icon: 'ℹ️',
          style: {
            background: '#6B7280',
            color: 'white',
            fontSize: '14px',
            borderRadius: '8px',
            padding: '12px 16px'
          }
        };
    }
  }

  private showToast(type: NotificationType, message: string, options: NotificationOptions = {}): string {
    const mergedOptions = { ...this.getDefaultOptions(type), ...options };
    let toastId: string;

    switch (type) {
      case NotificationType.SUCCESS:
        toastId = toast.success(message, mergedOptions);
        break;
      case NotificationType.ERROR:
        toastId = toast.error(message, mergedOptions);
        break;
      case NotificationType.LOADING:
        toastId = toast.loading(message, mergedOptions);
        break;
      case NotificationType.WARNING:
      case NotificationType.INFO:
      default:
        toastId = toast(message, mergedOptions);
        break;
    }

    // Track active notification
    if (mergedOptions.id) {
      this.activeNotifications.set(mergedOptions.id, toastId);
    }

    return toastId;
  }

  /**
   * Show illustration generation started notification
   */
  public showGenerationStarted(locationKey?: string): string {
    if (!this.shouldShowNotification(NotificationType.LOADING)) {
      return '';
    }

    const message = i18n.t('Generating AI illustration...');
    const id = `generation-${locationKey || Date.now()}`;

    return this.showToast(NotificationType.LOADING, message, {
      id,
      duration: 0 // Don't auto-dismiss
    });
  }

  /**
   * Show illustration generation completed notification
   */
  public showGenerationCompleted(locationKey?: string): void {
    if (!this.shouldShowNotification(NotificationType.SUCCESS)) {
      return;
    }

    const message = i18n.t('AI illustration generated successfully');
    const id = `generation-${locationKey || Date.now()}`;

    // Dismiss loading notification if it exists
    this.dismissNotification(id);

    this.showToast(NotificationType.SUCCESS, message, {
      duration: 2000 // Brief success message
    });
  }

  /**
   * Show illustration generation failed notification
   */
  public showGenerationFailed(error?: string, locationKey?: string): void {
    if (!this.shouldShowNotification(NotificationType.ERROR)) {
      return;
    }

    const message = error || i18n.t('Failed to generate AI illustration') || 'Failed to generate AI illustration';
    const id = `generation-${locationKey || Date.now()}`;

    // Dismiss loading notification if it exists
    this.dismissNotification(id);

    this.showToast(NotificationType.ERROR, message, {
      duration: 4000
    });
  }

  /**
   * Show cache hit notification (debug mode only)
   */
  public showCacheHit(locationKey?: string): void {
    if (!this.shouldShowNotification(NotificationType.INFO) || 
        ConfigService.getReaderConfig('aiIllustrationDebugMode') !== 'yes') {
      return;
    }

    const message = i18n.t('Illustration loaded from cache');
    
    this.showToast(NotificationType.INFO, message, {
      duration: 1500,
      icon: '💾'
    });
  }

  /**
   * Show API rate limit warning
   */
  public showRateLimitWarning(): void {
    if (!this.shouldShowNotification(NotificationType.WARNING)) {
      return;
    }

    const message = i18n.t('API rate limit reached. Please wait before generating more illustrations.');
    
    this.showToast(NotificationType.WARNING, message, {
      id: 'rate-limit-warning',
      duration: 5000
    });
  }

  /**
   * Show authentication error
   */
  public showAuthenticationError(): void {
    if (!this.shouldShowNotification(NotificationType.ERROR)) {
      return;
    }

    const message = i18n.t('AI illustration authentication failed. Please check your API key in settings.');
    
    this.showToast(NotificationType.ERROR, message, {
      id: 'auth-error',
      duration: 6000
    });
  }

  /**
   * Show network error with retry option
   */
  public showNetworkError(willRetry: boolean = false): void {
    if (!this.shouldShowNotification(NotificationType.WARNING)) {
      return;
    }

    const message = willRetry 
      ? i18n.t('Network connection issue. Will retry automatically.')
      : i18n.t('Network connection issue. Please check your internet connection.');
    
    this.showToast(NotificationType.WARNING, message, {
      id: 'network-error',
      duration: willRetry ? 3000 : 5000
    });
  }

  /**
   * Show feature disabled notification
   */
  public showFeatureDisabled(): void {
    if (!this.shouldShowNotification(NotificationType.INFO)) {
      return;
    }

    const message = i18n.t('AI illustrations are currently disabled. Enable them in settings to see generated images.');
    
    this.showToast(NotificationType.INFO, message, {
      id: 'feature-disabled',
      duration: 4000
    });
  }

  /**
   * Show cache cleared notification
   */
  public showCacheCleared(): void {
    if (!this.shouldShowNotification(NotificationType.INFO)) {
      return;
    }

    const message = i18n.t('AI illustration cache cleared successfully');
    
    this.showToast(NotificationType.SUCCESS, message, {
      duration: 2000
    });
  }

  /**
   * Show configuration updated notification
   */
  public showConfigurationUpdated(): void {
    if (!this.shouldShowNotification(NotificationType.SUCCESS)) {
      return;
    }

    const message = i18n.t('AI illustration settings updated');
    
    this.showToast(NotificationType.SUCCESS, message, {
      duration: 2000
    });
  }

  /**
   * Show memory warning
   */
  public showMemoryWarning(): void {
    if (!this.shouldShowNotification(NotificationType.WARNING)) {
      return;
    }

    const message = i18n.t('High memory usage detected. Consider clearing the illustration cache.');
    
    this.showToast(NotificationType.WARNING, message, {
      id: 'memory-warning',
      duration: 5000
    });
  }

  /**
   * Show performance warning
   */
  public showPerformanceWarning(operation: string, duration: number): void {
    if (!this.shouldShowNotification(NotificationType.WARNING) ||
        ConfigService.getReaderConfig('aiIllustrationDebugMode') !== 'yes') {
      return;
    }

    const message = i18n.t(`Slow operation detected: ${operation} took ${Math.round(duration)}ms`);
    
    this.showToast(NotificationType.WARNING, message, {
      duration: 3000
    });
  }

  /**
   * Show custom notification
   */
  public showCustom(
    type: NotificationType,
    message: string,
    options: NotificationOptions = {}
  ): string {
    if (!this.shouldShowNotification(type)) {
      return '';
    }

    return this.showToast(type, message, options);
  }

  /**
   * Dismiss a specific notification
   */
  public dismissNotification(id: string): void {
    const toastId = this.activeNotifications.get(id);
    if (toastId) {
      toast.dismiss(toastId);
      this.activeNotifications.delete(id);
    } else {
      // Try to dismiss by ID directly
      toast.dismiss(id);
    }
  }

  /**
   * Dismiss all AI illustration notifications
   */
  public dismissAll(): void {
    for (const [id, toastId] of this.activeNotifications) {
      toast.dismiss(toastId);
    }
    this.activeNotifications.clear();
  }

  /**
   * Update notification configuration
   */
  public updateConfiguration(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Save to ConfigService
    if (newConfig.enabled !== undefined) {
      ConfigService.setReaderConfig('aiIllustrationsNotifications', newConfig.enabled ? 'yes' : 'no');
    }
    if (newConfig.showProgress !== undefined) {
      ConfigService.setReaderConfig('aiIllustrationsShowProgress', newConfig.showProgress ? 'yes' : 'no');
    }
    if (newConfig.showErrors !== undefined) {
      ConfigService.setReaderConfig('aiIllustrationsShowErrors', newConfig.showErrors ? 'yes' : 'no');
    }
    if (newConfig.showSuccess !== undefined) {
      ConfigService.setReaderConfig('aiIllustrationsShowSuccess', newConfig.showSuccess ? 'yes' : 'no');
    }
    if (newConfig.showWarnings !== undefined) {
      ConfigService.setReaderConfig('aiIllustrationsShowWarnings', newConfig.showWarnings ? 'yes' : 'no');
    }
    if (newConfig.position) {
      ConfigService.setReaderConfig('aiIllustrationsNotificationPosition', newConfig.position);
    }
    if (newConfig.duration !== undefined) {
      ConfigService.setReaderConfig('aiIllustrationsNotificationDuration', newConfig.duration.toString());
    }

    this.logger.info('Notification configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): NotificationConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable notifications
   */
  public setEnabled(enabled: boolean): void {
    this.updateConfiguration({ enabled });
    
    if (!enabled) {
      this.dismissAll();
    }
  }

  /**
   * Get notification statistics
   */
  public getStats(): {
    activeNotifications: number;
    queuedNotifications: number;
    configuration: NotificationConfig;
  } {
    return {
      activeNotifications: this.activeNotifications.size,
      queuedNotifications: this.notificationQueue.length,
      configuration: this.getConfiguration()
    };
  }

  /**
   * Queue a notification for later display
   */
  public queueNotification(
    type: NotificationType,
    message: string,
    options: NotificationOptions = {}
  ): void {
    this.notificationQueue.push({ type, message, options });
    this.processQueue();
  }

  /**
   * Process queued notifications
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      if (notification) {
        this.showToast(notification.type, notification.message, notification.options);
        
        // Small delay between notifications to prevent spam
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Clear notification queue
   */
  public clearQueue(): void {
    this.notificationQueue = [];
    this.isProcessingQueue = false;
  }
}

// Export singleton instance
export const notificationService = new AIIllustrationNotificationService();