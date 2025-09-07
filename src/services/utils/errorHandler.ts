/**
 * Comprehensive error handling utilities for AI Illustration services
 * Provides graceful degradation, user-friendly notifications, and error recovery
 */

import toast from "react-hot-toast";
import { AIIllustrationError, ErrorCodes } from '../types/aiIllustration';
import { AIIllustrationLogger } from './logger';
import i18n from '../../i18n';

export interface ErrorHandlingOptions {
  showNotification?: boolean;
  logError?: boolean;
  retryable?: boolean;
  silent?: boolean;
  context?: string;
  metadata?: { bookId?: string; locationKey?: string };
}

export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  recoveryAction?: () => Promise<void>;
  fallbackAction?: () => Promise<void>;
  userMessage?: string;
}

export class AIIllustrationErrorHandler {
  private logger: AIIllustrationLogger;
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTimes: Map<string, number> = new Map();
  private readonly MAX_ERROR_FREQUENCY = 5; // Max errors per minute
  private readonly ERROR_FREQUENCY_WINDOW = 60000; // 1 minute

  constructor(context: string = 'ErrorHandler') {
    this.logger = new AIIllustrationLogger(context);
  }

  /**
   * Handle any error with comprehensive logging and user feedback
   */
  public async handleError(
    error: Error | AIIllustrationError | any,
    options: ErrorHandlingOptions = {}
  ): Promise<ErrorRecoveryStrategy> {
    const {
      showNotification = true,
      logError = true,
      retryable = false,
      silent = false,
      context = 'Unknown',
      metadata = {}
    } = options;

    // Normalize error
    const normalizedError = this.normalizeError(error);
    
    // Check error frequency to prevent spam
    const shouldShowNotification = showNotification && 
      !silent && 
      this.shouldShowNotification(normalizedError.code);

    // Log the error
    if (logError) {
      this.logger.error(
        `Error in ${context}: ${normalizedError.message}`,
        normalizedError,
        { context, retryable },
        metadata
      );
    }

    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(normalizedError, retryable);

    // Show user notification if appropriate
    if (shouldShowNotification) {
      await this.showUserNotification(normalizedError, recoveryStrategy, context);
    }

    // Update error tracking
    this.updateErrorTracking(normalizedError.code);

    return recoveryStrategy;
  }

  /**
   * Handle API errors specifically
   */
  public async handleApiError(
    error: any,
    operation: string,
    metadata?: { bookId?: string; locationKey?: string }
  ): Promise<ErrorRecoveryStrategy> {
    let errorCode = ErrorCodes.API_ERROR;
    let retryable = false;
    let userMessage = i18n.t('AI illustration generation failed');

    // Determine specific error type and handling
    if (error?.response?.status) {
      const status = error.response.status;
      
      if (status >= 500) {
        errorCode = ErrorCodes.API_ERROR;
        retryable = true;
        userMessage = i18n.t('Server temporarily unavailable. Will retry automatically.');
      } else if (status === 429) {
        errorCode = ErrorCodes.RATE_LIMIT_ERROR;
        retryable = true;
        userMessage = i18n.t('Rate limit reached. Please wait a moment.');
      } else if (status === 401 || status === 403) {
        errorCode = ErrorCodes.AUTHENTICATION_ERROR;
        retryable = false;
        userMessage = i18n.t('Authentication failed. Please check your API key.');
      } else if (status >= 400) {
        errorCode = ErrorCodes.API_ERROR;
        retryable = false;
        userMessage = i18n.t('Invalid request. Please try again.');
      }
    } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
      errorCode = ErrorCodes.NETWORK_ERROR;
      retryable = true;
      userMessage = i18n.t('Network connection issue. Will retry automatically.');
    }

    const aiError = new AIIllustrationError(
      error?.message || 'API request failed',
      errorCode,
      retryable
    );

