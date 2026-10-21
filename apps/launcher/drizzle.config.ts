import { defineConfig } from 'drizzle-kit';

// `npm run db:generate -w apps/launcher` writes a new SQL migration after a schema change; commit it.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/library/schema.ts',
  out: './src/main/library/migrations',
});
