/**
 * DraggableText Component
 * 
 * A specialized draggable text element designed for certificate text fields.
 * Built on top of DraggableField with enhanced keyboard navigation support.
 * 
 * FEATURES:
 * - Keyboard arrow key support (1% nudge per keypress)
 * - Shift+Arrow for 5% larger nudges
 * - Text-specific styling presets
 * 
 * ACCESSIBILITY:
 * - Full keyboard accessibility
 * - ARIA labels for screen readers
 * - Touch-friendly 44px minimum (WCAG)
 */

'use client';

import { useCallback, KeyboardEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { NormalizedCoordinate } from '@/hooks/useNormalizedCoordinates';
import type { LayoutField } from '@/types/database.types';

/**
 * Nudge increment as percentage (0.01 = 1%)
 */
const NUDGE_INCREMENT = 0.01;
const NUDGE_INCREMENT_LARGE = 0.05;

/**
 * Props for DraggableText component
 */
export interface DraggableTextProps {
  /** The field configuration */
  field: LayoutField;
  
  /** Position as normalized coordinates (0-1) */
  position: NormalizedCoordinate;
  
  /** Whether this field is currently selected */
  isSelected?: boolean;
  
  /** Callback when field is clicked/selected */
  onSelect?: (fieldId: string) => void;
  
  /** Callback when position is changed via keyboard */
  onPositionChange?: (fieldId: string, newPosition: NormalizedCoordinate) => void;
  
  /** Optional className for custom styling */
  className?: string;
  
  /** Preview text to display */
  previewText?: string;
  
  /** Whether keyboard controls are enabled (when selected) */
  enableKeyboardControls?: boolean;
}

/**
 * DraggableText - A draggable text field with keyboard navigation
 * 
 * @example
 * ```tsx
 * <DraggableText
 *   field={textField}
 *   position={{ x: 0.5, y: 0.3 }}
 *   isSelected={selectedId === field.id}
 *   onSelect={handleSelect}
 *   onPositionChange={handlePositionChange}
 *   enableKeyboardControls
 * />
 * ```
 */
export function DraggableText({
  field,
  position,
  isSelected = false,
  onSelect,
  onPositionChange,
  className = '',
  previewText,
  enableKeyboardControls = true,
}: DraggableTextProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: field.id,
    data: {
      field,
      position,
      type: 'text',
    },
  });

  /**
   * Clamp a value to 0-1 range
   */
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));

  /**
   * Handle keyboard navigation for fine-tuning position
   * Arrow keys nudge by 1%, Shift+Arrow nudges by 5%
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!isSelected || !enableKeyboardControls || !onPositionChange) return;

    const increment = e.shiftKey ? NUDGE_INCREMENT_LARGE : NUDGE_INCREMENT;
    let newPosition: NormalizedCoordinate | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        newPosition = {
          x: clamp(position.x - increment),
          y: position.y,
        };
        break;
      case 'ArrowRight':
        newPosition = {
          x: clamp(position.x + increment),
          y: position.y,
        };
        break;
      case 'ArrowUp':
        newPosition = {
          x: position.x,
          y: clamp(position.y - increment),
        };
        break;
      case 'ArrowDown':
        newPosition = {
          x: position.x,
          y: clamp(position.y + increment),
        };
        break;
      default:
        return; // Don't prevent default for other keys
    }

    if (newPosition) {
      e.preventDefault(); // Prevent page scroll
      onPositionChange(field.id, newPosition);
    }
  }, [isSelected, enableKeyboardControls, onPositionChange, position, field.id]);

  // Calculate transform style for dragging
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    transform: CSS.Translate.toString(transform),
    cursor: isDragging ? 'grabbing' : 'grab',
    minWidth: '44px',
    minHeight: '44px',
    zIndex: isDragging ? 'var(--z-field-active)' : 'var(--z-fields)',
    fontFamily: field.font === 'Pinyon Script' ? 'var(--font-script)' : 'var(--font-sans)',
    fontSize: `${field.size}px`,
    color: field.color || 'inherit',
    fontWeight: field.bold ? 'bold' : 'normal',
    fontStyle: field.italic ? 'italic' : 'normal',
    textAlign: field.align || 'left',
    userSelect: 'none',
    transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
  };

  // Handle click for selection
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(field.id);
  };

  // Display text priority: previewText > value > label > placeholder
  const displayText = previewText || field.value || field.label || `[${field.type}]`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        touch-target
        group
        rounded
        px-2 py-1
        outline-none
        ${isDragging ? 'opacity-80 shadow-lg ring-2 ring-primary' : ''}
        ${isSelected ? 'ring-2 ring-border-focus shadow-md bg-primary-light/20' : 'hover:ring-1 hover:ring-border'}
        ${className}
      `.trim()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={`Text field: ${field.label || field.type}. ${isSelected ? 'Selected. Use arrow keys to nudge position.' : 'Click to select.'}`}
      aria-pressed={isSelected}
      tabIndex={0}
    >
      {/* Text content */}
      <span className="pointer-events-none whitespace-nowrap">
        {displayText}
      </span>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white" />
      )}
      
      {/* Keyboard hint for selected field */}
      {isSelected && enableKeyboardControls && (
        <div 
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-foreground-muted whitespace-nowrap opacity-0 group-focus:opacity-100 transition-opacity"
          aria-hidden="true"
        >
          ← → ↑ ↓ to nudge
        </div>
      )}
    </div>
  );
}

/**
 * Helper to get text alignment CSS class
 */
export function getTextAlignClass(align?: LayoutField['align']): string {
  switch (align) {
    case 'left':
      return 'text-left';
    case 'right':
      return 'text-right';
    case 'center':
    default:
      return 'text-center';
  }
}
