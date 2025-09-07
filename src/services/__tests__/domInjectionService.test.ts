import { DOMInjectionService } from '../domInjectionService';
import { ErrorCodes } from '../types/aiIllustration';

// Mock DOM environment
const mockDocument = {
  createElement: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  getElementById: jest.fn(),
  head: null as any,
  body: null as any
};

const mockElement = {
  className: '',
  textContent: '',
  style: {},
  appendChild: jest.fn(),
  insertBefore: jest.fn(),
  remove: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  parentNode: {
    insertBefore: jest.fn()
  }
};

const mockRendition = {
  iframe: {
    contentDocument: mockDocument
  }
};

describe('DOMInjectionService', () => {
  let service: DOMInjectionService;

  beforeEach(() => {
    service = new DOMInjectionService();
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockDocument.createElement.mockReturnValue(mockElement);
    mockDocument.querySelector.mockReturnValue(mockElement);
    mockDocument.querySelectorAll.mockReturnValue([]);
    mockDocument.getElementById.mockReturnValue(null);
    mockDocument.head = mockElement;
    mockDocument.body = mockElement;
  });

  describe('injectIllustration', () => {
    it('should inject illustration successfully', () => {
      const imageBlobURL = 'blob:test-url';
      
      // Mock finding insertion point
      mockDocument.querySelector.mockReturnValue(mockElement);
      mockElement.textContent = 'This is a long enough paragraph for insertion';
      
      expect(() => {
        service.injectIllustration(mockRendition, imageBlobURL);
      }).not.toThrow();
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('figure');
      expect(mockDocument.createElement).toHaveBeenCalledWith('img');
      expect(mockElement.parentNode.insertBefore).toHaveBeenCalled();
    });

    it('should throw error when document is not accessible', () => {
      const invalidRendition = { iframe: null };
      
      expect(() => {
        service.injectIllustration(invalidRendition, 'blob:test-url');
      }).toThrow();
    });

    it('should throw error when no insertion point is found', () => {
      mockDocument.querySelector.mockReturnValue(null);
      mockDocument.querySelectorAll.mockReturnValue([]);
      
      expect(() => {
        service.injectIllustration(mockRendition, 'blob:test-url');
      }).toThrow();
    });
  });

  describe('injectStylesheet', () => {
    it('should inject stylesheet successfully', () => {
      mockDocument.getElementById.mockReturnValue(null); // No existing styles
      
      service.injectStylesheet(mockDocument as any);
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('style');
      expect(mockElement.appendChild).toHaveBeenCalled();
    });

    it('should not inject stylesheet if already exists', () => {
      mockDocument.getElementById.mockReturnValue(mockElement); // Existing styles
      
      service.injectStylesheet(mockDocument as any);
      
      expect(mockDocument.createElement).not.toHaveBeenCalledWith('style');
    });
  });

  describe('removeIllustrations', () => {
    it('should remove all illustrations and revoke blob URLs', () => {
      const mockImg = {
        src: 'blob:test-url'
      };
      const mockIllustration = {
        querySelector: jest.fn().mockReturnValue(mockImg),
        remove: jest.fn()
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockIllustration]);
      
      // Mock URL.revokeObjectURL
      global.URL.revokeObjectURL = jest.fn();
      
      service.removeIllustrations(mockDocument as any);
      
      expect(mockIllustration.remove).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });
  });

  describe('cleanup', () => {
    it('should remove both illustrations and stylesheet', () => {
      const mockIllustration = { remove: jest.fn(), querySelector: jest.fn() };
      const mockStylesheet = { remove: jest.fn() };
      
      mockDocument.querySelectorAll.mockReturnValue([mockIllustration]);
      mockDocument.getElementById.mockReturnValue(mockStylesheet);
      
      service.cleanup(mockDocument as any);
      
      expect(mockIllustration.remove).toHaveBeenCalled();
      expect(mockStylesheet.remove).toHaveBeenCalled();
    });
  });

  describe('hasIllustrations', () => {
    it('should return true when illustrations exist', () => {
      mockDocument.querySelectorAll.mockReturnValue([mockElement]);
      
      const result = service.hasIllustrations(mockDocument as any);
      
      expect(result).toBe(true);
    });

    it('should return false when no illustrations exist', () => {
      mockDocument.querySelectorAll.mockReturnValue([]);
      
      const result = service.hasIllustrations(mockDocument as any);
      
      expect(result).toBe(false);
    });
  });

  describe('getIllustrationCount', () => {
    it('should return correct count of illustrations', () => {
      mockDocument.querySelectorAll.mockReturnValue([mockElement, mockElement, mockElement]);
      
      const count = service.getIllustrationCount(mockDocument as any);
      
      expect(count).toBe(3);
    });
  });
});