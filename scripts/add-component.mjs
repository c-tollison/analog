import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const webDir = fileURLToPath(new URL('../apps/web', import.meta.url));
const args = process.argv.slice(2);

const run = (command, commandArgs, cwd) => {
    execFileSync(command, commandArgs, { cwd, stdio: 'inherit' });
};

run('pnpm', ['exec', 'shadcn-vue', 'add', ...args], webDir);

const componentsGlob = 'apps/web/src/components/shadcn-components';
run('pnpm', ['biome:fix', componentsGlob, 'apps/web/src/lib'], repoRoot);
run('pnpm', ['prettier:fix', `${componentsGlob}/**/*.vue`], repoRoot);
