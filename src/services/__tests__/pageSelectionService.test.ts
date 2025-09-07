import { PageSelectionServiceImpl } from '../pageSelectionService';

describe('PageSelectionService', () => {
  let service: PageSelectionServiceImpl;

  beforeEach(() => {
    service = new PageSelectionServiceImpl();
  });

  describe('shouldProcessPage', () => {
    it('should process every second page based on counter % 2 === 1', () => {
      // First page (counter becomes 1) - should process
      expect(service.shouldProcessPage('location-1')).toBe(true);
      expect(service.getCurrentCounter()).toBe(1);

      // Second page (counter becomes 2) - should not process
      expect(service.shouldProcessPage('location-2')).toBe(false);
      expect(service.getCurrentCounter()).toBe(2);

      // Third page (counter becomes 3) - should process
      expect(service.shouldProcessPage('location-3')).toBe(true);
      expect(service.getCurrentCounter()).toBe(3);

      // Fourth page (counter becomes 4) - should not process
      expect(service.shouldProcessPage('location-4')).toBe(false);
      expect(service.getCurrentCounter()).toBe(4);
    });

    it('should not process already processed location keys', () => {
      // First call should process
      expect(service.shouldProcessPage('location-1')).toBe(true);
      
      // Second call with same location key should not process
      expect(service.shouldProcessPage('location-1')).toBe(false);
      
      // Counter should not increment for duplicate location keys
      expect(service.getCurrentCounter()).toBe(1);
    });

    it('should track processed location keys correctly', () => {
      service.shouldProcessPage('location-1'); // counter = 1, processed for illustration
      service.shouldProcessPage('location-2'); // counter = 2, not processed for illustration
      service.shouldProcessPage('location-3'); // counter = 3, processed for illustration

      const processedKeys = service.getProcessedLocationKeys();
      // All location keys are tracked to prevent duplicate work
      expect(processedKeys.has('location-1')).toBe(true);
      expect(processedKeys.has('location-2')).toBe(true);
      expect(processedKeys.has('location-3')).toBe(true);
    });
  });

  describe('incrementPageCounter', () => {
    it('should increment the page counter', () => {
      expect(service.getCurrentCounter()).toBe(0);
      
      service.incrementPageCounter();
      expect(service.getCurrentCounter()).toBe(1);
      
      service.incrementPageCounter();
      expect(service.getCurrentCounter()).toBe(2);
    });
  });

  describe('resetCounter', () => {
    it('should reset counter and clear processed location keys', () => {
      // Set up some state
      service.shouldProcessPage('location-1');
      service.shouldProcessPage('location-2');
      expect(service.getCurrentCounter()).toBe(2);
      expect(service.getProcessedLocationKeys().size).toBe(2);

      // Reset
      service.resetCounter();
      
      expect(service.getCurrentCounter()).toBe(0);
      expect(service.getProcessedLocationKeys().size).toBe(0);
    });
  });

  describe('isAlreadyProcessed', () => {
    it('should return false for unprocessed location keys', () => {
      expect(service.isAlreadyProcessed('location-1')).toBe(false);
    });

    it('should return true for processed location keys', () => {
      service.shouldProcessPage('location-1'); // This will process it
      expect(service.isAlreadyProcessed('location-1')).toBe(true);
    });

    it('should return true for all location keys that were encountered', () => {
      service.shouldProcessPage('location-1'); // counter = 1, processed for illustration
      service.shouldProcessPage('location-2'); // counter = 2, not processed for illustration but tracked
      
      expect(service.isAlreadyProcessed('location-1')).toBe(true);
      expect(service.isAlreadyProcessed('location-2')).toBe(true);
    });
  });

  describe('setCurrentBook', () => {
    it('should reset state when switching to a different book', () => {
      // Set up state for first book
      service.setCurrentBook('book-1');
      service.shouldProcessPage('location-1');
      service.shouldProcessPage('location-2');
      
      expect(service.getCurrentCounter()).toBe(2);
      expect(service.getProcessedLocationKeys().size).toBe(2);

      // Switch to different book
      service.setCurrentBook('book-2');
      
      expect(service.getCurrentCounter()).toBe(0);
      expect(service.getProcessedLocationKeys().size).toBe(0);
    });

    it('should not reset state when setting the same book ID', () => {
      // Set up state
      service.setCurrentBook('book-1');
      service.shouldProcessPage('location-1');
      service.shouldProcessPage('location-2');
      
      const counterBefore = service.getCurrentCounter();
      const processedBefore = service.getProcessedLocationKeys().size;

      // Set same book ID
      service.setCurrentBook('book-1');
      
      expect(service.getCurrentCounter()).toBe(counterBefore);
      expect(service.getProcessedLocationKeys().size).toBe(processedBefore);
    });
  });

  describe('deterministic behavior', () => {
    it('should produce consistent results for the same sequence of location keys', () => {
      const locationKeys = ['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5'];
      const results1: boolean[] = [];
      const results2: boolean[] = [];

      // First run
      locationKeys.forEach(key => {
        results1.push(service.shouldProcessPage(key));
      });

      // Reset and run again
      service.resetCounter();
      locationKeys.forEach(key => {
        results2.push(service.shouldProcessPage(key));
      });

      expect(results1).toEqual(results2);
      expect(results1).toEqual([true, false, true, false, true]);
    });

    it('should handle rapid page navigation correctly', () => {
      // Simulate rapid navigation where user might visit same pages multiple times
      expect(service.shouldProcessPage('page-1')).toBe(true);  // counter = 1, process
      expect(service.shouldProcessPage('page-2')).toBe(false); // counter = 2, skip
      expect(service.shouldProcessPage('page-1')).toBe(false); // already processed, no counter increment
      expect(service.shouldProcessPage('page-3')).toBe(true);  // counter = 3, process
      expect(service.shouldProcessPage('page-2')).toBe(false); // already seen, no counter increment
      expect(service.shouldProcessPage('page-3')).toBe(false); // already processed, no counter increment

      expect(service.getCurrentCounter()).toBe(3);
      expect(service.getProcessedLocationKeys().size).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty location keys', () => {
      expect(service.shouldProcessPage('')).toBe(true); // counter = 1, process
      expect(service.shouldProcessPage('')).toBe(false); // already processed
    });

    it('should handle very long location keys', () => {
      const longKey = 'a'.repeat(1000);
      expect(service.shouldProcessPage(longKey)).toBe(true);
      expect(service.isAlreadyProcessed(longKey)).toBe(true);
    });

    it('should handle special characters in location keys', () => {
      const specialKey = 'location-with-special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?';
      expect(service.shouldProcessPage(specialKey)).toBe(true);
      expect(service.isAlreadyProcessed(specialKey)).toBe(true);
    });
  });
});