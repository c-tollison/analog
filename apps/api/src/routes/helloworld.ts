import { schemaValidator } from '../lib/validator.js';
import { Hono } from 'hono';
import { z } from 'zod';

const QuerySchema = z.object({
    name: z.string().min(1, 'name must not be empty').default('Hono'),
});

const helloWorld = new Hono().get(
    '/',
    schemaValidator('query', QuerySchema),
    (c) => {
        const { name } = c.req.valid('query');
        return c.text(`Hello ${name}!`);
    }
);

export default helloWorld;
