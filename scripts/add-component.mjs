import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const webDir = fileURLToPath(new URL('../apps/web', import.meta.url));
const args = process.argv.slice(2);

const run = (command, commandArgs, cwd) => {
    execFileSync(command, commandArgs, { cwd, stdio: 'inherit' });
};

if (args.some((arg) => arg === '-o' || arg === '--overwrite')) {
    console.error('Existing components are never overwritten.');
    process.exit(1);
}

// With no names shadcn opens its interactive picker, so it needs the terminal.
// Otherwise every "already exists, overwrite?" prompt is answered no.
function addComponents() {
    if (args.length === 0) {
        run('pnpm', ['exec', 'shadcn-vue', 'add'], webDir);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const no = spawn('yes', ['n'], { stdio: ['ignore', 'pipe', 'ignore'] });
        const add = spawn('pnpm', ['exec', 'shadcn-vue', 'add', ...args], {
            cwd: webDir,
            stdio: ['pipe', 'inherit', 'inherit'],
        });
        no.stdout.pipe(add.stdin);
        add.stdin.on('error', () => {});
        add.on('exit', (code) => {
            no.kill();
            code === 0
                ? resolve()
                : reject(new Error(`shadcn-vue exited with ${code}`));
        });
    });
}

await addComponents();

const componentsGlob = 'apps/web/src/components/shadcn-components';
run('pnpm', ['biome:fix', componentsGlob, 'apps/web/src/lib'], repoRoot);
run('pnpm', ['prettier:fix', `${componentsGlob}/**/*.vue`], repoRoot);
