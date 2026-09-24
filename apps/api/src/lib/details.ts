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
