import { catalogItemIsbn } from './catalog-item-isbn.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations, sql } from 'drizzle-orm';
import { type AnyPgColumn, index, text, uuid } from 'drizzle-orm/pg-core';

// Who published an ISBN. Lookups find a publisher by name or any alias, so
// "VIZ Media LLC" and "Viz" can both be Viz Media.
export const publisher = appSchema.table(
    'publisher',
    {
        id: id(),
        name: text('name').notNull(),
        // The publisher this is an imprint of, like Viz Media for Shonen Jump.
        parentId: uuid('parent_id').references(
            (): AnyPgColumn => publisher.id,
            {
                onDelete: 'set null',
            }
        ),
        aliases: text('aliases').array().notNull().default(sql`'{}'`),
        // `nameKey` of the name and each alias, for matching.
        matchKeys: text('match_keys').array().notNull().default(sql`'{}'`),
        ...timestamps(),
    },
    (table) => [
        index('publisher_match_keys_idx').using('gin', table.matchKeys),
        index('publisher_parent_id_idx').on(table.parentId),
    ]
);

export const publisherRelations = relations(publisher, ({ one, many }) => ({
    isbns: many(catalogItemIsbn),
    parent: one(publisher, {
        fields: [publisher.parentId],
        references: [publisher.id],
        relationName: 'imprints',
    }),
    imprints: many(publisher, { relationName: 'imprints' }),
}));
