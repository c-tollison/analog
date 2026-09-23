export type CoverSize = 'sm' | 'md' | 'lg';

// Open Library serves each cover as -S (~45px wide), -M (~180px) and -L
// (~500px). Pick the 1x/2x pair that fits where the cover is shown.
const OPEN_LIBRARY_SIZES: Record<CoverSize, [string, string]> = {
    sm: ['S', 'M'],
    md: ['M', 'L'],
    lg: ['L', 'L'],
};

const OPEN_LIBRARY_COVER =
    /^(https:\/\/covers\.openlibrary\.org\/b\/id\/\d+)-[SML]\.jpg$/;

/** Returns src/srcset for a stored cover URL at the given display size. */
export function coverSources(
    url: string,
    size: CoverSize
): { src: string; srcset?: string } {
    const match = url.match(OPEN_LIBRARY_COVER);
    if (!match) {
        return { src: url };
    }
    const [x1, x2] = OPEN_LIBRARY_SIZES[size];
    const at = (s: string) => `${match[1]}-${s}.jpg`;
    return x1 === x2
        ? { src: at(x1) }
        : { src: at(x1), srcset: `${at(x1)} 1x, ${at(x2)} 2x` };
}
