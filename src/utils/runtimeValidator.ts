// Runtime type validation system for TypeScript interfaces

import { apiLogger } from './logger';

export interface ValidationResult<T = any> {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedValue?: T;
  metadata: {
    validatedAt: number;
    validationTime: number;
    fieldCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface ValidationRule<T = any> {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'email' | 'url';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  sanitize?: (value: any) => T;
  allowNull?: boolean;
  defaultValue?: any; // Changed from T to any to support different types
}

export interface ValidationSchema<T = any> {
  name: string;
  rules: ValidationRule<T>[];
  strict?: boolean; // If true, reject unknown fields
  sanitize?: boolean; // If true, return sanitized values
}

class RuntimeValidator {
  private schemas = new Map<string, ValidationSchema>();
  private validationCache = new Map<string, ValidationResult>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Register a validation schema
  registerSchema<T>(schema: ValidationSchema<T>): void {
    this.schemas.set(schema.name, schema);
    apiLogger.debug('Validation schema registered', {
      name: schema.name,
      ruleCount: schema.rules.length,
      strict: schema.strict,
    });
  }

  // Validate data against a schema
  validate<T>(schemaName: string, data: any): ValidationResult<T> {
    const startTime = Date.now();
    const cacheKey = `${schemaName}_${JSON.stringify(data)}`;

    // Check cache first
    const cached = this.validationCache.get(cacheKey);
    if (cached && Date.now() - cached.metadata.validatedAt < this.cacheTimeout) {
      apiLogger.debug('Using cached validation result', { schemaName, cacheKey });
      return cached as ValidationResult<T>;
    }

    const schema = this.schemas.get(schemaName);
    if (!schema) {
      const result: ValidationResult<T> = {
        isValid: false,
        errors: [`Schema '${schemaName}' not found`],
        warnings: [],
        metadata: {
          validatedAt: Date.now(),
          validationTime: Date.now() - startTime,
          fieldCount: 0,
          errorCount: 1,
          warningCount: 0,
        },
      };
      return result;
    }

    const result = this.performValidation<T>(schema, data);
    result.metadata.validationTime = Date.now() - startTime;

    // Cache result
    this.validationCache.set(cacheKey, result);

    apiLogger.debug('Validation completed', {
      schemaName,
      isValid: result.isValid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      validationTime: result.metadata.validationTime,
    });

    return result;
  }

  // Perform the actual validation
  private performValidation<T>(schema: ValidationSchema, data: any): ValidationResult<T> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitizedValue: any = schema.sanitize ? {} : undefined;
    const startTime = Date.now();

    // Validate that data is an object if rules expect object fields
    if (data === null || data === undefined) {
      errors.push('Data is null or undefined');
      return {
        isValid: false,
        errors,
        warnings,
        sanitizedValue,
        metadata: {
          validatedAt: Date.now(),
          validationTime: 0,
          fieldCount: 0,
          errorCount: errors.length,
          warningCount: warnings.length,
        },
      };
    }

    if (typeof data !== 'object') {
      errors.push(`Expected object, got ${typeof data}`);
      return {
        isValid: false,
        errors,
        warnings,
        sanitizedValue,
        metadata: {
          validatedAt: Date.now(),
          validationTime: 0,
          fieldCount: 0,
          errorCount: errors.length,
          warningCount: warnings.length,
        },
      };
    }

    // Check for unknown fields in strict mode
    if (schema.strict) {
      const allowedFields = schema.rules.map(rule => rule.field);
      const unknownFields = Object.keys(data).filter(field => !allowedFields.includes(field));
      
      if (unknownFields.length > 0) {
        warnings.push(`Unknown fields found: ${unknownFields.join(', ')}`);
      }
    }

    // Validate each rule
    for (const rule of schema.rules) {
      const fieldResult = this.validateField(rule, data[rule.field], data);
      
      if (fieldResult.errors.length > 0) {
        errors.push(...fieldResult.errors.map(err => `${rule.field}: ${err}`));
      }
      
      if (fieldResult.warnings.length > 0) {
        warnings.push(...fieldResult.warnings.map(warn => `${rule.field}: ${warn}`));
      }

      // Apply sanitization if enabled
      if (schema.sanitize && fieldResult.sanitizedValue !== undefined) {
        sanitizedValue[rule.field] = fieldResult.sanitizedValue;
      } else if (schema.sanitize && rule.defaultValue !== undefined && data[rule.field] === undefined) {
        sanitizedValue[rule.field] = rule.defaultValue;
      } else if (schema.sanitize) {
        sanitizedValue[rule.field] = data[rule.field];
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue: schema.sanitize ? sanitizedValue as T : undefined,
      metadata: {
        validatedAt: Date.now(),
        validationTime: Date.now() - startTime,
        fieldCount: schema.rules.length,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    };
  }

  // Validate a single field
  private validateField(rule: ValidationRule, value: any, fullData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedValue = value;

    // Check required fields
    if (rule.required && (value === undefined || value === null)) {
      errors.push('is required');
      return { isValid: false, errors, warnings, metadata: {} as any };
    }

    // Skip validation if field is not required and is null/undefined
    if (!rule.required && (value === undefined || value === null)) {
      if (rule.allowNull || value === undefined) {
        return { isValid: true, errors, warnings, sanitizedValue: rule.defaultValue, metadata: {} as any };
      }
    }

    // Type validation
    const typeValidation = this.validateType(rule.type, value);
    if (!typeValidation.isValid) {
      errors.push(`expected ${rule.type}, got ${typeof value}`);
      return { isValid: false, errors, warnings, metadata: {} as any };
    }

    // Sanitize value if sanitizer is provided
    if (rule.sanitize) {
      try {
        sanitizedValue = rule.sanitize(value);
      } catch (sanitizeError) {
        warnings.push(`sanitization failed: ${(sanitizeError as Error).message}`);
      }
    }

    // Length/Range validation
    if (rule.min !== undefined || rule.max !== undefined) {
      const lengthValidation = this.validateLength(value, rule.min, rule.max, rule.type);
      if (!lengthValidation.isValid) {
        errors.push(...lengthValidation.errors);
      }
      warnings.push(...lengthValidation.warnings);
    }

    // Pattern validation
    if (rule.pattern && typeof sanitizedValue === 'string') {
      if (!rule.pattern.test(sanitizedValue)) {
        errors.push(`does not match pattern ${rule.pattern.source}`);
      }
    }

    // Custom validation
    if (rule.custom) {
      try {
        const customResult = rule.custom(sanitizedValue);
        if (typeof customResult === 'string') {
          errors.push(customResult);
        } else if (!customResult) {
          errors.push('failed custom validation');
        }
      } catch (customError) {
        errors.push(`custom validation error: ${(customError as Error).message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue,
      metadata: {} as any,
    };
  }

  // Validate data type
  private validateType(expectedType: string, value: any): ValidationResult {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    switch (expectedType) {
      case 'string':
        return {
          isValid: typeof value === 'string',
          errors: typeof value === 'string' ? [] : [`expected string, got ${actualType}`],
          warnings: [],
          metadata: {} as any,
        };

      case 'number':
        const isValidNumber = typeof value === 'number' && !isNaN(value) && isFinite(value);
        return {
          isValid: isValidNumber,
          errors: isValidNumber ? [] : [`expected valid number, got ${actualType}`],
          warnings: [],
          metadata: {} as any,
        };

      case 'boolean':
        return {
          isValid: typeof value === 'boolean',
          errors: typeof value === 'boolean' ? [] : [`expected boolean, got ${actualType}`],
          warnings: [],
          metadata: {} as any,
        };

      case 'object':
        const isValidObject = typeof value === 'object' && value !== null && !Array.isArray(value);
        return {
          isValid: isValidObject,
          errors: isValidObject ? [] : [`expected object, got ${actualType}`],
          warnings: [],
          metadata: {} as any,
        };

      case 'array':
        return {
          isValid: Array.isArray(value),
          errors: Array.isArray(value) ? [] : [`expected array, got ${actualType}`],
          warnings: [],
          metadata: {} as any,
        };

      case 'date':
        const isValidDate = value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
        return {
          isValid: isValidDate,
          errors: isValidDate ? [] : [`expected date, got ${actualType}`],
          warnings: [],
          metadata: {} as any,
        };

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValidEmail = typeof value === 'string' && emailPattern.test(value);
        return {
          isValid: isValidEmail,
          errors: isValidEmail ? [] : ['expected valid email format'],
          warnings: [],
          metadata: {} as any,
        };

      case 'url':
        let isValidUrl = false;
        try {
          new URL(value);
          isValidUrl = true;
        } catch {
          isValidUrl = false;
        }
        return {
          isValid: isValidUrl,
          errors: isValidUrl ? [] : ['expected valid URL format'],
          warnings: [],
          metadata: {} as any,
        };

      default:
        return {
          isValid: false,
          errors: [`unknown type: ${expectedType}`],
          warnings: [],
          metadata: {} as any,
        };
    }
  }

  // Validate length/range
  private validateLength(value: any, min?: number, max?: number, type?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let length: number;

    if (type === 'string' && typeof value === 'string') {
      length = value.length;
    } else if (type === 'array' && Array.isArray(value)) {
      length = value.length;
    } else if (type === 'number' && typeof value === 'number') {
      length = value;
    } else {
      return { isValid: true, errors, warnings, metadata: {} as any };
    }

    if (min !== undefined && length < min) {
      if (type === 'string') {
        errors.push(`must be at least ${min} characters long`);
      } else if (type === 'array') {
        errors.push(`must have at least ${min} items`);
      } else {
        errors.push(`must be at least ${min}`);
      }
    }

    if (max !== undefined && length > max) {
      if (type === 'string') {
        errors.push(`must be at most ${max} characters long`);
      } else if (type === 'array') {
        errors.push(`must have at most ${max} items`);
      } else {
        errors.push(`must be at most ${max}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {} as any,
    };
  }

  // Clear validation cache
  clearCache(): void {
    this.validationCache.clear();
    apiLogger.debug('Validation cache cleared');
  }

  // Get validation statistics
  getStats(): {
    schemaCount: number;
    cacheSize: number;
    schemas: string[];
  } {
    return {
      schemaCount: this.schemas.size,
      cacheSize: this.validationCache.size,
      schemas: Array.from(this.schemas.keys()),
    };
  }
}

// Export singleton instance
export const runtimeValidator = new RuntimeValidator();

// Register common schemas
runtimeValidator.registerSchema({
  name: 'MarketData',
  sanitize: true,
  strict: true,
  rules: [
    { field: 'symbol', required: true, type: 'string', min: 1, max: 10, pattern: /^[A-Z0-9]+$/ },
    { field: 'price', required: true, type: 'number', min: 0, sanitize: (v) => Math.max(0, parseFloat(v) || 0) },
    { field: 'change', required: true, type: 'number', sanitize: (v) => parseFloat(v) || 0 },
    { field: 'changePercent', required: true, type: 'number', sanitize: (v) => parseFloat(v) || 0 },
    { field: 'volume', required: false, type: 'number', min: 0, defaultValue: 0 },
    { field: 'marketCap', required: false, type: 'number', min: 0 },
    { field: 'type', required: true, type: 'string', custom: (v) => ['stock', 'crypto'].includes(v) },
    { field: 'lastUpdated', required: true, type: 'number', min: 0 },
    { field: 'source', required: false, type: 'string', custom: (v) => ['real', 'cache', 'mock', 'fallback'].includes(v) },
  ],
});

runtimeValidator.registerSchema({
  name: 'UserPreferences',
  sanitize: true,
  strict: false,
  rules: [
    { field: 'theme', required: false, type: 'string', custom: (v) => ['light', 'dark', 'auto'].includes(v), defaultValue: 'auto' },
    { field: 'currency', required: false, type: 'string', pattern: /^[A-Z]{3}$/, defaultValue: 'USD' },
    { field: 'notifications', required: false, type: 'boolean', defaultValue: true },
    { field: 'autoRefresh', required: false, type: 'boolean', defaultValue: true },
    { field: 'refreshInterval', required: false, type: 'number', min: 1000, max: 300000, defaultValue: 30000 },
  ],
});

runtimeValidator.registerSchema({
  name: 'APIResponse',
  sanitize: false,
  strict: false,
  rules: [
    { field: 'success', required: true, type: 'boolean' },
    { field: 'data', required: false, type: 'object', allowNull: true },
    { field: 'error', required: false, type: 'string', allowNull: true },
    { field: 'timestamp', required: false, type: 'number', min: 0 },
    { field: 'requestId', required: false, type: 'string' },
  ],
});

// Helper functions for common validations
export const validateMarketData = (data: any) => {
  return runtimeValidator.validate('MarketData', data);
};

export const validateUserPreferences = (data: any) => {
  return runtimeValidator.validate('UserPreferences', data);
};

export const validateAPIResponse = (data: any) => {
  return runtimeValidator.validate('APIResponse', data);
};

export { RuntimeValidator };
export default runtimeValidator;
