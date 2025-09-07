/**
 * Jest configuration for AI Book Illustrations integration tests
 * Optimized for testing with real book formats and performance monitoring
 */

module.exports = {
  displayName: 'AI Illustrations Integration Tests',
  testMatch: [
    '<rootDir>/src/services/__tests__/*integration.test.ts',
    '<rootDir>/src/services/__tests__/run-integration-tests.ts'
  ],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/services/__tests__/setup-integration.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/services/aiIllustrationService.ts',
    'src/services/aiApiService.ts',
    'src/services/cache/cacheService.ts',
    'src/services/pageSelectionService.ts',
    'src/services/textExtractionService.ts',
    'src/services/domInjectionService.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: '<rootDir>/coverage/integration',
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 2, // Limit workers for memory-intensive tests
  logHeapUsage: true,
  detectOpenHandles: true,
  forceExit: true,
  verbose: true,
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results/integration',
      outputName: 'junit.xml'
    }]
  ],
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2017',
          lib: ['es2017', 'dom'],
          allowJs: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
          forceConsistentCasingInFileNames: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx'
        }
      }
    }
  }
};