/**
 * Text Extraction Service
 * 
 * Extracts and normalizes visible text from the current page for AI illustration generation.
 * Handles different book formats (EPUB, PDF, TXT) and provides text normalization utilities.
 */

import { TextExtractionService, AIIllustrationError, ErrorCodes } from './types/aiIllustration';
import { getIframeDoc } from '../utils/reader/docUtil';
import { logger } from './utils/logger';

export class TextExtractionServiceImpl implements TextExtractionService {
  private readonly MAX_TEXT_LENGTH = 2000; // Maximum text length for AI processing
  private readonly MIN_TEXT_LENGTH = 50; // Minimum text length to be useful

  /**
   * Extracts visible text content from the current page via foliate.js rendition.
   * Accesses iframe document.body and handles different book formats.
   * 
   * @param rendition - The foliate.js rendition object
   * @returns Extracted raw text from the current page
   */
  extractPageText(rendition: any): string {
    try {
      console.log('📝 Starting text extraction...');
      if (!rendition) {
        throw new AIIllustrationError(
          'Rendition object is null or undefined',
          ErrorCodes.TEXT_EXTRACTION_ERROR
        );
      }

      // Get the current book format from rendition
      const bookFormat = this.getBookFormat(rendition);
      console.log('📝 Book format:', bookFormat);
      logger.debug('Extracting text for book format:', bookFormat);

      // Get iframe documents using existing utility
      const docs = getIframeDoc(bookFormat);
      console.log('📝 Found documents:', docs?.length || 0);
      
      if (!docs || docs.length === 0) {
        throw new AIIllustrationError(
          'No iframe documents found for text extraction',
          ErrorCodes.TEXT_EXTRACTION_ERROR
        );
      }

      let extractedText = '';

      // Extract text from all available documents
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        console.log(`📝 Processing document ${i}:`, doc ? 'exists' : 'null');
        if (!doc || !doc.body) {
          console.log(`📝 Document ${i} has no body, skipping`);
          logger.warn(`Document ${i} has no body, skipping`);
          continue;
        }

        console.log(`📝 Document ${i} body content length:`, doc.body.textContent?.length || 0);
        const docText = this.extractTextFromDocument(doc);
        console.log(`📝 Extracted text from document ${i}:`, docText.length, 'chars');
        if (docText.trim()) {
          extractedText += (extractedText ? '\n\n' : '') + docText;
        }
      }

      if (!extractedText.trim()) {
        throw new AIIllustrationError(
          'No text content found on current page',
          ErrorCodes.TEXT_EXTRACTION_ERROR
        );
      }

      logger.debug(`Extracted ${extractedText.length} characters from page`);
      return extractedText;

    } catch (error) {
      if (error instanceof AIIllustrationError) {
        throw error;
      }
      
      logger.error('Unexpected error during text extraction:', error);
      throw new AIIllustrationError(
        `Text extraction failed: ${error.message}`,
        ErrorCodes.TEXT_EXTRACTION_ERROR
      );
    }
  }

  /**
   * Normalizes extracted text by removing HTML tags, footnotes, navigation elements,
   * collapsing whitespace, and limiting length while preserving essential context.
   * 
   * @param rawText - Raw text extracted from the page
   * @returns Normalized text suitable for AI processing
   */
  normalizeText(rawText: string): string {
    try {
      if (!rawText || typeof rawText !== 'string') {
        return '';
      }

      let normalizedText = rawText;

      // Remove HTML tags and entities
      normalizedText = this.removeHtmlTags(normalizedText);
      
      // Remove footnotes and reference markers
      normalizedText = this.removeFootnotes(normalizedText);
      
      // Remove navigation elements and common UI text
      normalizedText = this.removeNavigationElements(normalizedText);
      
      // Collapse whitespace and normalize line breaks
      normalizedText = this.collapseWhitespace(normalizedText);
      
      // Limit text length while preserving context
      normalizedText = this.limitTextLength(normalizedText);

      // Final validation
      if (normalizedText.trim().length < this.MIN_TEXT_LENGTH) {
        logger.warn(`Normalized text too short (${normalizedText.length} chars), may not provide good context`);
      }

      logger.debug(`Normalized text from ${rawText.length} to ${normalizedText.length} characters`);
      return normalizedText.trim();

    } catch (error) {
      logger.error('Error during text normalization:', error);
      // Return a truncated version of the original text as fallback
      return rawText.substring(0, this.MAX_TEXT_LENGTH).trim();
    }
  }

  /**
   * Extracts text content from a document while preserving context.
   * Focuses on main content areas and excludes navigation/UI elements.
   */
  private extractTextFromDocument(doc: Document): string {
    try {
      console.log('📝 Extracting text from document...');
      // Try to find main content areas first, but avoid just headers
      const contentSelectors = [
        'main',
        '[role="main"]',
        '.content',
        '.main-content',
        '.text',
        'article',
        '.body-text',
        'p', // Try paragraphs first
        'div' // Fallback to divs
      ];

      let contentElement: Element | null = null;
      
      for (const selector of contentSelectors) {
        const elements = doc.querySelectorAll(selector);
        // Find the element with the most text content
        let bestElement: Element | null = null;
        let maxTextLength = 0;
        
        for (const element of elements) {
          const textLength = element.textContent?.length || 0;
          if (textLength > maxTextLength && textLength > 50) { // At least 50 characters
            maxTextLength = textLength;
            bestElement = element;
          }
        }
        
        if (bestElement) {
          contentElement = bestElement;
          console.log(`📝 Found content using selector: ${selector} (${maxTextLength} chars)`);
          logger.debug(`Found content using selector: ${selector}`);
          break;
        }
      }

      // Fallback to body if no specific content area found
      const targetElement = contentElement || doc.body;
      console.log('📝 Target element:', targetElement ? targetElement.tagName : 'null');
      
      if (!targetElement) {
        return '';
      }

      // Get text content while excluding certain elements
      const excludeSelectors = [
        'script',
        'style',
        'nav',
        'header',
        'footer',
        '.navigation',
        '.nav',
        '.menu',
        '.sidebar',
        '.footnote',
        '.endnote',
        '.page-number',
        '.chapter-number'
      ];

      // Clone the element to avoid modifying the original DOM
      const clonedElement = targetElement.cloneNode(true) as Element;
      
      // Remove excluded elements
      excludeSelectors.forEach(selector => {
        const elementsToRemove = clonedElement.querySelectorAll(selector);
        elementsToRemove.forEach(el => el.remove());
      });

      // Extract text content
      const textContent = clonedElement.textContent || '';
      console.log('📝 Final extracted text length:', textContent.length);
      console.log('📝 Text preview:', textContent.substring(0, 200) + '...');
      
      return textContent;

    } catch (error) {
      logger.error('Error extracting text from document:', error);
      // Fallback to simple textContent extraction
      return doc.body?.textContent || '';
    }
  }

  /**
   * Removes HTML tags and entities from text.
   */
  private removeHtmlTags(text: string): string {
    return text
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/&lt;|&gt;|&amp;|&quot;|&#39;/g, ' '); // Remove common entities
  }

  /**
   * Removes footnotes, endnotes, and reference markers.
   */
  private removeFootnotes(text: string): string {
    return text
      .replace(/\[\d+\]/g, '') // Remove [1], [2], etc.
      .replace(/\(\d+\)/g, '') // Remove (1), (2), etc.
      .replace(/\*+/g, '') // Remove asterisk markers
      .replace(/†+/g, '') // Remove dagger markers
      .replace(/‡+/g, '') // Remove double dagger markers
      .replace(/§+/g, '') // Remove section markers
      .replace(/\d+\./g, ' ') // Remove numbered list markers at start of lines
      .replace(/^[ivxlcdm]+\./gmi, ' '); // Remove roman numeral markers
  }

  /**
   * Removes navigation elements and common UI text.
   */
  private removeNavigationElements(text: string): string {
    const navigationPatterns = [
      /next\s*page/gi,
      /previous\s*page/gi,
      /table\s*of\s*contents/gi,
      /chapter\s*\d+/gi,
      /page\s*\d+/gi,
      /click\s*here/gi,
      /read\s*more/gi,
      /continue\s*reading/gi,
      /back\s*to\s*top/gi,
      /home\s*page/gi,
      /menu/gi,
      /navigation/gi
    ];

    let cleanedText = text;
    navigationPatterns.forEach(pattern => {
      cleanedText = cleanedText.replace(pattern, ' ');
    });

    return cleanedText;
  }

  /**
   * Collapses whitespace and normalizes line breaks.
   */
  private collapseWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
      .replace(/\n{3,}/g, '\n\n'); // Limit consecutive line breaks to 2
  }

  /**
   * Limits text length while preserving essential context.
   * Tries to break at sentence boundaries when possible.
   */
  private limitTextLength(text: string): string {
    if (text.length <= this.MAX_TEXT_LENGTH) {
      return text;
    }

    // Try to break at sentence boundaries
    const sentences = text.split(/[.!?]+/);
    let truncatedText = '';
    
    for (const sentence of sentences) {
      const potentialText = truncatedText + sentence + '.';
      if (potentialText.length > this.MAX_TEXT_LENGTH) {
        break;
      }
      truncatedText = potentialText;
    }

    // If we couldn't build any complete sentences, just truncate
    if (truncatedText.length < this.MIN_TEXT_LENGTH) {
      truncatedText = text.substring(0, this.MAX_TEXT_LENGTH);
      
      // Try to break at word boundary
      const lastSpaceIndex = truncatedText.lastIndexOf(' ');
      if (lastSpaceIndex > this.MAX_TEXT_LENGTH * 0.8) {
        truncatedText = truncatedText.substring(0, lastSpaceIndex);
      }
      
      truncatedText += '...';
    }

    return truncatedText;
  }

  /**
   * Attempts to determine the book format from the rendition object.
   * Falls back to 'EPUB' if format cannot be determined.
   */
  private getBookFormat(rendition: any): string {
    try {
      // Try to get format from rendition properties
      if (rendition.book && rendition.book.format) {
        return rendition.book.format.toUpperCase();
      }
      
      // Try alternative property paths
      if (rendition.format) {
        return rendition.format.toUpperCase();
      }
      
      // Check if it's a PDF by looking at the URL or container
      if (rendition.book && rendition.book.url && rendition.book.url.includes('.pdf')) {
        return 'PDF';
      }

      // Default to EPUB for most ebook formats
      logger.debug('Could not determine book format, defaulting to EPUB');
      return 'EPUB';
      
    } catch (error) {
      logger.warn('Error determining book format:', error);
      return 'EPUB';
    }
  }

  /**
   * Validates that extracted text is suitable for AI processing.
   */
  private validateExtractedText(text: string): boolean {
    if (!text || text.trim().length < this.MIN_TEXT_LENGTH) {
      return false;
    }

    // Check if text is mostly punctuation or numbers
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    const totalCount = text.length;
    
    if (alphaCount / totalCount < 0.5) {
      logger.warn('Extracted text has low alphabetic content ratio');
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const textExtractionService = new TextExtractionServiceImpl();