/**
 * Configuration service for AI Illustration feature
 * Provides a convenient interface for managing AI illustration settings
 */

import { ConfigService } from '../../assets/lib/kookit-extra-browser.min';
import { AIIllustrationConfig } from '../types/aiIllustration';

export class AIIllustrationConfigService {
  /**
   * Get current AI illustration configuration
   */
  static getConfig(): AIIllustrationConfig {
    try {
      return {
        enabled: ConfigService.getReaderConfig('aiIllustrationsEnabled') === 'yes',
        frequency: (ConfigService.getReaderConfig('aiIllustrationsFrequency') as any) || 'every-second-page',
        imageQuality: (ConfigService.getReaderConfig('aiIllustrationsQuality') as any) || 'standard',
        cacheSize: parseInt(ConfigService.getReaderConfig('aiIllustrationsCacheSize')) || 100,
        showNotifications: ConfigService.getReaderConfig('aiIllustrationsNotifications') === 'yes'
      };
    } catch (error) {
      console.warn('Error loading AI illustration configuration:', error);
      
      // Return default configuration
      return {
        enabled: false,
        frequency: 'every-second-page',
        imageQuality: 'standard',
        cacheSize: 100,
        showNotifications: false
      };
    }
  }

  /**
   * Update AI illustration configuration
   */
  static updateConfig(newConfig: Partial<AIIllustrationConfig>): void {
    try {
      if (newConfig.enabled !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsEnabled', newConfig.enabled ? 'yes' : 'no');
      }
      if (newConfig.frequency) {
        ConfigService.setReaderConfig('aiIllustrationsFrequency', newConfig.frequency);
      }
      if (newConfig.imageQuality) {
        ConfigService.setReaderConfig('aiIllustrationsQuality', newConfig.imageQuality);
      }
      if (newConfig.cacheSize !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsCacheSize', newConfig.cacheSize.toString());
      }
      if (newConfig.showNotifications !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsNotifications', newConfig.showNotifications ? 'yes' : 'no');
      }
    } catch (error) {
      console.error('Error updating AI illustration configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  static resetConfig(): void {
    try {
      ConfigService.setReaderConfig('aiIllustrationsEnabled', 'no');
      ConfigService.setReaderConfig('aiIllustrationsFrequency', 'every-second-page');
      ConfigService.setReaderConfig('aiIllustrationsQuality', 'standard');
      ConfigService.setReaderConfig('aiIllustrationsCacheSize', '100');
      ConfigService.setReaderConfig('aiIllustrationsNotifications', 'no');
    } catch (error) {
      console.error('Error resetting AI illustration configuration:', error);
      throw error;
    }
  }

  /**
   * Check if AI illustrations are enabled
   */
  static isEnabled(): boolean {
    return ConfigService.getReaderConfig('aiIllustrationsEnabled') === 'yes';
  }

  /**
   * Enable or disable AI illustrations
   */
  static setEnabled(enabled: boolean): void {
    ConfigService.setReaderConfig('aiIllustrationsEnabled', enabled ? 'yes' : 'no');
  }
}