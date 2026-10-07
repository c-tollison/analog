import {
    and,
    asc,
    desc,
    eq,
    inArray,
    isNotNull,
    ne,
    schema,
    sql,
} from '@analog/db';
import { CheckRule, PersonRole, SeriesKind } from '@analog/types';

import { creditNames, type PersonLink } from './book-values.js';
import { VOLUME_TEXT } from './books.js';
import { db } from './init.js';
import { isLatin } from './open-library.js';
import {
    type ChoiceCriteria,
    choice,
    noul,
    type Questions,
    type TypeSafeClient,
} from '@typesafe-ai/sdk';

// The checks behind `pnpm catalog:check`. Jev only answers plain questions
// that the text itself can answer, and code turns the answers into problems
// using these rules (also listed in CHECK_RULES in @analog/types):
//
//  1. Art books and guidebooks aren't in a series of volumes.
//  2. A book whose title names an edition (Omnibus, VIZBIG, 3-in-1...) is in
//     a series with that edition in its name.
//  3. Manga and light novel titles are "Series, Vol. N", with no volume
//     subtitle: "Haikyu!! 33: Monsters' Ball" becomes "Haikyu!!, Vol. 33".
//  4. The number in the title is the saved volume.
//  5. Names have no tags like "(English)" or "(Manga)".
//  6. A series is named the way its books spell it.
//  7. No two series have the same name written differently.
//  8. No two books in a series share a volume number.
//
// Punctuation doesn't count as a difference: curly and straight quotes,
// dashes, accents and spacing around colons are evened out first. Books
// with no series are left alone. Nothing here changes the catalog; problems
// are saved for an admin.

const { catalogItem, series } = schema;

type Series = typeof series.$inferSelect;
type Isbn = typeof schema.catalogItemIsbn.$inferSelect & {
    publisher: { name: string } | null;
};
export type Item = typeof catalogItem.$inferSelect & {
    isbns: Isbn[];
    series: Series | null;
    people: PersonLink[];
};
export type Problem = Omit<
    typeof schema.catalogCheck.$inferInsert,
    'id' | 'createdAt'
>;
// What a check cost in TypeSafe requests and tokens.
export type Usage = Pick<
    typeof schema.catalogCheckRun.$inferInsert,
    'requests' | 'inputTokens' | 'outputTokens'
>;
export type Checked = { problems: Problem[]; usage: Usage };

const NO_USAGE: Usage = { requests: 0, inputTokens: 0, outputTokens: 0 };

function usageOf(usage: { input_tokens: number; output_tokens: number }) {
    return {
        requests: 1,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
    };
}

// Series whose title is close enough to be a possible duplicate.
const SIMILAR_SERIES = 0.3;
const MAX_SIMILAR_SERIES = 6;
const EXAMPLE_ITEMS = 5;
// Jev's yes, for yes/no questions.
const YES = 0.5;
// How sure Jev must be that a book is an art book before flagging it.
const COMPANION_MIN = 0.8;
// Below this, "extra words" flags were mostly wrong on real data.
const EXTRA_WORDS_MIN = 0.6;

