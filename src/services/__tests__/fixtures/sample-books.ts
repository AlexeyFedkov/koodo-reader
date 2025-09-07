/**
 * Sample book fixtures for integration testing
 * Provides mock book data in various formats for testing AI illustration functionality
 */

export interface MockBookData {
  id: string;
  title: string;
  format: string;
  size: number;
  content: {
    chapters: Array<{
      title: string;
      pages: Array<{
        locationKey: string;
        content: string;
        wordCount: number;
      }>;
    }>;
  };
}

export const sampleEpubBook: MockBookData = {
  id: 'sample-epub-001',
  title: 'The Adventure Begins',
  format: 'EPUB',
  size: 1024 * 1024, // 1MB
  content: {
    chapters: [
      {
        title: 'Chapter 1: The Journey Starts',
        pages: [
          {
            locationKey: 'chapter-1-page-1',
            content: `<p>The morning sun cast long shadows across the cobblestone streets of the ancient city. 
                     Sarah walked briskly, her leather satchel bouncing against her hip with each determined step. 
                     The marketplace was already bustling with vendors setting up their colorful stalls, 
                     the air filled with the aroma of fresh bread and exotic spices.</p>
                     <p>She had been planning this journey for months, studying maps and gathering supplies. 
                     Today was the day she would finally leave the familiar confines of her hometown 
                     and venture into the unknown territories beyond the mountains.</p>`,
            wordCount: 95
          },
          {
            locationKey: 'chapter-1-page-2',
            content: `<p>The old merchant at the corner stall recognized her approach and waved enthusiastically. 
                     "Ah, young Sarah! Today is the big day, yes?" His weathered face crinkled into a warm smile 
                     as he gestured toward his display of travel provisions.</p>
                     <p>"Indeed it is, Master Chen," she replied, examining the carefully arranged items. 
                     "I'll need enough supplies for at least two weeks in the wilderness." 
                     The merchant nodded knowingly and began selecting the finest dried fruits, 
                     hardtack, and water purification tablets.</p>`,
            wordCount: 88
          },
          {
            locationKey: 'chapter-1-page-3',
            content: `<p>As Sarah completed her final preparations, a sense of both excitement and nervousness 
                     filled her chest. The path ahead was uncertain, filled with potential dangers 
                     and unexpected discoveries. She had heard tales of ancient ruins hidden deep 
                     in the forest, guarded by mystical creatures and forgotten magic.</p>
                     <p>Her grandmother's journal, tucked safely in her satchel, contained cryptic clues 
                     about a legendary artifact that could change the fate of their kingdom. 
                     The responsibility weighed heavily on her shoulders, but her determination remained unwavering.</p>`,
            wordCount: 92
          }
        ]
      },
      {
        title: 'Chapter 2: Into the Wilderness',
        pages: [
          {
            locationKey: 'chapter-2-page-1',
            content: `<p>The city gates loomed before Sarah as she approached the edge of civilization. 
                     The massive stone archway had stood for centuries, marking the boundary between 
                     the safe, ordered world she knew and the wild, untamed lands beyond.</p>
                     <p>Guards in polished armor nodded respectfully as she presented her travel documents. 
                     "Safe travels, miss," one of them called out as she passed through the gates. 
                     "May the winds be at your back and the path clear before you."</p>`,
            wordCount: 78
          },
          {
            locationKey: 'chapter-2-page-2',
            content: `<p>The forest path wound through towering oak and pine trees, their branches 
                     creating a natural canopy that filtered the sunlight into dancing patterns 
                     on the forest floor. Birds chirped melodiously overhead, and small woodland 
                     creatures scurried through the underbrush.</p>
                     <p>Sarah paused to consult her grandmother's map, tracing the route with her finger. 
                     According to the ancient markings, she needed to follow this path for three days 
                     before reaching the first landmark - a stone circle known as the Whispering Stones.</p>`,
            wordCount: 89
          }
        ]
      }
    ]
  }
};

export const samplePdfBook: MockBookData = {
  id: 'sample-pdf-001',
  title: 'Technical Manual: Advanced Systems',
  format: 'PDF',
  size: 2 * 1024 * 1024, // 2MB
  content: {
    chapters: [
      {
        title: 'Introduction to Advanced Systems',
        pages: [
          {
            locationKey: 'page-1',
            content: `Advanced Systems Overview
                     
                     This manual provides comprehensive guidance for understanding and implementing 
                     advanced technological systems in modern industrial environments. 
                     The principles outlined in this document have been tested and validated 
                     across multiple deployment scenarios.
                     
                     Key topics covered include:
                     - System architecture and design patterns
                     - Performance optimization techniques
                     - Security implementation strategies
                     - Maintenance and troubleshooting procedures`,
            wordCount: 67
          },
          {
            locationKey: 'page-2',
            content: `System Architecture Fundamentals
                     
                     The foundation of any advanced system lies in its architectural design. 
                     A well-designed architecture ensures scalability, maintainability, 
                     and optimal performance under varying load conditions.
                     
                     Core architectural principles:
                     1. Modularity - Breaking systems into discrete, manageable components
                     2. Abstraction - Hiding implementation details behind clean interfaces
                     3. Separation of Concerns - Each component has a single, well-defined responsibility
                     4. Loose Coupling - Minimizing dependencies between system components`,
            wordCount: 82
          }
        ]
      }
    ]
  }
};

