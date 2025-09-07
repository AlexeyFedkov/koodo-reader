import { CacheService } from '../cacheService';
import { CachedIllustration, AIIllustrationError, ErrorCodes } from '../../types/aiIllustration';
import { fail } from 'assert';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

// Mock the persistent cache
jest.mock('../persistentCache', () => {
  return {
    PersistentCache: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(undefined),
      loadBookEntries: jest.fn().mockResolvedValue(new Map()),
      getStats: jest.fn().mockResolvedValue({
        totalEntries: 0,
        entriesByBook: new Map(),
        oldestEntry: null,
        newestEntry: null,
        estimatedSizeBytes: 0
      }),
      cleanup: jest.fn().mockResolvedValue(0),
      close: jest.fn()
    }))
  };
});

describe('CacheService Integration Tests', () => {
  let cacheService: CacheService;
  let mockPersistentCache: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    cacheService = new CacheService(10); // 10MB memory cache
    
    // Get the mock instance and set up its methods
    const PersistentCacheMock = require('../persistentCache').PersistentCache;
    mockPersistentCache = PersistentCacheMock.mock.instances[PersistentCacheMock.mock.instances.length - 1];
    
    // Ensure all methods are properly mocked
    if (!mockPersistentCache.initialize) {
      mockPersistentCache.initialize = jest.fn().mockResolvedValue(undefined);
    }
    if (!mockPersistentCache.get) {
      mockPersistentCache.get = jest.fn().mockResolvedValue(null);
    }
    if (!mockPersistentCache.set) {
      mockPersistentCache.set = jest.fn().mockResolvedValue(undefined);
    }
    if (!mockPersistentCache.has) {
      mockPersistentCache.has = jest.fn().mockResolvedValue(false);
    }
    if (!mockPersistentCache.delete) {
      mockPersistentCache.delete = jest.fn().mockResolvedValue(true);
    }
    if (!mockPersistentCache.clear) {
      mockPersistentCache.clear = jest.fn().mockResolvedValue(undefined);
    }
    if (!mockPersistentCache.loadBookEntries) {
      mockPersistentCache.loadBookEntries = jest.fn().mockResolvedValue(new Map());
    }
    if (!mockPersistentCache.getStats) {
      mockPersistentCache.getStats = jest.fn().mockResolvedValue({
        totalEntries: 0,
        entriesByBook: new Map(),
        oldestEntry: null,
        newestEntry: null,
        estimatedSizeBytes: 0
      });
    }
    if (!mockPersistentCache.cleanup) {
      mockPersistentCache.cleanup = jest.fn().mockResolvedValue(0);
    }
    if (!mockPersistentCache.close) {
      mockPersistentCache.close = jest.fn();
    }
  });

  afterEach(async () => {
    await cacheService.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await cacheService.initialize();
      
      expect(mockPersistentCache.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockPersistentCache.initialize.mockRejectedValueOnce(new Error('DB initialization failed'));

      await expect(cacheService.initialize()).rejects.toThrow(AIIllustrationError);
      await expect(cacheService.initialize()).rejects.toThrow('Failed to initialize cache service');
    });

    it('should not initialize multiple times', async () => {
      await cacheService.initialize();
      await cacheService.initialize();
      
      expect(mockPersistentCache.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent initialization', async () => {
      const promise1 = cacheService.initialize();
      const promise2 = cacheService.initialize();
      
      await Promise.all([promise1, promise2]);
      
      expect(mockPersistentCache.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('dual-tier caching', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should check memory cache first, then persistent cache', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';
      
      // Mock persistent cache to return data
      mockPersistentCache.get.mockResolvedValueOnce(testData);

      const result = await cacheService.get(key);

      expect(result).toEqual(testData);
      expect(mockPersistentCache.get).toHaveBeenCalledWith(key);
    });

    it('should populate memory cache when retrieving from persistent cache', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';
      
      // Mock persistent cache to return data on first call
      mockPersistentCache.get.mockResolvedValueOnce(testData);

      // First call should hit persistent cache
      const result1 = await cacheService.get(key);
      expect(result1).toEqual(testData);
      expect(mockPersistentCache.get).toHaveBeenCalledTimes(1);

      // Second call should hit memory cache (persistent cache not called again)
      mockPersistentCache.get.mockClear();
      const result2 = await cacheService.get(key);
      expect(result2).toEqual(testData);
      expect(mockPersistentCache.get).not.toHaveBeenCalled();
    });

    it('should store in both memory and persistent cache', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';
      
      await cacheService.set(key, testData);

      expect(mockPersistentCache.set).toHaveBeenCalledWith(key, testData);
      
      // Should be available in memory cache immediately
      const result = await cacheService.get(key);
      expect(result).toEqual(testData);
    });

    it('should handle persistent cache failures gracefully during set', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';
      
      mockPersistentCache.set.mockRejectedValueOnce(new Error('Persistent storage failed'));

      await expect(cacheService.set(key, testData)).rejects.toThrow(AIIllustrationError);
      
      // Should still be available in memory cache
      const result = await cacheService.get(key);
      expect(result).toEqual(testData);
    });
  });

  describe('cache hydration', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should hydrate memory cache from persistent storage', async () => {
      const bookId = 'book1';
      const testEntries = new Map([
        ['book1:location1', {
          status: 'completed' as const,
          prompt: 'Test prompt 1',
          imageBlobURL: 'blob:test-url-1',
          timestamp: Date.now()
        }],
        ['book1:location2', {
          status: 'completed' as const,
          prompt: 'Test prompt 2',
          imageBlobURL: 'blob:test-url-2',
          timestamp: Date.now()
        }]
      ]);

      mockPersistentCache.loadBookEntries.mockResolvedValueOnce(testEntries);

      await cacheService.hydrateFromPersistent(bookId);

      expect(mockPersistentCache.loadBookEntries).toHaveBeenCalledWith(bookId);
      
      // Entries should now be available in memory cache
      for (const [key, data] of testEntries) {
        const result = await cacheService.get(key);
        expect(result).toEqual(data);
      }
    });

    it('should handle hydration errors', async () => {
      const bookId = 'book1';
      
      mockPersistentCache.loadBookEntries.mockRejectedValueOnce(new Error('Hydration failed'));

      await expect(cacheService.hydrateFromPersistent(bookId)).rejects.toThrow(AIIllustrationError);
      await expect(cacheService.hydrateFromPersistent(bookId)).rejects.toThrow('Failed to hydrate cache');
    });
  });

  describe('cache cleanup and invalidation', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should clear both memory and persistent cache', async () => {
      const bookId = 'book1';
      
      await cacheService.clear(bookId);

      expect(mockPersistentCache.clear).toHaveBeenCalledWith(bookId);
    });

    it('should delete from both caches', async () => {
      const key = 'book1:location1';
      
      await cacheService.delete(key);

      expect(mockPersistentCache.delete).toHaveBeenCalledWith(key);
    });

    it('should invalidate entries based on criteria', async () => {
      const testData1: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt 1',
        imageBlobURL: 'blob:test-url-1',
        timestamp: Date.now() - 10000 // 10 seconds ago
      };

      const testData2: CachedIllustration = {
        status: 'error',
        prompt: 'Test prompt 2',
        imageBlobURL: undefined,
        timestamp: Date.now()
      };

      const key1 = 'book1:location1';
      const key2 = 'book1:location2';
      
      await cacheService.set(key1, testData1);
      await cacheService.set(key2, testData2);

      // Invalidate error entries
      const invalidatedCount = await cacheService.invalidate({
        status: 'error'
      });

      expect(invalidatedCount).toBe(1);
      
      // Error entry should be gone
      const result1 = await cacheService.get(key1);
      const result2 = await cacheService.get(key2);
      
      expect(result1).toEqual(testData1); // Should still exist
      expect(result2).toBeNull(); // Should be invalidated
    });

    it('should cleanup old entries', async () => {
      const maxAgeMs = 5000; // 5 seconds
      const maxEntries = 10;
      
      const cleanupResult = await cacheService.cleanup({
        maxAgeMs,
        maxEntries
      });

      expect(mockPersistentCache.cleanup).toHaveBeenCalledWith(maxAgeMs, maxEntries);
      expect(cleanupResult).toHaveProperty('memoryEvicted');
      expect(cleanupResult).toHaveProperty('persistentDeleted');
    });
  });

  describe('cache statistics', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should provide comprehensive cache statistics', async () => {
      const mockMemoryStats = {
        size: 2,
        maxSize: 100,
        estimatedSizeBytes: 1024,
        maxSizeBytes: 10485760,
        hitRate: 0.8,
        entries: [
          {
            key: 'book1:location1',
            timestamp: Date.now(),
            accessCount: 3,
            lastAccessed: Date.now(),
            status: 'completed'
          }
        ]
      };

      const mockPersistentStats = {
        totalEntries: 5,
        entriesByBook: new Map([['book1', 3], ['book2', 2]]),
        oldestEntry: Date.now() - 86400000,
        newestEntry: Date.now(),
        estimatedSizeBytes: 5120
      };

      // Mock the memory cache stats
      const memoryCache = (cacheService as any).memoryCache;
      memoryCache.getStats = jest.fn().mockReturnValue(mockMemoryStats);
      
      mockPersistentCache.getStats.mockResolvedValueOnce(mockPersistentStats);

      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty('memory', mockMemoryStats);
      expect(stats).toHaveProperty('persistent', mockPersistentStats);
      expect(stats).toHaveProperty('combined');
      expect(stats.combined).toHaveProperty('totalUniqueKeys');
      expect(stats.combined).toHaveProperty('memoryHitRate');
      expect(stats.combined).toHaveProperty('persistentHitRate');
    });

    it('should handle stats errors gracefully', async () => {
      mockPersistentCache.getStats.mockRejectedValueOnce(new Error('Stats error'));

      await expect(cacheService.getStats()).rejects.toThrow(AIIllustrationError);
      await expect(cacheService.getStats()).rejects.toThrow('Failed to get cache stats');
    });
  });

  describe('key generation', () => {
    it('should generate consistent cache keys', () => {
      const bookId = 'book123';
      const locationKey = 'chapter1:page5';
      
      const key = cacheService.generateKey(bookId, locationKey);
      
      expect(key).toBe('book123:chapter1:page5');
    });
  });

  describe('generating entries tracking', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should track entries that are currently being generated', async () => {
      const testData: CachedIllustration = {
        status: 'generating',
        timestamp: Date.now()
      };

      const key = 'book1:location1';
      
      await cacheService.set(key, testData);

      const generatingEntries = cacheService.getGeneratingEntries();
      
      expect(generatingEntries).toHaveLength(1);
      expect(generatingEntries[0].key).toBe(key);
      expect(generatingEntries[0].data.status).toBe('generating');
    });
  });

  describe('error handling', () => {
    it('should handle cache errors with proper error codes', async () => {
      mockPersistentCache.initialize.mockRejectedValueOnce(new Error('DB error'));

      try {
        await cacheService.initialize();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AIIllustrationError);
        expect((error as AIIllustrationError).code).toBe(ErrorCodes.CACHE_ERROR);
      }
    });

    it('should handle get operation errors', async () => {
      await cacheService.initialize();
      
      mockPersistentCache.get.mockRejectedValueOnce(new Error('Get error'));

      await expect(cacheService.get('test:key')).rejects.toThrow(AIIllustrationError);
    });

    it('should handle has operation errors gracefully', async () => {
      await cacheService.initialize();
      
      mockPersistentCache.has.mockRejectedValueOnce(new Error('Has error'));

      const result = await cacheService.has('test:key');
      
      expect(result).toBe(false); // Should return false on error
    });
  });

  describe('resource cleanup', () => {
    it('should cleanup resources on close', async () => {
      await cacheService.initialize();
      
      await cacheService.close();

      expect(mockPersistentCache.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      await cacheService.initialize();
      
      mockPersistentCache.close.mockImplementationOnce(() => {
        throw new Error('Close error');
      });

      // Should not throw
      await expect(cacheService.close()).resolves.toBeUndefined();
    });
  });
});