// Simple validation script to check TypeScript interfaces
import { 
  AIIllustrationService,
  PageSelectionService,
  TextExtractionService,
  AIApiService,
  CacheService,
  DOMInjectionService,
  LocationKey,
  CachedIllustration,
  AIIllustrationConfig,
  AIIllustrationDevConfig,
  PromptRequest,
  ImageRequest,
  AIIllustrationError,
  ErrorCodes
} from './types/aiIllustration';

// This file serves as a compile-time validation of our interfaces
// If this compiles without errors, our interfaces are correctly defined

// Example implementations to validate interface contracts
class MockAIIllustrationService implements AIIllustrationService {
  async initialize(rendition: any, bookId: string): Promise<void> {
    // Mock implementation
  }

  async processPage(locationKey: string): Promise<void> {
    // Mock implementation
  }

  isEligiblePage(locationKey: string): boolean {
    return true;
  }

  cleanup(): void {
    // Mock implementation
  }
}

class MockPageSelectionService implements PageSelectionService {
  shouldProcessPage(locationKey: string): boolean {
    return true;
  }

  incrementPageCounter(): void {
    // Mock implementation
  }

  resetCounter(): void {
    // Mock implementation
  }

  isAlreadyProcessed(locationKey: string): boolean {
    return false;
  }
}

class MockTextExtractionService implements TextExtractionService {
  extractPageText(rendition: any): string {
    return 'mock text';
  }

  normalizeText(rawText: string): string {
    return rawText.trim();
  }
}

class MockAIApiService implements AIApiService {
  async generatePrompt(locationKey: string, text: string): Promise<string> {
    return 'mock prompt';
  }

  async generateImage(locationKey: string, prompt: string): Promise<string> {
    return 'blob:mock-url';
  }
}

class MockCacheService implements CacheService {
  async get(key: string): Promise<CachedIllustration | null> {
    return null;
  }

  async set(key: string, data: CachedIllustration): Promise<void> {
    // Mock implementation
  }

  async hydrateFromPersistent(bookId: string): Promise<void> {
    // Mock implementation
  }

  async clear(bookId?: string): Promise<void> {
    // Mock implementation
  }
}

class MockDOMInjectionService implements DOMInjectionService {
  injectIllustration(rendition: any, imageBlobURL: string): void {
    // Mock implementation
  }

  injectStylesheet(document: Document): void {
    // Mock implementation
  }

  removeIllustrations(document: Document): void {
    // Mock implementation
  }
}

// Validate data structures
const mockLocationKey: LocationKey = {
  bookId: 'test-book',
  chapterIndex: 1,
  pageOffset: 0,
  cfi: 'epubcfi(/6/4[chapter01]!/4/2/2[para01]/1:0)'
};

const mockCachedIllustration: CachedIllustration = {
  status: 'completed',
  prompt: 'A beautiful landscape',
  imageBlobURL: 'blob:http://localhost/test',
  timestamp: Date.now()
};

const mockConfig: AIIllustrationConfig = {
  enabled: true,
  frequency: 'every-second-page',
  imageQuality: 'standard',
  cacheSize: 100,
  showNotifications: true
};

const mockDevConfig: AIIllustrationDevConfig = {
  apiEndpoint: 'https://api.hyperbolic.xyz/v1',
  requestTimeout: 30000,
  retryAttempts: 1,
  debugMode: false
};

const mockPromptRequest: PromptRequest = {
  model: "openai/gpt-oss-20b",
  messages: [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Generate an image prompt" }
  ],
  max_tokens: 512,
  temperature: 0.7,
  top_p: 0.8,
  stream: false
};

const mockImageRequest: ImageRequest = {
  model_name: "FLUX.1-dev",
  prompt: "A beautiful landscape",
  enable_refiner: "false",
  negative_prompt: "blurry, low quality",
  strength: "0.8",
  steps: "30",
  cfg_scale: "5",
  resolution: "1024x1024",
  backend: "auto"
};

// Validate error handling
const mockError = new AIIllustrationError(
  'Test error',
  ErrorCodes.API_ERROR,
  true
);

console.log('All interfaces validated successfully!');
export { 
  MockAIIllustrationService,
  MockPageSelectionService,
  MockTextExtractionService,
  MockAIApiService,
  MockCacheService,
  MockDOMInjectionService
};