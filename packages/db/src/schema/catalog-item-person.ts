import { catalogItem } from './catalog-item.js';
import { personRole } from './enums.js';
import { person } from './person.js';
import { appSchema } from './primitives.js';
import { relations } from 'drizzle-orm';
import { index, integer, primaryKey, uuid } from 'drizzle-orm/pg-core';

// Who made the work, like its author and illustrator, in credit order.
// Credits for one edition, like a translator, are on its ISBN.
export const catalogItemPerson = appSchema.table(
    'catalog_item_person',
    {
        catalogItemId: uuid('catalog_item_id')
            .notNull()
            .references(() => catalogItem.id, { onDelete: 'cascade' }),
        personId: uuid('person_id')
            .notNull()
            .references(() => person.id, { onDelete: 'cascade' }),
        role: personRole('role').notNull(),
        position: integer('position').notNull(),
    },
    (table) => [
        primaryKey({
            columns: [table.catalogItemId, table.personId, table.role],
        }),
        index('catalog_item_person_person_id_idx').on(table.personId),
    ]
);

export const catalogItemPersonRelations = relations(
    catalogItemPerson,
    ({ one }) => ({
        catalogItem: one(catalogItem, {
            fields: [catalogItemPerson.catalogItemId],
            references: [catalogItem.id],
        }),
        person: one(person, {
            fields: [catalogItemPerson.personId],
            references: [person.id],
        }),
    })
);