// Edition names that set a run apart, for rule 2.
const EDITIONS = [
    { name: 'Omnibus', pattern: /omnibus/i },
    { name: 'N-in-1', pattern: /\b\d-in-1\b/i },
    { name: 'VIZBIG', pattern: /vizbig/i },
    { name: 'Perfect Edition', pattern: /perfect edition/i },
    { name: 'Deluxe', pattern: /deluxe/i },
    { name: "Collector's Edition", pattern: /collector's edition/i },
    { name: 'Full Color', pattern: /full[- ]colou?r/i },
    { name: 'Fullmetal Edition', pattern: /fullmetal edition/i },
    { name: 'Complete Collection', pattern: /complete (manga )?collection/i },
];

/**
 * A name with its punctuation evened out, for comparing. A curly apostrophe
 * matches a straight one, so "Journey's End" matches either way; capitals
 * still count.
 */
export function plainName(text: string): string {
    return (
        text
            .normalize('NFKD')
            // Accents, split off by NFKD: "Pokemon" matches with or without one.
            .replace(/[\u0300-\u036f]/g, '')
            // Curly single quotes, backtick and acute accent.
            .replace(/[\u2018\u2019`\u00b4]/g, "'")
            // Curly double quotes.
            .replace(/[\u201c\u201d]/g, '"')
            // Hyphens and dashes.
            .replace(/[\u2010-\u2015]/g, '-')
            .replace(/\s*:\s*/g, ': ')
            .replace(/\s+/g, ' ')
            .trim()
    );
}

function editionsIn(text: string): string[] {
    const plain = plainName(text);
    return EDITIONS.filter(({ pattern }) => pattern.test(plain)).map(
        ({ name }) => name
    );
}

/** A name in quotes, on one line. */
function q(text: string | null | undefined): string {
    return `"${text?.replace(/\s+/g, ' ').trim()}"`;
}

function isNumberedKind(kind: SeriesKind | null): boolean {
    return kind === SeriesKind.Manga || kind === SeriesKind.LightNovel;
}

function similarSeries(title: string, exceptId: string) {
    const closeness = sql<number>`greatest(
        word_similarity(${series.title}, ${title}),
        word_similarity(${title}, ${series.title})
    )`;
    return db()
        .select()
        .from(series)
        .where(
            and(sql`${closeness} >= ${SIMILAR_SERIES}`, ne(series.id, exceptId))
        )
        .orderBy(desc(closeness))
        .limit(MAX_SIMILAR_SERIES);
}

/** A series as Jev sees it: its name and a few of its books. */
async function seriesCards(rows: Series[]) {
    const books = rows.length
        ? await db()
              .select({
                  seriesId: catalogItem.seriesId,
                  title: catalogItem.title,
              })
              .from(catalogItem)
              .where(
                  inArray(
                      catalogItem.seriesId,
                      rows.map((row) => row.id)
                  )
              )
              .orderBy(asc(catalogItem.position))
        : [];
    return rows.map((row) => ({
        title: row.title,
        books: books
            .filter((book) => book.seriesId === row.id)
            .slice(0, EXAMPLE_ITEMS)
            .map((book) => book.title),
    }));
}

const EXTRA_WORDS = noul(
    {
        question:
            'Does `name` include words that are not part of the name of the work?',
        counts: [
            'A language, like "(English)"',
            'A format, like "(Manga)" or "Novel"',
            'A publisher or store name',
            'Stray characters, like "__" or "[ ]"',
        ],
        does_not_count: [
            'Edition names that set a run apart, like "3-in-1 Edition", "Omnibus" or "VIZBIG Edition"',
            'Volume numbers, like "Vol. 3"',
            'Punctuation that is part of the name, like "Haikyu!!"',
        ],
    },
    {
        true: 'It has words that are not part of the name.',
        false: 'It is only the name of the work, with its edition and volume when needed.',
    }
);

const COMPANION = noul(
    'Is `book` an art book, guidebook, fanbook or other companion book, rather than a volume of the story?'
);

const NUMBER = /\d+(?:\.\d+)?/g;
const NOT_A_VOLUME = 'not_a_volume';

/**
 * Checks one book. `seriesNames` has the suggested name for series whose
 * spelling was flagged, so title fixes use it.
 */
export async function checkItem(
    client: TypeSafeClient,
    item: Item,
    seriesNames: Map<string, string>
): Promise<Checked> {
    const otherTitles = item.isbns.flatMap((isbn) =>
        isbn.title && isbn.title !== item.title ? [isbn.title] : []
    );
    const book = {
        title: item.title,
        subtitle: item.subtitle,
        authors: creditNames(item.people, PersonRole.Author),
        publishers: [
            ...new Set(
                item.isbns.flatMap((isbn) => isbn.publisher?.name ?? [])
            ),
        ],
        other_edition_titles: otherTitles,
    };
    const problems: Problem[] = [];
    const flag = (problem: Omit<Problem, 'catalogItemId'>) =>
        problems.push({ catalogItemId: item.id, ...problem });
    const numbered = isNumberedKind(item.kind) && item.series !== null;

    const questions: Questions = {};
    if (item.series) {
        questions.companion = COMPANION;
    } else {
        // Rule 5. A "Series, Vol. N" title is checked by rule 3 instead.
        questions.extra_words = EXTRA_WORDS;
    }
    // Every number in its titles, so Jev picks one and never makes one up.
    const numbers = new Set(
        [book.title, book.subtitle, ...otherTitles].flatMap((text) =>
            [...(text?.matchAll(NUMBER) ?? [])].map(([n]) => String(Number(n)))
        )
    );
    if (numbers.size && item.series) {
        const options: ChoiceCriteria = {
            [NOT_A_VOLUME]:
                'None of these is its volume number, or it is not a numbered volume.',
        };
        for (const number of numbers) {
            options[number] = `Volume ${number}`;
        }
        questions.volume = choice(
            {
                question:
                    'Which volume of its series is `book`, going by its titles?',
                rules: [
                    'A book that collects several volumes has its own volume number, usually after "Vol.". The numbers of the volumes it collects are not its volume number.',
                    'Years, anniversaries, page counts and the numbers in "2-in-1" or "3-in-1" are not volume numbers.',
                ],
            },
            options
        );
    }
    if (!Object.keys(questions).length) {
        return { problems, usage: NO_USAGE };
    }

    const { answers, usage } = await client.systemOne({
        state: { book, name: item.title },
        questions,
    });

    // Rule 1: art books aren't in a series of volumes.
    const companion = answers.companion;
    let seriesFlagged = false;
    if (
        item.series &&
        companion?.type === 'noul' &&
        companion.noul >= COMPANION_MIN
    ) {
        seriesFlagged = true;
        flag({
            rule: CheckRule.WrongSeries,
            message: `${q(item.title)} looks like an art book or guidebook, but it's in ${q(item.series.title)}. Companion books get their own series`,
            confidence: companion.noul,
        });
    }

    // Rule 2: an edition in the title is in the series name too.
    if (item.series && !seriesFlagged) {
        const inSeries = editionsIn(item.series.title);
        const missing = editionsIn(item.title).filter(
            (edition) => !inSeries.includes(edition)
        );
        if (missing.length) {
            seriesFlagged = true;
            flag({
                rule: CheckRule.WrongSeries,
                message: `${q(item.title)} is a ${missing.join(', ')} edition, but ${q(item.series.title)} isn't. Editions get their own series`,
            });
        }
    }

    // Rule 4: the number in the title is the saved volume.
    const volumeAnswer = answers.volume;
    const titleVolume =
        volumeAnswer?.type === 'choice' && volumeAnswer.choice !== NOT_A_VOLUME
            ? volumeAnswer
            : null;
    if (titleVolume && titleVolume.choice !== String(item.position)) {
        flag({
            rule: CheckRule.VolumeMismatch,
            message: `${q(item.title)} says volume ${titleVolume.choice}, but it's saved as ${item.position ?? 'none'}`,
            fix: titleVolume.choice,
            confidence: titleVolume.probabilities[titleVolume.choice],
        });
    }

    // Rule 5.
    const extra = answers.extra_words;
    if (extra?.type === 'noul' && extra.noul >= EXTRA_WORDS_MIN) {
        flag({
            rule: CheckRule.ExtraWords,
            message: `${q(item.title)} has extra words`,
            confidence: extra.noul,
        });
    }

    if (numbered && item.series && !seriesFlagged) {
        const volume = titleVolume?.choice ?? item.position;
        if (volume === null) {
            flag({
                rule: CheckRule.MissingVolume,
                message: `${q(item.title)} has no volume number`,
            });
        } else {
            // Rule 3, using the suggested series name when there is one.
            const name = seriesNames.get(item.series.id) ?? item.series.title;
            const want = `${name}, Vol. ${volume}`;
            if (plainName(item.title) !== plainName(want)) {
                flag({
                    rule: CheckRule.TitleStyle,
                    message: `${q(item.title)} → ${q(want)}`,
                    fix: want,
                });
            }
        }
    }

    return { problems, usage: usageOf(usage) };
}

/**
 * Rule 8: books that share a series and volume number with another. Only
 * looks in one series when `seriesId` is given.
 */
export async function checkDuplicateVolumes(
    itemIds: Set<string>,
    seriesId?: string
): Promise<Problem[]> {
    const rows = await db()
        .select({
            id: catalogItem.id,
            title: catalogItem.title,
            seriesId: catalogItem.seriesId,
            position: catalogItem.position,
        })
        .from(catalogItem)
        .where(
            and(
                seriesId
                    ? eq(catalogItem.seriesId, seriesId)
                    : isNotNull(catalogItem.seriesId),
                isNotNull(catalogItem.position)
            )
        );
    const key = (row: (typeof rows)[number]) =>
        `${row.seriesId}:${row.position}`;
    return rows.flatMap((row) => {
        const others = rows.filter(
            (other) => other.id !== row.id && key(other) === key(row)
        );
        const [first] = others;
        if (!first || !itemIds.has(row.id)) {
            return [];
        }
        return [
            {
                catalogItemId: row.id,
                rule: CheckRule.DuplicateVolume,
                message: `${q(row.title)} has the same volume (${row.position}) as ${q(first.title)}. Merge it in as another ISBN?`,
                fix: first.id,
            },
        ];
    });
}

/**
 * The ways a series' books spell its name, with how many books use each.
 * Spellings that only differ in punctuation count as one, written the way
 * the series already is when it's one of them. "Akame ga KILL!, Vol. 2"
 * spells it "Akame ga KILL!".
 */
async function spellingsOf(row: Series): Promise<Map<string, number>> {
    const books = await db()
        .select({ title: catalogItem.title })
        .from(catalogItem)
        .where(eq(catalogItem.seriesId, row.id));
    // Keyed by the evened-out name, so punctuation doesn't split them.
    const found = new Map([
        [plainName(row.title), { name: row.title, books: 0 }],
    ]);
    for (const { title } of books) {
        if (!isLatin(title)) {
            continue;
        }
        const plain = title.replace(/\s+/g, ' ').trim();
        const name = plain.replace(VOLUME_TEXT, '').trim() || plain;
        const entry = found.get(plainName(name)) ?? { name, books: 0 };
        entry.books++;
        found.set(plainName(name), entry);
    }
    return new Map(
        [...found.values()].map((entry) => [entry.name, entry.books])
    );
}

/** Checks a series' name and looks for other series it duplicates. */
export async function checkSeries(
    client: TypeSafeClient,
    row: Series
): Promise<Checked> {
    const others = await similarSeries(row.title, row.id);
    const [card, ...otherCards] = await seriesCards([row, ...others]);
    const questions: Questions = { extra_words: EXTRA_WORDS };

    // Rule 6: pick the right name from the ways its books spell it. Only
    // manga and light novel titles carry the series name.
    const spellings = await spellingsOf(row);
    if (spellings.size > 1 && isNumberedKind(row.kind)) {
        const options: ChoiceCriteria = {};
        for (const [spelling, books] of spellings) {
            options[spelling] = { books_using_it: books };
        }
        questions.spelling = choice(
            {
                question: 'Which is the right name for `series`?',
                rules: [
                    'The right name is the English name of the work, spelled and capitalized the way the publisher writes it.',
                    'It keeps edition names that set a run apart, like "Omnibus", "3-in-1 Edition" or "VIZBIG Edition".',
                    'It has no volume numbers, volume subtitles, or tags like "(Manga)" or "(English)".',
                ],
            },
            options
        );
    }
    // Rule 7: the same name written differently. Different editions are
    // told apart by code, so Jev is only asked about the names.
    const ownEditions = editionsIn(row.title).join();
    const sameEdition = others.flatMap((other, i) =>
        editionsIn(other.title).join() === ownEditions ? [{ other, i }] : []
    );
    for (const { i } of sameEdition) {
        questions[`same_name_${i}`] = noul(
            `Do \`series.title\` and \`others[${i}].title\` name the same work, only written differently, like with other spelling, capitals or a tag such as "(English)"?`
        );
    }

    const { answers, usage } = await client.systemOne({
        state: {
            name: row.title,
            series: card ?? row.title,
            others: otherCards,
        },
        questions,
    });

    const problems: Problem[] = [];
    const flag = (problem: Omit<Problem, 'seriesId'>) =>
        problems.push({ seriesId: row.id, ...problem });

    const spelling = answers.spelling;
    const respell =
        spelling?.type === 'choice' && spelling.choice !== row.title
            ? spelling
            : null;
    if (respell) {
        flag({
            rule: CheckRule.SeriesSpelling,
            message: `Series ${q(row.title)} → ${q(respell.choice)}`,
            fix: respell.choice,
            confidence: respell.probabilities[respell.choice],
        });
    }
    // Rule 5. A new spelling already drops any extra words.
    const extra = answers.extra_words;
    if (!respell && extra?.type === 'noul' && extra.noul >= EXTRA_WORDS_MIN) {
        flag({
            rule: CheckRule.ExtraWords,
            message: `Series ${q(row.title)} has extra words`,
            confidence: extra.noul,
        });
    }

    for (const { other, i } of sameEdition) {
        const same = answers[`same_name_${i}`];
        if (same?.type === 'noul' && same.noul >= YES) {
            flag({
                rule: CheckRule.DuplicateSeries,
                message: `Series ${q(row.title)} may be the same as ${q(other.title)}`,
                fix: other.id,
                confidence: same.noul,
            });
        }
    }
    return { problems, usage: usageOf(usage) };
}
