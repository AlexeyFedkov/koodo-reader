import { PageSelectionServiceImpl } from '../pageSelectionService';

describe('PageSelectionService Advanced Tests', () => {
  let service: PageSelectionServiceImpl;

  beforeEach(() => {
    service = new PageSelectionServiceImpl();
  });

  describe('deterministic page selection logic (Requirements 1.2, 6.3, 6.4)', () => {
    it('should maintain deterministic behavior across multiple book sessions', () => {
      // Test with book 1
      service.setCurrentBook('book1');
      
      const book1Results = [
        service.shouldProcessPage('book1-page1'), // counter=1, should process
        service.shouldProcessPage('book1-page2'), // counter=2, should not process
        service.shouldProcessPage('book1-page3'), // counter=3, should process
        service.shouldProcessPage('book1-page4'), // counter=4, should not process
        service.shouldProcessPage('book1-page5')  // counter=5, should process
      ];

      expect(book1Results).toEqual([true, false, true, false, true]);
      expect(service.getCurrentCounter()).toBe(5);

      // Switch to book 2 - should reset and start fresh
      service.setCurrentBook('book2');
      expect(service.getCurrentCounter()).toBe(0);

      const book2Results = [
        service.shouldProcessPage('book2-page1'), // counter=1, should process
        service.shouldProcessPage('book2-page2'), // counter=2, should not process
        service.shouldProcessPage('book2-page3')  // counter=3, should process
      ];

      expect(book2Results).toEqual([true, false, true]);
      expect(service.getCurrentCounter()).toBe(3);

      // Switch back to book 1 - should reset again
      service.setCurrentBook('book1');
      expect(service.getCurrentCounter()).toBe(0);
      
      // Should get same pattern as before
      const book1SecondSession = [
        service.shouldProcessPage('book1-page1-session2'), // counter=1, should process
        service.shouldProcessPage('book1-page2-session2')  // counter=2, should not process
      ];

      expect(book1SecondSession).toEqual([true, false]);
    });

    it('should handle complex navigation patterns correctly', () => {
      service.setCurrentBook('test-book');

      // Simulate user navigating forward and backward
      const navigationSequence = [
        'chapter1-page1',  // New location, counter=1, process
        'chapter1-page2',  // New location, counter=2, skip
        'chapter1-page1',  // Already seen, no counter increment, skip
        'chapter1-page3',  // New location, counter=3, process
        'chapter1-page2',  // Already seen, no counter increment, skip
        'chapter1-page4',  // New location, counter=4, skip
        'chapter1-page3',  // Already seen, no counter increment, skip
        'chapter1-page5'   // New location, counter=5, process
      ];

      const results = navigationSequence.map(location => 
        service.shouldProcessPage(location)
      );

      expect(results).toEqual([true, false, false, true, false, false, false, true]);
      expect(service.getCurrentCounter()).toBe(5); // Only 5 unique locations
      expect(service.getProcessedLocationKeys().size).toBe(5);
    });

    it('should handle rapid page changes without duplicate processing', () => {
      service.setCurrentBook('rapid-nav-book');

      // Simulate rapid navigation where user quickly flips through pages
      const rapidSequence = [];
      const expectedResults = [];

      for (let i = 1; i <= 20; i++) {
        rapidSequence.push(`page-${i}`);
        expectedResults.push(i % 2 === 1); // Every odd page should be processed
      }

      const results = rapidSequence.map(page => service.shouldProcessPage(page));

      expect(results).toEqual(expectedResults);
      expect(service.getCurrentCounter()).toBe(20);

      // Now simulate user going back to some pages
      const backtrackResults = [
        service.shouldProcessPage('page-5'),  // Already processed, should skip
        service.shouldProcessPage('page-10'), // Already processed, should skip
        service.shouldProcessPage('page-21')  // New page, counter=21, should process
      ];

      expect(backtrackResults).toEqual([false, false, true]);
      expect(service.getCurrentCounter()).toBe(21);
    });

    it('should maintain counter integrity during concurrent-like operations', () => {
      service.setCurrentBook('concurrent-test');

      // Simulate what might happen with rapid user interactions
      const operations = [];
      
      // Queue up a bunch of operations
      for (let i = 1; i <= 10; i++) {
        operations.push(() => service.shouldProcessPage(`location-${i}`));
      }

      // Execute them in sequence (simulating rapid calls)
      const results = operations.map(op => op());

      // Should maintain deterministic behavior
      expect(results).toEqual([true, false, true, false, true, false, true, false, true, false]);
      expect(service.getCurrentCounter()).toBe(10);
      expect(service.getProcessedLocationKeys().size).toBe(10);
    });
  });

  describe('location key tracking and duplicate prevention (Requirement 6.5)', () => {
    it('should prevent duplicate work for identical location keys', () => {
      service.setCurrentBook('duplicate-test');

      const locationKey = 'chapter1-section2-page5';

      // First encounter - should process
      expect(service.shouldProcessPage(locationKey)).toBe(true);
      expect(service.getCurrentCounter()).toBe(1);
      expect(service.isAlreadyProcessed(locationKey)).toBe(true);

      // Subsequent encounters - should not process
      for (let i = 0; i < 5; i++) {
        expect(service.shouldProcessPage(locationKey)).toBe(false);
        expect(service.getCurrentCounter()).toBe(1); // Counter should not increment
      }

      expect(service.getProcessedLocationKeys().size).toBe(1);
    });

    it('should track location keys with special characters and formats', () => {
      service.setCurrentBook('special-chars-test');

      const specialLocationKeys = [
        'chapter-1:section-2.5#page-10',
        'chapter_2/section_3?page=15&offset=100',
        'chapter 3 section 4 page 20',
        'chapter@4#section$5%page^25',
        'chapter[5]section{6}page(30)',
        'chapter|7\\section/8\\page\\35'
      ];

      const results = specialLocationKeys.map(key => service.shouldProcessPage(key));
      
      // Should follow normal pattern: odd positions (1,3,5) should be processed
      expect(results).toEqual([true, false, true, false, true, false]);
      
      // All keys should be tracked
      specialLocationKeys.forEach(key => {
        expect(service.isAlreadyProcessed(key)).toBe(true);
      });

      expect(service.getProcessedLocationKeys().size).toBe(6);
    });

    it('should handle very long location keys', () => {
      service.setCurrentBook('long-keys-test');

      const longLocationKey = 'chapter-' + 'a'.repeat(1000) + '-page-' + 'b'.repeat(1000);
      
      expect(service.shouldProcessPage(longLocationKey)).toBe(true);
      expect(service.isAlreadyProcessed(longLocationKey)).toBe(true);
      expect(service.shouldProcessPage(longLocationKey)).toBe(false); // Should not process again
    });

    it('should handle empty and null-like location keys', () => {
      service.setCurrentBook('edge-cases-test');

      const edgeCaseKeys = ['', '   ', '\n', '\t', '0', 'null', 'undefined'];
      
      const results = edgeCaseKeys.map(key => service.shouldProcessPage(key));
      
      // Should follow normal pattern
      expect(results).toEqual([true, false, true, false, true, false, true]);
      
      // All should be tracked
      edgeCaseKeys.forEach(key => {
        expect(service.isAlreadyProcessed(key)).toBe(true);
      });
    });
  });

  describe('book switching and state management', () => {
    it('should properly isolate state between different books', () => {
      // Set up state for book 1
      service.setCurrentBook('book-1');
      service.shouldProcessPage('book1-page1'); // counter=1, process
      service.shouldProcessPage('book1-page2'); // counter=2, skip
      service.shouldProcessPage('book1-page3'); // counter=3, process

      expect(service.getCurrentCounter()).toBe(3);
      expect(service.getProcessedLocationKeys().size).toBe(3);

      // Switch to book 2
      service.setCurrentBook('book-2');
      expect(service.getCurrentCounter()).toBe(0);
      expect(service.getProcessedLocationKeys().size).toBe(0);

      // Process some pages in book 2
      service.shouldProcessPage('book2-page1'); // counter=1, process
      service.shouldProcessPage('book2-page2'); // counter=2, skip

      expect(service.getCurrentCounter()).toBe(2);
      expect(service.getProcessedLocationKeys().size).toBe(2);

      // Switch back to book 1 - should reset (new session)
      service.setCurrentBook('book-1');
      expect(service.getCurrentCounter()).toBe(0);
      expect(service.getProcessedLocationKeys().size).toBe(0);

      // Should not remember previous book 1 state
      expect(service.isAlreadyProcessed('book1-page1')).toBe(false);
    });

    it('should handle book ID edge cases', () => {
      const edgeBookIds = ['', '   ', 'book with spaces', 'book-with-special-chars!@#$%'];
      
      edgeBookIds.forEach((bookId, index) => {
        service.setCurrentBook(bookId);
        expect(service.getCurrentCounter()).toBe(0);
        
        // Should work normally
        expect(service.shouldProcessPage(`page-${index}`)).toBe(true);
        expect(service.getCurrentCounter()).toBe(1);
      });
    });

    it('should handle same book ID set multiple times', () => {
      const bookId = 'consistent-book';
      
      service.setCurrentBook(bookId);
      service.shouldProcessPage('page1'); // counter=1, process
      service.shouldProcessPage('page2'); // counter=2, skip
      
      const counterBefore = service.getCurrentCounter();
      const processedBefore = service.getProcessedLocationKeys().size;

      // Set same book ID again
      service.setCurrentBook(bookId);
      
      // State should remain unchanged
      expect(service.getCurrentCounter()).toBe(counterBefore);
      expect(service.getProcessedLocationKeys().size).toBe(processedBefore);
      expect(service.isAlreadyProcessed('page1')).toBe(true);
      expect(service.isAlreadyProcessed('page2')).toBe(true);
    });
  });

  describe('performance and memory considerations', () => {
    it('should handle large numbers of location keys efficiently', () => {
      service.setCurrentBook('performance-test');

      const startTime = Date.now();
      const numPages = 10000;
      
      // Process many pages
      for (let i = 1; i <= numPages; i++) {
        service.shouldProcessPage(`page-${i}`);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(service.getCurrentCounter()).toBe(numPages);
      expect(service.getProcessedLocationKeys().size).toBe(numPages);
      
      // Should complete in reasonable time (less than 1 second for 10k operations)
      expect(processingTime).toBeLessThan(1000);

      // Test lookup performance
      const lookupStartTime = Date.now();
      
      for (let i = 1; i <= 1000; i++) {
        service.isAlreadyProcessed(`page-${i}`);
      }

      const lookupEndTime = Date.now();
      const lookupTime = lookupEndTime - lookupStartTime;
      
      // Lookups should be very fast
      expect(lookupTime).toBeLessThan(100);
    });

    it('should maintain memory efficiency with processed keys set', () => {
      service.setCurrentBook('memory-test');

      // Add many keys
      for (let i = 1; i <= 1000; i++) {
        service.shouldProcessPage(`page-${i}`);
      }

      const processedKeys = service.getProcessedLocationKeys();
      expect(processedKeys.size).toBe(1000);

      // Reset should clear memory
      service.resetCounter();
      expect(service.getProcessedLocationKeys().size).toBe(0);
      expect(service.getCurrentCounter()).toBe(0);
    });
  });

  describe('integration with book reading patterns', () => {
    it('should handle typical sequential reading pattern', () => {
      service.setCurrentBook('sequential-reading');

      // Simulate user reading through a book sequentially
      const pages = [];
      const expectedResults = [];
      
      for (let chapter = 1; chapter <= 5; chapter++) {
        for (let page = 1; page <= 10; page++) {
          const locationKey = `chapter-${chapter}-page-${page}`;
          pages.push(locationKey);
          
          // Every second page should be processed
          expectedResults.push((pages.length % 2) === 1);
        }
      }

      const results = pages.map(page => service.shouldProcessPage(page));
      
      expect(results).toEqual(expectedResults);
      expect(service.getCurrentCounter()).toBe(50); // 5 chapters * 10 pages
      
      // Count how many were processed for illustration
      const processedCount = results.filter(r => r).length;
      expect(processedCount).toBe(25); // Half of the pages
    });

    it('should handle bookmark jumping and random access', () => {
      service.setCurrentBook('random-access');

      // Simulate user jumping around via bookmarks
      const jumpSequence = [
        'chapter-5-page-10',  // counter=1, process
        'chapter-1-page-1',   // counter=2, skip
        'chapter-10-page-5',  // counter=3, process
        'chapter-3-page-7',   // counter=4, skip
        'chapter-5-page-10',  // already seen, skip
        'chapter-8-page-2',   // counter=5, process
        'chapter-1-page-1',   // already seen, skip
        'chapter-12-page-1'   // counter=6, skip
      ];

      const results = jumpSequence.map(location => service.shouldProcessPage(location));
      
      expect(results).toEqual([true, false, true, false, false, true, false, false]);
      expect(service.getCurrentCounter()).toBe(6); // 6 unique locations
      expect(service.getProcessedLocationKeys().size).toBe(6);
    });

    it('should handle search result navigation', () => {
      service.setCurrentBook('search-navigation');

      // Simulate user clicking through search results
      const searchResults = [
        'chapter-2-page-5-match-1',   // counter=1, process
        'chapter-7-page-12-match-2',  // counter=2, skip
        'chapter-2-page-5-match-1',   // already seen, skip
        'chapter-15-page-3-match-3',  // counter=3, process
        'chapter-7-page-12-match-2',  // already seen, skip
        'chapter-20-page-8-match-4'   // counter=4, skip
      ];

      const results = searchResults.map(location => service.shouldProcessPage(location));
      
      expect(results).toEqual([true, false, false, true, false, false]);
      expect(service.getCurrentCounter()).toBe(4); // 4 unique search result locations
    });
  });

  describe('error resilience', () => {
    it('should handle malformed location keys gracefully', () => {
      service.setCurrentBook('error-resilience');

      const malformedKeys = [
        null as any,
        undefined as any,
        123 as any,
        {} as any,
        [] as any,
        function() {} as any
      ];

      // Should not throw errors, should convert to strings
      malformedKeys.forEach((key, index) => {
        expect(() => service.shouldProcessPage(key)).not.toThrow();
        
        // Should track the stringified version
        const stringKey = String(key);
        expect(service.isAlreadyProcessed(stringKey)).toBe(true);
      });

      expect(service.getCurrentCounter()).toBe(malformedKeys.length);
    });

    it('should maintain consistency after errors', () => {
      service.setCurrentBook('consistency-test');

      // Process some normal pages
      service.shouldProcessPage('normal-page-1'); // counter=1, process
      service.shouldProcessPage('normal-page-2'); // counter=2, skip

      // Try some problematic operations
      try {
        service.shouldProcessPage(null as any);
        service.shouldProcessPage(undefined as any);
      } catch (error) {
        // Even if errors occur, service should remain functional
      }

      // Should still work normally
      expect(service.shouldProcessPage('normal-page-3')).toBe(true); // Should process based on counter
      expect(service.getCurrentCounter()).toBeGreaterThan(2);
      expect(service.getProcessedLocationKeys().size).toBeGreaterThan(2);
    });
  });
});