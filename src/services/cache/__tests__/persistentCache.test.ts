import { PersistentCache } from '../persistentCache';
import { CachedIllustration, AIIllustrationError, ErrorCodes } from '../../types/aiIllustration';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(),
  oncomplete: null,
  onerror: null,
  onabort: null
};

const mockObjectStore = {
  add: jest.fn(),
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  getAll: jest.fn(),
  getAllKeys: jest.fn(),
  count: jest.fn(),
  openCursor: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn()
};

const mockDatabase = {
  transaction: jest.fn().mockReturnValue(mockTransaction),
  createObjectStore: jest.fn().mockReturnValue(mockObjectStore),
  deleteObjectStore: jest.fn(),
  close: jest.fn(),
  version: 1,
  objectStoreNames: { contains: jest.fn().mockReturnValue(true) }
};

const mockRequest = {
  result: mockDatabase,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null
};

// Mock global IndexedDB
Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

describe('PersistentCache IndexedDB Tests', () => {
  let persistentCache: PersistentCache;

  beforeEach(() => {
    jest.clearAllMocks();
    persistentCache = new PersistentCache();
    
    // Setup default mock behavior
    mockIndexedDB.open.mockReturnValue(mockRequest);
    mockTransaction.objectStore.mockReturnValue(mockObjectStore);
  });

  afterEach(() => {
    persistentCache.close();
  });

  describe('initialization', () => {
    it('should initialize IndexedDB successfully', async () => {
      // Simulate successful database opening
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);

      await expect(persistentCache.initialize()).resolves.toBeUndefined();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('AIIllustrationCache', 1);
    });

    it('should handle database opening errors', async () => {
      const error = new Error('Database opening failed');
      
      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.onerror({ target: { error } } as any);
        }
      }, 0);

      await expect(persistentCache.initialize()).rejects.toThrow(AIIllustrationError);
      await expect(persistentCache.initialize()).rejects.toThrow('Failed to initialize persistent cache');
    });

    it('should handle database upgrade', async () => {
      setTimeout(() => {
        if (mockRequest.onupgradeneeded) {
          mockRequest.onupgradeneeded({ target: { result: mockDatabase } } as any);
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);

      await persistentCache.initialize();

      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('illustrations', { keyPath: 'key' });
    });

    it('should not initialize multiple times', async () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);

      await persistentCache.initialize();
      await persistentCache.initialize();

      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);
      
      await persistentCache.initialize();
    });

    it('should store data successfully', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';

      // Mock successful transaction
      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const setPromise = persistentCache.set(key, testData);

      // Simulate successful put operation
      setTimeout(() => {
        if (putRequest.onsuccess) {
          putRequest.onsuccess({} as any);
        }
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete({} as any);
        }
      }, 0);

      await expect(setPromise).resolves.toBeUndefined();
      
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        key,
        data: testData,
        bookId: 'book1',
        timestamp: testData.timestamp
      });
    });

    it('should retrieve data successfully', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';

      // Mock successful get operation
      const getRequest = { 
        result: { key, data: testData, bookId: 'book1', timestamp: testData.timestamp },
        onsuccess: null, 
        onerror: null 
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = persistentCache.get(key);

      // Simulate successful get operation
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess({ target: getRequest } as any);
        }
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete({} as any);
        }
      }, 0);

      const result = await getPromise;
      
      expect(result).toEqual(testData);
      expect(mockObjectStore.get).toHaveBeenCalledWith(key);
    });

    it('should return null for non-existent keys', async () => {
      const key = 'nonexistent:key';

      // Mock get operation returning undefined
      const getRequest = { 
        result: undefined,
        onsuccess: null, 
        onerror: null 
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = persistentCache.get(key);

      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess({ target: getRequest } as any);
        }
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete({} as any);
        }
      }, 0);

      const result = await getPromise;
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'book1:location1';

      // Mock get operation returning data
      const getRequest = { 
        result: { key, data: {}, bookId: 'book1', timestamp: Date.now() },
        onsuccess: null, 
        onerror: null 
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const hasPromise = persistentCache.has(key);

      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess({ target: getRequest } as any);
        }
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete({} as any);
        }
      }, 0);

      const result = await hasPromise;
      expect(result).toBe(true);
    });

    it('should delete data successfully', async () => {
      const key = 'book1:location1';

      // Mock successful delete operation
      const deleteRequest = { onsuccess: null, onerror: null };
      mockObjectStore.delete.mockReturnValue(deleteRequest);

      const deletePromise = persistentCache.delete(key);

      setTimeout(() => {
        if (deleteRequest.onsuccess) {
          deleteRequest.onsuccess({} as any);
        }
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete({} as any);
        }
      }, 0);

      const result = await deletePromise;
      
      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith(key);
    });

    it('should clear all data', async () => {
      // Mock successful clear operation
      const clearRequest = { onsuccess: null, onerror: null };
      mockObjectStore.clear.mockReturnValue(clearRequest);

      const clearPromise = persistentCache.clear();

      setTimeout(() => {
        if (clearRequest.onsuccess) {
          clearRequest.onsuccess({} as any);
        }
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete({} as any);
        }
      }, 0);

      await expect(clearPromise).resolves.toBeUndefined();
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });

    it('should clear data for specific book', async () => {
      const bookId = 'book1';

      // Mock cursor for book-specific clearing
      const mockCursor = {
        value: { key: 'book1:location1', bookId: 'book1' },
        delete: jest.fn(),
        continue: jest.fn()
      };

      const cursorRequest = { 
        result: mockCursor,
        onsuccess: null, 
        onerror: null 
      };
      
      mockObjectStore.openCursor.mockReturnValue(cursorRequest);

      const clearPromise = persistentCache.clear(bookId);

      setTimeout(() => {
        if (cursorRequest.onsuccess) {
          // First call - cursor with data
          cursorRequest.onsuccess({ target: cursorRequest } as any);
          
          // Simulate cursor.continue() leading to end
          setTimeout(() => {
            cursorRequest.result = null;
            if (cursorRequest.onsuccess) {
              cursorRequest.onsuccess({ target: cursorRequest } as any);
            }
            if (mockTransaction.oncomplete) {
              mockTransaction.oncomplete({} as any);
            }
          }, 0);
        }
      }, 0);

      await expect(clearPromise).resolves.toBeUndefined();
      expect(mockCursor.delete).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);
      
      await persistentCache.initialize();
    });

    it('should handle transaction errors during set', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';
      const error = new Error('Transaction failed');

      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const setPromise = persistentCache.set(key, testData);

      setTimeout(() => {
        if (mockTransaction.onerror) {
          mockTransaction.onerror({ target: { error } } as any);
        }
      }, 0);

      await expect(setPromise).rejects.toThrow(AIIllustrationError);
      await expect(setPromise).rejects.toThrow('Failed to store in persistent cache');
    });

    it('should handle request errors during get', async () => {
      const key = 'book1:location1';
      const error = new Error('Get request failed');

      const getRequest = { 
        result: null,
        error,
        onsuccess: null, 
        onerror: null 
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = persistentCache.get(key);

      setTimeout(() => {
        if (getRequest.onerror) {
          getRequest.onerror({ target: getRequest } as any);
        }
      }, 0);

      await expect(getPromise).rejects.toThrow(AIIllustrationError);
      await expect(getPromise).rejects.toThrow('Failed to get from persistent cache');
    });

    it('should handle database not initialized errors', async () => {
      const uninitializedCache = new PersistentCache();
      
      await expect(uninitializedCache.get('test:key')).rejects.toThrow(AIIllustrationError);
      await expect(uninitializedCache.get('test:key')).rejects.toThrow('Persistent cache not initialized');
    });

    it('should handle transaction abort', async () => {
      const testData: CachedIllustration = {
        status: 'completed',
        prompt: 'Test prompt',
        imageBlobURL: 'blob:test-url',
        timestamp: Date.now()
      };

      const key = 'book1:location1';

      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const setPromise = persistentCache.set(key, testData);

      setTimeout(() => {
        if (mockTransaction.onabort) {
          mockTransaction.onabort({ target: { error: new Error('Transaction aborted') } } as any);
        }
      }, 0);

      await expect(setPromise).rejects.toThrow(AIIllustrationError);
    });
  });

  describe('book entries loading', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);
      
      await persistentCache.initialize();
    });

    it('should load all entries for a specific book', async () => {
      const bookId = 'book1';
      const mockEntries = [
        {
          key: 'book1:location1',
          data: { status: 'completed', prompt: 'Prompt 1', imageBlobURL: 'blob:1', timestamp: Date.now() },
          bookId: 'book1'
        },
        {
          key: 'book1:location2',
          data: { status: 'completed', prompt: 'Prompt 2', imageBlobURL: 'blob:2', timestamp: Date.now() },
          bookId: 'book1'
        }
      ];

      let cursorCallCount = 0;
      const cursorRequest = { 
        result: null as any,
        onsuccess: null, 
        onerror: null 
      };
      
      mockObjectStore.openCursor.mockReturnValue(cursorRequest);

      const loadPromise = persistentCache.loadBookEntries(bookId);

      setTimeout(() => {
        if (cursorRequest.onsuccess) {
          // First call - return first entry
          cursorRequest.result = {
            value: mockEntries[0],
            continue: jest.fn(() => {
              setTimeout(() => {
                cursorCallCount++;
                if (cursorCallCount === 1) {
                  // Second call - return second entry
                  cursorRequest.result = {
                    value: mockEntries[1],
                    continue: jest.fn(() => {
                      setTimeout(() => {
                        // Third call - end of cursor
                        cursorRequest.result = null;
                        if (cursorRequest.onsuccess) {
                          cursorRequest.onsuccess({ target: cursorRequest } as any);
                        }
                        if (mockTransaction.oncomplete) {
                          mockTransaction.oncomplete({} as any);
                        }
                      }, 0);
                    })
                  };
                  if (cursorRequest.onsuccess) {
                    cursorRequest.onsuccess({ target: cursorRequest } as any);
                  }
                }
              }, 0);
            })
          };
          cursorRequest.onsuccess({ target: cursorRequest } as any);
        }
      }, 0);

      const result = await loadPromise;
      
      expect(result.size).toBe(2);
      expect(result.get('book1:location1')).toEqual(mockEntries[0].data);
      expect(result.get('book1:location2')).toEqual(mockEntries[1].data);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);
      
      await persistentCache.initialize();
    });

    it('should provide cache statistics', async () => {
      const mockEntries = [
        { key: 'book1:location1', bookId: 'book1', timestamp: Date.now() - 1000 },
        { key: 'book1:location2', bookId: 'book1', timestamp: Date.now() },
        { key: 'book2:location1', bookId: 'book2', timestamp: Date.now() - 500 }
      ];

      let cursorCallCount = 0;
      const cursorRequest = { 
        result: null as any,
        onsuccess: null, 
        onerror: null 
      };
      
      mockObjectStore.openCursor.mockReturnValue(cursorRequest);

      const statsPromise = persistentCache.getStats();

      setTimeout(() => {
        const simulateCursorIteration = (index: number) => {
          if (index < mockEntries.length) {
            cursorRequest.result = {
              value: mockEntries[index],
              continue: jest.fn(() => {
                setTimeout(() => simulateCursorIteration(index + 1), 0);
              })
            };
          } else {
            cursorRequest.result = null;
            if (mockTransaction.oncomplete) {
              mockTransaction.oncomplete({} as any);
            }
          }
          
          if (cursorRequest.onsuccess) {
            cursorRequest.onsuccess({ target: cursorRequest } as any);
          }
        };

        simulateCursorIteration(0);
      }, 0);

      const stats = await statsPromise;
      
      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByBook.get('book1')).toBe(2);
      expect(stats.entriesByBook.get('book2')).toBe(1);
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry!);
    });
  });

  describe('cleanup operations', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);
      
      await persistentCache.initialize();
    });

    it('should cleanup old entries', async () => {
      const maxAgeMs = 5000; // 5 seconds
      const maxEntries = 10;
      const oldTimestamp = Date.now() - 10000; // 10 seconds ago
      
      const mockOldEntry = {
        key: 'book1:old-location',
        bookId: 'book1',
        timestamp: oldTimestamp
      };

      const mockCursor = {
        value: mockOldEntry,
        delete: jest.fn(),
        continue: jest.fn()
      };

      const cursorRequest = { 
        result: mockCursor,
        onsuccess: null, 
        onerror: null 
      };
      
      mockObjectStore.openCursor.mockReturnValue(cursorRequest);

      const cleanupPromise = persistentCache.cleanup(maxAgeMs, maxEntries);

      setTimeout(() => {
        if (cursorRequest.onsuccess) {
          cursorRequest.onsuccess({ target: cursorRequest } as any);
          
          setTimeout(() => {
            cursorRequest.result = null;
            if (cursorRequest.onsuccess) {
              cursorRequest.onsuccess({ target: cursorRequest } as any);
            }
            if (mockTransaction.oncomplete) {
              mockTransaction.oncomplete({} as any);
            }
          }, 0);
        }
      }, 0);

      const deletedCount = await cleanupPromise;
      
      expect(deletedCount).toBe(1);
      expect(mockCursor.delete).toHaveBeenCalled();
    });
  });

  describe('resource management', () => {
    it('should close database connection', () => {
      // Initialize first
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);

      return persistentCache.initialize().then(() => {
        persistentCache.close();
        expect(mockDatabase.close).toHaveBeenCalled();
      });
    });

    it('should handle close when not initialized', () => {
      // Should not throw
      expect(() => persistentCache.close()).not.toThrow();
    });
  });
});