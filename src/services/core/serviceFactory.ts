// Service factory for creating and configuring AI Illustration services
import { ServiceContainer, ServiceNames } from './serviceContainer';
import { AIIllustrationLogger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import { AbortControllerManager } from '../utils/abortController';
import { 
  AIIllustrationService,
  PageSelectionService,
  TextExtractionService,
  AIApiService,
  CacheService,
  DOMInjectionService
} from '../types/aiIllustration';

export class ServiceFactory {
  private static logger = new AIIllustrationLogger('ServiceFactory');
  private static initialized = false;

  /**
   * Initialize all AI Illustration services
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Services already initialized');
      return;
    }

    try {
      this.logger.info('Initializing AI Illustration services');
      const container = ServiceContainer.getInstance();

      // Register utility services
      container.register('abortControllerManager', new AbortControllerManager());

      // TODO: Register service implementations when they are created
      // const pageSelectionService = new PageSelectionServiceImpl();
      // container.register(ServiceNames.PAGE_SELECTION, pageSelectionService);

      // const textExtractionService = new TextExtractionServiceImpl();
      // container.register(ServiceNames.TEXT_EXTRACTION, textExtractionService);

      // const cacheService = new CacheServiceImpl();
      // container.register(ServiceNames.CACHE, cacheService);

      // const aiApiService = new AIApiServiceImpl();
      // container.register(ServiceNames.AI_API, aiApiService);

      // const domInjectionService = new DOMInjectionServiceImpl();
      // container.register(ServiceNames.DOM_INJECTION, domInjectionService);

      // const aiIllustrationService = new AIIllustrationServiceImpl(
      //   pageSelectionService,
      //   textExtractionService,
      //   cacheService,
      //   aiApiService,
      //   domInjectionService
      // );
      // container.register(ServiceNames.AI_ILLUSTRATION, aiIllustrationService);

      this.initialized = true;
      this.logger.info('AI Illustration services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AI Illustration services', error);
      errorHandler.handleError(error as Error, { context: 'ServiceFactory.initialize' });
      throw error;
    }
  }

  /**
   * Get the main AI Illustration service
   */
  public static getAIIllustrationService(): AIIllustrationService {
    this.ensureInitialized();
    return ServiceContainer.getInstance().get<AIIllustrationService>(ServiceNames.AI_ILLUSTRATION);
  }

  /**
   * Get a specific service by name
   */
  public static getService<T>(serviceName: string): T {
    this.ensureInitialized();
    return ServiceContainer.getInstance().get<T>(serviceName);
  }

  /**
   * Cleanup all services
   */
  public static async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      this.logger.info('Cleaning up AI Illustration services');
      const container = ServiceContainer.getInstance();

      // Cancel all in-flight requests
      if (container.has('abortControllerManager')) {
        const abortManager = container.get<AbortControllerManager>('abortControllerManager');
        abortManager.cancelAll();
      }

      // Cleanup main service
      if (container.has(ServiceNames.AI_ILLUSTRATION)) {
        const aiService = container.get<AIIllustrationService>(ServiceNames.AI_ILLUSTRATION);
        aiService.cleanup();
      }

      // Clear service container
      container.clear();
      
      this.initialized = false;
      this.logger.info('AI Illustration services cleaned up successfully');
    } catch (error) {
      this.logger.error('Error during service cleanup', error);
      errorHandler.handleError(error as Error, { context: 'ServiceFactory.cleanup' });
    }
  }

  /**
   * Check if services are initialized
   */
  public static isInitialized(): boolean {
    return this.initialized;
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AI Illustration services not initialized. Call ServiceFactory.initialize() first.');
    }
  }
}