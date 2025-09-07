import { MemoryCache } from '../memoryCache';
import { CachedIllustration } from '../../types/aiIllustration';

describe('MemoryCache LRU Eviction Tests', () => {
  let memoryCache: MemoryCache;

  beforeEach(() => {
    // Use a small cache size to test eviction
    memoryCache = new MemoryCache(0.001); // Very small cache (1KB) to force eviction
  });

  describe('LRU eviction behavior', () => {
    it('should evict least recently used items when cache is full', () => {
      const testData1: CachedIllustration = {
        status: 'completed',
        prompt: 'A'.repeat(500), // Large prompt to fill cache quickly
        imageBlobURL: 'blob:test-url-1',
        timestamp: Date.now()
      };

      const testData2: CachedIllustration = {
        status: 'completed',
        prompt: 'B'.repeat(500),
        imageBlobURL: 'blob:test-url-2',
        timestamp: Date.now()
      };

      const testData3: CachedIllustration = {
        status: 'completed',
        prompt: 'C'.repeat(500),
        imageBlobURL: 'blob:test-url-3',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book1', 'location2');
      const key3 = MemoryCache.generateKey('book1', 'location3');

      // Add items to cache
      memoryCache.set(key1, testData1);
      memoryCache.set(key2, testData2);
      
      // Access key1 to make it more recently used
      memoryCache.get(key1);
      
      // Add key3, which should evict key2 (least recently used)
      memoryCache.set(key3, testData3);

      // key1 should still exist (recently accessed)
      expect(memoryCache.get(key1)).toEqual(testData1);
      
      // key2 should be evicted
      expect(memoryCache.get(key2)).toBeNull();
      
      // key3 should exist (just added)
      expect(memoryCache.get(key3)).toEqual(testData3);
    });

    it('should update access time and count on get operations', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, testData);
      
      const initialStats = memoryCache.getStats();
      const initialEntry = initialStats.entries.find(e => e.key === key);
      const initialAccessCount = initialEntry!.accessCount;
      const initialLastAccessed = initialEntry!.lastAccessed;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        memoryCache.get(key);
        
        const updatedStats = memoryCache.getStats();
        const updatedEntry = updatedStats.entries.find(e => e.key === key);
        
        expect(updatedEntry!.accessCount).toBe(initialAccessCount + 1);
        expect(updatedEntry!.lastAccessed).toBeGreaterThan(initialLastAccessed);
      }, 10);
    });

    it('should prioritize recently accessed items during eviction', () => {
      // Use slightly larger cache for this test
      const largerCache = new MemoryCache(0.002); // 2KB
      
      const createTestData = (id: string): CachedIllustration => ({
        status: 'completed',
        prompt: `Test prompt ${id}`.repeat(20), // Make it reasonably sized
        imageBlobURL: `blob:test-url-${id}`,
        timestamp: Date.now()
      });

      const keys = ['key1', 'key2', 'key3', 'key4', 'key5'].map(k => 
        MemoryCache.generateKey('book1', k)
      );

      // Fill cache
      keys.forEach((key, index) => {
        largerCache.set(key, createTestData(index.toString()));
      });

      // Access some keys to make them recently used
      largerCache.get(keys[0]); // Most recent
      largerCache.get(keys[2]); // Second most recent
      
      // Add more items to force eviction
      const newKey1 = MemoryCache.generateKey('book1', 'new1');
      const newKey2 = MemoryCache.generateKey('book1', 'new2');
      
      largerCache.set(newKey1, createTestData('new1'));
      largerCache.set(newKey2, createTestData('new2'));

      // Recently accessed items should still be in cache
      expect(largerCache.get(keys[0])).not.toBeNull();
      expect(largerCache.get(keys[2])).not.toBeNull();
      
      // Some of the less recently used items should be evicted
      const remainingItems = keys.filter(key => largerCache.get(key) !== null);
      expect(remainingItems.length).toBeLessThan(keys.length);
    });

    it('should handle cache size estimation correctly', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      const initialStats = memoryCache.getStats();
      const initialSize = initialStats.estimatedSizeBytes;
      
      memoryCache.set(key, testData);
      
      const updatedStats = memoryCache.getStats();
      const updatedSize = updatedStats.estimatedSizeBytes;
      
      expect(updatedSize).toBeGreaterThan(initialSize);
    });

    it('should respect maximum cache size limits', () => {
      const maxSizeMB = 0.001; // 1KB
      const cache = new MemoryCache(maxSizeMB);
      
      const stats = cache.getStats();
      expect(stats.maxSizeBytes).toBe(maxSizeMB * 1024 * 1024);
    });
  });

  describe('eviction edge cases', () => {
    it('should handle eviction when cache has only one item', () => {
      const testData1: CachedIllustration = {
        status: 'completed',
        prompt: 'A'.repeat(1000), // Large enough to fill small cache
        imageBlobURL: 'blob:test-url-1',
        timestamp: Date.now()
      };

      const testData2: CachedIllustration = {
        status: 'completed',
        prompt: 'B'.repeat(1000),
        imageBlobURL: 'blob:test-url-2',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book1', 'location2');

      memoryCache.set(key1, testData1);
      memoryCache.set(key2, testData2); // Should evict key1

      expect(memoryCache.get(key1)).toBeNull();
      expect(memoryCache.get(key2)).toEqual(testData2);
    });

    it('should handle rapid additions and evictions', () => {
      const keys: string[] = [];
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'X'.repeat(200), // Medium sized data
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      // Rapidly add many items
      for (let i = 0; i < 20; i++) {
        const key = MemoryCache.generateKey('book1', `location${i}`);
        keys.push(key);
        memoryCache.set(key, { ...testData, prompt: `${testData.prompt}-${i}` });
      }

      const stats = memoryCache.getStats();
      
      // Should have evicted some items due to size constraints
      expect(stats.size).toBeLessThan(20);
      expect(stats.estimatedSizeBytes).toBeLessThanOrEqual(stats.maxSizeBytes);
    });

    it('should maintain cache integrity during concurrent operations', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const operations: Promise<void>[] = [];

      // Simulate concurrent set/get operations
      for (let i = 0; i < 10; i++) {
        const key = MemoryCache.generateKey('book1', `location${i}`);
        
        operations.push(
          new Promise<void>((resolve) => {
            memoryCache.set(key, { ...testData, prompt: `${testData.prompt}-${i}` });
            memoryCache.get(key);
            resolve();
          })
        );
      }

      return Promise.all(operations).then(() => {
        const stats = memoryCache.getStats();
        
        // Cache should be in a consistent state
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.entries.length).toBe(stats.size);
        
        // All entries should have valid data
        stats.entries.forEach(entry => {
          expect(entry.key).toBeTruthy();
          expect(entry.accessCount).toBeGreaterThan(0);
          expect(entry.timestamp).toBeGreaterThan(0);
          expect(entry.lastAccessed).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('memory management', () => {
    it('should free memory when items are evicted', () => {
      const largeData: CachedIllustration = {
        status: 'completed',
        prompt: 'A'.repeat(500),
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book1', 'location2');

      memoryCache.set(key1, largeData);
      const statsAfterFirst = memoryCache.getStats();
      
      memoryCache.set(key2, largeData); // Should evict key1
      const statsAfterSecond = memoryCache.getStats();

      // Size should not have doubled (indicating eviction occurred)
      expect(statsAfterSecond.estimatedSizeBytes).toBeLessThan(statsAfterFirst.estimatedSizeBytes * 2);
    });

    it('should handle delete operations correctly', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, testData);
      expect(memoryCache.has(key)).toBe(true);
      
      const deleted = memoryCache.delete(key);
      expect(deleted).toBe(true);
      expect(memoryCache.has(key)).toBe(false);
      expect(memoryCache.get(key)).toBeNull();
    });

    it('should return false when deleting non-existent keys', () => {
      const key = MemoryCache.generateKey('book1', 'nonexistent');
      
      const deleted = memoryCache.delete(key);
      expect(deleted).toBe(false);
    });
  });

  describe('statistics accuracy', () => {
    it('should provide accurate hit rate calculations', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      // Set item
      memoryCache.set(key, testData);
      
      // Perform some hits and misses
      memoryCache.get(key); // hit
      memoryCache.get(key); // hit
      memoryCache.get('nonexistent:key'); // miss
      memoryCache.get(key); // hit
      memoryCache.get('another:nonexistent'); // miss

      const stats = memoryCache.getStats();
      
      // Should have reasonable hit rate (3 hits out of 5 gets = 60%)
      expect(stats.hitRate).toBeCloseTo(0.6, 1);
    });

    it('should track access patterns correctly', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, testData);
      
      // Access multiple times
      for (let i = 0; i < 5; i++) {
        memoryCache.get(key);
      }

      const stats = memoryCache.getStats();
      const entry = stats.entries.find(e => e.key === key);
      
      expect(entry).toBeDefined();
      expect(entry!.accessCount).toBe(6); // 1 from set + 5 from gets
    });
  });
});