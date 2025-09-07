import { CachedIllustration } from '../../types/aiIllustration';
import { MemoryCache } from '../memoryCache';

describe('CacheService Simple Tests', () => {
  let memoryCache: MemoryCache;

  beforeEach(() => {
    memoryCache = new MemoryCache(10); // 10MB memory cache
  });

  describe('key generation', () => {
    it('should generate consistent cache keys', () => {
      const bookId = 'book123';
      const locationKey = 'chapter1:page5';
      
      const key1 = MemoryCache.generateKey(bookId, locationKey);
      const key2 = MemoryCache.generateKey(bookId, locationKey);
      
      expect(key1).toBe(key2);
      expect(key1).toBe('book123:chapter1:page5');
    });

    it('should handle special characters in keys', () => {
      const bookId = 'book-with-special@chars';
      const locationKey = 'chapter#1:page$5';
      
      const key = MemoryCache.generateKey(bookId, locationKey);
      
      expect(key).toBe('book-with-special@chars:chapter#1:page$5');
    });

    it('should handle empty strings', () => {
      const key = MemoryCache.generateKey('', '');
      expect(key).toBe(':');
    });
  });

  describe('basic memory cache operations', () => {
    it('should store and retrieve data', () => {
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

    it('should delete entries', () => {
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
    });

    it('should return false when deleting non-existent keys', () => {
      const deleted = memoryCache.delete('nonexistent:key');
      expect(deleted).toBe(false);
    });
  });

  describe('cache clearing', () => {
    it('should clear all entries', () => {
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
      
      expect(memoryCache.get(key1)).toBeNull();
      expect(memoryCache.get(key2)).toBeNull();
    });

    it('should clear entries for specific book', () => {
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
      
      expect(memoryCache.get(key1)).toBeNull();
      expect(memoryCache.get(key2)).toEqual(testData);
    });
  });

  describe('statistics', () => {
    it('should provide basic statistics', () => {
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
      expect(stats.maxSizeBytes).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should track access counts', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, testData);
      memoryCache.get(key);
      memoryCache.get(key);
      
      const stats = memoryCache.getStats();
      const entry = stats.entries.find(e => e.key === key);
      
      expect(entry).toBeDefined();
      expect(entry!.accessCount).toBe(3); // 1 from set + 2 from gets
    });
  });

  describe('different cache statuses', () => {
    it('should handle generating status', () => {
      const generatingData: CachedIllustration = {
        status: 'generating',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, generatingData);
      const retrieved = memoryCache.get(key);
      
      expect(retrieved?.status).toBe('generating');
      expect(retrieved?.prompt).toBeUndefined();
      expect(retrieved?.imageBlobURL).toBeUndefined();
    });

    it('should handle error status', () => {
      const errorData: CachedIllustration = {
        status: 'error',
        error: 'API request failed',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, errorData);
      const retrieved = memoryCache.get(key);
      
      expect(retrieved?.status).toBe('error');
      expect(retrieved?.error).toBe('API request failed');
    });

    it('should handle completed status', () => {
      const completedData: CachedIllustration = {
        status: 'completed',
        prompt: 'Generated prompt',
        imageBlobURL: 'blob:image-data',
        timestamp: Date.now()
      };

      const key = MemoryCache.generateKey('book1', 'location1');
      
      memoryCache.set(key, completedData);
      const retrieved = memoryCache.get(key);
      
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.prompt).toBe('Generated prompt');
      expect(retrieved?.imageBlobURL).toBe('blob:image-data');
    });
  });

  describe('generating entries tracking', () => {
    it('should track entries that are currently being generated', () => {
      const generatingData: CachedIllustration = {
        status: 'generating',
        timestamp: Date.now()
      };

      const completedData: CachedIllustration = {
        status: 'completed',
        prompt: 'Done',
        imageBlobURL: 'blob:done',
        timestamp: Date.now()
      };

      const key1 = MemoryCache.generateKey('book1', 'location1');
      const key2 = MemoryCache.generateKey('book1', 'location2');
      
      memoryCache.set(key1, generatingData);
      memoryCache.set(key2, completedData);
      
      const generatingEntries = memoryCache.getGeneratingEntries();
      
      expect(generatingEntries).toHaveLength(1);
      expect(generatingEntries[0].key).toBe(key1);
      expect(generatingEntries[0].data.status).toBe('generating');
    });

    it('should return empty array when no entries are generating', () => {
      const generatingEntries = memoryCache.getGeneratingEntries();
      expect(generatingEntries).toHaveLength(0);
    });
  });

  describe('book key filtering', () => {
    it('should get keys for specific book', () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const book1Key1 = MemoryCache.generateKey('book1', 'location1');
      const book1Key2 = MemoryCache.generateKey('book1', 'location2');
      const book2Key1 = MemoryCache.generateKey('book2', 'location1');
      
      memoryCache.set(book1Key1, testData);
      memoryCache.set(book1Key2, testData);
      memoryCache.set(book2Key1, testData);
      
      const book1Keys = memoryCache.getBookKeys('book1');
      
      expect(book1Keys).toHaveLength(2);
      expect(book1Keys).toContain(book1Key1);
      expect(book1Keys).toContain(book1Key2);
      expect(book1Keys).not.toContain(book2Key1);
    });

    it('should return empty array for non-existent book', () => {
      const keys = memoryCache.getBookKeys('nonexistent-book');
      expect(keys).toHaveLength(0);
    });
  });
});