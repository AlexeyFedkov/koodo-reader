/**
 * AI Illustration Service - Main orchestration service
 * 
 * Coordinates all AI illustration generation activities by managing dependent services,
 * hooking into foliate.js rendition lifecycle, and handling the complete workflow
 * from page selection to image injection.
 */

import { 
  AIIllustrationService,
  AIIllustrationConfig,
  AIIllustrationDevConfig,
  CachedIllustration,
  ErrorCodes,
  AIIllustrationError
} from './types/aiIllustration';
import { pageSelectionService } from './pageSelectionService';
import { textExtractionService } from './textExtractionService';
import { aiApiService } from './aiApiService';
import { CacheService } from './cache/cacheService';
import { DOMInjectionService } from './domInjectionService';
import { ConfigService } from '../assets/lib/kookit-extra-browser.min';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { performanceMonitor } from './utils/performanceMonitor';
import { notificationService } from './utils/notificationService';

export class AIIllustrationServiceImpl implements AIIllustrationService {
  private rendition: any = null;
  private currentBookId: string = '';
  private cacheService: CacheService;
  private domInjectionService: DOMInjectionService;
  private initialized = false;
  private isProcessing = false;
  private inFlightRequests = new Set<string>();
  private config: AIIllustrationConfig;
  private devConfig: AIIllustrationDevConfig;
  private renderedEventHandler: (() => Promise<void>) | null = null;
  private originalNext: any = null;
  private originalPrev: any = null;

  constructor() {
    this.cacheService = new CacheService();
    this.domInjectionService = new DOMInjectionService();
    this.config = this.loadConfiguration();
    this.devConfig = this.loadDevConfiguration();
  }

  /**
   * Initialize the AI illustration service with rendition and book context
   * Requirements: 1.1, 1.5
   */
  async initialize(rendition: any, bookId: string): Promise<void> {
    const trackingId = performanceMonitor.startOperation('service-initialization');
    
    try {
      logger.info(`Initializing AI illustration service for book: ${bookId}`, undefined, { bookId });

      // Store rendition and book context
      this.rendition = rendition;
      this.currentBookId = bookId;

      // Initialize dependent services
      await this.initializeDependentServices();

      // Set up page selection service for new book
      pageSelectionService.setCurrentBook(bookId);

      // Hook into rendition lifecycle
      this.setupRenditionEventHandlers();

      // Hydrate cache from persistent storage
      await this.cacheService.hydrateFromPersistent(bookId);

      this.initialized = true;
      
      performanceMonitor.endOperation(trackingId, 'service-initialization', true, { bookId });
      logger.info('AI illustration service initialized successfully', undefined, { bookId });

    } catch (error) {
      performanceMonitor.endOperation(trackingId, 'service-initialization', false, { bookId });
      
      const recovery = await errorHandler.handleError(error, {
        context: 'service-initialization',
        metadata: { bookId },
        showNotification: true,
        retryable: false
      });

      throw new AIIllustrationError(
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.API_ERROR,
        false
      );
    }
  }

  /**
   * Process a page for illustration generation
   * Requirements: 1.3, 1.4, 3.3, 6.1
   */
  async processPage(locationKey: string, readerPageNumber?: number): Promise<void> {
    const trackingId = performanceMonitor.startOperation('page-processing');
    const metadata = { bookId: this.currentBookId, locationKey };

    if (!this.initialized) {
      logger.warn('Service not initialized, skipping page processing', undefined, metadata);
      performanceMonitor.endOperation(trackingId, 'page-processing', false, metadata);
      return;
    }

    if (!this.isEligiblePage(locationKey, readerPageNumber)) {
      performanceMonitor.endOperation(trackingId, 'page-processing', false, metadata);
      return;
    }

    // Prevent duplicate processing (single-flight requests)
    if (this.inFlightRequests.has(locationKey)) {
      logger.debug(`Page ${locationKey} already being processed`, undefined, metadata);
      performanceMonitor.endOperation(trackingId, 'page-processing', false, metadata);
      return;
    }

    try {
      console.log(`🎨 Starting AI illustration generation for page ${readerPageNumber || 'unknown'}`);
      this.inFlightRequests.add(locationKey);
      await this.executeProcessingWorkflow(locationKey);
      performanceMonitor.endOperation(trackingId, 'page-processing', true, metadata);
    } catch (error) {
      performanceMonitor.endOperation(trackingId, 'page-processing', false, metadata);
      
      // Handle error with comprehensive error handling
      await errorHandler.handleError(error, {
        context: 'page-processing',
        metadata,
        showNotification: false, // Don't show notifications for individual page failures
        silent: true // Silent failure for graceful degradation
      });
    } finally {
      this.inFlightRequests.delete(locationKey);
    }
  }

