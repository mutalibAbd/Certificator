/**
 * LoadingSpinner Component
 * 
 * A reusable loading spinner with multiple sizes and optional label.
 * Uses CSS animation defined in globals.css.
 */

'use client';

interface LoadingSpinnerProps {
    /** Size variant: 'sm' (16px), 'md' (24px), 'lg' (32px), 'xl' (48px) */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Optional loading message */
    label?: string;
    /** Center the spinner in its container */
    centered?: boolean;
}

const SIZE_CLASSES = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
} as const;

export function LoadingSpinner({
    size = 'md',
    label,
    centered = false,
}: LoadingSpinnerProps) {
    const spinner = (
        <div className={`loading-spinner ${SIZE_CLASSES[size]}`} />
    );

    if (!label && !centered) {
        return spinner;
    }

    return (
        <div
            className={`
        flex flex-col items-center gap-2
        ${centered ? 'justify-center h-full w-full' : ''}
      `}
        >
            {spinner}
            {label && (
                <span className="text-sm text-[var(--foreground-muted)]">{label}</span>
            )}
        </div>
    );
}

/**
 * LoadingOverlay Component
 * 
 * A full-screen or container-relative loading overlay with backdrop.
 */

interface LoadingOverlayProps {
    /** Loading message */
    message?: string;
    /** Whether to cover the full viewport or just the parent container */
    fullScreen?: boolean;
}

export function LoadingOverlay({
    message = 'Loading...',
    fullScreen = false,
}: LoadingOverlayProps) {
    return (
        <div
            className={`
        flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-50
        ${fullScreen ? 'fixed inset-0' : 'absolute inset-0'}
      `}
        >
            <LoadingSpinner size="lg" label={message} />
        </div>
    );
}

/**
 * Skeleton Component
 * 
 * A placeholder loading skeleton for content that is loading.
 */

interface SkeletonProps {
    /** Width of the skeleton (CSS value) */
    width?: string;
    /** Height of the skeleton (CSS value) */
    height?: string;
    /** Additional className */
    className?: string;
    /** Whether this is a circle skeleton */
    circle?: boolean;
}

export function Skeleton({
    width = '100%',
    height = '1rem',
    className = '',
    circle = false,
}: SkeletonProps) {
    return (
        <div
            className={`
        animate-pulse bg-slate-200 rounded
        ${circle ? 'rounded-full' : 'rounded'}
        ${className}
      `}
            style={{
                width: circle ? height : width,
                height,
            }}
        />
    );
}

/**
 * SkeletonCard Component
 * 
 * A skeleton placeholder for a card-like component.
 */

export function SkeletonCard() {
    return (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Skeleton height="8rem" className="rounded-none" />
            <div className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                    <Skeleton width="2.5rem" height="2.5rem" className="rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton width="70%" height="1rem" />
                        <Skeleton width="40%" height="0.75rem" />
                    </div>
                </div>
            </div>
            <div className="mx-5 mb-5 pt-4 border-t border-slate-100 flex gap-2">
                <Skeleton width="4rem" height="1.75rem" />
                <Skeleton width="4rem" height="1.75rem" />
            </div>
        </div>
    );
}
