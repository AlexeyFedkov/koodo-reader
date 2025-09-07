import { AIIllustrationError, ErrorCodes } from '../../types/aiIllustration';

describe('Error Handling Simple Tests', () => {
  describe('AIIllustrationError class', () => {
    it('should create error with correct properties', () => {
      const error = new AIIllustrationError(
        'Test error message',
        ErrorCodes.API_ERROR,
        true
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(ErrorCodes.API_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('AIIllustrationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should default retryable to false', () => {
      const error = new AIIllustrationError(
        'Non-retryable error',
        ErrorCodes.AUTHENTICATION_ERROR
      );

      expect(error.retryable).toBe(false);
    });

    it('should handle all error codes', () => {
      const errorCodes = [
        ErrorCodes.API_ERROR,
        ErrorCodes.NETWORK_ERROR,
        ErrorCodes.CACHE_ERROR,
        ErrorCodes.DOM_ERROR,
        ErrorCodes.TEXT_EXTRACTION_ERROR,
        ErrorCodes.RATE_LIMIT_ERROR,
        ErrorCodes.AUTHENTICATION_ERROR
      ];

      errorCodes.forEach(code => {
        const error = new AIIllustrationError('Test', code, true);
        expect(error.code).toBe(code);
      });
    });
  });

  describe('Error categorization', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        new AIIllustrationError('Network timeout', ErrorCodes.NETWORK_ERROR, true),
        new AIIllustrationError('Rate limited', ErrorCodes.RATE_LIMIT_ERROR, true),
        new AIIllustrationError('Server error', ErrorCodes.API_ERROR, true)
      ];

      retryableErrors.forEach(error => {
        expect(error.retryable).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new AIIllustrationError('Invalid API key', ErrorCodes.AUTHENTICATION_ERROR, false),
        new AIIllustrationError('Bad request', ErrorCodes.API_ERROR, false),
        new AIIllustrationError('DOM not found', ErrorCodes.DOM_ERROR, false)
      ];

      nonRetryableErrors.forEach(error => {
        expect(error.retryable).toBe(false);
      });
    });
  });

  describe('Error context preservation', () => {
    it('should preserve stack trace', () => {
      const error = new AIIllustrationError(
        'Test error',
        ErrorCodes.API_ERROR,
        false
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AIIllustrationError');
    });

    it('should be catchable as Error', () => {
      try {
        throw new AIIllustrationError('Test', ErrorCodes.API_ERROR, false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AIIllustrationError);
      }
    });
  });

  describe('Error message formatting', () => {
    it('should handle empty messages', () => {
      const error = new AIIllustrationError('', ErrorCodes.API_ERROR, false);
      expect(error.message).toBe('');
    });

    it('should handle long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const error = new AIIllustrationError(longMessage, ErrorCodes.API_ERROR, false);
      expect(error.message).toBe(longMessage);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Error with "quotes" and \n newlines \t tabs';
      const error = new AIIllustrationError(specialMessage, ErrorCodes.API_ERROR, false);
      expect(error.message).toBe(specialMessage);
    });
  });
});