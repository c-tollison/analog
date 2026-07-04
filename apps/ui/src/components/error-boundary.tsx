import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full min-h-screen flex-col items-center justify-center gap-4 p-8">
                    <h1 className="text-2xl font-semibold">
                        Something went wrong
                    </h1>
                    <p className="max-w-md text-center text-sm text-gray-500">
                        An unexpected error occurred. Please try refreshing the
                        page.
                    </p>
                    <Button onClick={() => window.location.reload()}>
                        Refresh Page
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
