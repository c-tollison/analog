import {
    and,
    count,
    eq,
    inArray,
    isNotNull,
    isNull,
    or,
    type SQL,
    schema,
    sql,
} from '@analog/db';
import { CheckRule } from '@analog/types';

import { db } from './init.js';

// Keeps `pnpm catalog:check` problems in step with admin edits. Verifying
// clears everything found for a row, and saving the suggested value clears
// that suggestion.

const { catalogCheck, catalogItem } = schema;

type Executor = Pick<ReturnType<typeof db>, 'delete'>;

const isOpen = isNull(catalogCheck.dismissedAt);

function clear(where: SQL | undefined, executor: Executor = db()) {
    return executor.delete(catalogCheck).where(where);
}

/** After items are verified: they won't be checked again. */
export function clearItemChecks(itemIds: string[], executor?: Executor) {
    return clear(inArray(catalogCheck.catalogItemId, itemIds), executor);
}

/** After a series is verified. Its items keep theirs. */
export function clearSeriesChecks(seriesId: string) {
    return clear(eq(catalogCheck.seriesId, seriesId));
}

/** Clears an item's suggestions that its new values now match. */
export function clearAppliedItemChecks(
    itemId: string,
    values: { title: string; volume: number | null; seriesId: string | null },
    executor?: Executor
) {
    const fixes: [CheckRule, string | null][] = [
        [CheckRule.TitleStyle, values.title],
        [
            CheckRule.VolumeMismatch,
            values.volume === null ? null : String(values.volume),
        ],
        [CheckRule.WrongSeries, values.seriesId],
    ];
    return clear(
        and(
            eq(catalogCheck.catalogItemId, itemId),
            // Title is always set, so this is never empty.
            or(
                ...fixes.flatMap(([rule, value]) =>
                    value === null
                        ? []
                        : [
                              and(
                                  eq(catalogCheck.rule, rule),
                                  eq(catalogCheck.fix, value)
                              ),
                          ]
                )
            )
        ),
        executor
    );
}

/** After a series is renamed, its name suggestions are out of date. */
export function clearSeriesNameChecks(seriesId: string) {
    return clear(
        and(
            eq(catalogCheck.seriesId, seriesId),
            inArray(catalogCheck.rule, [
                CheckRule.SeriesSpelling,
                CheckRule.ExtraWords,
            ])
        )
    );
}

/** Open suggestions per item, to join on the item id. */
export function checkCountsByItem() {
    return db()
        .select({
            itemId: catalogCheck.catalogItemId,
            checkCount: count().as('check_count'),
        })
        .from(catalogCheck)
        .where(and(isOpen, isNotNull(catalogCheck.catalogItemId)))
        .groupBy(catalogCheck.catalogItemId)
        .as('item_check_counts');
}

/** Open suggestions per series, for it and its items, to join on its id. */
export function checkCountsBySeries() {
    const seriesId = sql<string>`coalesce(${catalogCheck.seriesId}, ${catalogItem.seriesId})`;
    return db()
        .select({
            seriesId: seriesId.as('check_series_id'),
            checkCount: count().as('check_count'),
        })
        .from(catalogCheck)
        .leftJoin(catalogItem, eq(catalogCheck.catalogItemId, catalogItem.id))
        .where(isOpen)
        .groupBy(seriesId)
        .as('series_check_counts');
}
