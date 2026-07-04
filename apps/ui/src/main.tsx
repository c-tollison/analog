import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { ErrorBoundary } from '@/components/error-boundary';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';

const UsersPage = lazy(() =>
    import('./pages/users').then((m) => ({ default: m.UsersPage }))
);
const NotFoundPage = lazy(() =>
    import('./pages/not-found').then((m) => ({ default: m.NotFoundPage }))
);

import './index.css';

import { RootLayout } from './layout/root-layout';

function Root() {
    return (
        <ErrorBoundary>
            <QueryProvider>
                <ThemeProvider defaultTheme="system" storageKey="analog-theme">
                    <RootLayout />
                </ThemeProvider>
            </QueryProvider>
        </ErrorBoundary>
    );
}

const router = createBrowserRouter([
    {
        element: <Root />,
        children: [
            {
                path: '/',
                element: <UsersPage />,
            },
            {
                path: '*',
                element: <NotFoundPage />,
            },
        ],
    },
]);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