    return this.handleError(aiError, {
      showNotification: true,
      logError: true,
      retryable,
      context: `API-${operation}`,
      metadata
    });
  }

  /**
   * Handle cache errors with fallback strategies
   */
  public async handleCacheError(
    error: any,
    operation: string,
    metadata?: { bookId?: string; locationKey?: string }
  ): Promise<ErrorRecoveryStrategy> {
    const cacheError = new AIIllustrationError(
      `Cache operation failed: ${error?.message || 'Unknown error'}`,
      ErrorCodes.CACHE_ERROR,
      false
    );

    return this.handleError(cacheError, {
      showNotification: false, // Cache errors are usually silent
      logError: true,
      retryable: false,
      context: `Cache-${operation}`,
      metadata
    });
  }

  /**
   * Handle DOM manipulation errors
   */
  public async handleDomError(
    error: any,
    operation: string,
    metadata?: { bookId?: string; locationKey?: string }
  ): Promise<ErrorRecoveryStrategy> {
    const domError = new AIIllustrationError(
      `DOM operation failed: ${error?.message || 'Unknown error'}`,
      ErrorCodes.DOM_ERROR,
      false
    );

    return this.handleError(domError, {
      showNotification: false, // DOM errors are usually silent
      logError: true,
      retryable: false,
      context: `DOM-${operation}`,
      metadata
    });
  }

  /**
   * Handle text extraction errors
   */
  public async handleTextExtractionError(
    error: any,
    metadata?: { bookId?: string; locationKey?: string }
  ): Promise<ErrorRecoveryStrategy> {
    const textError = new AIIllustrationError(
      `Text extraction failed: ${error?.message || 'No suitable content found'}`,
      ErrorCodes.TEXT_EXTRACTION_ERROR,
      false
    );

    return this.handleError(textError, {
      showNotification: false, // Text extraction errors are usually silent
      logError: true,
      retryable: false,
      context: 'TextExtraction',
      metadata
    });
  }

  /**
   * Normalize any error to AIIllustrationError
   */
  private normalizeError(error: any): AIIllustrationError {
    if (error instanceof AIIllustrationError) {
      return error;
    }

    if (error instanceof Error) {
      return new AIIllustrationError(
        error.message,
        ErrorCodes.API_ERROR,
        false
      );
    }

    if (typeof error === 'string') {
      return new AIIllustrationError(
        error,
        ErrorCodes.API_ERROR,
        false
      );
    }

    return new AIIllustrationError(
      'Unknown error occurred',
      ErrorCodes.API_ERROR,
      false
    );
  }

  /**
   * Determine recovery strategy based on error type
   */
  private determineRecoveryStrategy(
    error: AIIllustrationError,
    retryable: boolean
  ): ErrorRecoveryStrategy {
    const strategy: ErrorRecoveryStrategy = {
      canRecover: false
    };

    switch (error.code) {
      case ErrorCodes.NETWORK_ERROR:
      case ErrorCodes.API_ERROR:
        if (retryable) {
          strategy.canRecover = true;
          strategy.userMessage = i18n.t('Will retry automatically');
          strategy.recoveryAction = async () => {
            // Recovery will be handled by the calling service
            this.logger.info('Attempting automatic recovery for API error');
          };
        } else {
          strategy.canRecover = false;
          strategy.userMessage = i18n.t('Please try again later');
          strategy.fallbackAction = async () => {
            this.logger.info('Falling back to graceful degradation');
          };
        }
        break;

      case ErrorCodes.RATE_LIMIT_ERROR:
        strategy.canRecover = true;
        strategy.userMessage = i18n.t('Rate limit reached. Will retry after delay.');
        strategy.recoveryAction = async () => {
          // Add delay before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        };
        break;

      case ErrorCodes.AUTHENTICATION_ERROR:
        strategy.canRecover = false;
        strategy.userMessage = i18n.t('Please check your API configuration');
        strategy.fallbackAction = async () => {
          this.logger.warn('Authentication failed - feature will be disabled');
        };
        break;

      case ErrorCodes.CACHE_ERROR:
        strategy.canRecover = true;
        strategy.userMessage = i18n.t('Cache issue - will continue without caching');
        strategy.recoveryAction = async () => {
          this.logger.info('Continuing without cache');
        };
        break;

      case ErrorCodes.DOM_ERROR:
        strategy.canRecover = false;
        strategy.userMessage = i18n.t('Display issue - continuing reading normally');
        strategy.fallbackAction = async () => {
          this.logger.info('DOM injection failed - continuing without illustration');
        };
        break;

      case ErrorCodes.TEXT_EXTRACTION_ERROR:
        strategy.canRecover = false;
        strategy.userMessage = i18n.t('No suitable content found for illustration');
        strategy.fallbackAction = async () => {
          this.logger.info('Skipping illustration for this page');
        };
        break;

      default:
        strategy.canRecover = retryable;
        strategy.userMessage = retryable 
          ? i18n.t('Will retry automatically')
          : i18n.t('Please try again later');
    }

    return strategy;
  }

  /**
   * Show user-friendly notification
   */
  private async showUserNotification(
    error: AIIllustrationError,
    strategy: ErrorRecoveryStrategy,
    context: string
  ): Promise<void> {
    const message = strategy.userMessage || error.message;
    
    // Choose appropriate toast type based on error severity and recoverability
    if (strategy.canRecover) {
      toast.loading(message, {
        id: `ai-illustration-${error.code}`,
        duration: 3000
      });
    } else if (error.code === ErrorCodes.AUTHENTICATION_ERROR) {
      toast.error(message, {
        id: `ai-illustration-${error.code}`,
        duration: 5000
      });
    } else {
      // For non-critical errors, show a brief warning
      toast(message, {
        id: `ai-illustration-${error.code}`,
        duration: 2000,
        icon: '⚠️'
      });
    }
  }

  /**
   * Check if we should show notification based on error frequency
   */
  private shouldShowNotification(errorCode: string): boolean {
    const now = Date.now();
    const lastErrorTime = this.lastErrorTimes.get(errorCode) || 0;
    const errorCount = this.errorCounts.get(errorCode) || 0;

    // If it's been more than the frequency window, reset count
    if (now - lastErrorTime > this.ERROR_FREQUENCY_WINDOW) {
      this.errorCounts.set(errorCode, 1);
      this.lastErrorTimes.set(errorCode, now);
      return true;
    }

    // If we haven't exceeded the max frequency, show notification
    if (errorCount < this.MAX_ERROR_FREQUENCY) {
      return true;
    }

    // Too many errors in short time - suppress notification
    return false;
  }

  /**
   * Update error tracking for frequency control
   */
  private updateErrorTracking(errorCode: string): void {
    const now = Date.now();
    const lastErrorTime = this.lastErrorTimes.get(errorCode) || 0;
    const errorCount = this.errorCounts.get(errorCode) || 0;

    if (now - lastErrorTime > this.ERROR_FREQUENCY_WINDOW) {
      // Reset count if outside frequency window
      this.errorCounts.set(errorCode, 1);
    } else {
      // Increment count within frequency window
      this.errorCounts.set(errorCode, errorCount + 1);
    }

    this.lastErrorTimes.set(errorCode, now);
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    errorCounts: { [code: string]: number };
    lastErrorTimes: { [code: string]: number };
    totalErrors: number;
  } {
    const errorCounts: { [code: string]: number } = {};
    const lastErrorTimes: { [code: string]: number } = {};
    let totalErrors = 0;

    for (const [code, count] of this.errorCounts) {
      errorCounts[code] = count;
      totalErrors += count;
    }

    for (const [code, time] of this.lastErrorTimes) {
      lastErrorTimes[code] = time;
    }

    return {
      errorCounts,
      lastErrorTimes,
      totalErrors
    };
  }

  /**
   * Clear error tracking
   */
  public clearErrorTracking(): void {
    this.errorCounts.clear();
    this.lastErrorTimes.clear();
    this.logger.info('Error tracking cleared');
  }

  /**
   * Create a safe wrapper for async operations
   */
  public createSafeWrapper<T>(
    operation: () => Promise<T>,
    context: string,
    options: ErrorHandlingOptions = {}
  ): () => Promise<T | null> {
    return async (): Promise<T | null> => {
      try {
        return await operation();
      } catch (error) {
        await this.handleError(error, {
          ...options,
          context
        });
        return null;
      }
    };
  }

  /**
   * Create a safe wrapper for sync operations
   */
  public createSafeSyncWrapper<T>(
    operation: () => T,
    context: string,
    options: ErrorHandlingOptions = {}
  ): () => T | null {
    return (): T | null => {
      try {
        return operation();
      } catch (error) {
        // Handle sync errors asynchronously
        this.handleError(error, {
          ...options,
          context
        }).catch(err => {
          this.logger.error('Error in error handler', err);
        });
        return null;
      }
    };
  }
}

// Export singleton instance
export const errorHandler = new AIIllustrationErrorHandler('AI-Illustration');