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

describe('TextExtractionService Format-Specific Tests', () => {
  let service: TextExtractionServiceImpl;

  beforeEach(() => {
    service = new TextExtractionServiceImpl();
    mockGetIframeDoc.mockReset();
  });

  describe('EPUB format handling (Requirements 2.1, 2.2)', () => {
    it('should extract text from EPUB with proper content structure', () => {
      const epubDocument = {
        body: {
          textContent: 'Chapter 1: The Beginning\n\nIt was a dark and stormy night when our hero began their journey. The wind howled through the trees, and rain pelted against the windows of the old mansion.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'Chapter 1: The Beginning\n\nIt was a dark and stormy night when our hero began their journey. The wind howled through the trees, and rain pelted against the windows of the old mansion.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const epubRendition = {
        book: { format: 'EPUB' }
      };

      mockGetIframeDoc.mockReturnValue([epubDocument]);

      const result = service.extractPageText(epubRendition);
      
      expect(result).toContain('Chapter 1: The Beginning');
      expect(result).toContain('dark and stormy night');
      expect(result).toContain('hero began their journey');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('EPUB');
    });

    it('should handle EPUB with complex HTML structure', () => {
      const complexEpubContent = `
        <div class="chapter">
          <h1>Chapter Title</h1>
          <p>First paragraph with <em>emphasis</em> and <strong>bold text</strong>.</p>
          <p>Second paragraph with <a href="#footnote1">footnote reference</a>.</p>
          <blockquote>
            "This is a quoted passage from another work."
          </blockquote>
          <p>Final paragraph of the chapter.</p>
        </div>
      `;

      const epubDocument = {
        body: {
          innerHTML: complexEpubContent,
          textContent: 'Chapter Title First paragraph with emphasis and bold text. Second paragraph with footnote reference. "This is a quoted passage from another work." Final paragraph of the chapter.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'Chapter Title First paragraph with emphasis and bold text. Second paragraph with footnote reference. "This is a quoted passage from another work." Final paragraph of the chapter.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const epubRendition = { book: { format: 'EPUB' } };
      mockGetIframeDoc.mockReturnValue([epubDocument]);

      const result = service.extractPageText(epubRendition);
      
      expect(result).toContain('Chapter Title');
      expect(result).toContain('First paragraph with emphasis');
      expect(result).toContain('quoted passage');
      expect(result).not.toContain('<em>');
      expect(result).not.toContain('<strong>');
      expect(result).not.toContain('<a href=');
    });

    it('should handle EPUB with footnotes and references', () => {
      const epubWithFootnotes = 'This text has footnotes[1] and references[2]. Some text (see note 3) continues here. More content with asterisk markers* and dagger markers†.';

      const epubDocument = {
        body: {
          textContent: epubWithFootnotes,
          cloneNode: jest.fn().mockReturnValue({
            textContent: epubWithFootnotes,
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const epubRendition = { book: { format: 'EPUB' } };
      mockGetIframeDoc.mockReturnValue([epubDocument]);

      const result = service.normalizeText(service.extractPageText(epubRendition));
      
      expect(result).not.toContain('[1]');
      expect(result).not.toContain('[2]');
      expect(result).not.toContain('(see note 3)');
      expect(result).not.toContain('*');
      expect(result).not.toContain('†');
      expect(result).toContain('This text has footnotes and references');
    });
  });

  describe('PDF format handling (Requirements 2.1, 2.2)', () => {
    it('should extract text from PDF format', () => {
      const pdfDocument = {
        body: {
          textContent: 'PDF Document Page 1\n\nThis is content from a PDF file. It may have different formatting than EPUB files. The text extraction should handle PDF-specific elements.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'PDF Document Page 1\n\nThis is content from a PDF file. It may have different formatting than EPUB files. The text extraction should handle PDF-specific elements.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const pdfRendition = {
        book: { format: 'PDF' }
      };

      mockGetIframeDoc.mockReturnValue([pdfDocument]);

      const result = service.extractPageText(pdfRendition);
      
      expect(result).toContain('PDF Document Page 1');
      expect(result).toContain('content from a PDF file');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('PDF');
    });

    it('should detect PDF format from URL when format property is missing', () => {
      const pdfDocument = {
        body: {
          textContent: 'PDF content detected from URL',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'PDF content detected from URL',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const pdfRendition = {
        book: { url: '/path/to/document.pdf' }
      };

      mockGetIframeDoc.mockReturnValue([pdfDocument]);

      const result = service.extractPageText(pdfRendition);
      
      expect(result).toContain('PDF content detected from URL');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('PDF');
    });

    it('should handle PDF with page numbers and headers/footers', () => {
      const pdfWithPageElements = 'Page 15\n\nChapter 3: Advanced Topics\n\nThis is the main content of the page. It contains the actual text that should be extracted for AI processing.\n\nFooter: Document Title - Page 15 of 200';

      const pdfDocument = {
        body: {
          textContent: pdfWithPageElements,
          cloneNode: jest.fn().mockReturnValue({
            textContent: pdfWithPageElements,
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const pdfRendition = { book: { format: 'PDF' } };
      mockGetIframeDoc.mockReturnValue([pdfDocument]);

      const result = service.normalizeText(service.extractPageText(pdfRendition));
      
      expect(result).toContain('Advanced Topics');
      expect(result).toContain('main content of the page');
      // Page numbers and footers should be minimized
      expect(result.match(/Page \d+/g)?.length || 0).toBeLessThanOrEqual(1);
    });
  });

  describe('TXT and other formats (Requirements 2.1, 2.2)', () => {
    it('should handle plain text format', () => {
      const txtDocument = {
        body: {
          textContent: 'This is plain text content.\n\nIt has simple formatting with line breaks and paragraphs.\n\nNo HTML tags or complex structure.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'This is plain text content.\n\nIt has simple formatting with line breaks and paragraphs.\n\nNo HTML tags or complex structure.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const txtRendition = {
        book: { format: 'TXT' }
      };

      mockGetIframeDoc.mockReturnValue([txtDocument]);

      const result = service.extractPageText(txtRendition);
      
      expect(result).toContain('plain text content');
      expect(result).toContain('simple formatting');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('TXT');
    });

    it('should default to EPUB format when format cannot be determined', () => {
      const unknownDocument = {
        body: {
          textContent: 'Content from unknown format',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'Content from unknown format',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const unknownRendition = {}; // No format information

      mockGetIframeDoc.mockReturnValue([unknownDocument]);

      const result = service.extractPageText(unknownRendition);
      
      expect(result).toContain('Content from unknown format');
      expect(mockGetIframeDoc).toHaveBeenCalledWith('EPUB'); // Should default to EPUB
    });
  });

  describe('text normalization with length limits (Requirements 2.2)', () => {
    it('should limit text length while preserving sentence boundaries', () => {
      const longText = 'First sentence is short. ' + 
                      'Second sentence is much longer and contains a lot of detail about the story and characters. '.repeat(50) +
                      'Final sentence should be preserved if possible.';

      const result = service.normalizeText(longText);
      
      expect(result.length).toBeLessThanOrEqual(2010); // Max length + small buffer
      expect(result).toContain('First sentence is short.');
      
      // Should try to break at sentence boundaries
      if (result.includes('...')) {
        expect(result.endsWith('...')).toBe(true);
      }
    });

    it('should handle text that is exactly at the limit', () => {
      const exactLengthText = 'A'.repeat(2000);
      
      const result = service.normalizeText(exactLengthText);
      
      expect(result.length).toBeLessThanOrEqual(2000);
      expect(result).toBe(exactLengthText); // Should not be truncated
    });

    it('should handle very short text appropriately', () => {
      const shortText = 'Short text.';
      
      const result = service.normalizeText(shortText);
      
      expect(result).toBe(shortText);
      expect(result.length).toBeLessThan(50); // Below minimum threshold
    });

    it('should preserve context when truncating at word boundaries', () => {
      const textWithLongWords = 'This is a sentence with some ' + 'supercalifragilisticexpialidocious'.repeat(100) + ' words that are very long.';
      
      const result = service.normalizeText(textWithLongWords);
      
      expect(result.length).toBeLessThanOrEqual(2010);
      expect(result).toContain('This is a sentence');
      
      // Should try to break at word boundaries when possible
      if (result.includes('...')) {
        const lastSpaceIndex = result.lastIndexOf(' ', result.length - 4); // Before "..."
        expect(lastSpaceIndex).toBeGreaterThan(0);
      }
    });
  });

  describe('content filtering and cleanup', () => {
    it('should remove navigation elements', () => {
      const textWithNavigation = `
        Main story content begins here. The hero walked through the forest.
        Click here to continue reading.
        Next page
        Previous page
        Table of contents
        Back to top
        More story content continues. The adventure was just beginning.
        Home page
        Menu
        Navigation
      `;

      const result = service.normalizeText(textWithNavigation);
      
      expect(result).toContain('Main story content');
      expect(result).toContain('hero walked through');
      expect(result).toContain('adventure was just beginning');
      
      expect(result.toLowerCase()).not.toContain('click here');
      expect(result.toLowerCase()).not.toContain('next page');
      expect(result.toLowerCase()).not.toContain('previous page');
      expect(result.toLowerCase()).not.toContain('table of contents');
      expect(result.toLowerCase()).not.toContain('back to top');
      expect(result.toLowerCase()).not.toContain('home page');
      expect(result.toLowerCase()).not.toContain('menu');
      expect(result.toLowerCase()).not.toContain('navigation');
    });

    it('should handle mixed content with HTML entities', () => {
      const htmlEntityText = 'The character said &quot;Hello, world!&quot; and then &amp; walked away. The temperature was &lt;32&deg;F &gt; freezing point.';

      const result = service.normalizeText(htmlEntityText);
      
      expect(result).not.toContain('&quot;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      expect(result).not.toContain('&deg;');
      
      expect(result).toContain('Hello, world!');
      expect(result).toContain('walked away');
      expect(result).toContain('temperature');
    });

    it('should collapse excessive whitespace while preserving paragraph structure', () => {
      const messyWhitespace = `
        
        
        First    paragraph    with    multiple    spaces.
        
        
        
        Second paragraph    after    many    line    breaks.
        
        
        Third   paragraph   with   tabs	and	spaces.
        
        
        
      `;

      const result = service.normalizeText(messyWhitespace);
      
      expect(result).not.toContain('    '); // No multiple spaces
      expect(result).not.toContain('\n\n\n'); // No excessive line breaks
      expect(result).toContain('First paragraph with multiple spaces');
      expect(result).toContain('Second paragraph after many line breaks');
      expect(result).toContain('Third paragraph with tabs and spaces');
      
      // Should have reasonable paragraph separation
      const paragraphs = result.split('\n\n').filter(p => p.trim());
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle documents with no body element', () => {
      const documentWithoutBody = {
        body: null,
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const rendition = { book: { format: 'EPUB' } };
      mockGetIframeDoc.mockReturnValue([documentWithoutBody]);

      expect(() => service.extractPageText(rendition)).toThrow(AIIllustrationError);
      expect(() => service.extractPageText(rendition)).toThrow('No text content found on current page');
    });

    it('should handle mixed document quality in multi-document extraction', () => {
      const goodDocument = {
        body: {
          textContent: 'Good content from first document.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'Good content from first document.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const emptyDocument = {
        body: {
          textContent: '',
          cloneNode: jest.fn().mockReturnValue({
            textContent: '',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const anotherGoodDocument = {
        body: {
          textContent: 'More good content from third document.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'More good content from third document.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const rendition = { book: { format: 'EPUB' } };
      mockGetIframeDoc.mockReturnValue([goodDocument, emptyDocument, anotherGoodDocument]);

      const result = service.extractPageText(rendition);
      
      expect(result).toContain('Good content from first document');
      expect(result).toContain('More good content from third document');
      expect(result).toContain('\n\n'); // Should have document separation
    });

    it('should handle content with only punctuation and numbers', () => {
      const punctuationOnlyText = '!@#$%^&*()_+-=[]{}|;:,.<>?123456789';

      const result = service.normalizeText(punctuationOnlyText);
      
      // Should still return the content, but validation might flag it
      expect(result).toBe(punctuationOnlyText);
    });

    it('should handle extremely long single words', () => {
      const longWordText = 'Normal text with a ' + 'verylongwordthatgoesonforseveralthousandcharacters'.repeat(100) + ' in the middle.';

      const result = service.normalizeText(longWordText);
      
      expect(result.length).toBeLessThanOrEqual(2010);
      expect(result).toContain('Normal text with a');
      
      // Should handle the long word gracefully
      if (result.includes('...')) {
        expect(result.endsWith('...')).toBe(true);
      }
    });
  });

  describe('content structure preservation', () => {
    it('should prefer main content areas over general body content', () => {
      const mainContent = {
        textContent: 'This is the main story content that should be extracted.',
        cloneNode: jest.fn().mockReturnValue({
          textContent: 'This is the main story content that should be extracted.',
          querySelectorAll: jest.fn().mockReturnValue([]),
          remove: jest.fn()
        })
      };

      const documentWithMain = {
        body: {
          textContent: 'This is body content with navigation and other elements. This is the main story content that should be extracted. Footer and other elements.',
          cloneNode: jest.fn().mockReturnValue({
            textContent: 'This is body content with navigation and other elements. This is the main story content that should be extracted. Footer and other elements.',
            querySelectorAll: jest.fn().mockReturnValue([]),
            remove: jest.fn()
          })
        },
        querySelector: jest.fn().mockImplementation((selector) => {
          if (selector === 'main') return mainContent;
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const rendition = { book: { format: 'EPUB' } };
      mockGetIframeDoc.mockReturnValue([documentWithMain]);

      const result = service.extractPageText(rendition);
      
      expect(result).toBe('This is the main story content that should be extracted.');
      expect(result).not.toContain('navigation and other elements');
      expect(result).not.toContain('Footer and other elements');
    });

    it('should exclude common non-content elements', () => {
      const contentWithExclusions = {
        textContent: 'Main story content here.',
        cloneNode: jest.fn().mockReturnValue({
          textContent: 'Main story content here.',
          querySelectorAll: jest.fn().mockImplementation((selector) => {
            // Mock elements to be removed
            if (selector.includes('script') || selector.includes('nav') || selector.includes('footer')) {
              return [{
                remove: jest.fn()
              }];
            }
            return [];
          }),
          remove: jest.fn()
        })
      };

      const documentWithExclusions = {
        body: contentWithExclusions,
        querySelector: jest.fn().mockReturnValue(contentWithExclusions),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      const rendition = { book: { format: 'EPUB' } };
      mockGetIframeDoc.mockReturnValue([documentWithExclusions]);

      const result = service.extractPageText(rendition);
      
      expect(result).toBe('Main story content here.');
    });
  });
});