// Enhanced logging utility for AI Illustration services with structured logging and metrics
import { ConfigService } from '../../assets/lib/kookit-extra-browser.min';
import { ErrorCodes, AIIllustrationError } from '../types/aiIllustration';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    operation: string;
    duration: number;
    startTime: number;
    endTime: number;
  };
  metadata?: {
    bookId?: string;
    locationKey?: string;
    userId?: string;
    sessionId?: string;
  };
}

export interface LogMetrics {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  averagePerformance: { [operation: string]: number };
  errorsByCode: { [code: string]: number };
  recentErrors: LogEntry[];
}

export class AIIllustrationLogger {
  private context: string;
  private logLevel: LogLevel;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;
  private metrics: LogMetrics;
  private performanceTracking: Map<string, number> = new Map();

  constructor(context: string) {
    this.context = context;
    this.logLevel = this.getLogLevel();
    this.sessionId = this.generateSessionId();
    this.metrics = this.initializeMetrics();
  }

  private generateSessionId(): string {
    return `ai-ill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): LogMetrics {
    return {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      averagePerformance: {},
      errorsByCode: {},
      recentErrors: []
    };
  }



  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(
    level: string, 
    message: string, 
    data?: any, 
    error?: Error | AIIllustrationError,
    performance?: { operation: string; duration: number; startTime: number; endTime: number },
    metadata?: { bookId?: string; locationKey?: string }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      metadata: {
        ...metadata,
        sessionId: this.sessionId,
        userId: this.getUserId()
      }
    };

    if (data) {
      entry.data = this.sanitizeData(data);
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: error instanceof AIIllustrationError ? error.code : undefined
      };
    }

    if (performance) {
      entry.performance = performance;
    }

    return entry;
  }

  private sanitizeData(data: any): any {
    try {
      // Remove sensitive information and circular references
      const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
        // Remove potential sensitive keys
        if (typeof key === 'string' && 
            (key.toLowerCase().includes('key') || 
             key.toLowerCase().includes('token') || 
             key.toLowerCase().includes('password'))) {
          return '[REDACTED]';
        }
        return value;
      }));
      return sanitized;
    } catch (error) {
      return { error: 'Failed to sanitize data', original: String(data) };
    }
  }

  private getUserId(): string | undefined {
    try {
      // Try to get user ID from config service if available
      return ConfigService.getItem('userId') || undefined;
    } catch {
      return undefined;
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Update metrics
    this.updateMetrics(entry);
  }

  private updateMetrics(entry: LogEntry): void {
    this.metrics.totalLogs++;

    if (entry.level === 'ERROR') {
      this.metrics.errorCount++;
      this.metrics.recentErrors.push(entry);
      
      // Keep only recent errors (last 50)
      if (this.metrics.recentErrors.length > 50) {
        this.metrics.recentErrors.shift();
      }

      // Track errors by code
      if (entry.error?.code) {
        this.metrics.errorsByCode[entry.error.code] = 
          (this.metrics.errorsByCode[entry.error.code] || 0) + 1;
      }
    }

    if (entry.level === 'WARN') {
      this.metrics.warningCount++;
    }

    // Track performance metrics
    if (entry.performance) {
      const operation = entry.performance.operation;
      const duration = entry.performance.duration;
      
      if (!this.metrics.averagePerformance[operation]) {
        this.metrics.averagePerformance[operation] = duration;
      } else {
        // Calculate running average
        this.metrics.averagePerformance[operation] = 
          (this.metrics.averagePerformance[operation] + duration) / 2;
      }
    }
  }

  private formatMessage(entry: LogEntry): string {
    let message = `[${entry.timestamp}] [AI-Illustration] [${entry.level}] [${entry.context}] ${entry.message}`;
    
    if (entry.metadata?.bookId) {
      message += ` [Book: ${entry.metadata.bookId}]`;
    }
    
    if (entry.metadata?.locationKey) {
      message += ` [Location: ${entry.metadata.locationKey}]`;
    }
    
    return message;
  }

  private logToConsole(entry: LogEntry): void {
    const message = this.formatMessage(entry);
    
    switch (entry.level) {
      case 'DEBUG':
        console.debug(message, entry.data);
        break;
      case 'INFO':
        console.info(message, entry.data);
        break;
      case 'WARN':
        console.warn(message, entry.data);
        break;
      case 'ERROR':
        console.error(message, entry.error, entry.data);
        break;
    }
  }

  public debug(message: string, data?: any, metadata?: { bookId?: string; locationKey?: string }): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry('DEBUG', message, data, undefined, undefined, metadata);
      this.addToBuffer(entry);
      this.logToConsole(entry);
    }
  }

  public info(message: string, data?: any, metadata?: { bookId?: string; locationKey?: string }): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry('INFO', message, data, undefined, undefined, metadata);
      this.addToBuffer(entry);
      this.logToConsole(entry);
    }
  }

  public warn(message: string, data?: any, metadata?: { bookId?: string; locationKey?: string }): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry('WARN', message, data, undefined, undefined, metadata);
      this.addToBuffer(entry);
      this.logToConsole(entry);
    }
  }

  public error(
    message: string, 
    error?: Error | AIIllustrationError, 
    data?: any, 
    metadata?: { bookId?: string; locationKey?: string }
  ): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry('ERROR', message, data, error, undefined, metadata);
      this.addToBuffer(entry);
      this.logToConsole(entry);
    }
  }

  public startPerformanceTracking(operation: string): string {
    const trackingId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    this.performanceTracking.set(trackingId, Date.now());
    return trackingId;
  }

  public endPerformanceTracking(
    trackingId: string, 
    operation: string, 
    metadata?: { bookId?: string; locationKey?: string }
  ): number {
    const startTime = this.performanceTracking.get(trackingId);
    if (!startTime) {
      this.warn(`Performance tracking ID not found: ${trackingId}`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.performanceTracking.delete(trackingId);

    const performanceData = {
      operation,
      duration,
      startTime,
      endTime
    };

    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(
        'DEBUG', 
        `Performance: ${operation} completed`, 
        undefined, 
        undefined, 
        performanceData, 
        metadata
      );
      this.addToBuffer(entry);
      this.logToConsole(entry);
    }

    return duration;
  }

  public performance(operation: string, startTime: number, metadata?: { bookId?: string; locationKey?: string }): number {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const performanceData = {
      operation,
      duration,
      startTime,
      endTime
    };

    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(
        'DEBUG', 
        `Performance: ${operation} took ${duration}ms`, 
        undefined, 
        undefined, 
        performanceData, 
        metadata
      );
      this.addToBuffer(entry);
      this.logToConsole(entry);
    }

    return duration;
  }

  public getMetrics(): LogMetrics {
    return { ...this.metrics };
  }

  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  public clearLogs(): void {
    this.logBuffer = [];
    this.metrics = this.initializeMetrics();
    this.performanceTracking.clear();
    this.info('Log buffer and metrics cleared');
  }

  public exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      context: this.context,
      exportTime: new Date().toISOString(),
      metrics: this.metrics,
      logs: this.logBuffer
    }, null, 2);
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level changed to ${LogLevel[level]}`);
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Export singleton instance
export const logger = new AIIllustrationLogger('AI-Illustration');