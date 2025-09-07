/**
 * Performance monitoring and metrics collection for AI Illustration services
 * Tracks operation performance, resource usage, and system health
 */

import { AIIllustrationLogger } from './logger';
import { ConfigService } from '../../assets/lib/kookit-extra-browser.min';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: {
    bookId?: string;
    locationKey?: string;
    cacheHit?: boolean;
    apiCall?: boolean;
    retryCount?: number;
    memoryUsed?: number;
    memoryTotal?: number;
    memoryLimit?: number;
    entryType?: string;
    startTime?: number;
    [key: string]: any;
  };
}

export interface SystemMetrics {
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
  cacheStats?: {
    memorySize: number;
    persistentSize: number;
    hitRate: number;
    totalRequests: number;
  };
  apiStats?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    rateLimitHits: number;
  };
}

export interface PerformanceReport {
  sessionId: string;
  reportTime: string;
  timeRange: {
    start: string;
    end: string;
    durationMs: number;
  };
  operationMetrics: {
    [operation: string]: {
      count: number;
      averageDuration: number;
      minDuration: number;
      maxDuration: number;
      successRate: number;
      totalDuration: number;
    };
  };
  systemMetrics: SystemMetrics;
  recommendations: string[];
}

export class AIIllustrationPerformanceMonitor {
  private logger: AIIllustrationLogger;
  private metrics: PerformanceMetric[] = [];
  private maxMetricsCount: number = 10000;
  private sessionStartTime: number;
  private sessionId: string;
  private performanceObserver?: PerformanceObserver;
  private memoryCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.logger = new AIIllustrationLogger('PerformanceMonitor');
    this.sessionStartTime = Date.now();
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
  }

  private generateSessionId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMonitoring(): void {
    // Initialize Performance Observer if available
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name.includes('ai-illustration')) {
              this.recordWebAPIPerformance(entry);
            }
          }
        });
        
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (error) {
        this.logger.warn('Performance Observer not available', error);
      }
    }

    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring(): void {
    // Check memory usage every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);
  }

  private checkMemoryUsage(): void {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryMetric: PerformanceMetric = {
          operation: 'memory-check',
          duration: 0,
          timestamp: Date.now(),
          success: true,
          metadata: {
            memoryUsed: memory.usedJSHeapSize,
            memoryTotal: memory.totalJSHeapSize,
            memoryLimit: memory.jsHeapSizeLimit
          }
        };
        
        this.addMetric(memoryMetric);

        // Warn if memory usage is high
        const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        if (memoryUsagePercent > 80) {
          this.logger.warn(`High memory usage detected: ${memoryUsagePercent.toFixed(2)}%`, {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          });
        }
      }
    } catch (error) {
      this.logger.warn('Error checking memory usage', error);
    }
  }

  private recordWebAPIPerformance(entry: PerformanceEntry): void {
    const metric: PerformanceMetric = {
      operation: `web-api-${entry.name}`,
      duration: entry.duration,
      timestamp: Date.now(),
      success: true,
      metadata: {
        entryType: entry.entryType,
        startTime: entry.startTime
      }
    };
    
    this.addMetric(metric);
  }

  /**
   * Start tracking a performance operation
   */
  public startOperation(operation: string, metadata?: any): string {
    const trackingId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Mark start time using Performance API if available
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(`ai-illustration-${trackingId}-start`);
      } catch (error) {
        this.logger.debug('Performance.mark not available', error);
      }
    }

    return trackingId;
  }

  /**
   * End tracking a performance operation
   */
  public endOperation(
    trackingId: string,
    operation: string,
    success: boolean = true,
    metadata?: any
  ): number {
    let duration = 0;

    // Try to use Performance API for precise timing
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      try {
        const startMark = `ai-illustration-${trackingId}-start`;
        const endMark = `ai-illustration-${trackingId}-end`;
        const measureName = `ai-illustration-${trackingId}`;

        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);

        const measure = performance.getEntriesByName(measureName)[0];
        if (measure) {
          duration = measure.duration;
        }

        // Clean up marks and measures
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
      } catch (error) {
        this.logger.debug('Error using Performance API', error);
      }
    }

    // Record the metric
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      metadata
    };

    this.addMetric(metric);

    // Log performance if debug mode is enabled
    if (ConfigService.getReaderConfig('aiIllustrationDebugMode') === 'yes') {
      this.logger.debug(`Performance: ${operation} ${success ? 'completed' : 'failed'} in ${duration}ms`, metadata);
    }

    return duration;
  }

  /**
   * Record a simple performance metric
   */
  public recordMetric(
    operation: string,
    duration: number,
    success: boolean = true,
    metadata?: any
  ): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      metadata
    };

    this.addMetric(metric);
  }

  /**
   * Add metric to collection
   */
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Maintain metrics count limit
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  public getOperationStats(operation: string, timeRangeMs?: number): {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    totalDuration: number;
  } {
    const now = Date.now();
    const cutoffTime = timeRangeMs ? now - timeRangeMs : 0;

    const operationMetrics = this.metrics.filter(m => 
      m.operation === operation && m.timestamp >= cutoffTime
    );

    if (operationMetrics.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        totalDuration: 0
      };
    }

    const durations = operationMetrics.map(m => m.duration);
    const successCount = operationMetrics.filter(m => m.success).length;
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: operationMetrics.length,
      averageDuration: totalDuration / operationMetrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successCount / operationMetrics.length) * 100,
      totalDuration
    };
  }

  /**
   * Get system metrics
   */
  public getSystemMetrics(): SystemMetrics {
    const metrics: SystemMetrics = {};

    // Memory metrics
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }

    return metrics;
  }

  /**
   * Generate comprehensive performance report
   */
  public generateReport(timeRangeMs?: number): PerformanceReport {
    const now = Date.now();
    const startTime = timeRangeMs ? now - timeRangeMs : this.sessionStartTime;
    const endTime = now;

    // Get unique operations
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    
    // Calculate metrics for each operation
    const operationMetrics: { [operation: string]: any } = {};
    for (const operation of operations) {
      operationMetrics[operation] = this.getOperationStats(operation, timeRangeMs);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(operationMetrics);

    return {
      sessionId: this.sessionId,
      reportTime: new Date().toISOString(),
      timeRange: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
        durationMs: endTime - startTime
      },
      operationMetrics,
      systemMetrics: this.getSystemMetrics(),
      recommendations
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(operationMetrics: { [operation: string]: any }): string[] {
    const recommendations: string[] = [];

    for (const [operation, stats] of Object.entries(operationMetrics)) {
      // Check for slow operations
      if (stats.averageDuration > 5000) {
        recommendations.push(`${operation} is taking an average of ${Math.round(stats.averageDuration)}ms. Consider optimization.`);
      }

      // Check for low success rates
      if (stats.successRate < 90 && stats.count > 5) {
        recommendations.push(`${operation} has a low success rate of ${stats.successRate.toFixed(1)}%. Check error handling.`);
      }

      // Check for high frequency operations
      if (stats.count > 100) {
        recommendations.push(`${operation} is being called frequently (${stats.count} times). Consider caching or batching.`);
      }
    }

    // System-level recommendations
    const systemMetrics = this.getSystemMetrics();
    if (systemMetrics.memoryUsage && systemMetrics.memoryUsage.percentage > 70) {
      recommendations.push(`Memory usage is high (${systemMetrics.memoryUsage.percentage.toFixed(1)}%). Consider clearing caches or reducing memory footprint.`);
    }

    return recommendations;
  }

  /**
   * Get recent metrics
   */
  public getRecentMetrics(count: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.logger.info('Performance metrics cleared');
  }

  /**
   * Export metrics as JSON
   */
  public exportMetrics(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime,
      exportTime: Date.now(),
      metrics: this.metrics,
      report: this.generateReport()
    }, null, 2);
  }

  /**
   * Get performance summary
   */
  public getSummary(): {
    totalOperations: number;
    uniqueOperations: number;
    averageOperationTime: number;
    successRate: number;
    sessionDuration: number;
  } {
    const totalOperations = this.metrics.length;
    const uniqueOperations = new Set(this.metrics.map(m => m.operation)).size;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const successfulOperations = this.metrics.filter(m => m.success).length;
    const sessionDuration = Date.now() - this.sessionStartTime;

    return {
      totalOperations,
      uniqueOperations,
      averageOperationTime: totalOperations > 0 ? totalDuration / totalOperations : 0,
      successRate: totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0,
      sessionDuration
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.logger.info('Performance monitor cleaned up');
  }
}

// Export singleton instance
export const performanceMonitor = new AIIllustrationPerformanceMonitor();