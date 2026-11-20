import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 25000,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
    },
  },
});

