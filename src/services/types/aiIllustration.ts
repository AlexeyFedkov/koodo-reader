// Core interfaces and types for AI Illustration feature

export interface LocationKey {
  bookId: string;
  chapterIndex: number;
  pageOffset: number;
  cfi?: string; // For EPUB
  pageNumber?: number; // For PDF
}

export interface CachedIllustration {
  status: 'generating' | 'completed' | 'error';
  prompt?: string;
  imageBlobURL?: string; // Temporary blob URL for immediate use
  imageBase64?: string; // Persistent base64 data for cache storage
  timestamp: number;
  error?: string;
}

export interface AIIllustrationConfig {
  enabled: boolean;
  frequency: 'every-page' | 'every-second-page' | 'every-third-page';
  imageQuality: 'standard' | 'high';
  cacheSize: number; // MB
  showNotifications: boolean;
}

export interface AIIllustrationDevConfig {
  apiEndpoint: string;
  requestTimeout: number;
  retryAttempts: number;
  debugMode: boolean;
}

// API Request/Response Models
export interface PromptRequest {
  model: "openai/gpt-oss-20b";
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  max_tokens: 512;
  temperature: 0.7;
  top_p: 0.8;
  stream: false;
}

export interface ImageRequest {
  model_name: "FLUX.1-dev";
  prompt: string;
  enable_refiner: "false";
  negative_prompt: string;
  strength: "0.8";
  steps: "30";
  cfg_scale: "5";
  resolution: "1024x1024";
  backend: "auto";
}

export interface PromptResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ImageResponse {
  images: Array<{
    url: string;
  }>;
}

// Service Interfaces
export interface AIIllustrationService {
  initialize(rendition: any, bookId: string): Promise<void>;
  processPage(locationKey: string): Promise<void>;
  isEligiblePage(locationKey: string): boolean;
  cleanup(): void;
}

export interface PageSelectionService {
  shouldProcessPage(locationKey: string): boolean;
  incrementPageCounter(): void;
  resetCounter(): void;
  isAlreadyProcessed(locationKey: string): boolean;
}

export interface TextExtractionService {
  extractPageText(rendition: any): string;
  normalizeText(rawText: string): string;
}

export interface AIApiService {
  generatePrompt(locationKey: string, text: string): Promise<string>;
  generateImage(locationKey: string, prompt: string): Promise<string>;
}

export interface CacheService {
  get(key: string): Promise<CachedIllustration | null>;
  set(key: string, data: CachedIllustration): Promise<void>;
  hydrateFromPersistent(bookId: string): Promise<void>;
  clear(bookId?: string): Promise<void>;
}

export interface DOMInjectionService {
  injectIllustration(rendition: any, imageBlobURL: string): void;
  injectStylesheet(document: Document): void;
  removeIllustrations(document: Document): void;
}

// Error Types
export class AIIllustrationError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean = false) {
    super(message);
    this.name = 'AIIllustrationError';
    this.code = code;
    this.retryable = retryable;
  }
}

export enum ErrorCodes {
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  DOM_ERROR = 'DOM_ERROR',
  TEXT_EXTRACTION_ERROR = 'TEXT_EXTRACTION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR'
}