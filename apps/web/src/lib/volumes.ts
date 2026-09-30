/** Whole-numbered volumes up to `total` that aren't in `owned`, as "4, 7–9". */
export function missingVolumes(owned: number[], total: number): string | null {
    const have = new Set(owned);
    const ranges: string[] = [];
    let start: number | null = null;
    for (let volume = 1; volume <= total + 1; volume++) {
        const isMissing = volume <= total && !have.has(volume);
        if (isMissing && start === null) {
            start = volume;
        } else if (!isMissing && start !== null) {
            const end = volume - 1;
            ranges.push(end === start ? `${start}` : `${start}–${end}`);
            start = null;
        }
    }
    return ranges.join(', ') || null;
}

// Tried in order. Numbers stop at 3 digits so years aren't read as volumes.
const VOLUME_IN_TITLE = [
    // "Vol. 3", "Volume 3", "Book 3", "Part 3", "No. 3", "v. 3", "#3"
    /(?:\b(?:vol(?:ume)?|book|part|no)\.?|\bv\.|#)\s*(\d{1,3}(?:\.\d+)?)\b/i,
    // "Haikyu!! 1: Hinata and Kageyama"
    /\s(\d{1,3}(?:\.\d+)?)\s*:/,
    // "Chainsaw Man 5", "Chainsaw Man (5)"
    /\s\(?(\d{1,3}(?:\.\d+)?)\)?\s*$/,
];

/** A best guess at the volume number in a book title, as "3". */
export function volumeFromTitle(title: string): string | null {
    for (const pattern of VOLUME_IN_TITLE) {
        const number = title.match(pattern)?.[1];
        if (number) {
            return String(Number(number));
        }
    }
    return null;
}