  /**
   * Check if a page is eligible for illustration generation
   * Requirements: 1.2, 6.3, 6.4, 6.5
   */
  isEligiblePage(locationKey: string, readerPageNumber?: number): boolean {
    if (!this.rendition || !this.currentBookId) {
      return false;
    }

    // Use page selection service to determine eligibility
    return pageSelectionService.shouldProcessPage(locationKey, readerPageNumber);
  }

  /**
   * Cleanup service and resources
   * Requirements: 6.1, 6.2
   */
  cleanup(): void {
    const trackingId = performanceMonitor.startOperation('service-cleanup');
    const metadata = { bookId: this.currentBookId };

    try {
      logger.info('Cleaning up AI illustration service', undefined, metadata);

      // Cancel all in-flight requests
      aiApiService.cancelAllRequests();
      this.inFlightRequests.clear();

      // Dismiss any active notifications
      notificationService.dismissAll();

      // Remove event handlers and restore original navigation methods
      this.removeRenditionEventHandlers();

      // Cleanup DOM injections if we have access to document
      if (this.rendition) {
        try {
          const document = this.getPageDocument();
          if (document) {
            this.domInjectionService.cleanup(document);
          }
        } catch (error) {
          errorHandler.handleDomError(error, 'cleanup-dom-injections', metadata);
        }
      }

      // Close cache service
      try {
        this.cacheService.close();
      } catch (error) {
        errorHandler.handleCacheError(error, 'close-cache-service', metadata);
      }

      // Cleanup performance monitor
      performanceMonitor.cleanup();

      // Reset state
      this.rendition = null;
      this.currentBookId = '';
      this.initialized = false;
      this.isProcessing = false;

      performanceMonitor.endOperation(trackingId, 'service-cleanup', true, metadata);
      logger.info('AI illustration service cleanup completed', undefined, metadata);

    } catch (error) {
      performanceMonitor.endOperation(trackingId, 'service-cleanup', false, metadata);
      errorHandler.handleError(error, {
        context: 'service-cleanup',
        metadata,
        showNotification: false
      });
    }
  }

