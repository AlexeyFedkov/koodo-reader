import { DOMInjectionService as IDOMInjectionService, ErrorCodes, AIIllustrationError } from './types/aiIllustration';

export class DOMInjectionService implements IDOMInjectionService {
  private static readonly AI_ILLUSTRATION_CLASS = 'ai-illustration';
  private static readonly AI_ILLUSTRATION_FIGURE_CLASS = 'ai-illustration-figure';
  private static readonly AI_ILLUSTRATION_IMG_CLASS = 'ai-illustration-img';
  private static readonly AI_ILLUSTRATION_LOADING_CLASS = 'ai-illustration-loading';
  private static readonly AI_ILLUSTRATION_ERROR_CLASS = 'ai-illustration-error';
  private static readonly STYLE_ID = 'ai-illustration-styles';

  /**
   * Inject illustration into page DOM at the top of content
   */
  injectIllustration(rendition: any, imageBlobURL: string): void {
    try {
      const document = this.getPageDocument(rendition);
      if (!document) {
        throw new AIIllustrationError(
          'Cannot access page document from rendition',
          ErrorCodes.DOM_ERROR,
          false
        );
      }

      // Ensure styles are injected
      this.injectStylesheet(document);

      // Remove any existing illustrations first
      this.removeIllustrations(document);

      // Create the figure element with image
      const figure = this.createIllustrationFigure(document, imageBlobURL);
      
      // Find the first paragraph or content element to insert before
      const insertionPoint = this.findInsertionPoint(document);
      
      if (insertionPoint) {
        // Insert the figure before the first paragraph
        console.log('🔍 Insertion point:', insertionPoint);
        console.log('🔍 Parent node:', insertionPoint.parentNode);
        insertionPoint.parentNode?.insertBefore(figure, insertionPoint);
      } else {
        // Fallback: inject directly into content area
        const contentArea = document.querySelector('.html-viewer-page, #page-area, .epub-content, .book-content');
        if (contentArea) {
          console.log('🔍 No insertion point found, injecting into content area');
          contentArea.insertBefore(figure, contentArea.firstChild);
        } else {
          console.log('🔍 No content area found, injecting into body');
          document.body?.insertBefore(figure, document.body.firstChild);
        }
      }
      
      console.log('🔍 Figure element:', figure);
      console.log('🔍 Figure HTML:', figure.outerHTML);
      
      // Verify insertion
      const insertedFigure = document.querySelector(`.${DOMInjectionService.AI_ILLUSTRATION_FIGURE_CLASS}`);
      console.log('🔍 Inserted figure found:', !!insertedFigure);
      if (insertedFigure) {
        console.log('🔍 Inserted figure styles:', window.getComputedStyle(insertedFigure));
      }

    } catch (error) {
      if (error instanceof AIIllustrationError) {
        throw error;
      }
      throw new AIIllustrationError(
        `Failed to inject illustration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.DOM_ERROR,
        false
      );
    }
  }

  /**
   * Create figure element with proper CSS classes and responsive image
   */
  private createIllustrationFigure(document: Document, imageBlobURL: string): HTMLElement {
    // Create figure container
    const figure = document.createElement('figure');
    figure.className = `${DOMInjectionService.AI_ILLUSTRATION_CLASS} ${DOMInjectionService.AI_ILLUSTRATION_FIGURE_CLASS}`;
    
    // Create image element
    const img = document.createElement('img');
    img.className = DOMInjectionService.AI_ILLUSTRATION_IMG_CLASS;
    img.src = imageBlobURL;
    img.alt = 'AI-generated illustration for this page';
    (img as any).loading = 'lazy';
    
    // Add loading state initially
    figure.classList.add(DOMInjectionService.AI_ILLUSTRATION_LOADING_CLASS);
    
    // Handle image load events
    img.onload = () => {
      console.log('✅ Image loaded successfully:', imageBlobURL);
      figure.classList.remove(DOMInjectionService.AI_ILLUSTRATION_LOADING_CLASS);
    };
    
    img.onerror = (error) => {
      console.error('❌ Image failed to load:', imageBlobURL, error);
      figure.classList.remove(DOMInjectionService.AI_ILLUSTRATION_LOADING_CLASS);
      figure.classList.add(DOMInjectionService.AI_ILLUSTRATION_ERROR_CLASS);
      
      // Replace image with error placeholder
      img.style.display = 'none';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'ai-illustration-error-placeholder';
      errorDiv.textContent = 'Failed to load illustration';
      figure.appendChild(errorDiv);
    };
    
    // Append image to figure
    figure.appendChild(img);
    
    return figure;
  }

  /**
   * Find the best insertion point for the illustration (before first paragraph)
   */
  private findInsertionPoint(document: Document): Element | null {
    // First, try to find the actual reading content area (not navigation)
    // Look for iframe content, reading area, or actual book text content
    let contentArea = document.querySelector('iframe[src*="epub"], .reading-area, .epub-reader, .book-reader');
    
    // If no iframe, look for content containers that are NOT navigation
    if (!contentArea) {
      const candidates = document.querySelectorAll('.html-viewer-page, #page-area, .epub-content, .content, .reader-content');
      for (const candidate of candidates) {
        // Skip navigation/TOC areas
        if (candidate.classList.contains('book-content') || 
            candidate.querySelector('.book-content-list') ||
            candidate.innerHTML.includes('data-href')) {
          console.log('🔍 Skipping navigation area:', candidate.className);
          continue;
        }
        contentArea = candidate;
        break;
      }
    }
    
    // If still no content area, try to find the actual text content
    if (!contentArea) {
      // Look for elements that contain actual book text (not navigation)
      const textElements = document.querySelectorAll('div, section, article');
      for (const element of textElements) {
        const text = element.textContent?.trim() || '';
        // Look for substantial text content that's not navigation
        if (text.length > 100 && 
            !element.classList.contains('book-content') &&
            !element.querySelector('.book-content-list') &&
            !text.includes('Title Page') &&
            !text.includes('Copyright') &&
            !text.includes('Contents')) {
          contentArea = element;
          console.log('🔍 Found text-based content area');
          break;
        }
      }
    }
    
    const searchRoot = contentArea || document;
    
    console.log('🔍 Content area found:', !!contentArea);
    console.log('🔍 Search root:', searchRoot);
    
    if (contentArea) {
      console.log('🔍 Content area innerHTML (first 500 chars):', contentArea.innerHTML.substring(0, 500));
      console.log('🔍 Content area children:', contentArea.children.length);
      for (let i = 0; i < Math.min(3, contentArea.children.length); i++) {
        console.log(`🔍 Child ${i}:`, contentArea.children[i]);
      }
    }
    
    // Look for common content containers in EPUB/HTML within the content area
    const contentSelectors = [
      'p:first-of-type',
      'div p:first-of-type',
      'section p:first-of-type',
      'article p:first-of-type',
      'main p:first-of-type',
      '.content p:first-of-type',
      '#content p:first-of-type'
    ];

    for (const selector of contentSelectors) {
      const element = searchRoot.querySelector(selector);
      if (element && this.isValidInsertionPoint(element)) {
        console.log('🔍 Found insertion point via selector:', selector);
        return element;
      }
    }

    // Fallback: look for any paragraph with substantial text content within content area
    const allParagraphs = searchRoot.querySelectorAll('p');
    console.log('🔍 Found paragraphs in content area:', allParagraphs.length);
    
    for (const p of allParagraphs) {
      if (this.isValidInsertionPoint(p)) {
        console.log('🔍 Found valid paragraph insertion point');
        return p;
      }
    }

    // Last resort: look for any block-level element with text within content area
    const blockElements = searchRoot.querySelectorAll('div, section, article, main');
    for (const element of blockElements) {
      const firstChild = element.querySelector('p, div, span');
      if (firstChild && this.isValidInsertionPoint(firstChild)) {
        console.log('🔍 Found block element insertion point');
        return firstChild;
      }
    }

    return null;
  }

  /**
   * Check if an element is a valid insertion point
   */
  private isValidInsertionPoint(element: Element): boolean {
    // Must have text content
    const textContent = element.textContent?.trim();
    if (!textContent || textContent.length < 20) {
      return false;
    }

    // Must be visible
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    }

    // Must not already contain an AI illustration
    if (element.querySelector(`.${DOMInjectionService.AI_ILLUSTRATION_CLASS}`)) {
      return false;
    }

    return true;
  }

  /**
   * Get the document from the rendition iframe
   */
  private getPageDocument(rendition: any): Document | null {
    try {
      console.log('🔍 Rendition object keys:', Object.keys(rendition || {}));
      console.log('🔍 Rendition element:', rendition?.element);
      
      // For Koodo Reader, look for the iframe that contains the actual book content
      if (rendition?.element) {
        const iframe = rendition.element.querySelector('#kookit-iframe, iframe');
        if (iframe && iframe.contentDocument) {
          console.log('✅ Found iframe content document');
          return iframe.contentDocument;
        }
        
        // Fallback to the main document if no iframe found
        console.log('✅ Found content element, using its document');
        return rendition.element.ownerDocument || document;
      }

      // Access the iframe document from foliate.js rendition
      if (rendition?.iframe?.contentDocument) {
        console.log('✅ Found document via iframe.contentDocument');
        return rendition.iframe.contentDocument;
      }

      // Alternative access patterns for different foliate.js versions
      if (rendition?.document) {
        console.log('✅ Found document via rendition.document');
        return rendition.document;
      }

      if (rendition?.contents?.document) {
        console.log('✅ Found document via contents.document');
        return rendition.contents.document;
      }

      // Try to access through window
      if (rendition?.iframe?.contentWindow?.document) {
        console.log('✅ Found document via iframe.contentWindow.document');
        return rendition.iframe.contentWindow.document;
      }

      // Fallback to main document if we can't find the iframe document
      console.log('🔄 Falling back to main document');
      return document;
    } catch (error) {
      console.warn('Error accessing page document:', error);
      // Final fallback to main document
      return document;
    }
  }

  /**
   * Inject scoped CSS stylesheet for AI illustrations
   */
  injectStylesheet(document: Document): void {
    try {
      // Check if styles are already injected
      if (document.getElementById(DOMInjectionService.STYLE_ID)) {
        return;
      }

      const style = document.createElement('style');
      style.id = DOMInjectionService.STYLE_ID;
      style.textContent = this.getStylesheetContent();

      // Insert into document head
      const head = document.head || document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(style);
      } else {
        // Fallback: insert at beginning of body
        const body = document.body;
        if (body && body.firstChild) {
          body.insertBefore(style, body.firstChild);
        }
      }
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to inject stylesheet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.DOM_ERROR,
        false
      );
    }
  }

  /**
   * Get the CSS content for AI illustrations
   */
  private getStylesheetContent(): string {
    return `
      /* AI Illustration Styles - Scoped to avoid conflicts */
      .${DOMInjectionService.AI_ILLUSTRATION_FIGURE_CLASS} {
        margin: 1.5rem 0 2rem 0 !important;
        padding: 0 !important;
        text-align: center !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        position: relative !important;
        background: transparent !important;
        border: none !important;
        clear: both !important;
      }

      .${DOMInjectionService.AI_ILLUSTRATION_IMG_CLASS} {
        max-width: 100% !important;
        height: auto !important;
        display: block !important;
        margin: 0 auto !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        transition: opacity 0.3s ease !important;
        background: #f5f5f5 !important;
      }

      /* Loading state */
      .${DOMInjectionService.AI_ILLUSTRATION_LOADING_CLASS} .${DOMInjectionService.AI_ILLUSTRATION_IMG_CLASS} {
        opacity: 0.7 !important;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%) !important;
        background-size: 200% 100% !important;
        animation: ai-illustration-loading 1.5s infinite !important;
      }

      @keyframes ai-illustration-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .${DOMInjectionService.AI_ILLUSTRATION_LOADING_CLASS}::after {
        content: "Generating illustration..." !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(255, 255, 255, 0.9) !important;
        padding: 8px 16px !important;
        border-radius: 4px !important;
        font-size: 0.875rem !important;
        color: #666 !important;
        pointer-events: none !important;
        z-index: 1 !important;
      }

      /* Error state */
      .${DOMInjectionService.AI_ILLUSTRATION_ERROR_CLASS} {
        background: #f8f8f8 !important;
        border: 2px dashed #ddd !important;
        border-radius: 8px !important;
        padding: 2rem !important;
        min-height: 120px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .ai-illustration-error-placeholder {
        color: #999 !important;
        font-size: 0.875rem !important;
        text-align: center !important;
        font-style: italic !important;
      }

      /* Responsive behavior */
      @media (max-width: 768px) {
        .${DOMInjectionService.AI_ILLUSTRATION_FIGURE_CLASS} {
          margin: 1rem 0 1.5rem 0 !important;
        }
        
        .${DOMInjectionService.AI_ILLUSTRATION_IMG_CLASS} {
          border-radius: 4px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }
      }

      /* Ensure compatibility with dark themes */
      @media (prefers-color-scheme: dark) {
        .${DOMInjectionService.AI_ILLUSTRATION_IMG_CLASS} {
          background: #2a2a2a !important;
        }
        
        .${DOMInjectionService.AI_ILLUSTRATION_LOADING_CLASS} .${DOMInjectionService.AI_ILLUSTRATION_IMG_CLASS} {
          background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%) !important;
        }
        
        .${DOMInjectionService.AI_ILLUSTRATION_ERROR_CLASS} {
          background: #1a1a1a !important;
          border-color: #444 !important;
        }
        
        .ai-illustration-error-placeholder {
          color: #ccc !important;
        }
      }

      /* Print styles - hide illustrations in print */
      @media print {
        .${DOMInjectionService.AI_ILLUSTRATION_CLASS} {
          display: none !important;
        }
      }
    `;
  }

  /**
   * Remove all AI illustrations from the document
   */
  removeIllustrations(document: Document): void {
    try {
      const illustrations = document.querySelectorAll(`.${DOMInjectionService.AI_ILLUSTRATION_CLASS}`);
      
      illustrations.forEach(illustration => {
        // Clean up any blob URLs to prevent memory leaks
        const img = illustration.querySelector('img');
        if (img && img.src && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
        
        // Remove the element
        illustration.remove();
      });
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to remove illustrations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.DOM_ERROR,
        false
      );
    }
  }

  /**
   * Remove stylesheet from document
   */
  removeStylesheet(document: Document): void {
    try {
      const styleElement = document.getElementById(DOMInjectionService.STYLE_ID);
      if (styleElement) {
        styleElement.remove();
      }
    } catch (error) {
      console.warn('Error removing AI illustration stylesheet:', error);
    }
  }

  /**
   * Complete cleanup - remove all illustrations and styles
   */
  cleanup(document: Document): void {
    try {
      this.removeIllustrations(document);
      this.removeStylesheet(document);
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to cleanup DOM injection service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.DOM_ERROR,
        false
      );
    }
  }

  /**
   * Check if document has AI illustrations
   */
  hasIllustrations(document: Document): boolean {
    try {
      return document.querySelectorAll(`.${DOMInjectionService.AI_ILLUSTRATION_CLASS}`).length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get count of illustrations in document
   */
  getIllustrationCount(document: Document): number {
    try {
      return document.querySelectorAll(`.${DOMInjectionService.AI_ILLUSTRATION_CLASS}`).length;
    } catch (error) {
      return 0;
    }
  }
}