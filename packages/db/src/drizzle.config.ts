import { defineConfig } from 'drizzle-kit';

try {
    process.loadEnvFile('.env');
} catch {
    // No .env in CI, so use the vars already in the environment.
}

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema',
    out: './drizzle',
    dbCredentials: { url },
});
