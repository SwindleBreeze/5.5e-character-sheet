import { defineConfig } from 'vitest/config';

// Opt-in checks against local 5etools data: FIVETOOLS_DATA=<path> npm run test:smoke
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 120_000,
  },
});
