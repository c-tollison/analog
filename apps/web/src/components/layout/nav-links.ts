import { LibraryBigIcon, NotebookPenIcon, UsersIcon } from '@lucide/vue';

export const navLinks = [
    {
        name: 'log',
        label: 'Log',
        icon: NotebookPenIcon,
        paths: ['/log'],
    },
    {
        name: 'collections',
        label: 'Shelves',
        icon: LibraryBigIcon,
        paths: ['/shelves'],
    },
    {
        name: 'friends',
        label: 'Friends',
        icon: UsersIcon,
        paths: ['/friends', '/users'],
    },
] as const;

// Nested pages (a collection, a person) keep their section highlighted.
export function isNavActive(currentPath: string, paths: readonly string[]) {
    return paths.some((path) => currentPath.startsWith(path));
}
