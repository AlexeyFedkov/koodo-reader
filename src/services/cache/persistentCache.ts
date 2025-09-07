import { CachedIllustration } from '../types/aiIllustration';

interface IndexedDBEntry {
  key: string;
  bookId: string;
  locationKey: string;
  data: CachedIllustration;
  createdAt: number;
  updatedAt: number;
}

export class PersistentCache {
  private dbName = 'KoodoAIIllustrations';
  private dbVersion = 1;
  private storeName = 'illustrations';
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          
          // Create indexes for efficient querying
          store.createIndex('bookId', 'bookId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Get cached illustration from IndexedDB
   */
  async get(key: string): Promise<CachedIllustration | null> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => {
        reject(new Error(`Failed to get from IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const result = request.result as IndexedDBEntry | undefined;
        resolve(result ? result.data : null);
      };
    });
  }

  /**
   * Set cached illustration in IndexedDB
   */
  async set(key: string, data: CachedIllustration): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const [bookId, locationKey] = this.parseKey(key);
    const now = Date.now();

    const entry: IndexedDBEntry = {
      key,
      bookId,
      locationKey,
      data,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Check if entry exists to set correct createdAt
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => {
        const existing = getRequest.result as IndexedDBEntry | undefined;
        if (existing) {
          entry.createdAt = existing.createdAt;
        }

        const putRequest = store.put(entry);
        
        putRequest.onerror = () => {
          reject(new Error(`Failed to set in IndexedDB: ${putRequest.error?.message}`));
        };

        putRequest.onsuccess = () => {
          resolve();
        };
      };

      getRequest.onerror = () => {
        reject(new Error(`Failed to check existing entry: ${getRequest.error?.message}`));
      };
    });
  }

  /**
   * Check if key exists in IndexedDB
   */
  async has(key: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count(key);

      request.onerror = () => {
        reject(new Error(`Failed to check key in IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result > 0);
      };
    });
  }

  /**
   * Delete specific key from IndexedDB
   */
  async delete(key: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        reject(new Error(`Failed to delete from IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(true);
      };
    });
  }

  /**
   * Clear all entries or entries for specific book
   */
  async clear(bookId?: string): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      if (!bookId) {
        // Clear all entries
        const request = store.clear();
        
        request.onerror = () => {
          reject(new Error(`Failed to clear IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve();
        };
      } else {
        // Clear entries for specific book
        const index = store.index('bookId');
        const request = index.openCursor(IDBKeyRange.only(bookId));
        const keysToDelete: string[] = [];

        request.onerror = () => {
          reject(new Error(`Failed to query IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            keysToDelete.push(cursor.value.key);
            cursor.continue();
          } else {
            // Delete all collected keys
            this.deleteKeys(keysToDelete).then(resolve).catch(reject);
          }
        };
      }
    });
  }

  /**
   * Load all cached illustrations for a specific book (for cache hydration)
   */
  async loadBookEntries(bookId: string): Promise<Map<string, CachedIllustration>> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('bookId');
      const request = index.openCursor(IDBKeyRange.only(bookId));
      
      const entries = new Map<string, CachedIllustration>();

      request.onerror = () => {
        reject(new Error(`Failed to load book entries: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as IndexedDBEntry;
          entries.set(entry.key, entry.data);
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    entriesByBook: Map<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
    estimatedSizeBytes: number;
  }> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      
      let totalEntries = 0;
      const entriesByBook = new Map<string, number>();
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;
      let estimatedSizeBytes = 0;

      request.onerror = () => {
        reject(new Error(`Failed to get stats: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as IndexedDBEntry;
          
          totalEntries++;
          
          // Count by book
          const bookCount = entriesByBook.get(entry.bookId) || 0;
          entriesByBook.set(entry.bookId, bookCount + 1);
          
          // Track oldest/newest
          if (oldestEntry === null || entry.createdAt < oldestEntry) {
            oldestEntry = entry.createdAt;
          }
          if (newestEntry === null || entry.createdAt > newestEntry) {
            newestEntry = entry.createdAt;
          }
          
          // Estimate size
          estimatedSizeBytes += this.estimateEntrySize(entry);
          
          cursor.continue();
        } else {
          resolve({
            totalEntries,
            entriesByBook,
            oldestEntry,
            newestEntry,
            estimatedSizeBytes
          });
        }
      };
    });
  }

  /**
   * Cleanup old entries based on age or size limits
   */
  async cleanup(maxAgeMs: number, maxEntries?: number): Promise<number> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const cutoffTime = Date.now() - maxAgeMs;
    const keysToDelete: string[] = [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('createdAt');
      const request = index.openCursor();

      request.onerror = () => {
        reject(new Error(`Failed to cleanup: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as IndexedDBEntry;
          
          // Mark old entries for deletion
          if (entry.createdAt < cutoffTime) {
            keysToDelete.push(entry.key);
          }
          
          cursor.continue();
        } else {
          // If maxEntries is specified and we still have too many, delete oldest
          if (maxEntries && keysToDelete.length < (keysToDelete.length - maxEntries)) {
            // This would require another query to get total count and sort by age
            // For now, just delete the old entries we found
          }
          
          this.deleteKeys(keysToDelete)
            .then(() => resolve(keysToDelete.length))
            .catch(reject);
        }
      };
    });
  }

  /**
   * Close IndexedDB connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Parse cache key into bookId and locationKey
   */
  private parseKey(key: string): [string, string] {
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid cache key format: ${key}`);
    }
    
    return [
      key.substring(0, colonIndex),
      key.substring(colonIndex + 1)
    ];
  }

  /**
   * Delete multiple keys
   */
  private async deleteKeys(keys: string[]): Promise<void> {
    if (!this.db || keys.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      let completed = 0;
      let hasError = false;

      const onComplete = () => {
        completed++;
        if (completed === keys.length && !hasError) {
          resolve();
        }
      };

      const onError = (error: any) => {
        if (!hasError) {
          hasError = true;
          reject(new Error(`Failed to delete keys: ${error?.message}`));
        }
      };

      keys.forEach(key => {
        const request = store.delete(key);
        request.onsuccess = onComplete;
        request.onerror = () => onError(request.error);
      });
    });
  }

  /**
   * Estimate size of an IndexedDB entry in bytes
   */
  private estimateEntrySize(entry: IndexedDBEntry): number {
    let size = 0;
    
    // Key and metadata
    size += entry.key.length * 2;
    size += entry.bookId.length * 2;
    size += entry.locationKey.length * 2;
    size += 24; // createdAt, updatedAt, timestamp
    
    // Data content
    const data = entry.data;
    if (data.prompt) {
      size += data.prompt.length * 2;
    }
    if (data.imageBlobURL) {
      size += data.imageBlobURL.length * 0.75; // Estimate for base64
    }
    if (data.error) {
      size += data.error.length * 2;
    }
    size += 16; // status and other fields
    
    return size;
  }
}