import { catalogItemIsbn } from './catalog-item-isbn.js';
import { personRole } from './enums.js';
import { person } from './person.js';
import { appSchema } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, integer, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

// Who worked on one edition, like a translation's translator, in credit
// order. An ISBN brings these when it joins another item.
export const catalogItemIsbnPerson = appSchema.table(
    'catalog_item_isbn_person',
    {
        isbn: text('isbn')
            .notNull()
            .references(() => catalogItemIsbn.isbn, { onDelete: 'cascade' }),
        personId: uuid('person_id')
            .notNull()
            .references(() => person.id, { onDelete: 'cascade' }),
        role: personRole('role').notNull(),
        position: integer('position').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.isbn, table.personId, table.role] }),
        index('catalog_item_isbn_person_person_id_idx').on(table.personId),
    ]
);

export const catalogItemIsbnPersonRelations = relations(
    catalogItemIsbnPerson,
    ({ one }) => ({
        edition: one(catalogItemIsbn, {
            fields: [catalogItemIsbnPerson.isbn],
            references: [catalogItemIsbn.isbn],
        }),
        person: one(person, {
            fields: [catalogItemIsbnPerson.personId],
            references: [person.id],
        }),
    })
);
