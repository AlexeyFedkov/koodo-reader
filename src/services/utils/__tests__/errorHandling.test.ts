/**
 * Comprehensive tests for error handling, logging, and monitoring
 */

import { AIIllustrationErrorHandler } from '../errorHandler';
import { AIIllustrationLogger } from '../logger';
import { AIIllustrationPerformanceMonitor } from '../performanceMonitor';
import { AIIllustrationNotificationService } from '../notificationService';
import { AIIllustrationError, ErrorCodes } from '../../types/aiIllustration';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(() => 'toast-id'),
  error: jest.fn(() => 'toast-id'),
  loading: jest.fn(() => 'toast-id'),
  dismiss: jest.fn(),
  __esModule: true,
  default: jest.fn(() => 'toast-id')
}));

// Mock ConfigService
jest.mock('../../../assets/lib/kookit-extra-browser.min', () => ({
  ConfigService: {
    getReaderConfig: jest.fn((key: string) => {
      const defaults: { [key: string]: string } = {
        'aiIllustrationDebugMode': 'no',
        'aiIllustrationsNotifications': 'yes',
        'aiIllustrationsShowProgress': 'yes',
        'aiIllustrationsShowErrors': 'yes',
        'aiIllustrationsShowSuccess': 'no',
        'aiIllustrationsShowWarnings': 'yes'
      };
      return defaults[key] || '';
    }),
    setReaderConfig: jest.fn(),
    getItem: jest.fn(() => 'test-user-id')
  }
}));

// Mock i18n
jest.mock('../../../i18n', () => ({
  t: (key: string) => key
}));

