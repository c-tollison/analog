import { eq, schema } from '@analog/db';
import { UserRole } from '@analog/types';

import { loadConfig } from '../lib/config.js';
import { db, init, logger } from '../lib/init.js';
import { z } from 'zod';

// Sets a user's role by email. There is no API for this, so nobody can make
// themselves an admin from the app.
// Usage: set-role <email> <admin|member>

const { user } = schema;

const ArgsSchema = z.tuple([
    z.email().transform((email) => email.toLowerCase()),
    z.enum(UserRole),
]);

async function main() {
    const args = ArgsSchema.safeParse(process.argv.slice(2));
    if (!args.success) {
        throw new Error('Usage: set-role <email> <admin|member>');
    }
    const [email, role] = args.data;

    await init(loadConfig());
    try {
        const [updated] = await db()
            .update(user)
            .set({ role })
            .where(eq(user.email, email))
            .returning({ email: user.email, role: user.role });
        if (!updated) {
            throw new Error(`No user with email ${email}`);
        }
        logger().info(updated, 'Role updated');
    } finally {
        await db().$client.end();
    }
}

main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: The logger may not have started
    console.error(err);
    process.exitCode = 1;
});
