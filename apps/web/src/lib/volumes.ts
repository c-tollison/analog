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
