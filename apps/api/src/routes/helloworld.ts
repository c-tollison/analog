import { Hono } from 'hono';

const helloWorld = new Hono().get('/', (c) => {
    return c.text('Hello Hono!');
});

export default helloWorld;
