// Input validation utilities
// Provides type-safe validation for user inputs and API responses

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export class InputValidator {
  // Email validation
  static validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitized = email.trim().toLowerCase();
    
    if (!email) {
      return { isValid: false, errors: ['Email is required'] };
    }
    
    if (!emailRegex.test(sanitized)) {
      return { isValid: false, errors: ['Invalid email format'] };
    }
    
    return { isValid: true, errors: [], sanitizedValue: sanitized };
  }

  // Symbol validation (for trading symbols)
  static validateSymbol(symbol: string): ValidationResult {
    const symbolRegex = /^[A-Z0-9-]{1,10}$/;
    const sanitized = symbol.trim().toUpperCase();
    
    if (!symbol) {
      return { isValid: false, errors: ['Symbol is required'] };
    }
    
    if (!symbolRegex.test(sanitized)) {
      return { isValid: false, errors: ['Symbol must be 1-10 alphanumeric characters'] };
    }
    
    return { isValid: true, errors: [], sanitizedValue: sanitized };
  }

  // Price validation
  static validatePrice(price: string | number): ValidationResult {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    
    if (isNaN(numPrice)) {
      return { isValid: false, errors: ['Price must be a valid number'] };
    }
    
    if (numPrice <= 0) {
      return { isValid: false, errors: ['Price must be greater than 0'] };
    }
    
    if (numPrice > 1000000) {
      return { isValid: false, errors: ['Price seems unreasonably high'] };
    }
    
    return { isValid: true, errors: [], sanitizedValue: numPrice };
  }

  // Amount validation (for trading amounts)
  static validateAmount(amount: string | number): ValidationResult {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount)) {
      return { isValid: false, errors: ['Amount must be a valid number'] };
    }
    
    if (numAmount <= 0) {
      return { isValid: false, errors: ['Amount must be greater than 0'] };
    }
    
    return { isValid: true, errors: [], sanitizedValue: numAmount };
  }

  // Generic string validation
  static validateString(
    value: string, 
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowedChars?: string;
    } = {}
  ): ValidationResult {
    const { required = false, minLength = 0, maxLength = 1000, pattern, allowedChars } = options;
    const sanitized = value.trim();
    
    if (required && !sanitized) {
      return { isValid: false, errors: ['This field is required'] };
    }
    
    if (sanitized.length < minLength) {
      return { isValid: false, errors: [`Minimum length is ${minLength} characters`] };
    }
    
    if (sanitized.length > maxLength) {
      return { isValid: false, errors: [`Maximum length is ${maxLength} characters`] };
    }
    
    if (pattern && !pattern.test(sanitized)) {
      return { isValid: false, errors: ['Invalid format'] };
    }
    
    if (allowedChars) {
      const allowedRegex = new RegExp(`^[${allowedChars}]*$`);
      if (!allowedRegex.test(sanitized)) {
        return { isValid: false, errors: ['Contains invalid characters'] };
      }
    }
    
    return { isValid: true, errors: [], sanitizedValue: sanitized };
  }

  // Sanitize HTML to prevent XSS
  static sanitizeHtml(html: string): string {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Validate API response structure
  static validateApiResponse(response: any, expectedFields: string[]): ValidationResult {
    if (!response || typeof response !== 'object') {
      return { isValid: false, errors: ['Invalid response format'] };
    }

    const missingFields = expectedFields.filter(field => !(field in response));
    
    if (missingFields.length > 0) {
      return { 
        isValid: false, 
        errors: [`Missing required fields: ${missingFields.join(', ')}`] 
      };
    }

    return { isValid: true, errors: [] };
  }

  // Validate market data
  static validateMarketData(data: any): ValidationResult {
    const requiredFields = ['symbol', 'price', 'lastUpdated'];
    const structureValidation = this.validateApiResponse(data, requiredFields);
    
    if (!structureValidation.isValid) {
      return structureValidation;
    }

    // Validate symbol
    const symbolValidation = this.validateSymbol(data.symbol);
    if (!symbolValidation.isValid) {
      return { isValid: false, errors: [`Symbol: ${symbolValidation.errors.join(', ')}`] };
    }

    // Validate price
    const priceValidation = this.validatePrice(data.price);
    if (!priceValidation.isValid) {
      return { isValid: false, errors: [`Price: ${priceValidation.errors.join(', ')}`] };
    }

    // Validate timestamp
    const timestamp = new Date(data.lastUpdated).getTime();
    if (isNaN(timestamp)) {
      return { isValid: false, errors: ['Invalid timestamp format'] };
    }

    return { isValid: true, errors: [], sanitizedValue: {
      ...data,
      symbol: symbolValidation.sanitizedValue,
      price: priceValidation.sanitizedValue,
    }};
  }

  // Batch validation helper
  static validateBatch<T>(
    items: T[], 
    validator: (item: T) => ValidationResult
  ): { validItems: T[]; invalidItems: { item: T; errors: string[] }[] } {
    const validItems: T[] = [];
    const invalidItems: { item: T; errors: string[] }[] = [];

    items.forEach(item => {
      const result = validator(item);
      if (result.isValid) {
        validItems.push(result.sanitizedValue || item);
      } else {
        invalidItems.push({ item, errors: result.errors });
      }
    });

    return { validItems, invalidItems };
  }
}

export default InputValidator;
