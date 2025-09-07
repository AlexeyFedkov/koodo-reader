# Requirements Document

## Introduction

This feature adds AI-generated illustrations to books in Koodo/Kedoo by integrating with the existing foliate.js rendering system. The system will automatically generate contextual images for every second page of a book using Hyperbolic's AI APIs, creating an enhanced reading experience without disrupting the original EPUB content or user interface.

## Requirements

### Requirement 1

**User Story:** As a reader, I want to see AI-generated illustrations on every second page of my book, so that I can have a more immersive and visually engaging reading experience.

#### Acceptance Criteria

1. WHEN a user opens a book THEN the system SHALL hook into foliate.js page rendering lifecycle
2. WHEN a page is rendered THEN the system SHALL determine if it's an even-numbered page (every second page)
3. WHEN an even-numbered page is displayed THEN the system SHALL generate and display a contextual illustration
4. WHEN an illustration is generated THEN it SHALL be injected as a single image at the top of the page content
5. WHEN the same page is viewed again THEN the system SHALL display the cached illustration without regenerating

### Requirement 2

**User Story:** As a reader, I want illustrations that match the content of each page, so that the images enhance rather than distract from the story.

#### Acceptance Criteria

1. WHEN a page is selected for illustration THEN the system SHALL extract visible text from the current page only
2. WHEN text is extracted THEN the system SHALL normalize it by removing tags, notes, and collapsing whitespace
3. WHEN creating an image prompt THEN the system SHALL call Hyperbolic's chat API with the normalized text
4. WHEN generating the prompt THEN the system SHALL request a concise description including characters, setting, historical era, mood, and time of day
5. WHEN the prompt is created THEN it SHALL exclude text overlays and watermarks

### Requirement 3

**User Story:** As a reader, I want illustrations to load quickly and not slow down my reading, so that the feature enhances rather than hinders my experience.

#### Acceptance Criteria

1. WHEN an illustration is requested THEN the system SHALL first check in-memory cache by bookId and locationKey
2. WHEN not found in memory THEN the system SHALL check IndexedDB persistent cache
3. WHEN not found in persistent cache THEN the system SHALL generate new illustration via API
4. WHEN an illustration is generated THEN it SHALL be cached both in memory and IndexedDB
5. WHEN the same book is reopened THEN previously generated illustrations SHALL display immediately from cache
6. WHEN multiple requests are made for the same page THEN only one API call SHALL be in progress (single-flight)

### Requirement 4

**User Story:** As a reader, I want the illustrations to integrate seamlessly with the book layout, so that they don't disrupt the original formatting or readability.

#### Acceptance Criteria

1. WHEN an illustration is injected THEN it SHALL be placed at the top of the page content before the first paragraph
2. WHEN an illustration is displayed THEN it SHALL fit within the text column width
3. WHEN an illustration is shown THEN it SHALL preserve its aspect ratio
4. WHEN styling is applied THEN it SHALL use scoped CSS that doesn't affect original EPUB resources
5. WHEN the page is rendered THEN the original EPUB content SHALL remain unmodified

### Requirement 5

**User Story:** As a system administrator, I want API credentials to be stored securely, so that sensitive information is protected.

#### Acceptance Criteria

1. WHEN the application starts THEN API keys SHALL be stored using OS credential store (keytar)
2. WHEN making API calls THEN they SHALL be executed from Electron main process to avoid CORS
3. WHEN the renderer needs AI services THEN it SHALL use IPC bridge methods (generatePrompt, generateImage)
4. WHEN handling credentials THEN the renderer process SHALL never access raw API keys
5. WHEN API calls fail THEN the system SHALL retry once on transient 5xx errors

### Requirement 6

**User Story:** As a reader, I want the system to handle page navigation gracefully, so that rapid page changes don't cause issues or unnecessary API calls.

#### Acceptance Criteria

1. WHEN a user rapidly changes pages THEN in-flight API requests SHALL be cancelled using AbortController
2. WHEN a page is already being processed THEN additional requests for the same page SHALL be ignored
3. WHEN determining page selection THEN the system SHALL use a logical page counter that increments on each new location key
4. WHEN a location key is encountered THEN it SHALL be processed only if counter % 2 === 1 (every second page)
5. WHEN a location key has been processed before THEN it SHALL be skipped to avoid duplicate work