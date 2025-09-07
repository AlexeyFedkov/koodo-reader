import { AIApiService } from '../aiApiService';

// Mock electron ipcRenderer
const mockIpcRenderer = {
  invoke: jest.fn()
};

// Mock window.require
Object.defineProperty(window, 'require', {
  value: jest.fn().mockReturnValue({
    ipcRenderer: mockIpcRenderer
  }),
  writable: true
});

// Mock utility services
jest.mock('../utils/performanceMonitor', () => ({
  performanceMonitor: {
    startOperation: jest.fn().mockReturnValue('test-tracking-id'),
    endOperation: jest.fn()
  }
}));

jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock('../utils/errorHandler', () => ({
  errorHandler: {
    handleApiError: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../utils/notificationService', () => ({
  notificationService: {
    showRateLimitWarning: jest.fn(),
    showAuthenticationError: jest.fn(),
    showNetworkError: jest.fn()
  }
}));

import { performanceMonitor } from '../utils/performanceMonitor';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import { notificationService } from '../utils/notificationService';

describe('AIApiService Tests', () => {
  let apiService: AIApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    apiService = new AIApiService();
  });

  afterEach(() => {
    // Clean up any active requests
    apiService.cancelAllRequests();
  });

  describe('API key management', () => {
    it('should set API key successfully', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });

      const result = await apiService.setApiKey('test-api-key');

      expect(result).toBe(true);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-set-api-key', { apiKey: 'test-api-key' });
    });

    it('should handle API key setting failure', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({ success: false });

      const result = await apiService.setApiKey('invalid-key');

      expect(result).toBe(false);
    });

    it('should handle API key setting errors', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('IPC error'));

      const result = await apiService.setApiKey('test-key');

      expect(result).toBe(false);
    });
  });

  describe('prompt generation (Requirements 2.3, 2.4)', () => {
    it('should generate prompt successfully', async () => {
      const mockResponse = {
        success: true,
        prompt: 'A detailed scene description based on the text',
        locationKey: 'book1:location1'
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text content');

      expect(result.success).toBe(true);
      expect(result.data?.prompt).toBe('A detailed scene description based on the text');
      expect(result.data?.locationKey).toBe('book1:location1');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
        locationKey: 'book1:location1',
        text: 'Sample text content',
        abortSignal: expect.any(AbortSignal)
      });
    });

    it('should handle prompt generation failure', async () => {
      const mockResponse = {
        success: false,
        error: 'API request failed',
        shouldRetry: false
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed');
      expect(result.shouldRetry).toBe(false);
    });

    it('should handle rate limit errors with notifications', async () => {
      const mockResponse = {
        success: false,
        error: 'Rate limit exceeded',
        shouldRetry: true
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(notificationService.showRateLimitWarning).toHaveBeenCalled();
    });

    it('should handle authentication errors with notifications', async () => {
      const mockResponse = {
        success: false,
        error: 'Authentication failed',
        shouldRetry: false
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(notificationService.showAuthenticationError).toHaveBeenCalled();
    });

    it('should handle network errors with notifications', async () => {
      const mockResponse = {
        success: false,
        error: 'Network connection failed',
        shouldRetry: true
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(notificationService.showNetworkError).toHaveBeenCalledWith(true);
    });

    it('should handle exceptions during prompt generation', async () => {
      const error = new Error('Unexpected error');
      mockIpcRenderer.invoke.mockRejectedValueOnce(error);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(errorHandler.handleApiError).toHaveBeenCalledWith(error, 'prompt-generation', { locationKey: 'book1:location1' });
    });
  });

  describe('image generation (Requirements 2.3, 2.4)', () => {
    it('should generate image successfully', async () => {
      const mockResponse = {
        success: true,
        imageData: 'base64-encoded-image-data',
        locationKey: 'book1:location1'
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generateImage('book1:location1', 'A detailed scene description');

      expect(result.success).toBe(true);
      expect(result.data?.imageData).toBe('base64-encoded-image-data');
      expect(result.data?.locationKey).toBe('book1:location1');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-image', {
        locationKey: 'book1:location1',
        prompt: 'A detailed scene description',
        abortSignal: expect.any(AbortSignal)
      });
    });

    it('should handle image generation failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Image generation failed',
        shouldRetry: false
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(mockResponse);

      const result = await apiService.generateImage('book1:location1', 'Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image generation failed');
    });

    it('should handle image generation exceptions', async () => {
      const error = new Error('Image processing error');
      mockIpcRenderer.invoke.mockRejectedValueOnce(error);

      const result = await apiService.generateImage('book1:location1', 'Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image processing error');
      expect(errorHandler.handleApiError).toHaveBeenCalledWith(error, 'image-generation', { locationKey: 'book1:location1' });
    });
  });

  describe('retry logic and error handling (Requirements 5.5, 6.1, 6.2)', () => {
    it('should retry on 5xx errors with exponential backoff', async () => {
      const failureResponse = {
        success: false,
        error: 'Internal server error (500)',
        shouldRetry: true
      };

      const successResponse = {
        success: true,
        prompt: 'Generated after retry',
        locationKey: 'book1:location1'
      };

      mockIpcRenderer.invoke
        .mockResolvedValueOnce(failureResponse)  // First attempt fails
        .mockResolvedValueOnce(successResponse); // Second attempt succeeds

      const startTime = Date.now();
      const result = await apiService.generatePrompt('book1:location1', 'Sample text');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data?.prompt).toBe('Generated after retry');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(2);
      
      // Should have waited for retry delay (at least 1 second)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
    });

    it('should not retry on 4xx errors', async () => {
      const clientErrorResponse = {
        success: false,
        error: 'Bad request (400)',
        shouldRetry: false
      };

      mockIpcRenderer.invoke.mockResolvedValueOnce(clientErrorResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad request (400)');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1); // No retry
    });

    it('should stop retrying after max attempts', async () => {
      const failureResponse = {
        success: false,
        error: 'Server error (503)',
        shouldRetry: true
      };

      mockIpcRenderer.invoke.mockResolvedValue(failureResponse);

      const result = await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(result.success).toBe(false);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(2); // Initial + 1 retry = 2 total
    });

    it('should handle retry with exponential backoff timing', async () => {
      const failureResponse = {
        success: false,
        error: 'Temporary server error',
        shouldRetry: true
      };

      mockIpcRenderer.invoke.mockResolvedValue(failureResponse);

      const startTime = Date.now();
      await apiService.generatePrompt('book1:location1', 'Sample text');
      const endTime = Date.now();

      // Should have waited for initial delay (1000ms) before retry
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
      expect(endTime - startTime).toBeLessThan(3000); // But not too long
    });
  });

  describe('request cancellation (Requirements 6.1, 6.2)', () => {
    it('should cancel individual requests', async () => {
      const locationKey = 'book1:location1';
      
      // Start a request
      const requestPromise = apiService.generatePrompt(locationKey, 'Sample text');
      
      // Cancel it immediately
      apiService.cancelRequest(locationKey);
      
      // Mock the cancellation response
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: false,
        error: 'Request was cancelled',
        cancelled: true
      });

      const result = await requestPromise;

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it('should cancel all active requests', async () => {
      const locations = ['book1:loc1', 'book1:loc2', 'book1:loc3'];
      
      // Start multiple requests
      const promises = locations.map(loc => 
        apiService.generatePrompt(loc, 'Sample text')
      );
      
      expect(apiService.getActiveRequestCount()).toBe(3);
      
      // Cancel all requests
      apiService.cancelAllRequests();
      
      expect(apiService.getActiveRequestCount()).toBe(0);
      
      // Mock cancellation responses
      mockIpcRenderer.invoke.mockResolvedValue({
        success: false,
        error: 'Request was cancelled',
        cancelled: true
      });

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
      });
    });

    it('should handle cancellation during retry', async () => {
      const locationKey = 'book1:location1';
      
      // Mock initial failure that would trigger retry
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
        shouldRetry: true
      });

      const requestPromise = apiService.generatePrompt(locationKey, 'Sample text');
      
      // Cancel during retry delay
      setTimeout(() => {
        apiService.cancelRequest(locationKey);
      }, 500);

      const result = await requestPromise;

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it('should track active requests correctly', () => {
      expect(apiService.getActiveRequestCount()).toBe(0);
      expect(apiService.hasActiveRequest('book1:location1')).toBe(false);

      // Start a request (don't await it)
      apiService.generatePrompt('book1:location1', 'Sample text');
      
      expect(apiService.getActiveRequestCount()).toBe(1);
      expect(apiService.hasActiveRequest('book1:location1')).toBe(true);
      expect(apiService.hasActiveRequest('book1:location2')).toBe(false);

      // Cancel the request
      apiService.cancelRequest('book1:location1');
      
      expect(apiService.getActiveRequestCount()).toBe(0);
      expect(apiService.hasActiveRequest('book1:location1')).toBe(false);
    });
  });

  describe('performance monitoring integration', () => {
    it('should track performance metrics for prompt generation', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        prompt: 'Test prompt',
        locationKey: 'book1:location1'
      });

      await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(performanceMonitor.startOperation).toHaveBeenCalledWith('api-prompt-generation');
      expect(performanceMonitor.endOperation).toHaveBeenCalledWith(
        'test-tracking-id',
        'api-prompt-generation',
        true,
        expect.objectContaining({
          locationKey: 'book1:location1',
          textLength: 11,
          success: true
        })
      );
    });

    it('should track performance metrics for image generation', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        imageData: 'base64-data',
        locationKey: 'book1:location1'
      });

      await apiService.generateImage('book1:location1', 'Test prompt');

      expect(performanceMonitor.startOperation).toHaveBeenCalledWith('api-image-generation');
      expect(performanceMonitor.endOperation).toHaveBeenCalledWith(
        'test-tracking-id',
        'api-image-generation',
        true,
        expect.objectContaining({
          locationKey: 'book1:location1',
          promptLength: 11,
          success: true
        })
      );
    });

    it('should track retry metrics', async () => {
      mockIpcRenderer.invoke
        .mockResolvedValueOnce({
          success: false,
          error: 'Server error',
          shouldRetry: true
        })
        .mockResolvedValueOnce({
          success: true,
          prompt: 'Success after retry',
          locationKey: 'book1:location1'
        });

      await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(performanceMonitor.startOperation).toHaveBeenCalledWith('prompt-generation-retry-logic');
      expect(performanceMonitor.endOperation).toHaveBeenCalledWith(
        'test-tracking-id',
        'prompt-generation-retry-logic',
        true,
        expect.objectContaining({
          locationKey: 'book1:location1',
          attempt: 1,
          success: true
        })
      );
    });
  });

  describe('logging integration', () => {
    it('should log successful operations', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        prompt: 'Test prompt',
        locationKey: 'book1:location1'
      });

      await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(logger.debug).toHaveBeenCalledWith(
        'Starting prompt generation API call',
        { locationKey: 'book1:location1', textLength: 11 }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Prompt generation successful',
        { locationKey: 'book1:location1', promptLength: 11 }
      );
    });

    it('should log failures with appropriate levels', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: false,
        error: 'API error',
        shouldRetry: false
      });

      await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(logger.warn).toHaveBeenCalledWith(
        'Prompt generation failed',
        { locationKey: 'book1:location1', error: 'API error', shouldRetry: false }
      );
    });

    it('should log retry attempts', async () => {
      mockIpcRenderer.invoke
        .mockResolvedValueOnce({
          success: false,
          error: 'Server error',
          shouldRetry: true
        })
        .mockResolvedValueOnce({
          success: true,
          prompt: 'Success',
          locationKey: 'book1:location1'
        });

      await apiService.generatePrompt('book1:location1', 'Sample text');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Prompt generation attempt 1 failed'),
        expect.objectContaining({
          attempt: 0,
          error: 'Server error'
        }),
        { locationKey: 'book1:location1' }
      );
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle empty text input', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        prompt: 'Generated from empty text',
        locationKey: 'book1:location1'
      });

      const result = await apiService.generatePrompt('book1:location1', '');

      expect(result.success).toBe(true);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
        locationKey: 'book1:location1',
        text: '',
        abortSignal: expect.any(AbortSignal)
      });
    });

    it('should handle very long text input', async () => {
      const longText = 'A'.repeat(10000);
      
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        prompt: 'Generated from long text',
        locationKey: 'book1:location1'
      });

      const result = await apiService.generatePrompt('book1:location1', longText);

      expect(result.success).toBe(true);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
        locationKey: 'book1:location1',
        text: longText,
        abortSignal: expect.any(AbortSignal)
      });
    });

    it('should handle special characters in location keys', async () => {
      const specialLocationKey = 'book-1:chapter@2#section$3%page^4';
      
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        prompt: 'Generated prompt',
        locationKey: specialLocationKey
      });

      const result = await apiService.generatePrompt(specialLocationKey, 'Sample text');

      expect(result.success).toBe(true);
      expect(result.data?.locationKey).toBe(specialLocationKey);
    });

    it('should handle concurrent requests for different locations', async () => {
      const locations = ['book1:loc1', 'book1:loc2', 'book1:loc3'];
      
      // Mock responses for each location
      locations.forEach((loc, index) => {
        mockIpcRenderer.invoke.mockResolvedValueOnce({
          success: true,
          prompt: `Prompt for ${loc}`,
          locationKey: loc
        });
      });

      const promises = locations.map(loc => 
        apiService.generatePrompt(loc, `Text for ${loc}`)
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data?.locationKey).toBe(locations[index]);
        expect(result.data?.prompt).toBe(`Prompt for ${locations[index]}`);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      mockIpcRenderer.invoke
        .mockResolvedValueOnce({
          success: true,
          prompt: 'Success 1',
          locationKey: 'book1:loc1'
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Failed request',
          locationKey: 'book1:loc2'
        })
        .mockResolvedValueOnce({
          success: true,
          prompt: 'Success 3',
          locationKey: 'book1:loc3'
        });

      const promises = [
        apiService.generatePrompt('book1:loc1', 'Text 1'),
        apiService.generatePrompt('book1:loc2', 'Text 2'),
        apiService.generatePrompt('book1:loc3', 'Text 3')
      ];

      const results = await Promise.all(promises);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('cleanup and resource management', () => {
    it('should clean up abort controllers after successful requests', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        prompt: 'Test prompt',
        locationKey: 'book1:location1'
      });

      expect(apiService.hasActiveRequest('book1:location1')).toBe(false);

      const promise = apiService.generatePrompt('book1:location1', 'Sample text');
      
      expect(apiService.hasActiveRequest('book1:location1')).toBe(true);

      await promise;

      expect(apiService.hasActiveRequest('book1:location1')).toBe(false);
    });

    it('should clean up abort controllers after failed requests', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: false,
        error: 'Request failed'
      });

      const promise = apiService.generatePrompt('book1:location1', 'Sample text');
      
      expect(apiService.hasActiveRequest('book1:location1')).toBe(true);

      await promise;

      expect(apiService.hasActiveRequest('book1:location1')).toBe(false);
    });

    it('should handle cleanup when requests throw exceptions', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('IPC error'));

      const promise = apiService.generatePrompt('book1:location1', 'Sample text');
      
      expect(apiService.hasActiveRequest('book1:location1')).toBe(true);

      await promise;

      expect(apiService.hasActiveRequest('book1:location1')).toBe(false);
    });
  });
});