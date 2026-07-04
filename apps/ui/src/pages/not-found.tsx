import { Button } from '@/components/ui/button';

export function NotFoundPage() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-sm text-gray-500">
                The page you're looking for doesn't exist.
            </p>
            <Button to="/">Go Home</Button>
        </div>
    );
}
