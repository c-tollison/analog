const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_TOKEN = /\/[A-Za-z0-9_-]{24,}(?=\/|$)/g;

/**
 * Replaces id-like and token-like path segments before logging, so logs
 * stay low-cardinality and don't capture secrets that ended up in a URL.
 *   /api/items/3f2a…-…  -> /api/items/:id
 *   /api/verify/<long>  -> /api/verify/:token
 */
export function sanitizePath(path: string): string {
    return path.replace(UUID, ':id').replace(LONG_TOKEN, '/:token');
}
