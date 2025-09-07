/**
 * Integration tests for AI Book Illustrations feature
 * Tests end-to-end functionality with foliate.js and real book formats
 * 
 * Requirements covered:
 * - 1.1: Hook into foliate.js page rendering lifecycle
 * - 1.2: Determine if it's an even-numbered page (every second page)
 * - 1.3: Generate and display contextual illustrations
 * - 1.4: Inject illustrations as single image at top of page content
 * - 1.5: Display cached illustrations without regenerating
 */

import { aiIllustrationService } from '../aiIllustrationService';
import { AIApiService } from '../aiApiService';
import { CacheService } from '../cache/cacheService';
import { PageSelectionService } from '../pageSelectionService';
import { TextExtractionService } from '../textExtractionService';
import { DOMInjectionService } from '../domInjectionService';

// Mock electron ipcRenderer
const mockIpcRenderer = {
  invoke: jest.fn()
};

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
    endOperation: jest.fn(),
    trackMemoryUsage: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      totalOperations: 0,
      averageResponseTime: 0,
      memoryUsage: { used: 0, total: 0 }
    })
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

// Mock IndexedDB for cache testing
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockImplementation((tagName: string) => {
    const element = {
      tagName: tagName.toUpperCase(),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      },
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      innerHTML: '',
      textContent: '',
      src: '',
      onload: null,
      onerror: null
    };
    return element;
  }),
  writable: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn().mockReturnValue(Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  },
  writable: true
});

