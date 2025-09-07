// AbortController utilities for request cancellation
import { AIIllustrationLogger } from './logger';

export class AbortControllerManager {
  private logger = new AIIllustrationLogger('AbortControllerManager');
  private controllers: Map<string, AbortController> = new Map();

  public create(key: string): AbortController {
    // Cancel existing controller if it exists
    this.cancel(key);
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    
    this.logger.debug(`Created AbortController for key: ${key}`);
    return controller;
  }

  public get(key: string): AbortController | undefined {
    return this.controllers.get(key);
  }

  public cancel(key: string): void {
    const controller = this.controllers.get(key);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      this.logger.debug(`Cancelled AbortController for key: ${key}`);
    }
    this.controllers.delete(key);
  }

  public cancelAll(): void {
    this.logger.debug(`Cancelling all ${this.controllers.size} AbortControllers`);
    
    for (const [key, controller] of this.controllers.entries()) {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
    
    this.controllers.clear();
  }

  public cleanup(key: string): void {
    this.controllers.delete(key);
  }

  public size(): number {
    return this.controllers.size;
  }
}