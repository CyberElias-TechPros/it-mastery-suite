import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll } from 'vitest';

// Applies every migration in ./migrations to the isolated test database.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
