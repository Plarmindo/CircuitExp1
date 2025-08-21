/**
 * PII (Personally Identifiable Information) Detection Service
 * 
 * Provides automated detection and redaction of sensitive information
 * in file names, paths, and potentially file content.
 */

export interface PIIDetectionResult {
  detected: boolean;
  type: string;
  confidence: number;
  original: string;
  redacted: string;
  location: string;
}

export interface PIIConfig {
  enabled: boolean;
  redactionEnabled: boolean;
  patterns: string[];
  customPatterns: string[];
  confidenceThreshold: number;
}

export class PIIDetector {
  private patterns: Map<string, RegExp> = new Map();
  private config: PIIConfig;

  constructor(config: PIIConfig) {
    this.config = config;
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Email patterns
    this.patterns.set('email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    
    // Phone patterns
    this.patterns.set('phone_us', /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g);
    this.patterns.set('phone_intl', /\+(?:[0-9] ?){6,14}[0-9]/g);
    
    // Social Security patterns
    this.patterns.set('ssn', /\b\d{3}-?\d{2}-?\d{4}\b/g);
    
    // Credit card patterns
    this.patterns.set('credit_card', /\b(?:\d{4}[\s-]?){3}\d{4}\b/g);
    
    // IP address patterns
    this.patterns.set('ip_address', /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
    
    // Date patterns (potential DOB)
    this.patterns.set('date', /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g);
    
    // Name patterns (simple heuristic)
    this.patterns.set('name', /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g);
    
    // Custom patterns from config
    this.config.customPatterns.forEach((pattern, index) => {
      try {
        this.patterns.set(`custom_${index}`, new RegExp(pattern, 'g'));
      } catch (error) {
        console.warn(`Invalid custom PII pattern: ${pattern}`, error);
      }
    });
  }

  public scanPath(filePath: string): PIIDetectionResult[] {
    if (!this.config.enabled) return [];

    const results: PIIDetectionResult[] = [];
    const pathParts = filePath.split(/[/\\]/);

    pathParts.forEach((part, index) => {
      const detections = this.scanText(part, `path_part_${index}`);
      results.push(...detections);
    });

    return results;
  }

  public scanText(text: string, location: string): PIIDetectionResult[] {
    if (!this.config.enabled) return [];

    const results: PIIDetectionResult[] = [];

    for (const [type, pattern] of this.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const confidence = this.calculateConfidence(match, type);
          if (confidence >= this.config.confidenceThreshold) {
            results.push({
              detected: true,
              type,
              confidence,
              original: match,
              redacted: this.redactText(match, type),
              location
            });
          }
        });
      }
    }

    return results;
  }

  private calculateConfidence(text: string, type: string): number {
    // Simple confidence scoring based on pattern characteristics
    switch (type) {
      case 'email':
        return this.validateEmail(text) ? 0.95 : 0.3;
      case 'phone_us':
        return this.validatePhoneUS(text) ? 0.9 : 0.4;
      case 'ssn':
        return this.validateSSN(text) ? 0.95 : 0.3;
      case 'credit_card':
        return this.validateCreditCard(text) ? 0.95 : 0.3;
      case 'ip_address':
        return this.validateIPAddress(text) ? 0.85 : 0.3;
      default:
        return 0.7;
    }
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePhoneUS(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  }

  private validateSSN(ssn: string): boolean {
    const digits = ssn.replace(/\D/g, '');
    return digits.length === 9;
  }

  private validateCreditCard(card: string): boolean {
    const digits = card.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  }

  private validateIPAddress(ip: string): boolean {
    const octets = ip.split('.');
    if (octets.length !== 4) return false;
    
    return octets.every(octet => {
      const num = parseInt(octet);
      return num >= 0 && num <= 255;
    });
  }

  private redactText(text: string, type: string): string {
    if (!this.config.redactionEnabled) return text;

    switch (type) {
      case 'email':
        return text.replace(/(.{2}).+(@.+)/, '$1***$2');
      case 'phone_us':
        return text.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2');
      case 'ssn':
        return text.replace(/\d{3}-?\d{2}-?(\d{4})/, '***-**-$1');
      case 'credit_card':
        return text.replace(/(\d{4})\d{8,12}(\d{4})/, '$1************$2');
      case 'ip_address':
        return text.replace(/(\d+\.){3}\d+/, '***.***.***.***');
      default:
        return text.replace(/./g, '*');
    }
  }

  public updateConfig(newConfig: Partial<PIIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.customPatterns) {
      this.initializePatterns();
    }
  }

  public getConfig(): PIIConfig {
    return { ...this.config };
  }
}

// Default configuration
export const defaultPIIConfig: PIIConfig = {
  enabled: true,
  redactionEnabled: true,
  patterns: ['email', 'phone_us', 'ssn', 'credit_card', 'ip_address'],
  customPatterns: [],
  confidenceThreshold: 0.8
};