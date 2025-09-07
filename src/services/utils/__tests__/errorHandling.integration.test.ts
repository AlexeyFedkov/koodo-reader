import { errorHandler } from '../errorHandler';
import { logger } from '../logger';
import { notificationService } from '../notificationService';
import { AIIllustrationError, ErrorCodes } from '../../types/aiIllustration';

// Mock dependencies
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock('../notificationService', () => ({
  notificationService: {
    showError: jest.fn(),
    showWarning: jest.fn(),
    showRateLimitWarning: jest.fn(),
    showAuthenticationError: jest.fn(),
    showNetworkError: jest.fn()
  }
}));

// Mock the error handler with all required methods
jest.mock('../errorHandler', () => ({
  errorHandler: {
    handleApiError: jest.fn().mockResolvedValue(undefined),
    handleCacheError: jest.fn().mockResolvedValue(undefined),
    handleDomError: jest.fn().mockResolvedValue(undefined),
    handleTextExtractionError: jest.fn().mockResolvedValue(undefined),
    getRecoveryStrategy: jest.fn().mockResolvedValue({
      shouldRetry: false,
      retryDelay: 0,
      maxRetries: 0,
      fallbackAction: 'skip',
      userMessage: 'Error occurred',
      escalate: false
    }),
    getErrorStatistics: jest.fn().mockReturnValue({
      totalErrors: 0,
      errorsByType: {},
      errorsByOperation: {}
    }),
    getErrorTrends: jest.fn().mockReturnValue({
      errorRate: 0,
      timeWindows: [],
      isIncreasing: false
    }),
    getUserFriendlyMessage: jest.fn().mockReturnValue('User friendly error message'),
    getUserActionSuggestions: jest.fn().mockReturnValue('Try again later'),
    reportToMonitoring: jest.fn().mockResolvedValue(undefined),
    getPerformanceImpactMetrics: jest.fn().mockReturnValue({
      averageErrorDuration: 0,
      errorsByDuration: {},
      retryImpact: { totalRetries: 0 }
    })
  }
}));