export const sampleTxtBook: MockBookData = {
  id: 'sample-txt-001',
  title: 'Classic Literature Collection',
  format: 'TXT',
  size: 512 * 1024, // 512KB
  content: {
    chapters: [
      {
        title: 'Chapter 1',
        pages: [
          {
            locationKey: 'line-1-50',
            content: `It was the best of times, it was the worst of times, it was the age of wisdom, 
                     it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, 
                     it was the season of Light, it was the season of Darkness, it was the spring of hope, 
                     it was the winter of despair, we had everything before us, we had nothing before us, 
                     we were all going direct to Heaven, we were all going direct the other way.`,
            wordCount: 75
          },
          {
            locationKey: 'line-51-100',
            content: `In short, the period was so far like the present period, that some of its noisiest 
                     authorities insisted on its being received, for good or for evil, in the superlative 
                     degree of comparison only. There were a king with a large jaw and a queen with a plain face, 
                     on the throne of England; there were a king with a large jaw and a queen with a fair face, 
                     on the throne of France.`,
            wordCount: 68
          }
        ]
      }
    ]
  }
};

export const largeSampleBook: MockBookData = {
  id: 'large-sample-001',
  title: 'Epic Fantasy Novel',
  format: 'EPUB',
  size: 10 * 1024 * 1024, // 10MB
  content: {
    chapters: Array.from({ length: 20 }, (_, chapterIndex) => ({
      title: `Chapter ${chapterIndex + 1}: The Quest Continues`,
      pages: Array.from({ length: 15 }, (_, pageIndex) => ({
        locationKey: `chapter-${chapterIndex + 1}-page-${pageIndex + 1}`,
        content: `<p>This is page ${pageIndex + 1} of chapter ${chapterIndex + 1}. 
                 The story continues with our heroes facing new challenges and discovering 
                 ancient secrets. The landscape changes as they journey deeper into 
                 the mystical realm, encountering magical creatures and solving puzzles 
                 that test their wisdom and courage.</p>
                 <p>Each step brings them closer to their ultimate goal, but also 
                 reveals new obstacles that must be overcome. The bonds of friendship 
                 are tested as they face increasingly difficult decisions that will 
                 determine the fate of their world.</p>`,
        wordCount: 95
      }))
    }))
  }
};

/**
 * Creates a mock rendition object for testing with the provided book data
 */
export function createMockRendition(bookData: MockBookData) {
  let currentChapterIndex = 0;
  let currentPageIndex = 0;

  const mockDocument = {
    body: {
      innerHTML: '',
      textContent: '',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      insertBefore: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      children: []
    },
    querySelector: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue([]),
    createElement: document.createElement,
    head: {
      appendChild: jest.fn(),
      querySelector: jest.fn()
    }
  };

  const mockIframe = {
    contentDocument: mockDocument,
    contentWindow: {
      document: mockDocument
    }
  };

  return {
    on: jest.fn(),
    off: jest.fn(),
    format: bookData.format,
    getContents: jest.fn().mockReturnValue({
      document: mockDocument,
      window: { document: mockDocument }
    }),
    getIframe: jest.fn().mockReturnValue(mockIframe),
    getCurrentLocationKey: jest.fn().mockImplementation(() => {
      const chapter = bookData.content.chapters[currentChapterIndex];
      const page = chapter?.pages[currentPageIndex];
      return page?.locationKey || 'unknown-location';
    }),
    navigateToPage: (chapterIdx: number, pageIdx: number) => {
      currentChapterIndex = Math.max(0, Math.min(chapterIdx, bookData.content.chapters.length - 1));
      currentPageIndex = Math.max(0, Math.min(pageIdx, bookData.content.chapters[currentChapterIndex].pages.length - 1));
      
      const chapter = bookData.content.chapters[currentChapterIndex];
      const page = chapter.pages[currentPageIndex];
      
      mockDocument.body.innerHTML = page.content;
      mockDocument.body.textContent = page.content.replace(/<[^>]*>/g, '');
    },
    getCurrentPageContent: () => {
      const chapter = bookData.content.chapters[currentChapterIndex];
      const page = chapter?.pages[currentPageIndex];
      return page?.content || '';
    },
    getTotalPages: () => {
      return bookData.content.chapters.reduce((total, chapter) => total + chapter.pages.length, 0);
    },
    getBookData: () => bookData
  };
}

/**
 * Performance testing utilities
 */
export const performanceTestUtils = {
  measureMemoryUsage: () => {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      return {
        used: window.performance.memory.usedJSHeapSize,
        total: window.performance.memory.totalJSHeapSize,
        limit: window.performance.memory.jsHeapSizeLimit
      };
    }
    return { used: 0, total: 0, limit: 0 };
  },

  simulateMemoryPressure: (targetMB: number) => {
    const arrays: number[][] = [];
    const targetBytes = targetMB * 1024 * 1024;
    let currentBytes = 0;

    while (currentBytes < targetBytes) {
      const array = new Array(10000).fill(Math.random());
      arrays.push(array);
      currentBytes += array.length * 8; // Approximate bytes per number
    }

    return () => {
      arrays.length = 0; // Cleanup
    };
  },

  measureOperationTime: async (operation: () => Promise<void>) => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    return endTime - startTime;
  }
};