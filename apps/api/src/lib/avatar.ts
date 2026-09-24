import { HTTPException } from 'hono/http-exception';
import sharp from 'sharp';

const AVATAR_SIZE = 256;
const MAX_INPUT_PIXELS = 4096 * 4096;

/** A square WebP avatar from an uploaded image, with its metadata dropped. */
export async function toAvatar(input: ArrayBuffer): Promise<Buffer> {
    try {
        return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
            .autoOrient()
            .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        throw new HTTPException(400, {
            message: "That photo couldn't be read. Try a JPEG or PNG.",
        });
    }
}
