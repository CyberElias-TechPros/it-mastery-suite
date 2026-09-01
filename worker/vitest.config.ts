import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));

export default defineWorkersConfig({
  // The worker has no CSS; stop Vite from picking up the frontend PostCSS config.
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    poolOptions: {
      workers: {
        singleWorker: true,
        isolatedStorage: true,
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            TEST_MIGRATIONS: migrations,
            JWT_SECRET: 'test-secret-value-that-is-long-enough-1234567890',
            ENVIRONMENT: 'development',
            ALLOWED_ORIGINS: 'http://localhost:8080',
            ACCESS_TOKEN_TTL_SECONDS: '900',
            REFRESH_TOKEN_TTL_SECONDS: '1209600',
            MAX_UPLOAD_BYTES: '10485760',
            BOOTSTRAP_ADMIN: 'true',
          },
        },
      },
    },
  },
});
