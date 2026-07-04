import { CreateUserRequestSchema } from '@analog/types';
import { useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useCreateUserMutation } from '@/hooks/use-user-mutations';
import { useValidatedSubmit } from '@/hooks/use-validated-submit';
import { getErrorMessage } from '@/lib/errors';

export function UsersPage() {
    const mutation = useCreateUserMutation();

    const [name, setName] = useState('');

    const { onSubmit, fieldErrors } = useValidatedSubmit(
        CreateUserRequestSchema,
        { name },
        async (data) => {
            try {
                await mutation.mutateAsync(data);
                setName('');
            } catch {
                // mutation.isError renders inline
            }
        }
    );

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex justify-end p-4">
                <ThemeToggle />
            </header>

            <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                <h1 className="text-4xl font-bold">Create a user</h1>

                <form
                    onSubmit={onSubmit}
                    noValidate
                    className="flex w-full max-w-sm flex-col gap-2"
                >
                    <label htmlFor="user-name" className="text-sm font-medium">
                        Name
                    </label>
                    <input
                        id="user-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={!!fieldErrors.name}
                        className="rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                    />
                    {fieldErrors.name && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {fieldErrors.name}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="mt-2"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? 'Creating…' : 'Create user'}
                    </Button>

                    {mutation.isError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {getErrorMessage(mutation.error)}
                        </p>
                    )}
                </form>

                {mutation.isSuccess && (
                    <div className="w-full max-w-sm rounded-md border border-gray-300 p-4 text-sm dark:border-gray-700">
                        <p className="font-medium">
                            Created {mutation.data.name}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                            id: {mutation.data.id}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                            created:{' '}
                            {new Date(mutation.data.createdAt).toLocaleString()}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
