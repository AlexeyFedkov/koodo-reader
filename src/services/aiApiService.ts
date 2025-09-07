/**
 * AI API Service for generating prompts and images via Hyperbolic APIs
 * Communicates with main process through IPC bridge for secure API access
 */

import { isElectron } from 'react-device-detect';
import { performanceMonitor } from './utils/performanceMonitor';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { notificationService } from './utils/notificationService';

export interface AIApiResponse<T> {
  success: boolean;
  error?: string;
  cancelled?: boolean;
  shouldRetry?: boolean;
  data?: T;
}

export interface PromptResponse {
  prompt: string;
  locationKey: string;
}

export interface ImageResponse {
  imageData: string; // base64 encoded image
  locationKey: string;
}

export class AIApiService {
  private abortControllers: Map<string, AbortController> = new Map();
  private readonly MAX_RETRIES = 1;
  private readonly RETRY_DELAY_MS = 1000;

  /**
   * Set the Hyperbolic API key (stored securely in main process)
   */
  async setApiKey(apiKey: string): Promise<boolean> {
    // API key is hardcoded, no need to set it
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(attempt: number): number {
    return this.RETRY_DELAY_MS * Math.pow(2, attempt);
  }

  /**
   * Execute API call with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<AIApiResponse<T>>,
    locationKey: string,
    operationType: string
  ): Promise<AIApiResponse<T>> {
    let lastError: string = "";
    const retryTrackingId = performanceMonitor.startOperation(`${operationType.toLowerCase()}-retry-logic`);
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      // Check if request was cancelled before retry
      if (!this.abortControllers.has(locationKey)) {
        performanceMonitor.endOperation(retryTrackingId, `${operationType.toLowerCase()}-retry-logic`, false, {
          locationKey,
          reason: 'cancelled',
          attempt
        });
        return {
          success: false,
          error: "Request was cancelled",
          cancelled: true
        };
      }

      try {
        const result = await operation();
        
        // If successful or explicitly cancelled, return immediately
        if (result.success || result.cancelled) {
          performanceMonitor.endOperation(retryTrackingId, `${operationType.toLowerCase()}-retry-logic`, result.success, {
            locationKey,
            attempt,
            success: result.success,
            cancelled: result.cancelled
          });
          return result;
        }

        // If this is the last attempt, return the error
        if (attempt === this.MAX_RETRIES) {
          performanceMonitor.endOperation(retryTrackingId, `${operationType.toLowerCase()}-retry-logic`, false, {
            locationKey,
            attempt,
            reason: 'max-retries-exceeded'
          });
          return result;
        }

        // Only retry on 5xx errors or network issues
        if (result.shouldRetry) {
          lastError = result.error || "Unknown error";
          const delay = this.getRetryDelay(attempt);
          
          logger.warn(
            `${operationType} attempt ${attempt + 1} failed for ${locationKey}: ${result.error}. Retrying in ${delay}ms...`,
            { attempt, delay, error: result.error },
            { locationKey }
          );
          
          await this.sleep(delay);
          continue;
        } else {
          // Don't retry on 4xx errors or other non-retryable errors
          logger.info(
            `${operationType} failed with non-retryable error for ${locationKey}: ${result.error}`,
            { attempt, error: result.error },
            { locationKey }
          );
          performanceMonitor.endOperation(retryTrackingId, `${operationType.toLowerCase()}-retry-logic`, false, {
            locationKey,
            attempt,
            reason: 'non-retryable-error'
          });
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        
        // If this is the last attempt, return the error
        if (attempt === this.MAX_RETRIES) {
          logger.error(
            `${operationType} failed after ${attempt + 1} attempts for ${locationKey}`,
            error,
            { attempt },
            { locationKey }
          );
          performanceMonitor.endOperation(retryTrackingId, `${operationType.toLowerCase()}-retry-logic`, false, {
            locationKey,
            attempt,
            reason: 'exception-max-retries'
          });
          return {
            success: false,
            error: lastError
          };
        }

        // Wait before retry
        const delay = this.getRetryDelay(attempt);
        logger.warn(
          `${operationType} attempt ${attempt + 1} failed for ${locationKey}: ${lastError}. Retrying in ${delay}ms...`,
          { attempt, delay, error: lastError },
          { locationKey }
        );
        
        await this.sleep(delay);
      }
    }

    performanceMonitor.endOperation(retryTrackingId, `${operationType.toLowerCase()}-retry-logic`, false, {
      locationKey,
      reason: 'fallthrough'
    });

    return {
      success: false,
      error: lastError || "Max retries exceeded"
    };
  }

  /**
   * Generate a prompt for image generation using chat completions API
   */
  async generatePrompt(locationKey: string, text: string): Promise<AIApiResponse<PromptResponse>> {
    const trackingId = performanceMonitor.startOperation('api-prompt-generation');
    const metadata = { locationKey, textLength: text.length };

    // Cancel any existing request for this location
    this.cancelRequest(locationKey);

    // Create new abort controller
    const abortController = new AbortController();
    this.abortControllers.set(locationKey, abortController);

    const operation = async (): Promise<AIApiResponse<PromptResponse>> => {
      try {
        console.log('🌐 Making direct API call for prompt generation');
        logger.debug('Starting prompt generation API call', { locationKey, textLength: text.length });
        
        // Make direct API call
        const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtcmZlZGtvdkBnbWFpbC5jb20iLCJpYXQiOjE3Mzk0NTg2MTh9.M_42ijlTQmEPkprxul3hZc6VwNrj1D_t2PVTtu3yKXM',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [
              {
                role: "system",
                content: "You are an expert at creating vivid scene descriptions for book illustrations. Create a detailed visual description based on the text provided. If the text is very short (like a chapter title), imagine an appropriate scene that would fit that context. Focus on visual elements: characters, setting, atmosphere, lighting, and mood. Keep the description under 150 words."
              },
              {
                role: "user",
                content: `Create a detailed illustration description for: "${text}". If this is just a title or short text, imagine a compelling visual scene that would represent this part of the story.`
              }
            ],
            max_tokens: 1000,
            temperature: 0.8,
            top_p: 0.9,
            stream: false
          }),
          signal: abortController.signal
        });

        const result = await response.json();
        console.log('🔍 Full API response:', result);
        console.log('🔍 Choices array:', result.choices);
        console.log('🔍 First choice:', result.choices?.[0]);
        console.log('🔍 Message object:', result.choices?.[0]?.message);

        if (response.ok && result.choices && result.choices[0]) {
          const prompt = result.choices[0].message.content;
          console.log('🔍 Extracted prompt from choices:', prompt);
          logger.debug('Prompt generation successful', { locationKey, promptLength: prompt?.length });
          return {
            success: true,
            data: {
              prompt: prompt,
              locationKey: locationKey
            }
          };
        } else {
          const errorMsg = result.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          logger.warn('Prompt generation failed', { locationKey, error: errorMsg, status: response.status });
          
          // Handle specific error types
          if (response.status === 429) {
            notificationService.showRateLimitWarning();
          } else if (response.status === 401 || response.status === 403) {
            notificationService.showAuthenticationError();
          } else if (!response.ok) {
            notificationService.showNetworkError(response.status >= 500);
          }

          return {
            success: false,
            error: errorMsg,
            shouldRetry: response.status >= 500
          };
        }
      } catch (error) {
        logger.error("Prompt generation failed with exception", error, { locationKey });
        
        await errorHandler.handleApiError(error, 'prompt-generation', { locationKey });
        
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    };

    try {
      const result = await this.executeWithRetry(operation, locationKey, "Prompt generation");
      performanceMonitor.endOperation(trackingId, 'api-prompt-generation', result.success, {
        ...metadata,
        success: result.success,
        retryCount: result.cancelled ? 0 : 1
      });
      return result;
    } finally {
      // Clean up abort controller
      this.abortControllers.delete(locationKey);
    }
  }

  /**
   * Generate an image using FLUX.1-dev model
   */
  async generateImage(locationKey: string, prompt: string): Promise<AIApiResponse<ImageResponse>> {
    const trackingId = performanceMonitor.startOperation('api-image-generation');
    const metadata = { locationKey, promptLength: prompt.length };

    // Cancel any existing request for this location
    this.cancelRequest(locationKey);

    // Create new abort controller
    const abortController = new AbortController();
    this.abortControllers.set(locationKey, abortController);

    const operation = async (): Promise<AIApiResponse<ImageResponse>> => {
      try {
        console.log('🌐 Making direct API call for image generation');
        logger.debug('Starting image generation API call', { locationKey, promptLength: prompt.length });
        
        const requestBody = {
          'model_name': 'FLUX.1-dev',
          'prompt': prompt,
          'height': 1024,
          'width': 1024,
          'steps': 30,
          'cfg_scale': 5
        };
        console.log('🔍 Request body:', requestBody);
        
        // Make direct API call
        const response = await fetch('https://api.hyperbolic.xyz/v1/image/generation', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtcmZlZGtvdkBnbWFpbC5jb20iLCJpYXQiOjE3Mzk0NTg2MTh9.M_42ijlTQmEPkprxul3hZc6VwNrj1D_t2PVTtu3yKXM',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal
        });

        const result = await response.json();
        console.log('🔍 Image API response:', result);
        console.log('🔍 Response status:', response.status);
        
        if (result.detail) {
          console.log('🔍 Error details:', result.detail);
          result.detail.forEach((detail, index) => {
            console.log(`🔍 Error ${index + 1}:`, detail);
            if (detail.loc) {
              console.log(`🔍 Missing field location:`, detail.loc);
            }
          });
        }

        if (response.ok && result.images && result.images[0]) {
          console.log('🔍 First image object:', result.images[0]);
          const imageData = result.images[0].image;
          logger.debug('Image generation successful', { 
            locationKey, 
            imageDataLength: imageData?.length 
          });
          return {
            success: true,
            data: {
              imageData: imageData,
              locationKey: locationKey
            }
          };
        } else {
          const errorMsg = result.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          logger.warn('Image generation failed', { 
            locationKey, 
            error: errorMsg, 
            status: response.status 
          });
          
          // Handle specific error types
          if (response.status === 429) {
            notificationService.showRateLimitWarning();
          } else if (response.status === 401 || response.status === 403) {
            notificationService.showAuthenticationError();
          } else if (!response.ok) {
            notificationService.showNetworkError(response.status >= 500);
          }

          return {
            success: false,
            error: errorMsg,
            shouldRetry: response.status >= 500
          };
        }
      } catch (error) {
        logger.error("Image generation failed with exception", error, { locationKey });
        
        await errorHandler.handleApiError(error, 'image-generation', { locationKey });
        
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    };

    try {
      const result = await this.executeWithRetry(operation, locationKey, "Image generation");
      performanceMonitor.endOperation(trackingId, 'api-image-generation', result.success, {
        ...metadata,
        success: result.success,
        retryCount: result.cancelled ? 0 : 1
      });
      return result;
    } finally {
      // Clean up abort controller
      this.abortControllers.delete(locationKey);
    }
  }

  /**
   * Cancel any in-flight request for a specific location
   */
  cancelRequest(locationKey: string): void {
    const controller = this.abortControllers.get(locationKey);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(locationKey);
    }
  }

  /**
   * Cancel all in-flight requests
   */
  cancelAllRequests(): void {
    for (const [locationKey, controller] of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  /**
   * Check if there's an active request for a location
   */
  hasActiveRequest(locationKey: string): boolean {
    return this.abortControllers.has(locationKey);
  }

  /**
   * Get the number of active requests
   */
  getActiveRequestCount(): number {
    return this.abortControllers.size;
  }
}

// Export singleton instance
export const aiApiService = new AIApiService();