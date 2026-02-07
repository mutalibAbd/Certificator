/**
 * CertificateCanvas Component
 * 
 * The main canvas for editing certificate layouts with drag-and-drop field placement.
 * 
 * FEATURES:
 * - Drag-and-drop field positioning using dnd-kit
 * - Normalized coordinates for responsive layouts
 * - restrictToParentElement to prevent fields from leaving the canvas
 * - Touch-friendly for tablet users (common in educational settings)
 * - Aspect ratio preservation for accurate PDF preview
 * - Visual snapping guides (blue dashed) for alignment
 * - Keyboard arrow key support for fine-tuning (1% nudge)
 * 
 * COORDINATE SYSTEM:
 * - All positions stored as normalized (0.0 to 1.0)
 * - Browser coordinate system (Top-Left Origin)
 * - Convert to PDF coordinates when generating final output
 */

'use client';

import { useState, useCallback, useMemo, KeyboardEvent } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';

import { useNormalizedCoordinates, type NormalizedCoordinate } from '@/hooks/useNormalizedCoordinates';
import { useSnapGuides } from '@/hooks/useSnapGuides';
import { DraggableField } from '@/components/DraggableField';
import { SnapGuides } from '@/components/SnapGuides';
import { getCssFontFamily } from '@/lib/fonts';
import type { LayoutField } from '@/types/database.types';

/** Nudge increment for keyboard navigation (1%) */
const NUDGE_INCREMENT = 0.01;
/** Large nudge increment for Shift+Arrow (5%) */
const NUDGE_INCREMENT_LARGE = 0.05;
/** Default A4 height in PDF points — fallback for scaling font sizes */
const DEFAULT_PDF_PAGE_HEIGHT = 841.89;

/**
 * Field with position data for the canvas
 */
export interface CanvasField extends LayoutField {
  /** Normalized position (0-1) */
  position: NormalizedCoordinate;
}

/**
 * Props for CertificateCanvas component
 */
export interface CertificateCanvasProps {
  /** Array of fields to display on the canvas */
  fields: CanvasField[];

  /** Callback when fields are updated (position changes) */
  onFieldsChange: (fields: CanvasField[]) => void;

  /** Aspect ratio of the certificate (default: US Letter 8.5/11) */
  aspectRatio?: number;
  
  /** Currently selected field ID */
  selectedFieldId?: string | null;
  
  /** Callback when a field is selected */
  onFieldSelect?: (fieldId: string | null) => void;
  
  /** Whether the canvas is in read-only mode */
  readOnly?: boolean;
  
  /** Optional className for custom styling */
  className?: string;

  /** Loading state - show spinner when PDF is generating */
  isLoading?: boolean;

  /** PDF page height in points for font scaling (default: 841.89 for A4) */
  pdfPageHeight?: number;
}

/**
 * CertificateCanvas - Main component for visual certificate layout editing
 * 
 * @example
 * ```tsx
 * const [fields, setFields] = useState<CanvasField[]>([]);
 * const [selectedId, setSelectedId] = useState<string | null>(null);
 * 
 * <CertificateCanvas
 *   fields={fields}
 *   onFieldsChange={setFields}
 *   selectedFieldId={selectedId}
 *   onFieldSelect={setSelectedId}
 * />
 * ```
 */