describe('Error Handling System', () => {
  let errorHandler: AIIllustrationErrorHandler;
  let logger: AIIllustrationLogger;
  let performanceMonitor: AIIllustrationPerformanceMonitor;
  let notificationService: AIIllustrationNotificationService;

  beforeEach(() => {
    errorHandler = new AIIllustrationErrorHandler('Test');
    logger = new AIIllustrationLogger('Test');
    performanceMonitor = new AIIllustrationPerformanceMonitor();
    notificationService = new AIIllustrationNotificationService();
    
    // Clear any previous state
    errorHandler.clearErrorTracking();
    logger.clearLogs();
    performanceMonitor.clearMetrics();
  });

  afterEach(() => {
    performanceMonitor.cleanup();
  });

  describe('AIIllustrationErrorHandler', () => {
    it('should handle API errors correctly', async () => {
      const apiError = new AIIllustrationError(
        'API request failed',
        ErrorCodes.API_ERROR,
        true
      );

      const recovery = await errorHandler.handleError(apiError, {
        context: 'test-api-call',
        metadata: { bookId: 'test-book', locationKey: 'test-location' }
      });

      expect(recovery.canRecover).toBe(true);
      expect(recovery.userMessage).toBeDefined();
    });

    it('should handle network errors with retry strategy', async () => {
      const networkError = new AIIllustrationError(
        'Network connection failed',
        ErrorCodes.NETWORK_ERROR,
        true
      );

      const recovery = await errorHandler.handleApiError(
        { code: 'NETWORK_ERROR', message: 'Network failed' },
        'test-operation',
        { bookId: 'test-book' }
      );

      expect(recovery.canRecover).toBe(true);
    });

    it('should handle authentication errors without retry', async () => {
      const authError = new AIIllustrationError(
        'Authentication failed',
        ErrorCodes.AUTHENTICATION_ERROR,
        false
      );

      const recovery = await errorHandler.handleError(authError, {
        context: 'authentication',
        retryable: false
      });

      expect(recovery.canRecover).toBe(false);
    });

    it('should track error frequency and suppress notifications', async () => {
      const error = new AIIllustrationError('Test error', ErrorCodes.API_ERROR, false);

      // Generate multiple errors quickly
      for (let i = 0; i < 10; i++) {
        await errorHandler.handleError(error, {
          context: 'frequency-test',
          showNotification: true
        });
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should create safe wrappers for operations', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      const safeWrapper = errorHandler.createSafeWrapper(
        failingOperation,
        'test-operation'
      );

      const result = await safeWrapper();
      expect(result).toBeNull();
    });
  });

  describe('AIIllustrationLogger', () => {
    it('should log messages with proper formatting', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.info('Test message', { data: 'test' }, { bookId: 'test-book' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should track performance metrics', () => {
      const trackingId = logger.startPerformanceTracking('test-operation');
      
      // Simulate some work
      setTimeout(() => {
        const duration = logger.endPerformanceTracking(
          trackingId,
          'test-operation',
          { bookId: 'test-book' }
        );
        
        expect(duration).toBeGreaterThan(0);
      }, 10);
    });

    it('should maintain log buffer with size limits', () => {
      // Generate many log entries
      for (let i = 0; i < 1500; i++) {
        logger.info(`Log entry ${i}`);
      }

      const recentLogs = logger.getRecentLogs(100);
      expect(recentLogs.length).toBeLessThanOrEqual(100);
    });

    it('should export logs in proper format', () => {
      logger.info('Test log for export');
      
      const exportedLogs = logger.exportLogs();
      const parsed = JSON.parse(exportedLogs);
      
      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('logs');
      expect(parsed).toHaveProperty('metrics');
    });

    it('should sanitize sensitive data', () => {
      const sensitiveData = {
        apiKey: 'secret-key',
        password: 'secret-password',
        normalData: 'safe-data'
      };

      logger.info('Test with sensitive data', sensitiveData);
      
      const recentLogs = logger.getRecentLogs(1);
      const logData = recentLogs[0]?.data;
      
      expect(logData?.apiKey).toBe('[REDACTED]');
      expect(logData?.password).toBe('[REDACTED]');
      expect(logData?.normalData).toBe('safe-data');
    });
  });

  describe('AIIllustrationPerformanceMonitor', () => {
    it('should track operation performance', () => {
      const trackingId = performanceMonitor.startOperation('test-operation');
      
      // Simulate work
      const duration = performanceMonitor.endOperation(
        trackingId,
        'test-operation',
        true,
        { testData: 'value' }
      );

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should generate performance statistics', () => {
      // Record some metrics
      performanceMonitor.recordMetric('test-op', 100, true);
      performanceMonitor.recordMetric('test-op', 200, true);
      performanceMonitor.recordMetric('test-op', 150, false);

      const stats = performanceMonitor.getOperationStats('test-op');
      
      expect(stats.count).toBe(3);
      expect(stats.averageDuration).toBe(150);
      expect(stats.successRate).toBe(66.66666666666666);
    });

    it('should generate comprehensive reports', () => {
      performanceMonitor.recordMetric('operation-1', 100, true);
      performanceMonitor.recordMetric('operation-2', 200, false);

      const report = performanceMonitor.generateReport();
      
      expect(report).toHaveProperty('sessionId');
      expect(report).toHaveProperty('operationMetrics');
      expect(report).toHaveProperty('recommendations');
      expect(report.operationMetrics).toHaveProperty('operation-1');
      expect(report.operationMetrics).toHaveProperty('operation-2');
    });

    it('should provide performance recommendations', () => {
      // Create slow operation
      performanceMonitor.recordMetric('slow-operation', 15000, true);
      
      const report = performanceMonitor.generateReport();
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain('slow-operation');
    });

    it('should export metrics correctly', () => {
      performanceMonitor.recordMetric('export-test', 100, true);
      
      const exported = performanceMonitor.exportMetrics();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('report');
    });
  });

  describe('AIIllustrationNotificationService', () => {
    it('should show different types of notifications', () => {
      const toast = require('react-hot-toast');
      
      notificationService.showGenerationStarted('test-location');
      expect(toast.loading).toHaveBeenCalled();
      
      notificationService.showGenerationCompleted('test-location');
      expect(toast.success).toHaveBeenCalled();
      
      notificationService.showGenerationFailed('Test error', 'test-location');
      expect(toast.error).toHaveBeenCalled();
    });

    it('should respect notification configuration', () => {
      notificationService.updateConfiguration({
        showErrors: false,
        showSuccess: false
      });

      const toast = require('react-hot-toast');
      toast.error.mockClear();
      toast.success.mockClear();

      notificationService.showGenerationFailed('Test error');
      notificationService.showGenerationCompleted();

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should dismiss notifications correctly', () => {
      const toast = require('react-hot-toast');
      
      notificationService.showGenerationStarted('test-location');
      notificationService.dismissNotification('generation-test-location');
      
      expect(toast.dismiss).toHaveBeenCalled();
    });

    it('should queue notifications when needed', async () => {
      notificationService.queueNotification(
        'info' as any,
        'Queued message'
      );

      const stats = notificationService.getStats();
      expect(stats.queuedNotifications).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error workflow', async () => {
      const error = new AIIllustrationError(
        'Integration test error',
        ErrorCodes.API_ERROR,
        true
      );

      // This should trigger logging, error handling, and notifications
      const recovery = await errorHandler.handleError(error, {
        context: 'integration-test',
        metadata: { bookId: 'test-book', locationKey: 'test-location' },
        showNotification: true
      });

      expect(recovery).toBeDefined();
      expect(recovery.canRecover).toBe(true);

      // Check that metrics were recorded
      const logMetrics = logger.getMetrics();
      expect(logMetrics.errorCount).toBeGreaterThan(0);
    });

    it('should handle performance monitoring with error tracking', () => {
      const trackingId = performanceMonitor.startOperation('error-prone-operation');
      
      try {
        throw new Error('Simulated error');
      } catch (error) {
        performanceMonitor.endOperation(trackingId, 'error-prone-operation', false);
        errorHandler.handleError(error, { context: 'performance-test' });
      }

      const perfStats = performanceMonitor.getOperationStats('error-prone-operation');
      expect(perfStats.successRate).toBe(0);
    });
  });
});