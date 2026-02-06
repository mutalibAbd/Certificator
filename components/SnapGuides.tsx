/**
 * SnapGuides Component
 * 
 * Renders visual snapping guide lines on the canvas.
 * Lines appear as blue dashed lines when elements align with
 * the center or other elements during drag operations.
 * 
 * VISUAL SPEC (from frontend.md):
 * - Blue dashed lines
 * - Appear when elements are aligned within snap threshold
 */

'use client';

import type { SnapGuide } from '@/hooks/useSnapGuides';

/**
 * Props for SnapGuides component
 */
export interface SnapGuidesProps {
  /** Active snap guides to render */
  guides: SnapGuide[];
  /** Optional className for the container */
  className?: string;
}

/**
 * SnapGuides - Renders visual snap alignment guides
 * 
 * @example
 * ```tsx
 * <SnapGuides guides={activeGuides} />
 * ```
 */
export function SnapGuides({ guides, className = '' }: SnapGuidesProps) {
  if (guides.length === 0) return null;

  return (
    <div 
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {guides.map((guide) => (
        <SnapGuideLine key={guide.id} guide={guide} />
      ))}
    </div>
  );
}

/**
 * Single snap guide line component
 */
function SnapGuideLine({ guide }: { guide: SnapGuide }) {
  const baseClasses = 'snap-line absolute pointer-events-none z-snap-lines transition-opacity duration-150';
  
  // Different styles for center vs element alignment guides
  const isCenterGuide = guide.type === 'center';
  const opacity = guide.isActive ? (isCenterGuide ? 'opacity-100' : 'opacity-75') : 'opacity-0';

  if (guide.direction === 'vertical') {
    return (
      <div
        className={`${baseClasses} ${opacity} top-0 bottom-0 w-px border-l-2`}
        style={{ 
          left: `${guide.position * 100}%`,
          // Center guides are fully opaque, element guides slightly transparent
          borderColor: isCenterGuide 
            ? 'var(--color-snap-guide)' 
            : 'var(--color-snap-guide-element, var(--color-snap-guide))',
        }}
      />
    );
  }

  // Horizontal guide
  return (
    <div
      className={`${baseClasses} ${opacity} left-0 right-0 h-px border-t-2`}
      style={{ 
        top: `${guide.position * 100}%`,
        borderColor: isCenterGuide 
          ? 'var(--color-snap-guide)' 
          : 'var(--color-snap-guide-element, var(--color-snap-guide))',
      }}
    />
  );
}

/**
 * Simple center guides that always show during drag
 * Use this for a simpler implementation without snap detection
 */
export function CenterGuides({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <>
      {/* Vertical center line */}
      <div
        className="snap-line absolute top-0 bottom-0 w-px border-l-2 pointer-events-none z-snap-lines opacity-50"
        style={{ left: '50%' }}
        aria-hidden="true"
      />
      {/* Horizontal center line */}
      <div
        className="snap-line absolute left-0 right-0 h-px border-t-2 pointer-events-none z-snap-lines opacity-50"
        style={{ top: '50%' }}
        aria-hidden="true"
      />
    </>
  );
}
