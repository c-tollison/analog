import { eq, schema } from '@analog/db';

import { db } from './init.js';
import { HTTPException } from 'hono/http-exception';
import sharp from 'sharp';

const MAX_WIDTH = 600;
const MAX_HEIGHT = 900;
const MAX_INPUT_PIXELS = 8192 * 8192;

/** A WebP cover from an uploaded image, shrunk to fit and with its metadata dropped. */
export async function toCover(input: ArrayBuffer): Promise<Buffer> {
    try {
        return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
            .autoOrient()
            .resize(MAX_WIDTH, MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();
    } catch {
        throw new HTTPException(400, {
            message: "That image couldn't be read. Try a JPEG or PNG.",
        });
    }
}

// The version in the URL lets browsers cache each cover forever.
export function uploadedCoverUrl(isbn: string, updatedAt: Date): string {
    return `/api/catalog/covers/${isbn}?v=${updatedAt.getTime()}`;
}

/** The URL of the cover an admin uploaded for this ISBN, if there is one. */
export async function findUploadedCover(isbn: string): Promise<string | null> {
    const { catalogItemIsbnCover } = schema;
    const [found] = await db()
        .select({ updatedAt: catalogItemIsbnCover.updatedAt })
        .from(catalogItemIsbnCover)
        .where(eq(catalogItemIsbnCover.isbn, isbn));
    return found ? uploadedCoverUrl(isbn, found.updatedAt) : null;
}
