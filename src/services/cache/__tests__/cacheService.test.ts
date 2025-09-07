import { MemoryCache } from '../memoryCache';
import { CachedIllustration } from '../../types/aiIllustration';

describe('MemoryCache', () => {
  let memoryCache: MemoryCache;
  
  beforeEach(() => {
    memoryCache = new MemoryCache(10); // 10MB memory cache
  });

  describe('generateKey', () => {
    it('should generate correct cache key format', () => {
      const key = MemoryCache.generateKey('book123', 'chapter1:page5');
      expect(key).toBe('book123:chapter1:page5');
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve from memory cache', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, testData);
      const retrieved = memoryCache.get(key);
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = memoryCache.get('nonexistent:key');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      expect(memoryCache.has(key)).toBe(false);
      memoryCache.set(key, testData);
      expect(memoryCache.has(key)).toBe(true);
    });
  });

  describe('cache invalidation', () => {
    it('should clear cache for specific book', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book2', 'location1');
      
      memoryCache.set(key1, testData);
      memoryCache.set(key2, testData);
      
      memoryCache.clear('book1');
      
      const result1 = memoryCache.get(key1);
      const result2 = memoryCache.get(key2);
      
      expect(result1).toBeNull();
      expect(result2).toEqual(testData);
    });

    it('should clear all cache entries', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book2', 'location1');
      
      memoryCache.set(key1, testData);
      memoryCache.set(key2, testData);
      
      memoryCache.clear();
      
      const result1 = memoryCache.get(key1);
      const result2 = memoryCache.get(key2);
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should track access statistics', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, testData);
      
      // Access the item multiple times
      memoryCache.get(key);
      memoryCache.get(key);
      
      const stats = memoryCache.getStats();
      const entry = stats.entries.find(e => e.key === key);
      
      expect(entry).toBeDefined();
      expect(entry!.accessCount).toBe(3); // 1 from set + 2 from get
    });
  });

  describe('statistics', () => {
    it('should provide cache statistics', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book1', 'location2');
      
      memoryCache.set(key1, testData);
      memoryCache.set(key2, testData);
      
      const stats = memoryCache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
    });
  });
});