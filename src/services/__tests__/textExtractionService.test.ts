import { TextExtractionServiceImpl } from '../textExtractionService';
import { AIIllustrationError, ErrorCodes } from '../types/aiIllustration';

// Mock the docUtil module
jest.mock('../../utils/reader/docUtil', () => ({
  getIframeDoc: jest.fn()
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { getIframeDoc } from '../../utils/reader/docUtil';

const mockGetIframeDoc = getIframeDoc as jest.MockedFunction<typeof getIframeDoc>;

describe('TextExtractionService', () => {
  let service: TextExtractionServiceImpl;
  let mockDocument: Document;
  let mockRendition: any;

  beforeEach(() => {
    service = new TextExtractionServiceImpl();
    
    // Create a mock document
    mockDocument = {
      body: {
        textContent: 'This is sample text from a book page. It contains multiple sentences and paragraphs.',
        cloneNode: jest.fn().mockReturnValue({
          textContent: 'This is sample text from a book page. It contains multiple sentences and paragraphs.',
          querySelectorAll: jest.fn().mockReturnValue([]),
          remove: jest.fn()
        })
      },
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockReturnValue([])
    } as any;

    // Create a mock rendition
    mockRendition = {
      book: {
        format: 'EPUB'
      }
    };

    // Reset mocks
    mockGetIframeDoc.mockReset();
  });

  describe('extractPageText', () => {
    it('should extract text from EPUB format successfully', () => {
      mockGetIframeDoc.mockReturnValue([mockDocument]);

      const result = service.extractPageText(mockRendition);

      expect(result).toBe('This is sample text from a book page. It contains multiple sentences and paragraphs.');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('EPUB');
    });

    it('should handle PDF format', () => {
      mockRendition.book.format = 'PDF';
      mockGetIframeDoc.mockReturnValue([mockDocument]);

      const result = service.extractPageText(mockRendition);

      expect(result).toBe('This is sample text from a book page. It contains multiple sentences and paragraphs.');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('PDF');
    });

    it('should throw error when rendition is null', () => {
      expect(() => service.extractPageText(null)).toThrow(AIIllustrationError);
      expect(() => service.extractPageText(null)).toThrow('Rendition object is null or undefined');
    });

    it('should throw error when no iframe documents found', () => {
      mockGetIframeDoc.mockReturnValue([]);

      expect(() => service.extractPageText(mockRendition)).toThrow(AIIllustrationError);
      expect(() => service.extractPageText(mockRendition)).toThrow('No iframe documents found for text extraction');
    });

    it('should throw error when no text content found', () => {
      const emptyDocument = {
        body: { textContent: '' },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;
      
      mockGetIframeDoc.mockReturnValue([emptyDocument]);

      expect(() => service.extractPageText(mockRendition)).toThrow(AIIllustrationError);
      expect(() => service.extractPageText(mockRendition)).toThrow('No text content found on current page');
    });

    it('should handle multiple documents', () => {
      const doc1 = {
        body: {
          textContent: 'First document text.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'First document text.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const doc2 = {
        body: {
          textContent: 'Second document text.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'Second document text.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      mockGetIframeDoc.mockReturnValue([doc1, doc2]);

      const result = service.extractPageText(mockRendition);

      expect(result).toBe('First document text.\n\nSecond document text.');
    });

    it('should skip documents without body', () => {
      const validDoc = mockDocument;
      const invalidDoc = { body: null } as any;

      mockGetIframeDoc.mockReturnValue([validDoc, invalidDoc]);

      const result = service.extractPageText(mockRendition);

      expect(result).toBe('This is sample text from a book page. It contains multiple sentences and paragraphs.');
    });
  });

  describe('normalizeText', () => {
    it('should remove HTML tags', () => {
      const htmlText = 'This is <b>bold</b> and <i>italic</i> text with <a href="#">links</a>.';
      const result = service.normalizeText(htmlText);
      
      expect(result).not.toContain('<b>');
      expect(result).not.toContain('</b>');
      expect(result).not.toContain('<i>');
      expect(result).not.toContain('</i>');
      expect(result).not.toContain('<a href="#">');
      expect(result).not.toContain('</a>');
    });

    it('should remove HTML entities', () => {
      const entityText = 'Text with &amp; entities &lt; and &gt; symbols &quot;quotes&quot;.';
      const result = service.normalizeText(entityText);
      
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      expect(result).not.toContain('&quot;');
    });

    it('should remove footnote markers', () => {
      const footnoteText = 'This text has footnotes[1] and more[2]. Also (1) and (2) markers.';
      const result = service.normalizeText(footnoteText);
      
      expect(result).not.toContain('[1]');
      expect(result).not.toContain('[2]');
      expect(result).not.toContain('(1)');
      expect(result).not.toContain('(2)');
    });

    it('should remove navigation elements', () => {
      const navText = 'Click here to continue reading. Next page. Previous page. Table of contents.';
      const result = service.normalizeText(navText);
      
      expect(result.toLowerCase()).not.toContain('click here');
      expect(result.toLowerCase()).not.toContain('next page');
      expect(result.toLowerCase()).not.toContain('previous page');
      expect(result.toLowerCase()).not.toContain('table of contents');
    });

    it('should collapse whitespace', () => {
      const spacedText = 'Text   with    multiple     spaces\n\n\n\nand   line   breaks.';
      const result = service.normalizeText(spacedText);
      
      expect(result).not.toContain('   ');
      expect(result).not.toContain('\n\n\n');
    });

    it('should limit text length while preserving sentences', () => {
      const longText = 'A'.repeat(3000) + '. ' + 'B'.repeat(1000) + '.';
      const result = service.normalizeText(longText);
      
      expect(result.length).toBeLessThanOrEqual(2010); // Allow small buffer for ellipsis
      expect(result).toContain('...');
    });

    it('should handle empty or null input', () => {
      expect(service.normalizeText('')).toBe('');
      expect(service.normalizeText(null as any)).toBe('');
      expect(service.normalizeText(undefined as any)).toBe('');
    });

    it('should preserve essential context in long text', () => {
      const sentences = [
        'First sentence with important context.',
        'Second sentence continues the story.',
        'Third sentence adds more detail.',
        'Fourth sentence concludes the paragraph.'
      ];
      const longText = sentences.join(' ') + ' ' + 'X'.repeat(3000);
      
      const result = service.normalizeText(longText);
      
      // Should preserve the meaningful sentences at the beginning
      expect(result).toContain('First sentence with important context.');
      expect(result).toContain('Second sentence continues the story.');
    });
  });

  describe('book format detection', () => {
    it('should detect PDF format from rendition', () => {
      mockRendition.book.format = 'PDF';
      mockGetIframeDoc.mockReturnValue([mockDocument]);

      service.extractPageText(mockRendition);

      expect(mockGetIframeDoc).toHaveBeenCalledWith('PDF');
    });

    it('should default to EPUB when format cannot be determined', () => {
      const renditionWithoutFormat = {};
      mockGetIframeDoc.mockReturnValue([mockDocument]);

      service.extractPageText(renditionWithoutFormat);

      expect(mockGetIframeDoc).toHaveBeenCalledWith('EPUB');
    });

    it('should detect PDF from URL when format property is missing', () => {
      const renditionWithPdfUrl = {
        book: {
          url: 'path/to/book.pdf'
        }
      };
      mockGetIframeDoc.mockReturnValue([mockDocument]);

      service.extractPageText(renditionWithPdfUrl);

      expect(mockGetIframeDoc).toHaveBeenCalledWith('PDF');
    });
  });

  describe('error handling', () => {
    it('should handle extraction errors gracefully', () => {
      mockGetIframeDoc.mockImplementation(() => {
        throw new Error('DOM access error');
      });

      expect(() => service.extractPageText(mockRendition)).toThrow(AIIllustrationError);
      expect(() => service.extractPageText(mockRendition)).toThrow('Text extraction failed: DOM access error');
    });

    it('should handle normalization errors gracefully', () => {
      const problematicText = 'Some text that might cause issues';
      
      // Mock a method to throw an error during normalization
      const originalMethod = (service as any).removeHtmlTags;
      (service as any).removeHtmlTags = jest.fn().mockImplementation(() => {
        throw new Error('Normalization error');
      });

      const result = service.normalizeText(problematicText);
      
      // Should return truncated original text as fallback
      expect(result).toBe(problematicText);
      
      // Restore original method
      (service as any).removeHtmlTags = originalMethod;
    });
  });

  describe('content extraction with selectors', () => {
    it('should prefer main content areas over body', () => {
      const mainElement = {
        textContent: 'Main content text',
        cloneNode: jest.fn().mockReturnValue({
          textContent: 'Main content text',
          querySelectorAll: jest.fn().mockReturnValue([]),
          remove: jest.fn()
        })
      };

      const docWithMain = {
        body: {
          textContent: 'Body text with navigation and other elements',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'Body text with navigation and other elements',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockImplementation((selector) => {
          if (selector === 'main') return mainElement;
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      mockGetIframeDoc.mockReturnValue([docWithMain]);

      const result = service.extractPageText(mockRendition);

      expect(result).toBe('Main content text');
      expect(docWithMain.querySelector).toHaveBeenCalledWith('main');
    });
  });
});