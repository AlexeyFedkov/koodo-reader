/**
 * Integration test setup for AI Book Illustrations
 * Configures test environment with necessary mocks and utilities
 */

import 'jest-environment-jsdom';

// Mock electron APIs
const mockElectron = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  remote: {
    app: {
      getPath: jest.fn().mockReturnValue('/mock/path')
    }
  }
};

Object.defineProperty(window, 'require', {
  value: jest.fn().mockReturnValue(mockElectron),
  writable: true
});

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      result: {
        createObjectStore: jest.fn(),
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            add: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(undefined),
            put: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
            getAll: jest.fn().mockResolvedValue([])
          }),
          oncomplete: null,
          onerror: null
        }),
        close: jest.fn()
      },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    });
  }),
  deleteDatabase: jest.fn().mockResolvedValue(undefined)
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// Mock Blob and URL APIs
global.Blob = jest.fn().mockImplementation((content, options) => ({
  content,
  options,
  size: content ? content.reduce((acc: number, item: any) => acc + item.length, 0) : 0,
  type: options?.type || ''
}));

global.URL = {
  createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: jest.fn()
} as any;

// Mock performance API with memory monitoring
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn().mockImplementation(() => Date.now() + Math.random() * 10),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    },
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn().mockReturnValue([]),
    getEntriesByName: jest.fn().mockReturnValue([]),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  },
  writable: true
});

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockImplementation((tagName: string) => {
    const element = {
      tagName: tagName.toUpperCase(),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false),
        toggle: jest.fn()
      },
      setAttribute: jest.fn(),
      getAttribute: jest.fn().mockReturnValue(null),
      removeAttribute: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      insertBefore: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockReturnValue([]),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      innerHTML: '',
      textContent: '',
      src: '',
      onload: null,
      onerror: null,
      children: [],
      parentNode: null,
      nextSibling: null,
      previousSibling: null
    };
    
    // Special handling for specific elements
    if (tagName.toLowerCase() === 'img') {
      Object.defineProperty(element, 'src', {
        set: function(value: string) {
          this._src = value;
          // Simulate image load
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 10);
        },
        get: function() {
          return this._src || '';
        }
      });
    }
    
    return element;
  }),
  writable: true
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.testUtils = {
  // Simulate async delay
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock memory pressure
  simulateMemoryPressure: (targetMB: number) => {
    const arrays: number[][] = [];
    const targetBytes = targetMB * 1024 * 1024;
    let currentBytes = 0;

    while (currentBytes < targetBytes) {
      const array = new Array(1000).fill(Math.random());
      arrays.push(array);
      currentBytes += array.length * 8;
    }

    return () => {
      arrays.length = 0;
    };
  },
  
  // Reset all mocks
  resetAllMocks: () => {
    jest.clearAllMocks();
    mockElectron.ipcRenderer.invoke.mockClear();
  }
};

// Setup and teardown
beforeEach(() => {
  // Reset performance memory values
  window.performance.memory.usedJSHeapSize = 1000000 + Math.random() * 100000;
  
  // Clear any existing timers
  jest.clearAllTimers();
});

afterEach(() => {
  // Clean up any remaining timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  
  // Reset mocks
  global.testUtils.resetAllMocks();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);

export {};