import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema',
    out: './drizzle',
    dbCredentials: {
        // Uses admin connection for migrations (DDL privileges)
        // biome-ignore lint/style/noNonNullAssertion: environment variable is set
        url: process.env.DATABASE_URL_ADMIN!,
    },
});
