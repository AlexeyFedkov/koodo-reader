# Implementation Plan

- [x] 1. Set up core service infrastructure and interfaces




  - Create TypeScript interfaces for all services and data models
  - Set up service dependency injection structure
  - Create base error handling and logging utilities
  - _Requirements: 1.1, 2.1, 5.1_

- [x] 2. Implement cache service with dual-tier storage





  - [x] 2.1 Create in-memory cache with LRU eviction


    - Implement Map-based cache with size limits and timestamp tracking
    - Add LRU eviction logic when cache size exceeds limits
    - Create cache key generation utilities for bookId:locationKey format
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.2 Implement IndexedDB persistent cache


    - Create IndexedDB schema for storing illustration data
    - Implement CRUD operations for cached illustrations
    - Add cache hydration logic to load from IndexedDB on startup
    - _Requirements: 3.2, 3.5_

  - [x] 2.3 Create unified cache service interface


    - Implement cache service that coordinates memory and persistent storage
    - Add cache invalidation and cleanup methods
    - Create cache statistics and monitoring utilities
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 3. Create page selection service with deterministic logic





  - Implement logical page counter that increments on new location keys
  - Add modulo-based selection logic (counter % 2 === 1) for every second page
  - Create location key tracking to prevent duplicate processing
  - Add counter reset functionality for new books
  - _Requirements: 1.2, 6.3, 6.4, 6.5_

- [x] 4. Build text extraction service for content processing





  - [x] 4.1 Implement page text extraction from foliate.js rendition


    - Access iframe document.body from current page
    - Extract visible text content while preserving context
    - Handle different book formats (EPUB, PDF, TXT)
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Create text normalization utilities


    - Remove HTML tags, footnotes, and navigation elements
    - Collapse whitespace and normalize line breaks
    - Limit text length while preserving essential context
    - _Requirements: 2.2_

- [x] 5. Implement AI API service with IPC communication





  - [x] 5.1 Create IPC bridge methods in main process


    - Add "ai-generate-prompt" IPC handler for chat API calls
    - Add "ai-generate-image" IPC handler for image generation
    - Implement secure API key management using OS credential store
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 Implement Hyperbolic API integration


    - Create prompt generation using chat completions API
    - Implement image generation using FLUX.1-dev model
    - Add proper request/response handling and error parsing
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 5.3 Add retry logic and error handling


    - Implement single retry for 5xx errors with exponential backoff
    - Add request cancellation using AbortController
    - Create graceful error handling that doesn't interrupt reading
    - _Requirements: 5.5, 6.1, 6.2_

- [x] 6. Create DOM injection service for non-destructive image placement





  - [x] 6.1 Implement image injection into page DOM


    - Create figure element with proper CSS classes
    - Insert image at top of page content before first paragraph
    - Ensure images are responsive and maintain aspect ratio
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Add scoped CSS styling


    - Create CSS rules that don't affect original EPUB resources
    - Implement responsive image sizing within text column width
    - Add loading states and error handling for images
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 6.3 Create cleanup and removal utilities


    - Implement methods to remove injected illustrations
    - Add cleanup logic for page navigation and book changes
    - Ensure no memory leaks from DOM references
    - _Requirements: 4.5_

- [x] 7. Build main AI illustration orchestration service





  - [x] 7.1 Create service initialization and lifecycle management


    - Initialize all dependent services (cache, text extraction, etc.)
    - Hook into foliate.js rendition "rendered" event
    - Implement service cleanup and resource management
    - _Requirements: 1.1, 1.5_

  - [x] 7.2 Implement main processing workflow


    - Coordinate page selection, text extraction, and API calls
    - Manage single-flight requests to prevent duplicate processing
    - Handle workflow errors gracefully without interrupting reading
    - _Requirements: 1.3, 1.4, 3.3, 6.1_

  - [x] 7.3 Add configuration and feature toggles


    - Integrate with existing ConfigService for user settings
    - Implement feature enable/disable functionality
    - Add debugging and development mode options
    - _Requirements: 1.1, 1.5_

- [x] 8. Integrate with existing Viewer component





  - [x] 8.1 Hook into rendition lifecycle events


    - Modify Viewer component to initialize AI illustration service
    - Connect to existing "rendered" event in handleRest method
    - Ensure integration doesn't affect existing functionality
    - _Requirements: 1.1, 1.5_

  - [x] 8.2 Add service cleanup on component unmount


    - Implement proper cleanup when leaving reader or changing books
    - Cancel in-flight requests during rapid page navigation
    - Clear component-specific cache and references
    - _Requirements: 6.1, 6.2_

- [x] 9. Add configuration UI and user controls





  - Create settings panel integration for AI illustration preferences
  - Add enable/disable toggle in reader settings
  - Implement cache management controls (clear cache, size limits)
  - Add user feedback for API errors and limitations
  - _Requirements: 1.1, 1.5_

- [x] 10. Implement comprehensive error handling and logging





  - Add structured logging for debugging and monitoring
  - Implement graceful degradation for API failures
  - Create user-friendly error messages and notifications
  - Add performance monitoring and metrics collection
  - _Requirements: 5.5, 6.1, 6.2_

- [x] 11. Create unit tests for all services





  - [x] 11.1 Test cache service functionality


    - Write tests for in-memory cache operations and LRU eviction
    - Test IndexedDB operations and error handling
    - Verify cache hydration and cleanup logic
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 11.2 Test page selection and text extraction


    - Verify deterministic page selection logic
    - Test text extraction with various book formats
    - Validate text normalization and length limits
    - _Requirements: 1.2, 2.1, 2.2, 6.3, 6.4_

  - [x] 11.3 Test API integration and error handling


    - Mock Hyperbolic API responses for testing
    - Test retry logic and error scenarios
    - Verify request cancellation and cleanup
    - _Requirements: 2.3, 2.4, 5.5, 6.1, 6.2_

- [x] 12. Integration testing with foliate.js and real books





  - Test with sample EPUB files to verify end-to-end functionality
  - Validate performance impact on reading experience
  - Test memory usage and cleanup during extended reading sessions
  - Verify compatibility with different book formats and sizes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_