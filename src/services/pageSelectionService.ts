/**
 * Page Selection Service
 * 
 * Handles deterministic "every second page" selection logic for AI illustration generation.
 * Maintains a logical page counter and tracks processed pages to avoid duplicates.
 */

export interface PageSelectionService {
  shouldProcessPage(locationKey: string, readerPageNumber?: number): boolean;
  incrementPageCounter(): void;
  resetCounter(): void;
  isAlreadyProcessed(locationKey: string): boolean;
}

export class PageSelectionServiceImpl implements PageSelectionService {
  private pageCounter: number = 0;
  private processedLocationKeys: Set<string> = new Set();
  private currentBookId: string | null = null;

  /**
   * Determines if a page should be processed for illustration generation.
   * Uses modulo-based selection logic for every second page.
   * Pattern: Page 1 (image), Page 2 (no image), Page 3 (no image), Page 4 (image), etc.
   * 
   * @param locationKey - Unique identifier for the current page location
   * @param readerPageNumber - Actual page number from the reader (optional)
   * @returns true if the page should be processed, false otherwise
   */
  shouldProcessPage(locationKey: string, readerPageNumber?: number): boolean {
    // Use provided reader page number or extract from location key
    const pageNumber = readerPageNumber || this.extractPageNumber(locationKey);

    // Process every second page starting from page 1
    // Pattern: 1 (yes), 2 (no), 3 (no), 4 (yes), 5 (no), 6 (yes), 7 (no), 8 (yes)...
    // This translates to: page 1, then every even page number after 2
    const shouldProcess = pageNumber === 1 || (pageNumber > 2 && pageNumber % 2 === 0);
    
    console.log(`📄 Page ${pageNumber}: ${shouldProcess ? 'Generating image' : 'No image'}`);

    // Only track processed location keys for eligible pages
    // This allows revisiting pages and loading from cache
    if (shouldProcess) {
      this.processedLocationKeys.add(locationKey);
    }

    return shouldProcess;
  }

  /**
   * Increments the logical page counter.
   * Called when encountering a new location key.
   */
  incrementPageCounter(): void {
    this.pageCounter++;
  }

  /**
   * Resets the page counter and clears processed location keys.
   * Should be called when opening a new book.
   */
  resetCounter(): void {
    this.pageCounter = 0;
    this.processedLocationKeys.clear();
    this.currentBookId = null;
  }

  /**
   * Checks if a location key has already been processed.
   * 
   * @param locationKey - Unique identifier for the page location
   * @returns true if the location key has been processed before
   */
  isAlreadyProcessed(locationKey: string): boolean {
    return this.processedLocationKeys.has(locationKey);
  }

  /**
   * Sets the current book ID and resets state if it's a different book.
   * 
   * @param bookId - Unique identifier for the current book
   */
  setCurrentBook(bookId: string): void {
    if (this.currentBookId !== bookId) {
      this.resetCounter();
      this.currentBookId = bookId;
    }
  }

  /**
   * Gets the current page counter value.
   * Useful for debugging and testing.
   */
  getCurrentCounter(): number {
    return this.pageCounter;
  }

  /**
   * Gets the set of processed location keys.
   * Useful for debugging and testing.
   */
  getProcessedLocationKeys(): Set<string> {
    return new Set(this.processedLocationKeys);
  }

  /**
   * Gets the next page counter value and increments it.
   * This ensures each page gets a unique sequential number.
   */
  getNextPageCounter(): number {
    this.incrementPageCounter();
    return this.pageCounter;
  }

  /**
   * Extracts the page number from a location key.
   * Location keys are in format: "bookId:page-N" or "bookId:page-N:additionalContext"
   */
  private extractPageNumber(locationKey: string): number {
    try {
      // Extract page number from location key format: "bookId:page-N" or "bookId:page-N:context"
      const parts = locationKey.split(':');
      if (parts.length >= 2) {
        const pagePart = parts[1]; // Should be "page-N"
        if (pagePart.startsWith('page-')) {
          const pageNumber = parseInt(pagePart.substring(5), 10);
          if (!isNaN(pageNumber)) {
            return pageNumber;
          }
        }
      }
      
      // Fallback: use current counter if we can't extract page number
      return this.pageCounter;
    } catch (error) {
      return this.pageCounter;
    }
  }
}

// Export singleton instance
export const pageSelectionService = new PageSelectionServiceImpl();