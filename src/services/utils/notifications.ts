// Notification utilities for AI Illustration services
import toast from 'react-hot-toast';
import i18n from '../../i18n';
import { AIIllustrationConfigService } from './config';
import { AIIllustrationError, ErrorCodes } from '../types/aiIllustration';

export class AIIllustrationNotifications {
  /**
   * Show error notification if notifications are enabled
   */
  public static showError(error: Error | AIIllustrationError, context?: string): void {
    const config = AIIllustrationConfigService.getConfig();
    
    if (!config.showNotifications) {
      return;
    }

    let message = '';
    let duration = 4000;

    if (error instanceof AIIllustrationError) {
      switch (error.code) {
        case ErrorCodes.API_ERROR:
          message = i18n.t('AI illustration generation failed. Please check your API configuration.');
          break;
        case ErrorCodes.NETWORK_ERROR:
          message = i18n.t('Network error while generating AI illustration. Please check your connection.');
          break;
        case ErrorCodes.RATE_LIMIT_ERROR:
          message = i18n.t('AI illustration rate limit reached. Please wait before generating more illustrations.');
          duration = 6000;
          break;
        case ErrorCodes.AUTHENTICATION_ERROR:
          message = i18n.t('AI illustration authentication failed. Please check your API key.');
          duration = 6000;
          break;
        case ErrorCodes.CACHE_ERROR:
          message = i18n.t('AI illustration cache error. Some illustrations may not be saved.');
          break;
        default:
          message = i18n.t('AI illustration error: {{message}}', { message: error.message });
          break;
      }
    } else {
      message = i18n.t('AI illustration error: {{message}}', { message: error.message });
    }

    if (context) {
      message = `${context}: ${message}`;
    }

    toast.error(message, { duration });
  }

  /**
   * Show success notification
   */
  public static showSuccess(message: string): void {
    const config = AIIllustrationConfigService.getConfig();
    
    if (!config.showNotifications) {
      return;
    }

    toast.success(i18n.t(message), { duration: 2000 });
  }

  /**
   * Show info notification
   */
  public static showInfo(message: string): void {
    const config = AIIllustrationConfigService.getConfig();
    
    if (!config.showNotifications) {
      return;
    }

    toast(i18n.t(message), { duration: 3000 });
  }

  /**
   * Show API limitation warning
   */
  public static showApiLimitation(limitType: 'quota' | 'rate' | 'cost'): void {
    const config = AIIllustrationConfigService.getConfig();
    
    if (!config.showNotifications) {
      return;
    }

    let message = '';
    let duration = 8000;

    switch (limitType) {
      case 'quota':
        message = i18n.t('AI illustration quota exceeded. Please upgrade your plan or wait for quota reset.');
        break;
      case 'rate':
        message = i18n.t('AI illustration rate limit reached. Please wait before generating more illustrations.');
        break;
      case 'cost':
        message = i18n.t('AI illustration cost limit reached. Please check your billing settings.');
        break;
    }

    toast.error(message, { 
      duration,
      icon: '⚠️'
    });
  }

  /**
   * Show cache management notification
   */
  public static showCacheInfo(action: 'cleared' | 'full' | 'error', details?: any): void {
    const config = AIIllustrationConfigService.getConfig();
    
    if (!config.showNotifications) {
      return;
    }

    let message = '';
    let type: 'success' | 'error' | 'info' = 'info';

    switch (action) {
      case 'cleared':
        message = i18n.t('AI illustration cache cleared successfully');
        type = 'success';
        break;
      case 'full':
        message = i18n.t('AI illustration cache is full. Old illustrations will be removed automatically.');
        type = 'info';
        break;
      case 'error':
        message = i18n.t('AI illustration cache error: {{message}}', { 
          message: details?.message || 'Unknown error' 
        });
        type = 'error';
        break;
    }

    switch (type) {
      case 'success':
        toast.success(message, { duration: 2000 });
        break;
      case 'error':
        toast.error(message, { duration: 4000 });
        break;
      default:
        toast(message, { duration: 3000 });
        break;
    }
  }
}