export function CertificateCanvas({
  fields,
  onFieldsChange,
  aspectRatio = 8.5 / 11, // US Letter default
  selectedFieldId = null,
  onFieldSelect,
  readOnly = false,
  className = '',
  isLoading = false,
  pdfPageHeight = DEFAULT_PDF_PAGE_HEIGHT,
}: CertificateCanvasProps) {
  // Track currently dragging field for overlay
  const [activeField, setActiveField] = useState<CanvasField | null>(null);
  
  // Track current drag position for snap detection
  const [currentDragPosition, setCurrentDragPosition] = useState<NormalizedCoordinate | null>(null);
  
  // Normalized coordinate system
  const {
    containerRef,
    containerSize,
    deltaToNormalized,
    clampNormalized,
    isReady,
  } = useNormalizedCoordinates();

  // Scale factor so canvas font sizes match their PDF proportions.
  // field.size is in PDF points; multiply by this to get canvas pixels.
  const canvasScale = containerSize.height > 0
    ? containerSize.height / pdfPageHeight
    : 1;

  // Snap guides for alignment feedback
  const { activeGuides, snappedPosition } = useSnapGuides({
    currentPosition: currentDragPosition,
    draggingId: activeField?.id ?? null,
    otherFields: fields.filter(f => f.id !== activeField?.id).map(f => ({
      id: f.id,
      position: f.position,
    })),
  });

  // Configure sensors for mouse and touch
  // Activation constraint prevents accidental drags
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // 5px movement required to start drag
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150, // 150ms hold required for touch drag
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  /**
   * Handle drag start - track which field is being dragged
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const field = fields.find((f) => f.id === active.id);
    if (field) {
      setActiveField(field);
      setCurrentDragPosition(field.position);
    }
  }, [fields]);

  /**
   * Handle drag move - update position for snap guide detection
   */
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { active, delta } = event;
    const field = fields.find((f) => f.id === active.id);
    if (!field) return;

    // Calculate current drag position
    const normalizedDelta = deltaToNormalized({ x: delta.x, y: delta.y });
    const newPosition = clampNormalized({
      x: field.position.x + normalizedDelta.x,
      y: field.position.y + normalizedDelta.y,
    });
    setCurrentDragPosition(newPosition);
  }, [fields, deltaToNormalized, clampNormalized]);

  /**
   * Handle drag end - update field position with normalized coordinates
   * 
   * CRITICAL: This is where we convert pixel delta to normalized delta
   * and update the field position. The restrictToParentElement modifier
   * ensures the drag stays within bounds, but we also clamp as a safety check.
   * Uses snapped position if within snap threshold.
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;

    if (readOnly) {
      setActiveField(null);
      setCurrentDragPosition(null);
      return;
    }

    // Find the field that was dragged
    const fieldIndex = fields.findIndex((f) => f.id === active.id);
    if (fieldIndex === -1) {
      setActiveField(null);
      setCurrentDragPosition(null);
      return;
    }

    const field = fields[fieldIndex];
    
    // Convert pixel delta to normalized delta
    const normalizedDelta = deltaToNormalized({
      x: delta.x,
      y: delta.y,
    });

    // Calculate raw new position
    const rawPosition = clampNormalized({
      x: field.position.x + normalizedDelta.x,
      y: field.position.y + normalizedDelta.y,
    });

    // Use snapped position if available (currentDragPosition still set)
    // snappedPosition will be the same as raw if no snap occurred
    const newPosition = currentDragPosition ? snappedPosition : rawPosition;

    // Update fields array immutably
    const updatedFields = [...fields];
    updatedFields[fieldIndex] = {
      ...field,
      position: newPosition,
      // Also update x/y in the LayoutField for storage compatibility
      x: newPosition.x,
      y: newPosition.y,
    };

    onFieldsChange(updatedFields);
    
    // Clear drag state after using snapped position
    setActiveField(null);
    setCurrentDragPosition(null);
  }, [fields, deltaToNormalized, clampNormalized, onFieldsChange, readOnly, currentDragPosition, snappedPosition]);

  /**
   * Handle canvas click - deselect when clicking empty area
   */
  const handleCanvasClick = useCallback(() => {
    onFieldSelect?.(null);
  }, [onFieldSelect]);

  /**
   * Handle field selection
   */
  const handleFieldSelect = useCallback((fieldId: string) => {
    onFieldSelect?.(fieldId);
  }, [onFieldSelect]);

  /**
   * Helper to clamp a value between 0 and 1
   */
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));

  /**
   * Handle keyboard navigation for fine-tuning position
   * Arrow keys nudge by 1%, Shift+Arrow nudges by 5%
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !selectedFieldId) return;

    const field = fields.find(f => f.id === selectedFieldId);
    if (!field) return;

    const increment = e.shiftKey ? NUDGE_INCREMENT_LARGE : NUDGE_INCREMENT;
    let newPosition: NormalizedCoordinate | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        newPosition = { x: clamp(field.position.x - increment), y: field.position.y };
        break;
      case 'ArrowRight':
        newPosition = { x: clamp(field.position.x + increment), y: field.position.y };
        break;
      case 'ArrowUp':
        newPosition = { x: field.position.x, y: clamp(field.position.y - increment) };
        break;
      case 'ArrowDown':
        newPosition = { x: field.position.x, y: clamp(field.position.y + increment) };
        break;
      case 'Escape':
        onFieldSelect?.(null);
        return;
      default:
        return;
    }

    if (newPosition) {
      e.preventDefault();
      const fieldIndex = fields.findIndex(f => f.id === selectedFieldId);
      const updatedFields = [...fields];
      updatedFields[fieldIndex] = {
        ...field,
        position: newPosition,
        x: newPosition.x,
        y: newPosition.y,
      };
      onFieldsChange(updatedFields);
    }
  }, [readOnly, selectedFieldId, fields, onFieldsChange, onFieldSelect]);

  // Memoize modifiers array
  const modifiers = useMemo(() => [restrictToParentElement], []);

  return (
    <div className={`relative ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-overlay bg-background/80 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="loading-spinner w-8 h-8" />
            <span className="text-sm text-foreground-muted">Generating PDF...</span>
          </div>
        </div>
      )}

      {/* Canvas container with aspect ratio */}
      <div
        className="relative w-full"
        style={{ aspectRatio: aspectRatio }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="application"
        aria-label="Certificate layout editor. Use arrow keys to nudge selected field."
      >
        <DndContext
          sensors={readOnly ? undefined : sensors}
          modifiers={modifiers}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          {/* Canvas surface */}
          <div
            ref={containerRef}
            className="absolute inset-0 rounded-lg overflow-hidden z-canvas"
            onClick={handleCanvasClick}
            role="application"
            aria-label="Certificate canvas - drag fields to position them"
          >
            {/* Draggable fields */}
            {isReady && fields.map((field) => (
              <DraggableField
                key={field.id}
                field={field}
                position={field.position}
                isSelected={selectedFieldId === field.id}
                onSelect={handleFieldSelect}
                canvasScale={canvasScale}
              />
            ))}

            {/* Dynamic snap guides (shown when aligned during drag) */}
            {activeField && <SnapGuides guides={activeGuides} />}
          </div>

          {/* Drag overlay - shows the dragged field above everything */}
          <DragOverlay>
            {activeField ? (
              <div
                className="px-2 py-1 bg-canvas-bg rounded shadow-lg ring-2 ring-primary opacity-90"
                style={{
                  fontFamily: getCssFontFamily(activeField.font),
                  fontSize: `${activeField.size * canvasScale}px`,
                  color: activeField.color || 'inherit',
                  fontWeight: activeField.bold ? 'bold' : 'normal',
                  fontStyle: activeField.italic ? 'italic' : 'normal',
                  transform: activeField.rotation ? `rotate(${activeField.rotation}deg)` : undefined,
                }}
              >
                {activeField.value || activeField.label || `[${activeField.type}]`}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Canvas info bar */}
      <div className="mt-2 flex justify-between text-xs text-foreground-muted">
        <span>
          {containerSize.width.toFixed(0)} × {containerSize.height.toFixed(0)} px
        </span>
        <span>{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

/**
 * Create a new canvas field with default values
 */
export function createCanvasField(
  partial: Partial<CanvasField> & { id: string; type: LayoutField['type'] }
): CanvasField {
  return {
    id: partial.id,
    type: partial.type,
    x: partial.x ?? 0.5,
    y: partial.y ?? 0.5,
    font: partial.font ?? 'Inter',
    size: partial.size ?? 16,
    position: partial.position ?? { x: 0.5, y: 0.5 },
    label: partial.label,
    value: partial.value,
    color: partial.color ?? '#000000',
    bold: partial.bold ?? false,
    italic: partial.italic ?? false,
    align: partial.align ?? 'center',
    rotation: partial.rotation ?? 0,
    width: partial.width,
    height: partial.height,
    source: partial.source,
  };
}