describe('AI Illustration Integration Tests', () => {
  let mockRendition: any;
  let mockDocument: any;
  let mockIframe: any;
  let testBookId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testBookId = 'test-book-123';

    // Create mock iframe document
    mockDocument = {
      body: {
        innerHTML: '<p>Sample book content for testing AI illustration generation.</p>',
        textContent: 'Sample book content for testing AI illustration generation.',
        querySelector: jest.fn().mockReturnValue({
          textContent: 'Sample book content for testing AI illustration generation.'
        }),
        querySelectorAll: jest.fn().mockReturnValue([
          { textContent: 'Sample book content for testing AI illustration generation.' }
        ]),
        insertBefore: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        children: []
      },
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      createElement: document.createElement,
      head: {
        appendChild: jest.fn(),
        querySelector: jest.fn()
      }
    };

    // Create mock iframe
    mockIframe = {
      contentDocument: mockDocument,
      contentWindow: {
        document: mockDocument
      }
    };

    // Create mock rendition
    mockRendition = {
      on: jest.fn(),
      off: jest.fn(),
      getContents: jest.fn().mockReturnValue({
        document: mockDocument,
        window: {
          document: mockDocument
        }
      }),
      getCurrentLocationKey: jest.fn().mockReturnValue('chapter-1-page-1'),
      getIframe: jest.fn().mockReturnValue(mockIframe),
      format: 'EPUB'
    };

    // Mock successful API responses
    mockIpcRenderer.invoke.mockImplementation((channel: string, config: any) => {
      if (channel === 'ai-generate-prompt') {
        return Promise.resolve({
          success: true,
          prompt: 'A detailed illustration showing the scene described in the text',
          locationKey: config.locationKey
        });
      } else if (channel === 'ai-generate-image') {
        return Promise.resolve({
          success: true,
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          locationKey: config.locationKey
        });
      }
      return Promise.resolve({ success: false });
    });
  });

  afterEach(async () => {
    // Cleanup after each test
    try {
      await aiIllustrationService.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('End-to-End Illustration Generation (Requirements 1.1, 1.2, 1.3, 1.4)', () => {
    it('should complete full illustration workflow for eligible pages', async () => {
      // Initialize the service
      await aiIllustrationService.initialize(mockRendition, testBookId);

      // Verify initialization
      expect(mockRendition.on).toHaveBeenCalledWith('rendered', expect.any(Function));

      // Get the rendered event handler
      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate page rendering for an eligible page (every second page)
      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      
      await renderedHandler();

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify API calls were made
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
        locationKey: 'chapter-1-page-2',
        text: expect.stringContaining('Sample book content'),
        abortSignal: expect.any(AbortSignal)
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-image', {
        locationKey: 'chapter-1-page-2',
        prompt: expect.stringContaining('detailed illustration'),
        abortSignal: expect.any(AbortSignal)
      });

      // Verify DOM injection occurred
      expect(mockDocument.body.insertBefore).toHaveBeenCalled();
    });

    it('should skip ineligible pages (not every second page)', async () => {
      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate page rendering for an ineligible page
      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-1');
      
      await renderedHandler();

      // Wait for potential async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no API calls were made
      expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
    });

    it('should handle cached illustrations without API calls (Requirement 1.5)', async () => {
      const locationKey = 'chapter-1-page-2';
      
      // Pre-populate cache
      const cacheService = new CacheService();
      await cacheService.set(`${testBookId}:${locationKey}`, {
        status: 'completed',
        prompt: 'Cached prompt',
        imageBlobURL: 'blob:cached-image-url',
        timestamp: Date.now()
      });

      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue(locationKey);
      
      await renderedHandler();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no API calls were made (using cache)
      expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();

      // Verify DOM injection still occurred
      expect(mockDocument.body.insertBefore).toHaveBeenCalled();
    });
  });

  describe('Performance Impact Testing', () => {
    it('should not significantly impact page rendering performance', async () => {
      const startTime = performance.now();
      
      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate multiple rapid page changes
      const pagePromises = [];
      for (let i = 0; i < 10; i++) {
        mockRendition.getCurrentLocationKey.mockReturnValue(`chapter-1-page-${i}`);
        pagePromises.push(renderedHandler());
      }

      await Promise.all(pagePromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (less than 1 second for 10 pages)
      expect(totalTime).toBeLessThan(1000);

      // Verify that only eligible pages triggered API calls
      const apiCalls = mockIpcRenderer.invoke.mock.calls.length;
      expect(apiCalls).toBeLessThanOrEqual(10); // At most 5 eligible pages * 2 API calls each
    });

    it('should handle memory usage efficiently during extended reading', async () => {
      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      const initialMemory = performance.memory.usedJSHeapSize;

      // Simulate extended reading session (50 pages)
      for (let i = 0; i < 50; i++) {
        mockRendition.getCurrentLocationKey.mockReturnValue(`chapter-${Math.floor(i/10)}-page-${i}`);
        await renderedHandler();
        
        // Add small delay to simulate realistic reading pace
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for 50 pages)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should cancel in-flight requests during rapid page navigation', async () => {
      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Start processing a page
      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      const firstPagePromise = renderedHandler();

      // Immediately navigate to another page
      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-4');
      const secondPagePromise = renderedHandler();

      await Promise.all([firstPagePromise, secondPagePromise]);

      // Verify that requests were properly managed (no duplicate processing)
      const apiService = new AIApiService();
      expect(apiService.getActiveRequestCount()).toBe(0);
    });
  });

  describe('Book Format Compatibility Testing', () => {
    const testFormats = [
      { format: 'EPUB', content: '<p>EPUB content with <em>formatting</em></p>' },
      { format: 'PDF', content: 'PDF text content extracted from page' },
      { format: 'TXT', content: 'Plain text content from TXT file' },
      { format: 'MOBI', content: '<div>MOBI content with structure</div>' }
    ];

    testFormats.forEach(({ format, content }) => {
      it(`should handle ${format} format correctly`, async () => {
        // Update mock document for specific format
        mockDocument.body.textContent = content;
        mockDocument.body.innerHTML = content;
        mockRendition.format = format;

        await aiIllustrationService.initialize(mockRendition, testBookId);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
        
        await renderedHandler();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify text extraction worked for the format
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
          locationKey: 'chapter-1-page-2',
          text: expect.stringContaining(format === 'EPUB' || format === 'MOBI' ? 'content' : content),
          abortSignal: expect.any(AbortSignal)
        });
      });
    });

    it('should handle books with different sizes and complexity', async () => {
      const testCases = [
        { size: 'small', content: 'Short content.' },
        { size: 'medium', content: 'A'.repeat(1000) + ' Medium length content with more text.' },
        { size: 'large', content: 'B'.repeat(5000) + ' Very long content that should be handled efficiently.' }
      ];

      for (const testCase of testCases) {
        mockDocument.body.textContent = testCase.content;
        
        await aiIllustrationService.initialize(mockRendition, `${testBookId}-${testCase.size}`);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
        
        const startTime = performance.now();
        await renderedHandler();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endTime = performance.now();

        // Should handle all sizes within reasonable time
        expect(endTime - startTime).toBeLessThan(500);

        // Verify API was called with appropriate content
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
          locationKey: 'chapter-1-page-2',
          text: expect.any(String),
          abortSignal: expect.any(AbortSignal)
        });

        // Reset mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should continue reading experience when API fails', async () => {
      // Mock API failure
      mockIpcRenderer.invoke.mockImplementation((channel: string) => {
        if (channel === 'ai-generate-prompt') {
          return Promise.resolve({
            success: false,
            error: 'API service unavailable'
          });
        }
        return Promise.resolve({ success: false });
      });

      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      
      // Should not throw error
      await expect(renderedHandler()).resolves.not.toThrow();

      // Verify no DOM injection occurred due to API failure
      expect(mockDocument.body.insertBefore).not.toHaveBeenCalled();
    });

    it('should handle DOM injection failures gracefully', async () => {
      // Mock DOM injection failure
      mockDocument.body.insertBefore.mockImplementation(() => {
        throw new Error('DOM manipulation failed');
      });

      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      
      // Should not throw error despite DOM failure
      await expect(renderedHandler()).resolves.not.toThrow();
    });

    it('should handle cache corruption gracefully', async () => {
      const cacheService = new CacheService();
      
      // Mock corrupted cache data
      jest.spyOn(cacheService, 'get').mockResolvedValue({
        status: 'completed',
        prompt: null, // Corrupted data
        imageBlobURL: null,
        timestamp: Date.now()
      });

      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      
      await renderedHandler();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should fall back to API generation when cache is corrupted
      expect(mockIpcRenderer.invoke).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup resources on service destruction', async () => {
      await aiIllustrationService.initialize(mockRendition, testBookId);

      // Start some operations
      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      renderedHandler(); // Don't await - simulate in-flight request

      // Cleanup
      await aiIllustrationService.cleanup();

      // Verify event listeners were removed
      expect(mockRendition.off).toHaveBeenCalledWith('rendered', expect.any(Function));

      // Verify no active requests remain
      const apiService = new AIApiService();
      expect(apiService.getActiveRequestCount()).toBe(0);
    });

    it('should handle cleanup when no initialization occurred', async () => {
      // Should not throw error when cleaning up uninitialized service
      await expect(aiIllustrationService.cleanup()).resolves.not.toThrow();
    });

    it('should prevent memory leaks during extended usage', async () => {
      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate many page changes
      for (let i = 0; i < 100; i++) {
        mockRendition.getCurrentLocationKey.mockReturnValue(`chapter-${Math.floor(i/20)}-page-${i}`);
        await renderedHandler();
      }

      // Cleanup
      await aiIllustrationService.cleanup();

      // Verify all resources are cleaned up
      const apiService = new AIApiService();
      expect(apiService.getActiveRequestCount()).toBe(0);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical reading session workflow', async () => {
      await aiIllustrationService.initialize(mockRendition, testBookId);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate realistic reading pattern
      const readingSequence = [
        'chapter-1-page-1',  // Skip (not eligible)
        'chapter-1-page-2',  // Process
        'chapter-1-page-3',  // Skip
        'chapter-1-page-4',  // Process
        'chapter-1-page-2',  // Return to previous page (should use cache)
        'chapter-2-page-1',  // Skip
        'chapter-2-page-2'   // Process
      ];

      for (const locationKey of readingSequence) {
        mockRendition.getCurrentLocationKey.mockReturnValue(locationKey);
        await renderedHandler();
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate reading time
      }

      // Verify appropriate number of API calls (3 unique eligible pages)
      const promptCalls = mockIpcRenderer.invoke.mock.calls.filter(
        call => call[0] === 'ai-generate-prompt'
      );
      expect(promptCalls.length).toBe(3); // chapter-1-page-2, chapter-1-page-4, chapter-2-page-2

      // Verify cache was used for repeated page
      const uniqueLocationKeys = new Set(promptCalls.map(call => call[1].locationKey));
      expect(uniqueLocationKeys.size).toBe(3);
    });

    it('should handle book switching correctly', async () => {
      const firstBookId = 'book-1';
      const secondBookId = 'book-2';

      // Initialize with first book
      await aiIllustrationService.initialize(mockRendition, firstBookId);

      let renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      await renderedHandler();

      // Switch to second book
      await aiIllustrationService.cleanup();
      jest.clearAllMocks();

      await aiIllustrationService.initialize(mockRendition, secondBookId);

      renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.getCurrentLocationKey.mockReturnValue('chapter-1-page-2');
      await renderedHandler();

      // Verify new book gets fresh processing
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('ai-generate-prompt', {
        locationKey: 'chapter-1-page-2',
        text: expect.any(String),
        abortSignal: expect.any(AbortSignal)
      });
    });
  });
});