  /**
   * Initialize all dependent services
   */
  private async initializeDependentServices(): Promise<void> {
    try {
      // Initialize cache service
      await this.cacheService.initialize();
      
      logger.debug('Dependent services initialized successfully');
    } catch (error) {
      throw new AIIllustrationError(
        `Failed to initialize dependent services: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.API_ERROR,
        false
      );
    }
  }

  /**
   * Set up event handlers for rendition lifecycle
   */
  private setupRenditionEventHandlers(): void {
    if (!this.rendition) {
      return;
    }

    // Create bound event handler
    this.renderedEventHandler = this.handleRenderedEvent.bind(this);

    // Hook into the existing "rendered" event (for initial page load)
    this.rendition.on('rendered', this.renderedEventHandler);

    // Also hook into navigation events by overriding next() and prev() methods
    this.setupNavigationEventHandlers();

    logger.debug('Rendition event handlers set up');
  }

  /**
   * Set up navigation event handlers by wrapping next() and prev() methods
   */
  private setupNavigationEventHandlers(): void {
    if (!this.rendition) {
      return;
    }

    // Store original methods for cleanup
    this.originalNext = this.rendition.next;
    this.originalPrev = this.rendition.prev;

    // Wrap next() method
    this.rendition.next = async (...args: any[]) => {
      const result = await this.originalNext.apply(this.rendition, args);
      
      // Trigger our page processing after navigation
      setTimeout(() => {
        this.handleRenderedEvent().catch(error => {
          console.error('❌ Error processing page after next():', error);
        });
      }, 200); // Small delay to ensure navigation is complete
      
      return result;
    };

    // Wrap prev() method
    this.rendition.prev = async (...args: any[]) => {
      const result = await this.originalPrev.apply(this.rendition, args);
      
      // Trigger our page processing after navigation
      setTimeout(() => {
        this.handleRenderedEvent().catch(error => {
          console.error('❌ Error processing page after prev():', error);
        });
      }, 200); // Small delay to ensure navigation is complete
      
      return result;
    };
  }

  /**
   * Remove event handlers from rendition
   */
  private removeRenditionEventHandlers(): void {
    if (this.rendition && this.renderedEventHandler) {
      try {
        this.rendition.off('rendered', this.renderedEventHandler);
        this.renderedEventHandler = null;
        logger.debug('Rendition event handlers removed');
      } catch (error) {
        logger.warn('Error removing rendition event handlers:', error);
      }
    }

    // Restore original navigation methods
    if (this.rendition && this.originalNext && this.originalPrev) {
      try {
        this.rendition.next = this.originalNext;
        this.rendition.prev = this.originalPrev;
        this.originalNext = null;
        this.originalPrev = null;
      } catch (error) {
        logger.warn('Error restoring original navigation methods:', error);
      }
    }
  }

  /**
   * Handle the rendition "rendered" event
   */
  private async handleRenderedEvent(): Promise<void> {
    try {
      // Generate location key from current rendition state
      const locationKey = this.generateLocationKey();
      
      if (locationKey) {
        // Process page asynchronously without blocking the rendering
        setTimeout(() => {
          this.processPage(locationKey, readerPageNumber).catch(error => {
            console.error('❌ Error in async page processing:', error);
            logger.error('Error in async page processing:', error);
          });
        }, 100); // Small delay to ensure rendering is complete
      }
    } catch (error) {
      console.error('❌ Error in rendered event handler:', error);
      logger.error('Error in rendered event handler:', error);
      // Don't throw - must not interrupt rendering
    }
  }

  /**
   * Execute the complete processing workflow for a page
   */
  private async executeProcessingWorkflow(locationKey: string): Promise<void> {
    console.log(`🚀 Starting workflow for ${locationKey}`);
    const workflowTrackingId = performanceMonitor.startOperation('workflow-execution');
    const cacheKey = this.cacheService.generateKey(this.currentBookId, locationKey);
    const metadata = { bookId: this.currentBookId, locationKey };

    console.log(`🔑 Cache key: ${cacheKey}`);

    if (this.devConfig.debugMode) {
      logger.info(`Debug: Starting workflow for ${locationKey} (cache key: ${cacheKey})`, undefined, metadata);
    }

    try {
      // Check cache first
      console.log(`💾 Checking cache for: ${cacheKey}`);
      const cacheCheckId = performanceMonitor.startOperation('cache-check');
      const cachedResult = await this.cacheService.get(cacheKey);
      performanceMonitor.endOperation(cacheCheckId, 'cache-check', true, { ...metadata, cacheHit: !!cachedResult });
      console.log(`💾 Cache result:`, cachedResult ? `Found (${cachedResult.status})` : 'Not found');
      
      if (cachedResult) {
        if (this.devConfig.debugMode) {
          logger.info(`Debug: Found cached result with status: ${cachedResult.status}`, undefined, metadata);
        }
        
        if (cachedResult.status === 'completed' && (cachedResult.imageBlobURL || cachedResult.imageBase64)) {
          // Inject cached illustration
          const injectionId = performanceMonitor.startOperation('dom-injection');
          try {
            let blobURL = cachedResult.imageBlobURL;
            
            // If we have base64 data but no valid blob URL, create a fresh one
            if (!blobURL && cachedResult.imageBase64) {
              blobURL = this.createBlobURLFromBase64(cachedResult.imageBase64);
              
              // Update cache with fresh blob URL
              await this.cacheService.set(cacheKey, {
                ...cachedResult,
                imageBlobURL: blobURL
              });
            }
            
            if (blobURL) {
              this.domInjectionService.injectIllustration(this.rendition, blobURL);
              performanceMonitor.endOperation(injectionId, 'dom-injection', true, { ...metadata, cached: true });
              logger.debug(`Injected cached illustration for ${locationKey}`, undefined, metadata);
              notificationService.showCacheHit(locationKey);
              performanceMonitor.endOperation(workflowTrackingId, 'workflow-execution', true, { ...metadata, cached: true });
              return;
            }
          } catch (domError) {
            performanceMonitor.endOperation(injectionId, 'dom-injection', false, { ...metadata, cached: true });
            await errorHandler.handleDomError(domError, 'inject-cached-illustration', metadata);
          }
        } else if (cachedResult.status === 'generating') {
          // Already being generated
          logger.debug(`Illustration already being generated for ${locationKey}`, undefined, metadata);
          performanceMonitor.endOperation(workflowTrackingId, 'workflow-execution', false, { ...metadata, reason: 'already-generating' });
          return;
        }
      } else if (this.devConfig.debugMode) {
        logger.info(`Debug: No cached result found for ${locationKey}`, undefined, metadata);
      }

      // Show generation started notification
      notificationService.showGenerationStarted(locationKey);

      // Mark as generating in cache
      await this.cacheService.set(cacheKey, {
        status: 'generating',
        timestamp: Date.now()
      });

      // Extract text from current page
      console.log(`📝 Extracting text from page...`);
      const textExtractionId = performanceMonitor.startOperation('text-extraction');
      let rawText: string;
      let normalizedText: string;
      
      try {
        rawText = textExtractionService.extractPageText(this.rendition);
        console.log(`📝 Raw text extracted (${rawText.length} chars):`, rawText.substring(0, 200) + '...');
        normalizedText = textExtractionService.normalizeText(rawText);
        console.log(`📝 Normalized text (${normalizedText.length} chars):`, normalizedText.substring(0, 200) + '...');
        performanceMonitor.endOperation(textExtractionId, 'text-extraction', true, { 
          ...metadata, 
          rawTextLength: rawText.length, 
          normalizedTextLength: normalizedText.length 
        });
      } catch (textError) {
        console.error(`❌ Text extraction failed:`, textError);
        performanceMonitor.endOperation(textExtractionId, 'text-extraction', false, metadata);
        await errorHandler.handleTextExtractionError(textError, metadata);
        throw textError;
      }

      if (this.devConfig.debugMode) {
        logger.info(`Debug: Extracted ${rawText.length} chars, normalized to ${normalizedText.length} chars`, undefined, metadata);
        logger.debug(`Debug: Normalized text preview: ${normalizedText.substring(0, 200)}...`, undefined, metadata);
      }

      if (!normalizedText.trim()) {
        const textError = new AIIllustrationError(
          'No suitable text content found for illustration',
          ErrorCodes.TEXT_EXTRACTION_ERROR,
          false
        );
        await errorHandler.handleTextExtractionError(textError, metadata);
        throw textError;
      }

      // Generate prompt via AI API
      console.log(`🤖 Generating AI prompt for text: "${normalizedText}"`);
      if (this.devConfig.debugMode) {
        logger.info(`Debug: Generating prompt for ${locationKey}`, undefined, metadata);
      }
      
      const promptGenerationId = performanceMonitor.startOperation('prompt-generation');
      let promptResponse;
      
      try {
        promptResponse = await aiApiService.generatePrompt(locationKey, normalizedText);
        console.log(`🤖 Prompt generation result:`, promptResponse);
        performanceMonitor.endOperation(promptGenerationId, 'prompt-generation', promptResponse.success, {
          ...metadata,
          apiCall: true,
          success: promptResponse.success
        });
      } catch (promptError) {
        console.error(`❌ Prompt generation failed:`, promptError);
        performanceMonitor.endOperation(promptGenerationId, 'prompt-generation', false, { ...metadata, apiCall: true });
        const recovery = await errorHandler.handleApiError(promptError, 'prompt-generation', metadata);
        throw promptError;
      }
      
      if (!promptResponse.success || !promptResponse.data) {
        const apiError = new AIIllustrationError(
          promptResponse.error || 'Failed to generate prompt',
          ErrorCodes.API_ERROR,
          promptResponse.shouldRetry || false
        );
        await errorHandler.handleApiError(apiError, 'prompt-generation', metadata);
        throw apiError;
      }

      console.log(`🔍 Prompt response data:`, promptResponse.data);
      const prompt = promptResponse.data.prompt;
      console.log(`🔍 Extracted prompt:`, prompt);
      
      if (this.devConfig.debugMode) {
        logger.info(`Debug: Generated prompt: ${prompt}`, undefined, metadata);
      }

      // Clean up the prompt for image generation
      let cleanPrompt = prompt;
      // Remove markdown formatting and title
      cleanPrompt = cleanPrompt.replace(/\*\*.*?\*\*/g, ''); // Remove **bold** text
      cleanPrompt = cleanPrompt.replace(/^.*?"PROLOGUE".*?\n\n/g, ''); // Remove title line
      cleanPrompt = cleanPrompt.replace(/[‑–—]/g, '-'); // Replace special dashes with regular dash
      cleanPrompt = cleanPrompt.replace(/[""'']/g, '"'); // Replace smart quotes with regular quotes
      cleanPrompt = cleanPrompt.trim();
      
      // Limit prompt length for image generation (Hyperbolic max: 1000 chars)
      if (cleanPrompt.length > 900) {
        cleanPrompt = cleanPrompt.substring(0, 900).trim();
        // Make sure we don't cut off in the middle of a word
        const lastSpace = cleanPrompt.lastIndexOf(' ');
        if (lastSpace > 800) {
          cleanPrompt = cleanPrompt.substring(0, lastSpace);
        }
      }

      // Generate image via AI API
      console.log(`🎨 Generating AI image with cleaned prompt: "${cleanPrompt}"`);
      if (this.devConfig.debugMode) {
        logger.info(`Debug: Generating image for ${locationKey}`, undefined, metadata);
      }
      
      const imageGenerationId = performanceMonitor.startOperation('image-generation');
      let imageResponse;
      
      try {
        imageResponse = await aiApiService.generateImage(locationKey, cleanPrompt);
        console.log(`🎨 Image generation result:`, imageResponse);
        performanceMonitor.endOperation(imageGenerationId, 'image-generation', imageResponse.success, {
          ...metadata,
          apiCall: true,
          success: imageResponse.success
        });
      } catch (imageError) {
        console.error(`❌ Image generation failed:`, imageError);
        performanceMonitor.endOperation(imageGenerationId, 'image-generation', false, { ...metadata, apiCall: true });
        const recovery = await errorHandler.handleApiError(imageError, 'image-generation', metadata);
        throw imageError;
      }
      
      if (!imageResponse.success || !imageResponse.data) {
        const apiError = new AIIllustrationError(
          imageResponse.error || 'Failed to generate image',
          ErrorCodes.API_ERROR,
          imageResponse.shouldRetry || false
        );
        await errorHandler.handleApiError(apiError, 'image-generation', metadata);
        throw apiError;
      }

      // Convert base64 to blob URL
      const blobConversionId = performanceMonitor.startOperation('blob-conversion');
      let imageBlobURL: string;
      const imageBase64 = imageResponse.data.imageData; // Store the original base64 data
      
      try {
        imageBlobURL = this.createBlobURLFromBase64(imageBase64);
        performanceMonitor.endOperation(blobConversionId, 'blob-conversion', true, metadata);
      } catch (blobError) {
        performanceMonitor.endOperation(blobConversionId, 'blob-conversion', false, metadata);
        await errorHandler.handleError(blobError, {
          context: 'blob-conversion',
          metadata,
          showNotification: false
        });
        throw blobError;
      }
      
      if (this.devConfig.debugMode) {
        logger.info(`Debug: Created blob URL for image: ${imageBlobURL.substring(0, 50)}...`, undefined, metadata);
      }

      // Cache the completed result with both blob URL and base64 data
      const cacheSaveId = performanceMonitor.startOperation('cache-save');
      try {
        await this.cacheService.set(cacheKey, {
          status: 'completed',
          prompt,
          imageBlobURL,
          imageBase64, // Store base64 data for persistence
          timestamp: Date.now()
        });
        performanceMonitor.endOperation(cacheSaveId, 'cache-save', true, metadata);
      } catch (cacheError) {
        performanceMonitor.endOperation(cacheSaveId, 'cache-save', false, metadata);
        await errorHandler.handleCacheError(cacheError, 'save-completed-result', metadata);
        // Continue even if caching fails
      }

      // Inject illustration into DOM
      console.log(`🖼️ Injecting illustration into DOM: ${imageBlobURL.substring(0, 50)}...`);
      const finalInjectionId = performanceMonitor.startOperation('final-dom-injection');
      try {
        this.domInjectionService.injectIllustration(this.rendition, imageBlobURL);
        performanceMonitor.endOperation(finalInjectionId, 'final-dom-injection', true, metadata);
        console.log(`✅ Successfully injected illustration for ${locationKey}`);
      } catch (domError) {
        console.error(`❌ DOM injection failed:`, domError);
        performanceMonitor.endOperation(finalInjectionId, 'final-dom-injection', false, metadata);
        await errorHandler.handleDomError(domError, 'inject-generated-illustration', metadata);
        throw domError;
      }

      performanceMonitor.endOperation(workflowTrackingId, 'workflow-execution', true, metadata);
      logger.info(`Successfully generated and injected illustration for ${locationKey}`, undefined, metadata);
      console.log(`🎉 Complete workflow success for ${locationKey}`);
      notificationService.showGenerationCompleted(locationKey);

    } catch (error) {
      performanceMonitor.endOperation(workflowTrackingId, 'workflow-execution', false, metadata);
      
      // Cache the error state
      try {
        await this.cacheService.set(cacheKey, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      } catch (cacheError) {
        await errorHandler.handleCacheError(cacheError, 'save-error-state', metadata);
      }

      // Show failure notification
      notificationService.showGenerationFailed(
        error instanceof Error ? error.message : 'Unknown error',
        locationKey
      );

      // Log the error but don't throw - graceful degradation
      logger.error(`Workflow failed for ${locationKey}`, error, undefined, metadata);
    }
  }

  /**
   * Generate a location key from current rendition state
   */
  private generateLocationKey(): string | null {
    try {
      if (!this.rendition) {
        console.log('❌ No rendition available');
        return null;
      }

      // Try to get current location from rendition using getPosition()
      let location: any = null;
      try {
        if (this.rendition.getPosition) {
          location = this.rendition.getPosition();
        }
      } catch (e) {
        // Silent fallback
      }
      
      // Use the reader's actual position information instead of our own counter
      // The count field from getPosition() represents the reader's internal page tracking
      let locationKey = `${this.currentBookId}`;
      let readerPageNumber = 1; // Default fallback
      
      if (location && location.count !== undefined) {
        // Use the reader's count as the page identifier
        readerPageNumber = parseInt(location.count, 10) || 1;
        locationKey += `:reader-page-${readerPageNumber}`;
      } else {
        // Fallback to counter-based approach if no count available
        const counter = pageSelectionService.getNextPageCounter();
        locationKey += `:fallback-page-${counter}`;
        readerPageNumber = counter;
      }
      
      // Add specific position information to make each page unique within a chapter
      if (location) {
        // Use count and percentage to make location unique within chapter
        if (location.count) {
          locationKey += `:count-${location.count}`;
        }
        if (location.percentage) {
          // Round percentage to avoid floating point precision issues
          const roundedPercentage = Math.round(parseFloat(location.percentage) * 10000) / 10000;
          locationKey += `:pct-${roundedPercentage}`;
        }
      }
      return locationKey;

    } catch (error) {
      console.error('❌ Error generating location key:', error);
      logger.warn('Error generating location key:', error);
      // Fallback to counter-based approach
      const counter = pageSelectionService.getNextPageCounter();
      const locationKey = `${this.currentBookId}:page-${counter}`;
      console.log('🔄 Using error fallback location key:', locationKey);
      return locationKey;
    }
  }

  /**
   * Get the page document from rendition
   */
  private getPageDocument(): Document | null {
    try {
      if (!this.rendition) {
        return null;
      }

      // Try different ways to access the document
      if (this.rendition.iframe && this.rendition.iframe.contentDocument) {
        return this.rendition.iframe.contentDocument;
      }

      if (this.rendition.document) {
        return this.rendition.document;
      }

      if (this.rendition.contents && this.rendition.contents.document) {
        return this.rendition.contents.document;
      }

      return null;
    } catch (error) {
      logger.warn('Error accessing page document:', error);
      return null;
    }
  }

  /**
   * Convert base64 image data to blob URL
   */
  private createBlobURLFromBase64(base64Data: string): string {
    try {
      // Remove data URL prefix if present
      const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert to binary
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob
      const blob = new Blob([bytes], { type: 'image/png' });
      
      // Create blob URL
      return URL.createObjectURL(blob);
      
    } catch (error) {
      logger.error('Error creating blob URL from base64:', error);
      throw new AIIllustrationError(
        'Failed to process image data',
        ErrorCodes.API_ERROR,
        false
      );
    }
  }

  /**
   * Load configuration from ConfigService
   */
  private loadConfiguration(): AIIllustrationConfig {
    // Always enabled, no configuration needed
    return {
      enabled: true, // Always enabled
      frequency: 'every-second-page',
      imageQuality: 'standard',
      cacheSize: 100,
      showNotifications: false
    };
  }

  /**
   * Update configuration and apply changes
   */
  updateConfiguration(newConfig: Partial<AIIllustrationConfig>): void {
    try {
      this.config = { ...this.config, ...newConfig };
      
      // Save to ConfigService
      if (newConfig.enabled !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsEnabled', newConfig.enabled ? 'yes' : 'no');
      }
      if (newConfig.frequency) {
        ConfigService.setReaderConfig('aiIllustrationsFrequency', newConfig.frequency);
      }
      if (newConfig.imageQuality) {
        ConfigService.setReaderConfig('aiIllustrationsQuality', newConfig.imageQuality);
      }
      if (newConfig.cacheSize !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsCacheSize', newConfig.cacheSize.toString());
      }
      if (newConfig.showNotifications !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsNotifications', newConfig.showNotifications ? 'yes' : 'no');
      }

      logger.info('AI illustration configuration updated:', this.config);

    } catch (error) {
      logger.error('Error updating configuration:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): AIIllustrationConfig {
    return { ...this.config };
  }

  /**
   * Load development configuration from ConfigService
   */
  private loadDevConfiguration(): AIIllustrationDevConfig {
    try {
      const devConfig: AIIllustrationDevConfig = {
        apiEndpoint: ConfigService.getReaderConfig('aiIllustrationsApiEndpoint') || 'https://api.hyperbolic.xyz/v1',
        requestTimeout: parseInt(ConfigService.getReaderConfig('aiIllustrationsTimeout')) || 30000,
        retryAttempts: parseInt(ConfigService.getReaderConfig('aiIllustrationsRetries')) || 1,
        debugMode: ConfigService.getReaderConfig('aiIllustrationsDebug') === 'yes'
      };

      if (devConfig.debugMode) {
        logger.info('AI illustrations debug mode enabled');
        logger.debug('Development configuration:', devConfig);
      }

      return devConfig;

    } catch (error) {
      logger.warn('Error loading development configuration, using defaults:', error);
      
      return {
        apiEndpoint: 'https://api.hyperbolic.xyz/v1',
        requestTimeout: 30000,
        retryAttempts: 1,
        debugMode: false
      };
    }
  }

  /**
   * Update development configuration
   */
  updateDevConfiguration(newDevConfig: Partial<AIIllustrationDevConfig>): void {
    try {
      this.devConfig = { ...this.devConfig, ...newDevConfig };
      
      // Save to ConfigService
      if (newDevConfig.apiEndpoint) {
        ConfigService.setReaderConfig('aiIllustrationsApiEndpoint', newDevConfig.apiEndpoint);
      }
      if (newDevConfig.requestTimeout !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsTimeout', newDevConfig.requestTimeout.toString());
      }
      if (newDevConfig.retryAttempts !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsRetries', newDevConfig.retryAttempts.toString());
      }
      if (newDevConfig.debugMode !== undefined) {
        ConfigService.setReaderConfig('aiIllustrationsDebug', newDevConfig.debugMode ? 'yes' : 'no');
      }

      logger.info('AI illustration development configuration updated:', this.devConfig);

    } catch (error) {
      logger.error('Error updating development configuration:', error);
    }
  }

  /**
   * Get current development configuration
   */
  getDevConfiguration(): AIIllustrationDevConfig {
    return { ...this.devConfig };
  }

  /**
   * Enable/disable feature with immediate effect
   */
  setEnabled(enabled: boolean): void {
    this.updateConfiguration({ enabled });
    
    if (!enabled) {
      // Cancel any in-flight requests when disabling
      aiApiService.cancelAllRequests();
      this.inFlightRequests.clear();
      logger.info('AI illustrations disabled, cancelled in-flight requests');
    } else {
      logger.info('AI illustrations enabled');
    }
  }

  /**
   * Toggle debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.updateDevConfiguration({ debugMode: enabled });
    
    if (enabled) {
      logger.info('AI illustrations debug mode enabled');
    } else {
      logger.info('AI illustrations debug mode disabled');
    }
  }

  /**
   * Get service status and statistics
   */
  async getStatus(): Promise<{
    initialized: boolean;
    enabled: boolean;
    debugMode: boolean;
    currentBookId: string;
    inFlightRequests: number;
    inFlightRequestKeys: string[];
    config: AIIllustrationConfig;
    devConfig: AIIllustrationDevConfig;
    cacheStats?: {
      memory: {
        size: number;
        maxSize: number;
        estimatedSizeBytes: number;
        maxSizeBytes: number;
        hitRate: number;
        entries: Array<{
          key: string;
          timestamp: number;
          accessCount: number;
          lastAccessed: number;
          status: string;
        }>;
      };
      persistent: {
        totalEntries: number;
        entriesByBook: Map<string, number>;
        oldestEntry: number | null;
        newestEntry: number | null;
        estimatedSizeBytes: number;
      };
      combined: {
        totalUniqueKeys: number;
        memoryHitRate: number;
        persistentHitRate: number;
      };
    };
    pageSelectionStats?: {
      currentCounter: number;
      processedLocationKeys: number;
    };
  }> {
    const status = {
      initialized: this.initialized,
      enabled: this.config.enabled,
      debugMode: this.devConfig.debugMode,
      currentBookId: this.currentBookId,
      inFlightRequests: this.inFlightRequests.size,
      inFlightRequestKeys: Array.from(this.inFlightRequests),
      config: this.getConfiguration(),
      devConfig: this.getDevConfiguration(),
      cacheStats: undefined as any,
      pageSelectionStats: {
        currentCounter: pageSelectionService.getCurrentCounter(),
        processedLocationKeys: pageSelectionService.getProcessedLocationKeys().size
      }
    };

    // Add cache stats if available
    if (this.initialized) {
      try {
        status.cacheStats = await this.cacheService.getStats();
      } catch (error) {
        logger.warn('Error getting cache stats:', error);
      }
    }

    return status;
  }

  /**
   * Debug method to manually trigger processing for current page
   */
  async debugProcessCurrentPage(): Promise<void> {
    if (!this.devConfig.debugMode) {
      logger.warn('Debug mode not enabled');
      return;
    }

    const locationKey = this.generateLocationKey();
    if (locationKey) {
      logger.info(`Debug: Manually processing page ${locationKey}`);
      await this.processPage(locationKey);
    } else {
      logger.warn('Debug: Could not generate location key for current page');
    }
  }

  /**
   * Clear cache for current book or all books
   */
  async clearCache(bookId?: string): Promise<void> {
    const targetBookId = bookId || this.currentBookId;
    logger.info(`Clearing cache for book ${targetBookId}`);
    await this.cacheService.clear(targetBookId);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const stats = await this.cacheService.getStats();
      return stats;
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      throw error;
    }
  }

  /**
   * Debug method to clear all cache for current book
   */
  async debugClearCache(): Promise<void> {
    if (!this.devConfig.debugMode) {
      logger.warn('Debug mode not enabled');
      return;
    }

    logger.info(`Debug: Clearing cache for book ${this.currentBookId}`);
    await this.cacheService.clear(this.currentBookId);
  }

  /**
   * Debug method to get detailed cache information
   */
  async debugGetCacheInfo(): Promise<any> {
    if (!this.devConfig.debugMode) {
      logger.warn('Debug mode not enabled');
      return null;
    }

    try {
      const stats = await this.cacheService.getStats();
      logger.info('Debug: Cache statistics:', stats);
      return stats;
    } catch (error) {
      logger.error('Debug: Error getting cache info:', error);
      return null;
    }
  }

  /**
   * Get comprehensive service health status
   */
  async getHealthStatus(): Promise<{
    service: {
      initialized: boolean;
      enabled: boolean;
      currentBookId: string;
      inFlightRequests: number;
    };
    performance: {
      summary: any;
      recentMetrics: any[];
    };
    errors: {
      stats: any;
      recentErrors: any[];
    };
    notifications: {
      stats: any;
    };
    recommendations: string[];
  }> {
    const healthStatus = {
      service: {
        initialized: this.initialized,
        enabled: this.config.enabled,
        currentBookId: this.currentBookId,
        inFlightRequests: this.inFlightRequests.size
      },
      performance: {
        summary: performanceMonitor.getSummary(),
        recentMetrics: performanceMonitor.getRecentMetrics(50)
      },
      errors: {
        stats: errorHandler.getErrorStats(),
        recentErrors: logger.getMetrics().recentErrors
      },
      notifications: {
        stats: notificationService.getStats()
      },
      recommendations: [] as string[]
    };

    // Generate health recommendations
    const recommendations: string[] = [];

    // Performance recommendations
    const perfSummary = healthStatus.performance.summary;
    if (perfSummary.averageOperationTime > 10000) {
      recommendations.push('Average operation time is high. Consider optimizing API calls or caching strategy.');
    }

    if (perfSummary.successRate < 90) {
      recommendations.push(`Success rate is low (${perfSummary.successRate.toFixed(1)}%). Check error logs for issues.`);
    }

    // Error recommendations
    const errorStats = healthStatus.errors.stats;
    if (errorStats.totalErrors > 10) {
      recommendations.push('High error count detected. Review error logs and consider adjusting configuration.');
    }

    // Service recommendations
    if (!this.initialized && this.config.enabled) {
      recommendations.push('Service is enabled but not initialized. Check initialization process.');
    }

    if (this.inFlightRequests.size > 5) {
      recommendations.push('Many requests in flight. Consider reducing request frequency or checking for stuck requests.');
    }

    healthStatus.recommendations.push(...recommendations);

    return healthStatus;
  }

  /**
   * Generate comprehensive diagnostic report
   */
  async generateDiagnosticReport(): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      service: await this.getStatus(),
      health: await this.getHealthStatus(),
      performance: performanceMonitor.generateReport(),
      logs: logger.exportLogs(),
      configuration: {
        user: this.getConfiguration(),
        dev: this.getDevConfiguration()
      }
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Handle critical errors that require immediate attention
   */
  private async handleCriticalError(error: any, context: string): Promise<void> {
    const metadata = { bookId: this.currentBookId };
    
    // Log critical error
    logger.error(`CRITICAL ERROR in ${context}`, error, undefined, metadata);

    // Show critical error notification
    notificationService.showCustom(
      'error' as any,
      `Critical error in AI illustrations: ${error?.message || 'Unknown error'}. Feature may be disabled.`,
      { duration: 10000 }
    );

    // Consider disabling the feature temporarily
    if (this.config.enabled) {
      logger.warn('Temporarily disabling AI illustrations due to critical error');
      this.setEnabled(false);
    }

    // Generate diagnostic report for debugging
    if (this.devConfig.debugMode) {
      try {
        const diagnosticReport = await this.generateDiagnosticReport();
        logger.info('Diagnostic report generated for critical error', { reportLength: diagnosticReport.length });
      } catch (reportError) {
        logger.error('Failed to generate diagnostic report', reportError);
      }
    }
  }

  /**
   * Monitor system resources and performance
   */
  private startResourceMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (memoryUsagePercent > 90) {
          this.handleCriticalError(
            new Error(`Critical memory usage: ${memoryUsagePercent.toFixed(2)}%`),
            'memory-monitoring'
          );
        } else if (memoryUsagePercent > 80) {
          notificationService.showMemoryWarning();
        }
      }
    }, 60000); // Check every minute

    // Monitor performance
    setInterval(() => {
      const perfSummary = performanceMonitor.getSummary();
      
      if (perfSummary.averageOperationTime > 30000) {
        notificationService.showPerformanceWarning('overall', perfSummary.averageOperationTime);
      }
    }, 300000); // Check every 5 minutes
  }

  /**
   * Enable comprehensive monitoring (debug mode)
   */
  enableComprehensiveMonitoring(): void {
    if (!this.devConfig.debugMode) {
      logger.warn('Debug mode not enabled, cannot start comprehensive monitoring');
      return;
    }

    logger.info('Starting comprehensive monitoring');
    this.startResourceMonitoring();
    
    // Log periodic status updates
    setInterval(() => {
      this.getHealthStatus().then(health => {
        logger.info('Periodic health check', health);
      }).catch(error => {
        logger.error('Error during periodic health check', error);
      });
    }, 600000); // Every 10 minutes
  }
}

// Export singleton instance
export const aiIllustrationService = new AIIllustrationServiceImpl();