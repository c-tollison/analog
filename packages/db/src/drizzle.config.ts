import { defineConfig } from 'drizzle-kit';

try {
    process.loadEnvFile('.env');
} catch {
    // no .env — rely on vars already in the environment (CI)
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
