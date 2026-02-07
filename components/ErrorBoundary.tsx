/**
 * ErrorBoundary Component
 * 
 * A reusable error boundary that catches JavaScript errors in child components.
 * Displays a user-friendly fallback UI with an option to retry.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<CustomError />}>
 *   <ComponentThatMightFail />
 * </ErrorBoundary>
 * ```
 */

'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Custom fallback UI to render on error */
    fallback?: ReactNode;
    /** Called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Label for the component being wrapped (for error messages) */
    componentLabel?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const label = this.props.componentLabel || 'component';

            return (
                <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg text-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-red-500 mb-3"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3 className="text-sm font-semibold text-red-700 mb-1">
                        Something went wrong
                    </h3>
                    <p className="text-xs text-red-600 mb-3">
                        The {label} failed to load. Please try again.
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="
              px-4 py-1.5 text-xs font-medium rounded-md
              bg-red-600 text-white hover:bg-red-700
              transition-colors cursor-pointer
            "
                    >
                        Try Again
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details className="mt-3 text-left w-full">
                            <summary className="text-xs text-red-600 cursor-pointer">
                                Error details
                            </summary>
                            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-32">
                                {this.state.error.message}
                                {'\n\n'}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
