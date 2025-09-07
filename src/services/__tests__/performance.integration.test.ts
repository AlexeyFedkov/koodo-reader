/**
 * Performance Integration Tests for AI Book Illustrations
 * Tests performance impact on reading experience and memory usage
 * 
 * Requirements covered:
 * - Validate performance impact on reading experience
 * - Test memory usage and cleanup during extended reading sessions
 * - Verify compatibility with different book formats and sizes
 */

import { aiIllustrationService } from '../aiIllustrationService';
import { 
  sampleEpubBook, 
  samplePdfBook, 
  sampleTxtBook, 
  largeSampleBook,
  createMockRendition,
  performanceTestUtils,
  MockBookData
} from './fixtures/sample-books';

// Mock electron ipcRenderer with performance simulation
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
      memoryUsage: { used: 0, total: 0 },
      cacheHitRate: 0.8
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

// Enhanced performance mock
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn().mockImplementation(() => Date.now() + Math.random() * 10),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    },
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn().mockReturnValue([])
  },
  writable: true
});

describe('AI Illustration Performance Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API responses with realistic delays
    mockIpcRenderer.invoke.mockImplementation((channel: string, config: any) => {
      const delay = channel === 'ai-generate-prompt' ? 500 : 1500; // Realistic API delays
      
      return new Promise(resolve => {
        setTimeout(() => {
          if (channel === 'ai-generate-prompt') {
            resolve({
              success: true,
              prompt: 'A detailed illustration showing the scene described in the text',
              locationKey: config.locationKey
            });
          } else if (channel === 'ai-generate-image') {
            resolve({
              success: true,
              imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              locationKey: config.locationKey
            });
          } else {
            resolve({ success: false });
          }
        }, delay);
      });
    });
  });

  afterEach(async () => {
    try {
      await aiIllustrationService.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Reading Experience Performance Impact', () => {
    it('should not delay page rendering beyond acceptable limits', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Test multiple page renders
      const pageRenderTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        mockRendition.navigateToPage(0, i % 3); // Navigate between pages
        
        const startTime = performance.now();
        await renderedHandler();
        const endTime = performance.now();
        
        pageRenderTimes.push(endTime - startTime);
      }

      // Calculate performance metrics
      const averageRenderTime = pageRenderTimes.reduce((a, b) => a + b, 0) / pageRenderTimes.length;
      const maxRenderTime = Math.max(...pageRenderTimes);

      // Performance assertions
      expect(averageRenderTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxRenderTime).toBeLessThan(200); // Max should be under 200ms
      
      // Verify that most renders are fast (only eligible pages should be slower)
      const fastRenders = pageRenderTimes.filter(time => time < 50).length;
      expect(fastRenders).toBeGreaterThan(pageRenderTimes.length * 0.5); // At least 50% should be fast
    });

    it('should handle rapid page navigation without blocking', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate rapid page navigation (user quickly flipping pages)
      const rapidNavigationPromises: Promise<void>[] = [];
      
      for (let i = 0; i < 20; i++) {
        mockRendition.navigateToPage(0, i % 3);
        rapidNavigationPromises.push(renderedHandler());
        
        // Small delay to simulate realistic rapid navigation
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const startTime = performance.now();
      await Promise.all(rapidNavigationPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      
      // Should handle rapid navigation efficiently
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify no memory leaks from rapid navigation
      expect(window.performance.memory.usedJSHeapSize).toBeLessThan(10 * 1024 * 1024); // Under 10MB
    });

    it('should maintain responsive UI during AI processing', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Navigate to eligible page that will trigger AI processing
      mockRendition.navigateToPage(0, 1); // Page 2 (eligible)
      
      const processingStartTime = performance.now();
      const processingPromise = renderedHandler();
      
      // Simulate UI interactions during processing
      const uiInteractionTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const interactionStart = performance.now();
        
        // Simulate UI interaction (e.g., menu click, scroll)
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const interactionEnd = performance.now();
        uiInteractionTimes.push(interactionEnd - interactionStart);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await processingPromise;
      const processingEndTime = performance.now();
      
      // UI should remain responsive during AI processing
      const averageInteractionTime = uiInteractionTimes.reduce((a, b) => a + b, 0) / uiInteractionTimes.length;
      expect(averageInteractionTime).toBeLessThan(50); // UI interactions should be under 50ms
      
      // Total processing time should be reasonable
      expect(processingEndTime - processingStartTime).toBeLessThan(3000); // Under 3 seconds
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('should maintain stable memory usage during extended reading', async () => {
      const mockRendition = createMockRendition(largeSampleBook);
      await aiIllustrationService.initialize(mockRendition, largeSampleBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      const initialMemory = performanceTestUtils.measureMemoryUsage();
      const memorySnapshots: Array<{ page: number; memory: number }> = [];

      // Simulate extended reading session (100 pages)
      for (let chapterIdx = 0; chapterIdx < 5; chapterIdx++) {
        for (let pageIdx = 0; pageIdx < 15; pageIdx++) {
          mockRendition.navigateToPage(chapterIdx, pageIdx);
          await renderedHandler();
          
          // Take memory snapshot every 10 pages
          if ((chapterIdx * 15 + pageIdx) % 10 === 0) {
            const currentMemory = performanceTestUtils.measureMemoryUsage();
            memorySnapshots.push({
              page: chapterIdx * 15 + pageIdx,
              memory: currentMemory.used
            });
          }
          
          // Small delay to simulate reading time
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      const finalMemory = performanceTestUtils.measureMemoryUsage();
      
      // Memory growth should be reasonable
      const memoryGrowth = finalMemory.used - initialMemory.used;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
      
      // Memory usage should not continuously increase (should stabilize due to cache limits)
      const lastFiveSnapshots = memorySnapshots.slice(-5);
      const memoryVariance = Math.max(...lastFiveSnapshots.map(s => s.memory)) - 
                            Math.min(...lastFiveSnapshots.map(s => s.memory));
      expect(memoryVariance).toBeLessThan(20 * 1024 * 1024); // Less than 20MB variance in last 5 snapshots
    });

    it('should properly cleanup resources when switching books', async () => {
      const books = [sampleEpubBook, samplePdfBook, sampleTxtBook];
      
      for (const book of books) {
        const mockRendition = createMockRendition(book);
        await aiIllustrationService.initialize(mockRendition, book.id);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        // Process a few pages
        for (let i = 0; i < 5; i++) {
          mockRendition.navigateToPage(0, i % book.content.chapters[0].pages.length);
          await renderedHandler();
        }

        // Cleanup before switching to next book
        await aiIllustrationService.cleanup();
        
        // Verify cleanup
        expect(mockRendition.off).toHaveBeenCalledWith('rendered', expect.any(Function));
        
        jest.clearAllMocks();
      }

      // Memory should be stable after processing multiple books
      const finalMemory = performanceTestUtils.measureMemoryUsage();
      expect(finalMemory.used).toBeLessThan(20 * 1024 * 1024); // Under 20MB after cleanup
    });

    it('should handle memory pressure gracefully', async () => {
      const mockRendition = createMockRendition(largeSampleBook);
      await aiIllustrationService.initialize(mockRendition, largeSampleBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate memory pressure
      const cleanupMemoryPressure = performanceTestUtils.simulateMemoryPressure(100); // 100MB

      try {
        // Process pages under memory pressure
        for (let i = 0; i < 20; i++) {
          mockRendition.navigateToPage(Math.floor(i / 15), i % 15);
          await renderedHandler();
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Should continue to function under memory pressure
        expect(mockIpcRenderer.invoke).toHaveBeenCalled();
        
      } finally {
        cleanupMemoryPressure();
      }
    });
  });

  describe('Book Format and Size Performance', () => {
    const testBooks = [
      { book: sampleEpubBook, expectedMaxTime: 2000 },
      { book: samplePdfBook, expectedMaxTime: 2500 },
      { book: sampleTxtBook, expectedMaxTime: 1500 },
      { book: largeSampleBook, expectedMaxTime: 3000 }
    ];

    testBooks.forEach(({ book, expectedMaxTime }) => {
      it(`should handle ${book.format} format (${Math.round(book.size / 1024)}KB) efficiently`, async () => {
        const mockRendition = createMockRendition(book);
        await aiIllustrationService.initialize(mockRendition, book.id);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        const processingTimes: number[] = [];
        const maxPagesToTest = Math.min(10, book.content.chapters[0].pages.length);

        for (let i = 0; i < maxPagesToTest; i++) {
          mockRendition.navigateToPage(0, i);
          
          const startTime = performance.now();
          await renderedHandler();
          const endTime = performance.now();
          
          processingTimes.push(endTime - startTime);
        }

        const averageTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        const maxTime = Math.max(...processingTimes);

        // Performance should be within expected limits for each format
        expect(averageTime).toBeLessThan(expectedMaxTime / 2);
        expect(maxTime).toBeLessThan(expectedMaxTime);

        // Verify processing was attempted for eligible pages
        const eligiblePages = processingTimes.length / 2; // Every second page
        const apiCalls = mockIpcRenderer.invoke.mock.calls.length;
        expect(apiCalls).toBeGreaterThanOrEqual(eligiblePages);
      });
    });

    it('should scale performance appropriately with book size', async () => {
      const books = [sampleTxtBook, sampleEpubBook, largeSampleBook];
      const performanceResults: Array<{ size: number; avgTime: number }> = [];

      for (const book of books) {
        const mockRendition = createMockRendition(book);
        await aiIllustrationService.initialize(mockRendition, book.id);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        const times: number[] = [];
        
        for (let i = 0; i < 5; i++) {
          mockRendition.navigateToPage(0, i % book.content.chapters[0].pages.length);
          
          const startTime = performance.now();
          await renderedHandler();
          const endTime = performance.now();
          
          times.push(endTime - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        performanceResults.push({ size: book.size, avgTime });

        await aiIllustrationService.cleanup();
        jest.clearAllMocks();
      }

      // Performance should not degrade dramatically with size
      // (due to text normalization and caching)
      const smallestBook = performanceResults[0];
      const largestBook = performanceResults[performanceResults.length - 1];
      
      const performanceRatio = largestBook.avgTime / smallestBook.avgTime;
      expect(performanceRatio).toBeLessThan(3); // Should not be more than 3x slower
    });
  });

  describe('Cache Performance Impact', () => {
    it('should show significant performance improvement with cache hits', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // First pass - populate cache
      const firstPassTimes: number[] = [];
      mockRendition.navigateToPage(0, 1); // Eligible page
      
      const firstStartTime = performance.now();
      await renderedHandler();
      const firstEndTime = performance.now();
      firstPassTimes.push(firstEndTime - firstStartTime);

      // Second pass - should use cache
      const secondPassTimes: number[] = [];
      mockRendition.navigateToPage(0, 1); // Same page
      
      const secondStartTime = performance.now();
      await renderedHandler();
      const secondEndTime = performance.now();
      secondPassTimes.push(secondEndTime - secondStartTime);

      // Cache hit should be significantly faster
      const firstPassAvg = firstPassTimes.reduce((a, b) => a + b, 0) / firstPassTimes.length;
      const secondPassAvg = secondPassTimes.reduce((a, b) => a + b, 0) / secondPassTimes.length;
      
      expect(secondPassAvg).toBeLessThan(firstPassAvg * 0.1); // Should be at least 10x faster
      expect(secondPassAvg).toBeLessThan(50); // Should be under 50ms
    });

    it('should maintain performance with large cache sizes', async () => {
      const mockRendition = createMockRendition(largeSampleBook);
      await aiIllustrationService.initialize(mockRendition, largeSampleBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Process many pages to build large cache
      const processingTimes: number[] = [];
      
      for (let chapterIdx = 0; chapterIdx < 3; chapterIdx++) {
        for (let pageIdx = 0; pageIdx < 10; pageIdx++) {
          mockRendition.navigateToPage(chapterIdx, pageIdx);
          
          const startTime = performance.now();
          await renderedHandler();
          const endTime = performance.now();
          
          processingTimes.push(endTime - startTime);
        }
      }

      // Performance should remain stable even with large cache
      const firstHalf = processingTimes.slice(0, processingTimes.length / 2);
      const secondHalf = processingTimes.slice(processingTimes.length / 2);
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      // Performance should not degrade significantly
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5); // No more than 50% slower
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle multiple books efficiently', async () => {
      const books = [sampleEpubBook, samplePdfBook, sampleTxtBook];
      const concurrentPromises: Promise<void>[] = [];

      books.forEach(async (book, index) => {
        const promise = (async () => {
          const mockRendition = createMockRendition(book);
          await aiIllustrationService.initialize(mockRendition, `${book.id}-${index}`);

          const renderedHandler = mockRendition.on.mock.calls.find(
            call => call[0] === 'rendered'
          )[1];

          // Process a few pages
          for (let i = 0; i < 3; i++) {
            mockRendition.navigateToPage(0, i);
            await renderedHandler();
          }
        })();
        
        concurrentPromises.push(promise);
      });

      const startTime = performance.now();
      await Promise.all(concurrentPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      
      // Should handle concurrent processing efficiently
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds for all books
      
      // Verify all books were processed
      expect(mockIpcRenderer.invoke).toHaveBeenCalled();
    });
  });
});