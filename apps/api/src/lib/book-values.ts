import { arrayContains, asc, eq, inArray, or, schema, sql } from '@analog/db';
import { Audience, EditionFormat, PersonRole } from '@analog/types';

import { db } from './init.js';

// Book sources disagree on spelling, so their text is turned into our own
// values here. Migration 0030 has the same rules in SQL.

/**
 * What two spellings of a name share, like "VIZ Media, LLC" and "Viz Media".
 * Case, spaces, punctuation and company endings don't count.
 */
export function nameKey(name: string): string {
    return name
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\b(llc|inc|incorporated|ltd)\b/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** A format from a source's text, or null when it's unclear. */
export function toEditionFormat(raw: string | null): EditionFormat | null {
    const text = raw?.toLowerCase() ?? '';
    if (text.includes('audio')) {
        return EditionFormat.Audiobook;
    }
    if (/e-?book|kindle|epub|digital/.test(text)) {
        return EditionFormat.Ebook;
    }
    const hard = text.includes('hard');
    const paper = /pap|soft|mass market|manga|comic|trade/.test(text);
    if (hard && paper) {
        return null;
    }
    if (hard) {
        return EditionFormat.Hardcover;
    }
    return paper ? EditionFormat.Paperback : null;
}

// Each genre's slug and the source names that mean it. Sources send names
// like "Comics & Graphic Novels / Manga / Fantasy", so each part is checked.
// Migration 0030 seeds the genre table and has the same rules in SQL.
const GENRE_NAMES: [string, RegExp][] = [
    ['action-adventure', /(^|[^a-z])action([^a-z]|$)|adventure/i],
    ['alternate-history', /alternat(iv)?e history/i],
    ['bildungsroman', /bildungsroman/i],
    ['classics', /classics/i],
    ['coming-of-age', /coming of age/i],
    ['contemporary-fiction', /^contemporary( fiction)?$/i],
    ['dystopian', /dystopia/i],
    ['family-drama', /family (life|saga|drama)/i],
    ['fantasy', /fantasy/i],
    ['dark-fantasy', /dark fantasy/i],
    ['fairy-tales', /fairy ?tale/i],
    ['folktales', /folk ?tale|folklore/i],
    ['heroic-fantasy', /heroic fantasy|sword (and|&) sorcery/i],
    ['high-fantasy', /^epic$|high fantasy|epic fantasy/i],
    ['historical-fantasy', /historical fantasy/i],
    ['low-fantasy', /low fantasy/i],
    ['magical-realism', /magical realism/i],
    ['mythic-fantasy', /mytholog|mythic/i],
    ['urban-fantasy', /urban fantasy/i],
    ['historical-fiction', /^historical( fiction)?$/i],
    ['horror', /horror/i],
    ['body-horror', /body horror/i],
    ['comedy-horror', /comedy horror|horror comedy/i],
    ['gothic-horror', /gothic horror|^gothic$/i],
    ['cosmic-horror', /cosmic horror|lovecraft/i],
    ['paranormal-horror', /paranormal horror|haunt/i],
    ['post-apocalyptic-horror', /zombie/i],
    ['psychological-horror', /psychological horror/i],
    ['quiet-horror', /quiet horror/i],
    ['slasher', /slasher/i],
    ['lgbtq', /lgbt|gay|lesbian|queer/i],
    ['literary-fiction', /literary/i],
    ['mystery', /myster|detective/i],
    ['caper', /caper|heist/i],
    ['cozy-mystery', /cozy/i],
    ['detective-mystery', /detective|private investigator|amateur sleuth/i],
    ['historical-mystery', /historical myster/i],
    ['howdunit', /howdunn?it/i],
    ['locked-room-mystery', /locked room/i],
    ['noir', /(^|[^a-z])noir([^a-z]|$)/i],
    ['procedural-mystery', /police procedural|hard.boiled/i],
    ['supernatural-mystery', /supernatural myster/i],
    ['urban-fiction', /urban fiction|street lit|^urban$/i],
    ['romance', /romance|love stor/i],
    ['contemporary-romance', /contemporary romance/i],
    ['dark-romance', /dark romance/i],
    ['erotic-romance', /erotic/i],
    ['romantasy', /romantasy|fantasy romance/i],
    ['gothic-romance', /gothic romance/i],
    ['historical-romance', /historical romance/i],
    ['paranormal-romance', /paranormal romance/i],
    ['regency-romance', /regency/i],
    ['romantic-comedy', /romantic comed|rom.?com/i],
    ['romantic-suspense', /romantic suspense/i],
    ['sci-fi-romance', /sci.?fi romance|science fiction romance/i],
    ['satire', /satire/i],
    ['science-fiction', /science fiction|sci.?fi/i],
    ['apocalyptic-sci-fi', /apocalyptic/i],
    ['colonization-sci-fi', /coloniz/i],
    ['hard-sci-fi', /hard science/i],
    ['military-sci-fi', /military science/i],
    ['mind-uploading', /mind upload|cyberpunk|android/i],
    [
        'parallel-worlds',
        /parallel (world|universe)|alternate (world|universe)/i,
    ],
    ['soft-sci-fi', /soft science/i],
    ['space-opera', /space opera/i],
    ['space-western', /space western/i],
    ['steampunk', /steampunk/i],
    ['speculative-fiction', /speculative/i],
    ['sports-fiction', /(^|[^a-z])sports?([^a-z]|$)/i],
    ['thriller', /thriller|suspense/i],
    ['action-thriller', /action thriller/i],
    ['conspiracy-thriller', /conspirac/i],
    ['disaster-thriller', /disaster/i],
    ['espionage-thriller', /espionage|spies|spy/i],
    ['forensic-thriller', /forensic/i],
    ['historical-thriller', /historical thriller/i],
    ['legal-thriller', /legal thriller|^legal$/i],
    ['paranormal-thriller', /paranormal thriller/i],
    ['psychological-thriller', /psychological thriller/i],
    ['religious-thriller', /religious thriller/i],
    ['utopian', /utopia/i],
    ['war-fiction', /(^|[^a-z])war([^a-z]|$)|military/i],
    ['western', /western/i],
    ['womens-fiction', /women'?s fiction/i],
    ['comedy', /comedy|humorous/i],
    ['drama', /(^|[^a-z])drama([^a-z]|$)/i],
    ['isekai', /isekai/i],
    ['mahou-shoujo', /mahou|magical girl/i],
    ['mecha', /mecha/i],
    ['music', /music/i],
    ['psychological', /psychological/i],
    ['slice-of-life', /slice.of.life|school life/i],
    ['supernatural', /supernatural|paranormal|ghost|occult|vampire|demon/i],
    [
        'art-photography',
        /^art( |$)|photography|architecture|film & video|design/i,
    ],
    ['memoir', /memoir|autobiograph/i],
    ['biography', /biograph/i],
    ['essays', /essays/i],
    ['food-drink', /cooking|cookbook|cookery|food|wine|beverage/i],
    ['history', /^history/i],
    ['how-to', /crafts|hobbies|how.to|reference|games & activities/i],
    [
        'humanities',
        /social science|political science|anthropology|sociology|psychology/i,
    ],
    ['humor', /^humor/i],
    ['parenting', /parenting/i],
    ['philosophy', /philosophy/i],
    ['religion', /religio|spiritual/i],
    [
        'science-technology',
        /^science$|technology|computers|mathematics|nature|medical/i,
    ],
    ['self-help', /self.help|personal growth/i],
    ['travel', /^travel/i],
    ['true-crime', /true crime/i],
];

const AUDIENCE_NAMES: [Audience, RegExp][] = [
    [Audience.Children, /juvenile|children/i],
    [Audience.YoungAdult, /young adult/i],
    [Audience.NewAdult, /new adult/i],
];

function nameParts(names: string[]): string[] {
    return names.flatMap((name) => name.split('/').map((part) => part.trim()));
}

/**
 * Genre slugs for genre names, from a source or our own. Names we don't
 * know are dropped.
 */
export async function toGenres(
    names: string[],
    executor: Pick<ReturnType<typeof db>, 'select'> = db()
): Promise<string[]> {
    const parts = nameParts(names);
    if (!parts.length) {
        return [];
    }
    const matched = GENRE_NAMES.filter(([, pattern]) =>
        parts.some((part) => pattern.test(part))
    ).map(([slug]) => slug);
    // Our own names and slugs match exactly, like a stored book's genres.
    const lower = parts.map((part) => part.toLowerCase());
    const { genre } = schema;
    const known = await executor
        .select({ slug: genre.slug })
        .from(genre)
        .where(
            or(
                inArray(genre.slug, [...matched, ...lower]),
                inArray(sql`lower(${genre.name})`, lower)
            )
        );
    return known.map((row) => row.slug);
}

type GenreExecutor = Pick<ReturnType<typeof db>, 'insert' | 'delete'>;

/** Replaces a book's own genres, by slug. */
export async function setItemGenres(
    catalogItemId: string,
    slugs: string[],
    executor: GenreExecutor = db()
): Promise<void> {
    const { catalogItemGenre } = schema;
    await executor
        .delete(catalogItemGenre)
        .where(eq(catalogItemGenre.catalogItemId, catalogItemId));
    if (slugs.length) {
        await executor
            .insert(catalogItemGenre)
            .values(slugs.map((genreSlug) => ({ catalogItemId, genreSlug })))
            .onConflictDoNothing();
    }
}

type SqlExecutor = Pick<ReturnType<typeof db>, 'execute'>;

/**
 * Gives every volume in a series these genres. Without `onlyEmpty`, it
 * replaces what they had; with it, only volumes with none get them.
 */
export async function setVolumeGenres(
    seriesId: string,
    slugs: string[],
    { onlyEmpty = false }: { onlyEmpty?: boolean } = {},
    executor: SqlExecutor & GenreExecutor = db()
): Promise<void> {
    const { catalogItem, catalogItemGenre } = schema;
    if (!onlyEmpty) {
        await executor
            .delete(catalogItemGenre)
            .where(
                inArray(
                    catalogItemGenre.catalogItemId,
                    db()
                        .select({ id: catalogItem.id })
                        .from(catalogItem)
                        .where(eq(catalogItem.seriesId, seriesId))
                )
            );
    }
    if (!slugs.length) {
        return;
    }
    await executor.execute(sql`
        insert into ${catalogItemGenre} (catalog_item_id, genre_slug)
        select item.id, picked.slug
        from ${catalogItem} item
        cross join unnest(${slugs}::text[]) picked(slug)
        where item.series_id = ${seriesId}
            and not exists (
                select 1 from ${catalogItemGenre} own
                where own.catalog_item_id = item.id
            )
        on conflict do nothing
    `);
}

/**
 * Gives a book that just joined a series its siblings' genres, unless it
 * already has its own.
 */
export async function inheritSeriesGenres(
    catalogItemId: string,
    seriesId: string,
    executor: SqlExecutor = db()
): Promise<void> {
    const { catalogItem, catalogItemGenre } = schema;
    await executor.execute(sql`
        insert into ${catalogItemGenre} (catalog_item_id, genre_slug)
        select distinct ${catalogItemId}::uuid, sibling.genre_slug
        from ${catalogItemGenre} sibling
        join ${catalogItem} item on item.id = sibling.catalog_item_id
        where item.series_id = ${seriesId}
            and item.id <> ${catalogItemId}
            and not exists (
                select 1 from ${catalogItemGenre} own
                where own.catalog_item_id = ${catalogItemId}
            )
        on conflict do nothing
    `);
}

/** The `with` that loads a book's genres with their names. */
export const withGenres = {
    genres: {
        columns: { genreSlug: true },
        with: { genre: { columns: { name: true } } },
    },
} as const;

/** Who a book is for, from a source's genre names, when they say. */
export function toAudience(names: string[]): Audience | null {
    const parts = nameParts(names);
    return (
        AUDIENCE_NAMES.find(([, pattern]) =>
            parts.some((part) => pattern.test(part))
        )?.[0] ?? null
    );
}

/**
 * A name with its other spellings, ready to save. Repeats and the name
 * itself are dropped from the spellings.
 */
export function namedValues(name: string, aliases: string[]) {
    const seen = new Set([name.toLowerCase()]);
    const others = aliases.filter((alias) => {
        const lower = alias.toLowerCase();
        if (seen.has(lower)) {
            return false;
        }
        seen.add(lower);
        return true;
    });
    const keys = [name, ...others].map(nameKey).filter(Boolean);
    return { name, aliases: others, matchKeys: [...new Set(keys)] };
}

type Named = { name: string; aliases: string[] };

/** What `into` becomes when `from` is merged into it. */
export function mergedValues(into: Named, from: Named) {
    return namedValues(into.name, [
        ...into.aliases,
        from.name,
        ...from.aliases,
    ]);
}

type Executor = Pick<ReturnType<typeof db>, 'select' | 'insert'>;

type NamedTable = typeof schema.person | typeof schema.publisher;

// The row whose name or alias matches, or a new one.
async function findOrCreateNamed(
    table: NamedTable,
    rawName: string,
    executor: Executor
): Promise<string | null> {
    const name = rawName.trim();
    const key = nameKey(name);
    if (!key) {
        return null;
    }
    const [found] = await executor
        .select({ id: table.id })
        .from(table)
        .where(arrayContains(table.matchKeys, [key]))
        .orderBy(asc(table.createdAt))
        .limit(1);
    if (found) {
        return found.id;
    }
    const [created] = await executor
        .insert(table)
        .values({ name, matchKeys: [key] })
        .returning({ id: table.id });
    return created?.id ?? null;
}

/** The publisher with this name or alias, made new when there's none. */
export function findOrCreatePublisher(
    name: string | null | undefined,
    executor: Executor = db()
): Promise<string | null> {
    return name
        ? findOrCreateNamed(schema.publisher, name, executor)
        : Promise.resolve(null);
}

export type Credit = { name: string; role: PersonRole };

type CreditExecutor = Pick<
    ReturnType<typeof db>,
    'select' | 'insert' | 'delete'
>;

// Each credit's person, found by name or alias or made new, in order.
async function creditRows(credits: Credit[], executor: CreditExecutor) {
    const rows = [];
    for (const [position, credit] of credits.entries()) {
        const personId = await findOrCreateNamed(
            schema.person,
            credit.name,
            executor
        );
        if (personId) {
            rows.push({ personId, role: credit.role, position });
        }
    }
    return rows;
}

/** Replaces who made the work, like its authors and illustrators. */
export async function setItemPeople(
    catalogItemId: string,
    credits: Credit[],
    executor: CreditExecutor = db()
): Promise<void> {
    const { catalogItemPerson } = schema;
    const rows = await creditRows(credits, executor);
    await executor
        .delete(catalogItemPerson)
        .where(eq(catalogItemPerson.catalogItemId, catalogItemId));
    if (rows.length) {
        await executor
            .insert(catalogItemPerson)
            .values(rows.map((row) => ({ ...row, catalogItemId })))
            .onConflictDoNothing();
    }
}

/** Replaces who worked on one edition, like its translator. */
export async function setEditionPeople(
    isbn: string,
    credits: Credit[],
    executor: CreditExecutor = db()
): Promise<void> {
    const { catalogItemIsbnPerson } = schema;
    const rows = await creditRows(credits, executor);
    await executor
        .delete(catalogItemIsbnPerson)
        .where(eq(catalogItemIsbnPerson.isbn, isbn));
    if (rows.length) {
        await executor
            .insert(catalogItemIsbnPerson)
            .values(rows.map((row) => ({ ...row, isbn })))
            .onConflictDoNothing();
    }
}

/** A looked-up book's authors and illustrators, for its item. */
export function itemCredits(book: {
    authors: string[];
    illustrators: string[];
}): Credit[] {
    return [
        ...book.authors.map((name) => ({ name, role: PersonRole.Author })),
        ...book.illustrators.map((name) => ({
            name,
            role: PersonRole.Illustrator,
        })),
    ];
}

/** A looked-up book's translators, for its ISBN. */
export function editionCredits(book: { translators: string[] }): Credit[] {
    return book.translators.map((name) => ({
        name,
        role: PersonRole.Translator,
    }));
}

export type PersonLink = {
    role: PersonRole;
    position: number;
    person: { name: string };
};

const ROLE_ORDER = Object.values(PersonRole);

// Credits sorted by role, then credit order.
function sorted(links: PersonLink[]): PersonLink[] {
    return links.toSorted(
        (a, b) =>
            ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
            a.position - b.position
    );
}

/** Names with a role, in credit order, each name once. */
export function creditNames(links: PersonLink[], role: PersonRole): string[] {
    const names = sorted(links)
        .filter((link) => link.role === role)
        .map((link) => link.person.name);
    return [...new Set(names)];
}

/** Credits as names with roles, in role and credit order, each once. */
export function creditList(links: PersonLink[]): Credit[] {
    const seen = new Set<string>();
    return sorted(links)
        .map((link) => ({ name: link.person.name, role: link.role }))
        .filter((credit) => {
            const key = `${credit.role}:${credit.name}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
}

/** The `with` that loads credits for `creditNames` and `creditList`. */
export const withPeople = {
    people: {
        columns: { role: true, position: true },
        with: { person: { columns: { name: true } } },
    },
} as const;
