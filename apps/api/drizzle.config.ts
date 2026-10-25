import { defineConfig } from 'drizzle-kit';

// `npm run db:generate -w apps/api` writes a new SQL migration after a schema change; commit it.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
