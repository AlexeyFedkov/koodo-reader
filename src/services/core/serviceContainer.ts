// Service container for dependency injection
import { AIIllustrationLogger } from '../utils/logger';

export class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, any> = new Map();
  private logger: AIIllustrationLogger;

  private constructor() {
    this.logger = new AIIllustrationLogger('ServiceContainer');
  }

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  public register<T>(name: string, service: T): void {
    this.logger.debug(`Registering service: ${name}`);
    this.services.set(name, service);
  }

  public get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service as T;
  }

  public has(name: string): boolean {
    return this.services.has(name);
  }

  public unregister(name: string): void {
    this.logger.debug(`Unregistering service: ${name}`);
    this.services.delete(name);
  }

  public clear(): void {
    this.logger.debug('Clearing all services');
    this.services.clear();
  }
}

// Service names constants
export const ServiceNames = {
  AI_ILLUSTRATION: 'aiIllustration',
  PAGE_SELECTION: 'pageSelection',
  TEXT_EXTRACTION: 'textExtraction',
  AI_API: 'aiApi',
  CACHE: 'cache',
  DOM_INJECTION: 'domInjection'
} as const;