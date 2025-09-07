/**
 * Integration Test Runner for AI Book Illustrations
 * Orchestrates comprehensive testing of the AI illustration system
 * with real book formats and performance monitoring
 */

import { aiIllustrationService } from '../aiIllustrationService';
import { 
  sampleEpubBook, 
  samplePdfBook, 
  sampleTxtBook, 
  largeSampleBook,
  createMockRendition,
  performanceTestUtils
} from './fixtures/sample-books';

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  memoryUsage: number;
  error?: string;
  metrics?: {
    apiCalls: number;
    cacheHits: number;
    averageResponseTime: number;
  };
}

interface TestSuite {
  suiteName: string;
  results: TestResult[];
  totalDuration: number;
  passRate: number;
}

class IntegrationTestRunner {
  private results: TestSuite[] = [];
  private mockIpcRenderer: any;

  constructor() {
    this.setupMocks();
  }

  private setupMocks() {
    // Mock electron ipcRenderer
    this.mockIpcRenderer = {
      invoke: jest.fn()
    };

    Object.defineProperty(window, 'require', {
      value: jest.fn().mockReturnValue({
        ipcRenderer: this.mockIpcRenderer
      }),
      writable: true
    });

    // Setup API response mocks
    this.mockIpcRenderer.invoke.mockImplementation((channel: string, config: any) => {
      const delay = channel === 'ai-generate-prompt' ? 300 : 800;
      
      return new Promise(resolve => {
        setTimeout(() => {
          if (channel === 'ai-generate-prompt') {
            resolve({
              success: true,
              prompt: `Generated prompt for ${config.locationKey}`,
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
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting AI Book Illustrations Integration Tests...\n');

    try {
      await this.runBasicFunctionalityTests();
      await this.runPerformanceTests();
      await this.runFormatCompatibilityTests();
      await this.runMemoryTests();
      await this.runErrorHandlingTests();
      
      this.printSummary();
    } catch (error) {
      console.error('❌ Test runner failed:', error);
    }
  }

  private async runBasicFunctionalityTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Basic Functionality',
      results: [],
      totalDuration: 0,
      passRate: 0
    };

    console.log('📚 Running Basic Functionality Tests...');

    // Test 1: End-to-end illustration generation
    await this.runTest(suite, 'End-to-end illustration generation', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      mockRendition.navigateToPage(0, 1); // Eligible page
      await renderedHandler();

      // Verify API calls were made
      const promptCalls = this.mockIpcRenderer.invoke.mock.calls.filter(
        call => call[0] === 'ai-generate-prompt'
      );
      const imageCalls = this.mockIpcRenderer.invoke.mock.calls.filter(
        call => call[0] === 'ai-generate-image'
      );

      if (promptCalls.length === 0) throw new Error('No prompt generation calls made');
      if (imageCalls.length === 0) throw new Error('No image generation calls made');

      await aiIllustrationService.cleanup();
    });

    // Test 2: Page selection logic
    await this.runTest(suite, 'Page selection logic (every second page)', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      const testPages = [
        { page: 0, shouldProcess: false },
        { page: 1, shouldProcess: true },
        { page: 2, shouldProcess: false },
        { page: 3, shouldProcess: true }
      ];

      let processedPages = 0;
      
      for (const { page, shouldProcess } of testPages) {
        this.mockIpcRenderer.invoke.mockClear();
        mockRendition.navigateToPage(0, page);
        await renderedHandler();

        const apiCalls = this.mockIpcRenderer.invoke.mock.calls.length;
        if (shouldProcess && apiCalls === 0) {
          throw new Error(`Page ${page} should have been processed but wasn't`);
        }
        if (!shouldProcess && apiCalls > 0) {
          throw new Error(`Page ${page} should not have been processed but was`);
        }
        
        if (shouldProcess) processedPages++;
      }

      if (processedPages !== 2) {
        throw new Error(`Expected 2 processed pages, got ${processedPages}`);
      }

      await aiIllustrationService.cleanup();
    });

    // Test 3: Cache functionality
    await this.runTest(suite, 'Cache hit performance', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // First render - should make API calls
      mockRendition.navigateToPage(0, 1);
      const firstRenderStart = performance.now();
      await renderedHandler();
      const firstRenderTime = performance.now() - firstRenderStart;

      const firstCallCount = this.mockIpcRenderer.invoke.mock.calls.length;

      // Second render - should use cache
      this.mockIpcRenderer.invoke.mockClear();
      mockRendition.navigateToPage(0, 1);
      const secondRenderStart = performance.now();
      await renderedHandler();
      const secondRenderTime = performance.now() - secondRenderStart;

      const secondCallCount = this.mockIpcRenderer.invoke.mock.calls.length;

      if (secondCallCount > 0) {
        throw new Error('Cache miss - API calls made on second render');
      }

      if (secondRenderTime >= firstRenderTime) {
        throw new Error('Cache hit not faster than initial render');
      }

      await aiIllustrationService.cleanup();
    });

    this.results.push(suite);
  }

  private async runPerformanceTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Performance',
      results: [],
      totalDuration: 0,
      passRate: 0
    };

    console.log('⚡ Running Performance Tests...');

    // Test 1: Page rendering performance
    await this.runTest(suite, 'Page rendering performance impact', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      const renderTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        mockRendition.navigateToPage(0, i % 3);
        
        const startTime = performance.now();
        await renderedHandler();
        const endTime = performance.now();
        
        renderTimes.push(endTime - startTime);
      }

      const averageTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const maxTime = Math.max(...renderTimes);

      if (averageTime > 150) {
        throw new Error(`Average render time too high: ${averageTime}ms`);
      }

      if (maxTime > 300) {
        throw new Error(`Max render time too high: ${maxTime}ms`);
      }

      await aiIllustrationService.cleanup();
    });

    // Test 2: Memory usage stability
    await this.runTest(suite, 'Memory usage stability', async () => {
      const mockRendition = createMockRendition(largeSampleBook);
      await aiIllustrationService.initialize(mockRendition, largeSampleBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      const initialMemory = performanceTestUtils.measureMemoryUsage();
      
      // Process 50 pages
      for (let i = 0; i < 50; i++) {
        const chapterIdx = Math.floor(i / 15);
        const pageIdx = i % 15;
        mockRendition.navigateToPage(chapterIdx, pageIdx);
        await renderedHandler();
        
        // Small delay to simulate reading
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = performanceTestUtils.measureMemoryUsage();
      const memoryGrowth = finalMemory.used - initialMemory.used;

      if (memoryGrowth > 30 * 1024 * 1024) { // 30MB
        throw new Error(`Memory growth too high: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
      }

      await aiIllustrationService.cleanup();
    });

    // Test 3: Rapid navigation handling
    await this.runTest(suite, 'Rapid navigation handling', async () => {
      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Simulate rapid page flipping
      const rapidPromises: Promise<void>[] = [];
      
      for (let i = 0; i < 20; i++) {
        mockRendition.navigateToPage(0, i % 3);
        rapidPromises.push(renderedHandler());
        
        // Very short delay to simulate rapid navigation
        await new Promise(resolve => setTimeout(resolve, 25));
      }

      const startTime = performance.now();
      await Promise.all(rapidPromises);
      const totalTime = performance.now() - startTime;

      if (totalTime > 3000) { // 3 seconds
        throw new Error(`Rapid navigation too slow: ${totalTime}ms`);
      }

      await aiIllustrationService.cleanup();
    });

    this.results.push(suite);
  }

  private async runFormatCompatibilityTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Format Compatibility',
      results: [],
      totalDuration: 0,
      passRate: 0
    };

    console.log('📄 Running Format Compatibility Tests...');

    const testBooks = [
      { book: sampleEpubBook, name: 'EPUB' },
      { book: samplePdfBook, name: 'PDF' },
      { book: sampleTxtBook, name: 'TXT' }
    ];

    for (const { book, name } of testBooks) {
      await this.runTest(suite, `${name} format compatibility`, async () => {
        const mockRendition = createMockRendition(book);
        await aiIllustrationService.initialize(mockRendition, book.id);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        // Test processing eligible page
        mockRendition.navigateToPage(0, 1);
        await renderedHandler();

        const apiCalls = this.mockIpcRenderer.invoke.mock.calls.length;
        if (apiCalls === 0) {
          throw new Error(`No API calls made for ${name} format`);
        }

        // Verify text extraction worked
        const promptCall = this.mockIpcRenderer.invoke.mock.calls.find(
          call => call[0] === 'ai-generate-prompt'
        );
        
        if (!promptCall || !promptCall[1].text) {
          throw new Error(`Text extraction failed for ${name} format`);
        }

        await aiIllustrationService.cleanup();
        this.mockIpcRenderer.invoke.mockClear();
      });
    }

    this.results.push(suite);
  }

  private async runMemoryTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Memory Management',
      results: [],
      totalDuration: 0,
      passRate: 0
    };

    console.log('🧠 Running Memory Management Tests...');

    // Test 1: Extended reading session
    await this.runTest(suite, 'Extended reading session memory', async () => {
      const mockRendition = createMockRendition(largeSampleBook);
      await aiIllustrationService.initialize(mockRendition, largeSampleBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      const memorySnapshots: number[] = [];
      
      // Simulate 2-hour reading session (120 page changes)
      for (let i = 0; i < 120; i++) {
        const chapterIdx = Math.floor(i / 15);
        const pageIdx = i % 15;
        mockRendition.navigateToPage(chapterIdx, pageIdx);
        await renderedHandler();
        
        // Take memory snapshot every 20 pages
        if (i % 20 === 0) {
          const memory = performanceTestUtils.measureMemoryUsage();
          memorySnapshots.push(memory.used);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Check for memory leaks (continuous growth)
      const firstHalf = memorySnapshots.slice(0, memorySnapshots.length / 2);
      const secondHalf = memorySnapshots.slice(memorySnapshots.length / 2);
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const growthRatio = secondHalfAvg / firstHalfAvg;
      
      if (growthRatio > 1.5) {
        throw new Error(`Memory leak detected: ${Math.round((growthRatio - 1) * 100)}% growth`);
      }

      await aiIllustrationService.cleanup();
    });

    // Test 2: Book switching cleanup
    await this.runTest(suite, 'Book switching cleanup', async () => {
      const books = [sampleEpubBook, samplePdfBook, sampleTxtBook];
      const initialMemory = performanceTestUtils.measureMemoryUsage();
      
      for (const book of books) {
        const mockRendition = createMockRendition(book);
        await aiIllustrationService.initialize(mockRendition, book.id);

        const renderedHandler = mockRendition.on.mock.calls.find(
          call => call[0] === 'rendered'
        )[1];

        // Process several pages
        for (let i = 0; i < 5; i++) {
          mockRendition.navigateToPage(0, i % book.content.chapters[0].pages.length);
          await renderedHandler();
        }

        await aiIllustrationService.cleanup();
        this.mockIpcRenderer.invoke.mockClear();
      }

      const finalMemory = performanceTestUtils.measureMemoryUsage();
      const memoryGrowth = finalMemory.used - initialMemory.used;
      
      if (memoryGrowth > 10 * 1024 * 1024) { // 10MB
        throw new Error(`Memory not properly cleaned up: ${Math.round(memoryGrowth / 1024 / 1024)}MB growth`);
      }
    });

    this.results.push(suite);
  }

  private async runErrorHandlingTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Error Handling',
      results: [],
      totalDuration: 0,
      passRate: 0
    };

    console.log('🛡️ Running Error Handling Tests...');

    // Test 1: API failure graceful degradation
    await this.runTest(suite, 'API failure graceful degradation', async () => {
      // Mock API failure
      this.mockIpcRenderer.invoke.mockImplementation(() => {
        return Promise.resolve({ success: false, error: 'API unavailable' });
      });

      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Should not throw error
      mockRendition.navigateToPage(0, 1);
      await renderedHandler();

      // Reset mock for other tests
      this.setupMocks();
      await aiIllustrationService.cleanup();
    });

    // Test 2: Network timeout handling
    await this.runTest(suite, 'Network timeout handling', async () => {
      // Mock network timeout
      this.mockIpcRenderer.invoke.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const mockRendition = createMockRendition(sampleEpubBook);
      await aiIllustrationService.initialize(mockRendition, sampleEpubBook.id);

      const renderedHandler = mockRendition.on.mock.calls.find(
        call => call[0] === 'rendered'
      )[1];

      // Should handle timeout gracefully
      mockRendition.navigateToPage(0, 1);
      await renderedHandler();

      // Reset mock for other tests
      this.setupMocks();
      await aiIllustrationService.cleanup();
    });

    this.results.push(suite);
  }

  private async runTest(suite: TestSuite, testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = performance.now();
    const startMemory = performanceTestUtils.measureMemoryUsage();
    
    try {
      await testFn();
      
      const endTime = performance.now();
      const endMemory = performanceTestUtils.measureMemoryUsage();
      
      const result: TestResult = {
        testName,
        passed: true,
        duration: endTime - startTime,
        memoryUsage: endMemory.used - startMemory.used,
        metrics: {
          apiCalls: this.mockIpcRenderer.invoke.mock.calls.length,
          cacheHits: 0, // Would be calculated from cache service
          averageResponseTime: 0 // Would be calculated from performance monitor
        }
      };
      
      suite.results.push(result);
      console.log(`  ✅ ${testName} (${Math.round(result.duration)}ms)`);
      
    } catch (error) {
      const endTime = performance.now();
      const endMemory = performanceTestUtils.measureMemoryUsage();
      
      const result: TestResult = {
        testName,
        passed: false,
        duration: endTime - startTime,
        memoryUsage: endMemory.used - startMemory.used,
        error: error instanceof Error ? error.message : String(error)
      };
      
      suite.results.push(result);
      console.log(`  ❌ ${testName} - ${result.error}`);
    }
    
    // Clear mocks between tests
    this.mockIpcRenderer.invoke.mockClear();
  }

  private printSummary(): void {
    console.log('\n📊 Test Results Summary');
    console.log('========================\n');

    let totalTests = 0;
    let totalPassed = 0;
    let totalDuration = 0;

    this.results.forEach(suite => {
      const passed = suite.results.filter(r => r.passed).length;
      const total = suite.results.length;
      const passRate = (passed / total) * 100;
      const suiteDuration = suite.results.reduce((sum, r) => sum + r.duration, 0);

      console.log(`${suite.suiteName}: ${passed}/${total} (${Math.round(passRate)}%) - ${Math.round(suiteDuration)}ms`);
      
      suite.results.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        const memory = result.memoryUsage > 0 ? ` (+${Math.round(result.memoryUsage / 1024)}KB)` : '';
        console.log(`  ${status} ${result.testName} (${Math.round(result.duration)}ms${memory})`);
        
        if (!result.passed && result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
      
      console.log('');
      
      totalTests += total;
      totalPassed += passed;
      totalDuration += suiteDuration;
    });

    const overallPassRate = (totalPassed / totalTests) * 100;
    
    console.log(`Overall: ${totalPassed}/${totalTests} tests passed (${Math.round(overallPassRate)}%)`);
    console.log(`Total Duration: ${Math.round(totalDuration)}ms`);
    
    if (overallPassRate === 100) {
      console.log('\n🎉 All tests passed! AI Book Illustrations system is ready for production.');
    } else {
      console.log(`\n⚠️  ${totalTests - totalPassed} tests failed. Please review and fix issues before deployment.`);
    }
  }
}

// Export for use in test files
export { IntegrationTestRunner };

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests().catch(console.error);
}