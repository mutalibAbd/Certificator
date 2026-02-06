/**
 * DraggableField Component
 * 
 * A draggable field element for the certificate canvas.
 * Uses dnd-kit for drag-and-drop functionality.
 * 
 * ACCESSIBILITY:
 * - Touch-friendly: Minimum 44px drag handles (WCAG compliance)
 * - Keyboard accessible: Can be focused and moved with keyboard
 * 
 * COORDINATE SYSTEM:
 * - Position is stored as normalized coordinates (0.0 to 1.0)
 * - Visual position is calculated from percentage of container
 */

'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getCssFontFamily } from '@/lib/fonts';
import type { NormalizedCoordinate } from '@/hooks/useNormalizedCoordinates';
import type { LayoutField } from '@/types/database.types';

/**
 * Props for DraggableField component
 */
export interface DraggableFieldProps {
  /** The field configuration from the layout */
  field: LayoutField;

  /** Position as normalized coordinates (0-1) */
  position: NormalizedCoordinate;

  /** Whether this field is currently selected */
  isSelected?: boolean;

  /** Callback when field is clicked/selected */
  onSelect?: (fieldId: string) => void;

  /** Optional className for custom styling */
  className?: string;

  /** Whether the field is in edit mode */
  isEditing?: boolean;

  /** Preview text to display (for template preview) */
  previewText?: string;

  /** Scale factor for font size: containerHeight / pdfPageHeight */
  canvasScale?: number;
}

/**
 * DraggableField - A draggable text field on the certificate canvas
 * 
 * @example
 * ```tsx
 * <DraggableField
 *   field={layoutField}
 *   position={{ x: 0.5, y: 0.3 }}
 *   isSelected={selectedId === field.id}
 *   onSelect={handleSelect}
 * />
 * ```
 */
export function DraggableField({
  field,
  position,
  isSelected = false,
  onSelect,
  className = '',
  isEditing = false,
  previewText,
  canvasScale = 1,
}: DraggableFieldProps) {
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
    },
  });

  // Calculate transform style for dragging
  // Combine drag translation with field rotation
  const dragTranslate = CSS.Translate.toString(transform);
  const rotationDeg = field.rotation || 0;
  const combinedTransform = [
    dragTranslate,
    rotationDeg ? `rotate(${rotationDeg}deg)` : '',
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = {
    // Position using percentage (normalized * 100%)
    position: 'absolute',
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    // Apply drag transform + rotation
    transform: combinedTransform || undefined,
    // Visual feedback
    cursor: isDragging ? 'grabbing' : 'grab',
    // Touch-friendly minimum size (44px per WCAG)
    minWidth: '44px',
    minHeight: '44px',
    // Z-index based on state
    zIndex: isDragging ? 'var(--z-field-active)' : 'var(--z-fields)',
    // Typography from field config (scaled to match PDF proportions)
    fontFamily: getCssFontFamily(field.font),
    fontSize: `${field.size * canvasScale}px`,
    color: field.color || 'inherit',
    fontWeight: field.bold ? 'bold' : 'normal',
    fontStyle: field.italic ? 'italic' : 'normal',
    textAlign: field.align || 'left',
    // Prevent text selection during drag
    userSelect: 'none',
    // Smooth transform for non-dragging state
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
        rounded
        px-2 py-1
        ${isDragging ? 'opacity-80 shadow-lg ring-2 ring-primary' : ''}
        ${isSelected ? 'ring-2 ring-border-focus shadow-md bg-primary-light/20' : 'hover:ring-1 hover:ring-border'}
        ${isEditing ? 'ring-2 ring-warning' : ''}
        ${className}
      `.trim()}
      onClick={handleClick}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={`Draggable field: ${field.label || field.type}`}
      aria-pressed={isSelected}
      tabIndex={0}
    >
      {/* Field content */}
      <span className="pointer-events-none whitespace-nowrap">
        {displayText}
      </span>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white" />
      )}
      
      {/* Drag handle indicator (visible on hover/focus) */}
      <div 
        className={`
          absolute -left-1 top-1/2 -translate-y-1/2
          w-1 h-4 rounded-full bg-drag-handle
          opacity-0 transition-opacity
          ${isDragging || isSelected ? 'opacity-100' : 'group-hover:opacity-100'}
        `}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Field type badge component for showing field type
 */
export function FieldTypeBadge({ type }: { type: LayoutField['type'] }) {
  const typeConfig = {
    text: { label: 'Text', color: 'bg-blue-100 text-blue-800' },
    date: { label: 'Date', color: 'bg-green-100 text-green-800' },
    signature: { label: 'Signature', color: 'bg-purple-100 text-purple-800' },
    image: { label: 'Image', color: 'bg-orange-100 text-orange-800' },
  };

  const config = typeConfig[type];

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${config.color}`}>
      {config.label}
    </span>
  );
}
