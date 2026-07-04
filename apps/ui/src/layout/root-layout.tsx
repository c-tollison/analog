import { Suspense } from 'react';
import { Outlet } from 'react-router';

export function RootLayout() {
    return (
        <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50">
            <Suspense fallback={null}>
                <Outlet />
            </Suspense>
        </div>
    );
}
