import { CachedIllustration } from '../types/aiIllustration';

interface CacheEntry {
  data: CachedIllustration;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxSizeBytes: number;

  constructor(maxSizeMB: number = 50) {
    this.maxSize = 100; // Maximum number of entries
    this.maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  }

  /**
   * Generate cache key from bookId and locationKey
   */
  static generateKey(bookId: string, locationKey: string): string {
    // If locationKey already starts with bookId, don't duplicate it
    if (locationKey.startsWith(`${bookId}:`)) {
      return locationKey;
    }
    return `${bookId}:${locationKey}`;
  }

  /**
   * Get cached illustration
   */
  get(key: string): CachedIllustration | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    return entry.data;
  }

  /**
   * Set cached illustration with LRU eviction
   */
  set(key: string, data: CachedIllustration): void {
    const now = Date.now();
    const entry: CacheEntry = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    };

    // If key already exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, entry);
      return;
    }

    // Check if we need to evict entries
    this.evictIfNecessary();

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries or entries for specific book
   */
  clear(bookId?: string): void {
    if (!bookId) {
      this.cache.clear();
      return;
    }

    // Clear entries for specific book
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${bookId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
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
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      status: entry.data.status
    }));

    const estimatedSizeBytes = this.estimateCacheSize();
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? (totalAccesses - entries.length) / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      estimatedSizeBytes,
      maxSizeBytes: this.maxSizeBytes,
      hitRate,
      entries
    };
  }

  /**
   * Evict entries using LRU strategy when cache exceeds limits
   */
  private evictIfNecessary(): void {
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLRUEntries(Math.ceil(this.maxSize * 0.1)); // Evict 10% of entries
    }

    // Check memory limit
    const estimatedSize = this.estimateCacheSize();
    if (estimatedSize >= this.maxSizeBytes) {
      this.evictLRUEntries(Math.ceil(this.maxSize * 0.2)); // Evict 20% of entries for memory pressure
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRUEntries(count: number): void {
    // Sort entries by last accessed time (oldest first)
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove the oldest entries
    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      const [key] = sortedEntries[i];
      this.cache.delete(key);
    }
  }

  /**
   * Estimate cache size in bytes (rough approximation)
   */
  private estimateCacheSize(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Key size
      totalSize += key.length * 2; // UTF-16 characters

      // Entry metadata size
      totalSize += 32; // timestamp, accessCount, lastAccessed

      // Data size estimation
      const data = entry.data;
      if (data.prompt) {
        totalSize += data.prompt.length * 2;
      }
      if (data.imageBlobURL) {
        // Rough estimation: blob URLs are typically base64 encoded images
        // Base64 adds ~33% overhead, so we estimate original size
        totalSize += data.imageBlobURL.length * 0.75;
      }
      if (data.error) {
        totalSize += data.error.length * 2;
      }
      totalSize += 16; // status string and timestamp
    }

    return totalSize;
  }

  /**
   * Get all keys for a specific book
   */
  getBookKeys(bookId: string): string[] {
    const keys: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${bookId}:`)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Get entries that are currently generating
   */
  getGeneratingEntries(): Array<{ key: string; data: CachedIllustration }> {
    const generating: Array<{ key: string; data: CachedIllustration }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.data.status === 'generating') {
        generating.push({ key, data: entry.data });
      }
    }

    return generating;
  }
}