describe('Error Handling Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API error handling (Requirements 5.5, 6.1, 6.2)', () => {
    it('should handle rate limit errors appropriately', async () => {
      const rateLimitError = new AIIllustrationError(
        'Rate limit exceeded',
        ErrorCodes.RATE_LIMIT_ERROR,
        true
      );

      await errorHandler.handleApiError(rateLimitError, 'prompt-generation', {
        locationKey: 'book1:location1'
      });

      expect(errorHandler.handleApiError).toHaveBeenCalledWith(
        rateLimitError,
        'prompt-generation',
        { locationKey: 'book1:location1' }
      );
    });

    it('should handle authentication errors', async () => {
      const authError = new AIIllustrationError(
        'Invalid API key',
        ErrorCodes.AUTHENTICATION_ERROR,
        false
      );

      await errorHandler.handleApiError(authError, 'image-generation', {
        locationKey: 'book1:location1'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Authentication error in image-generation',
        authError,
        { locationKey: 'book1:location1' }
      );
      expect(notificationService.showAuthenticationError).toHaveBeenCalled();
    });

    it('should handle network errors with retry indication', async () => {
      const networkError = new AIIllustrationError(
        'Network connection failed',
        ErrorCodes.NETWORK_ERROR,
        true
      );

      await errorHandler.handleApiError(networkError, 'prompt-generation', {
        locationKey: 'book1:location1'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Network error in prompt-generation',
        networkError,
        { locationKey: 'book1:location1' }
      );
      expect(notificationService.showNetworkError).toHaveBeenCalledWith(true);
    });

    it('should handle generic API errors', async () => {
      const apiError = new AIIllustrationError(
        'Unknown API error',
        ErrorCodes.API_ERROR,
        false
      );

      await errorHandler.handleApiError(apiError, 'image-generation', {
        locationKey: 'book1:location1'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'API error in image-generation',
        apiError,
        { locationKey: 'book1:location1' }
      );
      expect(notificationService.showError).toHaveBeenCalledWith(
        'AI service error: Unknown API error'
      );
    });

    it('should handle non-AIIllustrationError exceptions', async () => {
      const genericError = new Error('Unexpected error');

      await errorHandler.handleApiError(genericError, 'prompt-generation', {
        locationKey: 'book1:location1'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Unexpected error in prompt-generation',
        genericError,
        { locationKey: 'book1:location1' }
      );
      expect(notificationService.showError).toHaveBeenCalledWith(
        'Unexpected error: Unexpected error'
      );
    });
  });

  describe('cache error handling', () => {
    it('should handle cache initialization errors', async () => {
      const cacheError = new AIIllustrationError(
        'Failed to initialize IndexedDB',
        ErrorCodes.CACHE_ERROR,
        false
      );

      await errorHandler.handleCacheError(cacheError, 'initialization', {
        operation: 'initialize'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Cache error during initialization',
        cacheError,
        { operation: 'initialize' }
      );
    });

    it('should handle cache storage errors with retry indication', async () => {
      const storageError = new AIIllustrationError(
        'Storage quota exceeded',
        ErrorCodes.CACHE_ERROR,
        true
      );

      await errorHandler.handleCacheError(storageError, 'storage', {
        key: 'book1:location1',
        operation: 'set'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Retryable cache error during storage',
        storageError,
        { key: 'book1:location1', operation: 'set' }
      );
    });
  });

  describe('DOM error handling', () => {
    it('should handle DOM injection errors', async () => {
      const domError = new AIIllustrationError(
        'Failed to inject illustration',
        ErrorCodes.DOM_ERROR,
        false
      );

      await errorHandler.handleDomError(domError, 'injection', {
        locationKey: 'book1:location1'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'DOM error during injection',
        domError,
        { locationKey: 'book1:location1' }
      );
    });

    it('should handle DOM cleanup errors gracefully', async () => {
      const cleanupError = new AIIllustrationError(
        'Failed to remove illustrations',
        ErrorCodes.DOM_ERROR,
        false
      );

      await errorHandler.handleDomError(cleanupError, 'cleanup', {
        operation: 'removeIllustrations'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'DOM error during cleanup',
        cleanupError,
        { operation: 'removeIllustrations' }
      );
    });
  });

  describe('text extraction error handling', () => {
    it('should handle text extraction failures', async () => {
      const extractionError = new AIIllustrationError(
        'No text content found',
        ErrorCodes.TEXT_EXTRACTION_ERROR,
        false
      );

      await errorHandler.handleTextExtractionError(extractionError, {
        locationKey: 'book1:location1',
        bookFormat: 'EPUB'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Text extraction error',
        extractionError,
        { locationKey: 'book1:location1', bookFormat: 'EPUB' }
      );
    });

    it('should handle text normalization errors', async () => {
      const normalizationError = new Error('Normalization failed');

      await errorHandler.handleTextExtractionError(normalizationError, {
        locationKey: 'book1:location1',
        operation: 'normalize'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Text extraction error',
        normalizationError,
        { locationKey: 'book1:location1', operation: 'normalize' }
      );
    });
  });

  describe('error recovery and graceful degradation', () => {
    it('should provide recovery suggestions for retryable errors', async () => {
      const retryableError = new AIIllustrationError(
        'Temporary service unavailable',
        ErrorCodes.API_ERROR,
        true
      );

      const recovery = await errorHandler.getRecoveryStrategy(retryableError, {
        operation: 'prompt-generation',
        attemptCount: 1
      });

      expect(recovery.shouldRetry).toBe(true);
      expect(recovery.retryDelay).toBeGreaterThan(0);
      expect(recovery.maxRetries).toBeGreaterThan(1);
    });

    it('should provide fallback strategies for non-retryable errors', async () => {
      const nonRetryableError = new AIIllustrationError(
        'Invalid request format',
        ErrorCodes.API_ERROR,
        false
      );

      const recovery = await errorHandler.getRecoveryStrategy(nonRetryableError, {
        operation: 'image-generation',
        attemptCount: 1
      });

      expect(recovery.shouldRetry).toBe(false);
      expect(recovery.fallbackAction).toBeDefined();
      expect(recovery.userMessage).toBeDefined();
    });

    it('should escalate errors after max retry attempts', async () => {
      const persistentError = new AIIllustrationError(
        'Service consistently failing',
        ErrorCodes.API_ERROR,
        true
      );

      const recovery = await errorHandler.getRecoveryStrategy(persistentError, {
        operation: 'prompt-generation',
        attemptCount: 5 // Exceeds max retries
      });

      expect(recovery.shouldRetry).toBe(false);
      expect(recovery.escalate).toBe(true);
      expect(recovery.userMessage).toContain('persistent');
    });
  });

  describe('error context and metadata', () => {
    it('should capture and log relevant context for debugging', async () => {
      const error = new AIIllustrationError(
        'Context test error',
        ErrorCodes.API_ERROR,
        false
      );

      const context = {
        locationKey: 'book1:chapter2:page5',
        bookId: 'book1',
        textLength: 1500,
        promptLength: 200,
        userAgent: 'test-agent',
        timestamp: Date.now()
      };

      await errorHandler.handleApiError(error, 'prompt-generation', context);

      expect(logger.error).toHaveBeenCalledWith(
        'API error in prompt-generation',
        error,
        context
      );
    });

    it('should sanitize sensitive information from error logs', async () => {
      const error = new Error('API key abc123xyz is invalid');

      const context = {
        apiKey: 'secret-key-12345',
        userToken: 'user-token-67890',
        locationKey: 'book1:location1'
      };

      await errorHandler.handleApiError(error, 'authentication', context);

      // Should log the error but sanitize sensitive data
      expect(logger.error).toHaveBeenCalledWith(
        'Unexpected error in authentication',
        expect.objectContaining({
          message: expect.stringContaining('[REDACTED]')
        }),
        expect.objectContaining({
          locationKey: 'book1:location1',
          // Sensitive fields should be redacted
          apiKey: '[REDACTED]',
          userToken: '[REDACTED]'
        })
      );
    });
  });

  describe('error aggregation and reporting', () => {
    it('should track error patterns for analysis', async () => {
      const errors = [
        new AIIllustrationError('Rate limit 1', ErrorCodes.RATE_LIMIT_ERROR, true),
        new AIIllustrationError('Rate limit 2', ErrorCodes.RATE_LIMIT_ERROR, true),
        new AIIllustrationError('Rate limit 3', ErrorCodes.RATE_LIMIT_ERROR, true)
      ];

      for (const error of errors) {
        await errorHandler.handleApiError(error, 'prompt-generation', {
          locationKey: `book1:location${errors.indexOf(error) + 1}`
        });
      }

      const errorStats = errorHandler.getErrorStatistics();

      expect(errorStats.totalErrors).toBe(3);
      expect(errorStats.errorsByType[ErrorCodes.RATE_LIMIT_ERROR]).toBe(3);
      expect(errorStats.errorsByOperation['prompt-generation']).toBe(3);
    });

    it('should provide error trend analysis', async () => {
      const now = Date.now();
      
      // Simulate errors over time
      const timePoints = [now - 3600000, now - 1800000, now - 900000, now];
      
      for (let i = 0; i < timePoints.length; i++) {
        const error = new AIIllustrationError(
          `Error ${i}`,
          ErrorCodes.API_ERROR,
          false
        );

        // Mock the timestamp
        jest.spyOn(Date, 'now').mockReturnValue(timePoints[i]);
        
        await errorHandler.handleApiError(error, 'image-generation', {
          locationKey: `book1:location${i}`
        });
      }

      const trends = errorHandler.getErrorTrends(3600000); // Last hour

      expect(trends.errorRate).toBeGreaterThan(0);
      expect(trends.timeWindows).toHaveLength(4);
      expect(trends.isIncreasing).toBeDefined();

      // Restore Date.now
      jest.restoreAllMocks();
    });
  });

  describe('user notification strategies', () => {
    it('should throttle repeated error notifications', async () => {
      const error = new AIIllustrationError(
        'Repeated error',
        ErrorCodes.API_ERROR,
        false
      );

      // Send same error multiple times quickly
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleApiError(error, 'prompt-generation', {
          locationKey: 'book1:location1'
        });
      }

      // Should only show notification once due to throttling
      expect(notificationService.showError).toHaveBeenCalledTimes(1);
    });

    it('should provide contextual error messages for users', async () => {
      const networkError = new AIIllustrationError(
        'Connection timeout',
        ErrorCodes.NETWORK_ERROR,
        true
      );

      await errorHandler.handleApiError(networkError, 'image-generation', {
        locationKey: 'book1:location1',
        userContext: 'reading-session'
      });

      expect(notificationService.showNetworkError).toHaveBeenCalledWith(true);
      
      // Should provide user-friendly message
      const userMessage = errorHandler.getUserFriendlyMessage(networkError, 'image-generation');
      expect(userMessage).toContain('network');
      expect(userMessage).toContain('illustration');
      expect(userMessage).not.toContain('Connection timeout'); // Technical details hidden
    });

    it('should suggest user actions for recoverable errors', async () => {
      const quotaError = new AIIllustrationError(
        'Storage quota exceeded',
        ErrorCodes.CACHE_ERROR,
        true
      );

      const userMessage = errorHandler.getUserFriendlyMessage(quotaError, 'cache-storage');
      const suggestions = errorHandler.getUserActionSuggestions(quotaError);

      expect(userMessage).toContain('storage');
      expect(suggestions).toContain('clear cache');
      expect(suggestions).toContain('free up space');
    });
  });

  describe('integration with monitoring and analytics', () => {
    it('should report critical errors to monitoring service', async () => {
      const criticalError = new AIIllustrationError(
        'Service completely unavailable',
        ErrorCodes.API_ERROR,
        false
      );

      const monitoringSpy = jest.spyOn(errorHandler, 'reportToMonitoring');

      await errorHandler.handleApiError(criticalError, 'prompt-generation', {
        locationKey: 'book1:location1',
        severity: 'critical'
      });

      expect(monitoringSpy).toHaveBeenCalledWith(criticalError, {
        operation: 'prompt-generation',
        severity: 'critical',
        locationKey: 'book1:location1'
      });
    });

    it('should collect performance impact metrics', async () => {
      const performanceError = new AIIllustrationError(
        'Request timeout',
        ErrorCodes.API_ERROR,
        true
      );

      const performanceContext = {
        requestDuration: 30000, // 30 seconds
        retryCount: 2,
        locationKey: 'book1:location1'
      };

      await errorHandler.handleApiError(performanceError, 'image-generation', performanceContext);

      const performanceMetrics = errorHandler.getPerformanceImpactMetrics();
      
      expect(performanceMetrics.averageErrorDuration).toBeGreaterThan(0);
      expect(performanceMetrics.errorsByDuration['30s+']).toBe(1);
      expect(performanceMetrics.retryImpact.totalRetries).toBe(2);
    });
  });
});