import { CachedIllustration, CacheService as ICacheService, ErrorCodes, AIIllustrationError } from '../types/aiIllustration';
import { MemoryCache } from './memoryCache';
import { PersistentCache } from './persistentCache';

export class CacheService implements ICacheService {
  private memoryCache: MemoryCache;
  private persistentCache: PersistentCache;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(maxMemorySizeMB: number = 50) {
    this.memoryCache = new MemoryCache(maxMemorySizeMB);
    this.persistentCache = new PersistentCache();
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      await this.persistentCache.initialize();
      this.initialized = true;
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to initialize cache service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        false
      );
    }
  }

  /**
   * Get cached illustration (checks memory first, then persistent storage)
   */
  async get(key: string): Promise<CachedIllustration | null> {
    await this.ensureInitialized();

    try {
      // Check memory cache first
      const memoryResult = this.memoryCache.get(key);
      if (memoryResult) {
        return memoryResult;
      }

      // Check persistent cache
      const persistentResult = await this.persistentCache.get(key);
      if (persistentResult) {
        // Populate memory cache for faster future access
        this.memoryCache.set(key, persistentResult);
        return persistentResult;
      }

      return null;
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to get from cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Set cached illustration (stores in both memory and persistent storage)
   */
  async set(key: string, data: CachedIllustration): Promise<void> {
    await this.ensureInitialized();

    try {
      // Store in memory cache immediately
      this.memoryCache.set(key, data);

      // Store in persistent cache asynchronously
      await this.persistentCache.set(key, data);
    } catch (error) {
      // If persistent storage fails, at least we have it in memory
      console.warn('Failed to store in persistent cache:', error);
      
      throw new AIIllustrationError(
        `Failed to set in cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Check memory first
      if (this.memoryCache.has(key)) {
        return true;
      }

      // Check persistent storage
      return await this.persistentCache.has(key);
    } catch (error) {
      console.warn('Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Delete specific key from both caches
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const memoryDeleted = this.memoryCache.delete(key);
      const persistentDeleted = await this.persistentCache.delete(key);
      
      return memoryDeleted || persistentDeleted;
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to delete from cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Clear all entries or entries for specific book
   */
  async clear(bookId?: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Clear from both caches
      this.memoryCache.clear(bookId);
      await this.persistentCache.clear(bookId);
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Hydrate memory cache from persistent storage for a specific book
   */
  async hydrateFromPersistent(bookId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const entries = await this.persistentCache.loadBookEntries(bookId);
      
      // Load entries into memory cache
      for (const [key, data] of entries.entries()) {
        this.memoryCache.set(key, data);
      }
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to hydrate cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Generate cache key from bookId and locationKey
   */
  generateKey(bookId: string, locationKey: string): string {
    return MemoryCache.generateKey(bookId, locationKey);
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<{
    memory: {
      size: number;
      maxSize: number;
      estimatedSizeBytes: number;
      maxSizeBytes: number;
      hitRate: number;
      entries: Array<{
        key: string;
        timestamp: number;
        accessCount: number;
        lastAccessed: number;
        status: string;
      }>;
    };
    persistent: {
      totalEntries: number;
      entriesByBook: Map<string, number>;
      oldestEntry: number | null;
      newestEntry: number | null;
      estimatedSizeBytes: number;
    };
    combined: {
      totalUniqueKeys: number;
      memoryHitRate: number;
      persistentHitRate: number;
    };
  }> {
    await this.ensureInitialized();

    try {
      const memoryStats = this.memoryCache.getStats();
      const persistentStats = await this.persistentCache.getStats();

      // Calculate combined statistics
      const memoryKeys = new Set(memoryStats.entries.map(e => e.key));
      const persistentKeys = new Set(Array.from(persistentStats.entriesByBook.keys()));
      const allKeys = new Set([...memoryKeys, ...persistentKeys]);

      const memoryHitRate = memoryKeys.size / allKeys.size;
      const persistentHitRate = persistentKeys.size / allKeys.size;

      return {
        memory: memoryStats,
        persistent: persistentStats,
        combined: {
          totalUniqueKeys: allKeys.size,
          memoryHitRate,
          persistentHitRate
        }
      };
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to get cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Invalidate cache entries based on criteria
   */
  async invalidate(criteria: {
    bookId?: string;
    olderThan?: number; // timestamp
    status?: 'generating' | 'completed' | 'error';
  }): Promise<number> {
    await this.ensureInitialized();

    let invalidatedCount = 0;

    try {
      if (criteria.bookId) {
        // Get all keys for the book
        const bookKeys = this.memoryCache.getBookKeys(criteria.bookId);
        
        for (const key of bookKeys) {
          const data = this.memoryCache.get(key);
          if (this.shouldInvalidate(data, criteria)) {
            await this.delete(key);
            invalidatedCount++;
          }
        }
      } else {
        // Check all entries in memory cache
        const stats = this.memoryCache.getStats();
        
        for (const entry of stats.entries) {
          const data = this.memoryCache.get(entry.key);
          if (this.shouldInvalidate(data, criteria)) {
            await this.delete(entry.key);
            invalidatedCount++;
          }
        }
      }

      return invalidatedCount;
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to invalidate cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Cleanup old or excessive cache entries
   */
  async cleanup(options: {
    maxAgeMs?: number;
    maxEntries?: number;
    maxSizeBytes?: number;
  } = {}): Promise<{
    memoryEvicted: number;
    persistentDeleted: number;
  }> {
    await this.ensureInitialized();

    try {
      const results = {
        memoryEvicted: 0,
        persistentDeleted: 0
      };

      // Cleanup persistent cache
      if (options.maxAgeMs) {
        results.persistentDeleted = await this.persistentCache.cleanup(
          options.maxAgeMs,
          options.maxEntries
        );
      }

      // Memory cache cleanup is handled automatically by LRU eviction
      // But we can force cleanup if needed
      if (options.maxSizeBytes || options.maxEntries) {
        const stats = this.memoryCache.getStats();
        
        if (options.maxSizeBytes && stats.estimatedSizeBytes > options.maxSizeBytes) {
          // Force eviction of some entries
          const targetEvictions = Math.ceil(stats.size * 0.2); // Evict 20%
          const entries = stats.entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
          
          for (let i = 0; i < Math.min(targetEvictions, entries.length); i++) {
            this.memoryCache.delete(entries[i].key);
            results.memoryEvicted++;
          }
        }
      }

      return results;
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to cleanup cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.CACHE_ERROR,
        true
      );
    }
  }

  /**
   * Get entries that are currently being generated
   */
  getGeneratingEntries(): Array<{ key: string; data: CachedIllustration }> {
    return this.memoryCache.getGeneratingEntries();
  }

  /**
   * Close cache service and cleanup resources
   */
  async close(): Promise<void> {
    try {
      this.persistentCache.close();
      this.memoryCache.clear();
      this.initialized = false;
      this.initializationPromise = null;
    } catch (error) {
      console.warn('Error closing cache service:', error);
    }
  }

  /**
   * Ensure cache service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Check if entry should be invalidated based on criteria
   */
  private shouldInvalidate(
    data: CachedIllustration | null,
    criteria: {
      olderThan?: number;
      status?: 'generating' | 'completed' | 'error';
    }
  ): boolean {
    if (!data) {
      return false;
    }

    if (criteria.olderThan && data.timestamp < criteria.olderThan) {
      return true;
    }

    if (criteria.status && data.status === criteria.status) {
      return true;
    }

    return false;
  }
}