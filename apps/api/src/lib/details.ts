type Fact = { label: string; value: string };
type Link = { label: string; url: string };

/** Drops facts with nothing to show. */
export function filledFacts(
    facts: { label: string; value: string | null | undefined }[]
): Fact[] {
    return facts.filter((fact): fact is Fact => !!fact.value);
}

/** Drops links with no url. */
export function filledLinks(
    links: { label: string; url: string | null | undefined }[]
): Link[] {
    return links.filter((link): link is Link => !!link.url);
}

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
};

/** Text from a description that comes with some HTML. */
export function plainText(html: string | null | undefined): string | null {
    if (!html) {
        return null;
    }
    const text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(
            /&(amp|quot|#039|#39|lt|gt);/g,
            (entity) => ENTITIES[entity] ?? ''
        )
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text || null;
}
