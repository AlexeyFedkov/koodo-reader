// Basic infrastructure tests for AI Illustration services
import { 
  ServiceContainer, 
  ServiceNames,
  AIIllustrationLogger,
  ErrorHandler,
  AIIllustrationError,
  ErrorCodes,
  AIIllustrationUtils,
  AIIllustrationConfigService
} from '../index';

describe('AI Illustration Infrastructure', () => {
  describe('ServiceContainer', () => {
    let container: ServiceContainer;

    beforeEach(() => {
      container = ServiceContainer.getInstance();
      container.clear();
    });

    afterEach(() => {
      container.clear();
    });

    it('should register and retrieve services', () => {
      const mockService = { test: 'value' };
      container.register('testService', mockService);
      
      expect(container.has('testService')).toBe(true);
      expect(container.get('testService')).toBe(mockService);
    });

    it('should throw error for non-existent service', () => {
      expect(() => container.get('nonExistent')).toThrow('Service not found: nonExistent');
    });

    it('should unregister services', () => {
      container.register('testService', {});
      container.unregister('testService');
      
      expect(container.has('testService')).toBe(false);
    });
  });

  describe('AIIllustrationLogger', () => {
    let logger: AIIllustrationLogger;

    beforeEach(() => {
      logger = new AIIllustrationLogger('TestContext');
    });

    it('should create logger with context', () => {
      expect(logger).toBeDefined();
    });

    it('should log messages without throwing', () => {
      expect(() => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });

  describe('ErrorHandler', () => {
    it('should create AI illustration errors', () => {
      const error = ErrorHandler.createError(
        'Test error',
        ErrorCodes.API_ERROR,
        true
      );

      expect(error).toBeInstanceOf(AIIllustrationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.API_ERROR);
      expect(error.retryable).toBe(true);
    });

    it('should identify retryable errors', () => {
      const retryableError = new AIIllustrationError('Test', ErrorCodes.NETWORK_ERROR, true);
      const nonRetryableError = new AIIllustrationError('Test', ErrorCodes.AUTHENTICATION_ERROR, false);

      expect(ErrorHandler.isRetryableError(retryableError)).toBe(true);
      expect(ErrorHandler.isRetryableError(nonRetryableError)).toBe(false);
    });
  });

  describe('AIIllustrationUtils', () => {
    it('should generate cache keys', () => {
      const key = AIIllustrationUtils.generateCacheKey('book123', 'page456');
      expect(key).toBe('book123:page456');
    });

    it('should normalize text', () => {
      const input = '<p>Hello   world!</p>\n\n  [1] footnote  ';
      const expected = 'Hello world! footnote';
      
      expect(AIIllustrationUtils.normalizeText(input)).toBe(expected);
    });

    it('should validate blob URLs', () => {
      expect(AIIllustrationUtils.isValidBlobUrl('blob:http://example.com/123')).toBe(true);
      expect(AIIllustrationUtils.isValidBlobUrl('http://example.com/image.jpg')).toBe(false);
      expect(AIIllustrationUtils.isValidBlobUrl('')).toBe(false);
    });

    it('should format bytes', () => {
      expect(AIIllustrationUtils.formatBytes(0)).toBe('0 Bytes');
      expect(AIIllustrationUtils.formatBytes(1024)).toBe('1 KB');
      expect(AIIllustrationUtils.formatBytes(1048576)).toBe('1 MB');
    });

    it('should safely parse JSON', () => {
      const validJson = '{"test": "value"}';
      const invalidJson = '{invalid json}';
      const fallback = { default: true };

      expect(AIIllustrationUtils.safeJsonParse(validJson, fallback)).toEqual({ test: 'value' });
      expect(AIIllustrationUtils.safeJsonParse(invalidJson, fallback)).toEqual(fallback);
    });
  });

  describe('AIIllustrationConfigService', () => {
    it('should provide default configuration', () => {
      const config = AIIllustrationConfigService.getConfig();
      
      expect(config).toBeDefined();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.frequency).toBe('string');
      expect(typeof config.imageQuality).toBe('string');
      expect(typeof config.cacheSize).toBe('number');
      expect(typeof config.showNotifications).toBe('boolean');
    });

    it('should provide development configuration', () => {
      const devConfig = AIIllustrationConfigService.getDevConfig();
      
      expect(devConfig).toBeDefined();
      expect(typeof devConfig.apiEndpoint).toBe('string');
      expect(typeof devConfig.requestTimeout).toBe('number');
      expect(typeof devConfig.retryAttempts).toBe('number');
      expect(typeof devConfig.debugMode).toBe('boolean');
    });
  });
});

// Mock implementations for testing
jest.mock('../../assets/lib/kookit-extra-browser.min', () => ({
  ConfigService: {
    getReaderConfig: jest.fn(() => ''),
    setReaderConfig: jest.fn()
  }
}));

jest.mock('react-hot-toast', () => ({
  error: jest.fn(),
  success: jest.fn(),
  default: jest.fn()
}));

jest.mock('../../i18n', () => ({
  t: jest.fn((key: string) => key)
}));