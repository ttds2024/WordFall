import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The room tests read the full word lists once.
    testTimeout: 20000,
  },
});
