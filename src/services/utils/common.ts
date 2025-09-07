// Common utilities for AI Illustration services
import { LocationKey } from '../types/aiIllustration';
import { AIIllustrationLogger } from './logger';

export class AIIllustrationUtils {
  private static logger = new AIIllustrationLogger('AIIllustrationUtils');

  /**
   * Generate a cache key from bookId and locationKey
   */
  public static generateCacheKey(bookId: string, locationKey: string): string {
    return `${bookId}:${locationKey}`;
  }

  /**
   * Parse location key from string format
   */
  public static parseLocationKey(locationKeyStr: string): LocationKey | null {
    try {
      // Handle different location key formats
      if (locationKeyStr.includes('epubcfi')) {
        // EPUB CFI format
        const parts = locationKeyStr.split('/');
        return {
          bookId: '', // Will be set by caller
          chapterIndex: 0, // Extract from CFI if needed
          pageOffset: 0,
          cfi: locationKeyStr
        };
      } else if (locationKeyStr.includes('page-')) {
        // PDF page format
        const pageMatch = locationKeyStr.match(/page-(\d+)/);
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 0;
        
        return {
          bookId: '', // Will be set by caller
          chapterIndex: 0,
          pageOffset: 0,
          pageNumber
        };
      } else {
        // Generic format - try to extract numbers
        const numbers = locationKeyStr.match(/\d+/g);
        return {
          bookId: '', // Will be set by caller
          chapterIndex: numbers ? parseInt(numbers[0], 10) : 0,
          pageOffset: numbers && numbers.length > 1 ? parseInt(numbers[1], 10) : 0
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse location key', { locationKeyStr, error });
      return null;
    }
  }

  /**
   * Normalize text for AI processing
   */
  public static normalizeText(text: string): string {
    if (!text) return '';

    return text
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Remove footnote markers and references
      .replace(/\[\d+\]/g, ' ')
      .replace(/\(\d+\)/g, ' ')
      // Remove navigation elements
      .replace(/\b(next|previous|chapter|page)\b/gi, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Limit length while preserving sentence boundaries
      .substring(0, 2000);
  }

  /**
   * Debounce function calls
   */
  public static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function calls
   */
  public static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Create a promise that resolves after a delay
   */
  public static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if we're running in Electron
   */
  public static isElectron(): boolean {
    return typeof window !== 'undefined' && 
           window.process && 
           (window.process as any).type === 'renderer';
  }

  /**
   * Generate a unique request ID
   */
  public static generateRequestId(): string {
    return `ai-ill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate image blob URL
   */
  public static isValidBlobUrl(url: string): boolean {
    return typeof url === 'string' && url.startsWith('blob:');
  }

  /**
   * Convert bytes to human readable format
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Safe JSON parse with fallback
   */
  public static safeJsonParse<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json);
    } catch (error) {
      this.logger.warn('Failed to parse JSON', { json, error });
      return fallback;
    }
  }
}