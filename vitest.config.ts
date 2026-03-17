import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/app/app.html',
        'src/bridge/index.ts',
        'src/app/app.ts',
        'src/bridge/styles.ts',
        'src/bridge/fa-inline.ts',
      ],
    },
  },
});
