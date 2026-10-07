import { PersonRole } from '@analog/types';

const CREDIT_PHRASES: Record<PersonRole, string> = {
    [PersonRole.Author]: 'By',
    [PersonRole.Illustrator]: 'Illustrated by',
    [PersonRole.Translator]: 'Translated by',
    [PersonRole.Editor]: 'Edited by',
    [PersonRole.Narrator]: 'Narrated by',
    [PersonRole.Foreword]: 'Foreword by',
    [PersonRole.Afterword]: 'Afterword by',
    [PersonRole.CoverArtist]: 'Cover art by',
};

type Credit = { name: string; role: PersonRole };

/** Credits grouped by role, like "Translated by A, B", in the order given. */
export function creditLines(credits: Credit[]) {
    const lines = new Map<PersonRole, string[]>();
    for (const { name, role } of credits) {
        lines.set(role, [...(lines.get(role) ?? []), name]);
    }
    return [...lines].map(([role, names]) => ({
        role,
        names,
        text: `${CREDIT_PHRASES[role]} ${names.join(', ')}`,
    }));
}
