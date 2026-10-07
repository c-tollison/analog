import { catalogItemIsbnPerson } from './catalog-item-isbn-person.js';
import { catalogItemPerson } from './catalog-item-person.js';
import { appSchema, id, timestamps } from './primitives.js';
import { relations, sql } from 'drizzle-orm';
import { index, text } from 'drizzle-orm/pg-core';

// An author or illustrator. Lookups find a person by name or any alias, so
// fixing a spelling once fixes it for later books too.
export const person = appSchema.table(
    'person',
    {
        id: id(),
        name: text('name').notNull(),
        // Other spellings, like "suu Morishita" for "Suu Morishita".
        aliases: text('aliases').array().notNull().default(sql`'{}'`),
        // `nameKey` of the name and each alias, for matching.
        matchKeys: text('match_keys').array().notNull().default(sql`'{}'`),
        ...timestamps(),
    },
    (table) => [index('person_match_keys_idx').using('gin', table.matchKeys)]
);

export const personRelations = relations(person, ({ many }) => ({
    catalogItems: many(catalogItemPerson),
    editions: many(catalogItemIsbnPerson),
}));
