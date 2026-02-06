/**
 * useSnapGuides Hook
 * 
 * Detects when dragged elements are near snap points and returns
 * active guide lines to display.
 * 
 * SNAP TARGETS:
 * - Vertical center (x = 0.5)
 * - Horizontal center (y = 0.5)
 * - Other field positions (alignment between elements)
 * 
 * COORDINATE SYSTEM:
 * - All values are normalized (0.0 to 1.0)
 */

'use client';

import { useMemo } from 'react';
import type { NormalizedCoordinate } from './useNormalizedCoordinates';

/**
 * Snap threshold - how close (in normalized units) to trigger snap
 * 0.02 = 2% of container size
 */
const SNAP_THRESHOLD = 0.02;

/**
 * Represents a single snap guide line
 */
export interface SnapGuide {
  /** Unique identifier for the guide */
  id: string;
  /** Direction of the guide line */
  direction: 'vertical' | 'horizontal';
  /** Position (0-1) - x for vertical lines, y for horizontal lines */
  position: number;
  /** Type of snap target */
  type: 'center' | 'element';
  /** Whether this guide is currently active (element is snapped) */
  isActive: boolean;
}

/**
 * Result of snap detection
 */
export interface SnapResult {
  /** All available guide lines */
  guides: SnapGuide[];
  /** Only the active (snapped) guides */
  activeGuides: SnapGuide[];
  /** Snapped position (if within threshold) */
  snappedPosition: NormalizedCoordinate;
  /** Whether snapping to vertical center */
  isSnappedVertical: boolean;
  /** Whether snapping to horizontal center */
  isSnappedHorizontal: boolean;
}

/**
 * Field position for snap detection
 */
export interface SnapFieldPosition {
  id: string;
  position: NormalizedCoordinate;
}

/**
 * Options for the useSnapGuides hook
 */
export interface UseSnapGuidesOptions {
  /** Current position of the dragging element */
  currentPosition: NormalizedCoordinate | null;
  /** ID of the currently dragging element (to exclude from snap targets) */
  draggingId: string | null;
  /** Positions of other fields to snap to */
  otherFields?: SnapFieldPosition[];
  /** Snap threshold (default: 0.02 = 2%) */
  threshold?: number;
  /** Enable snapping to canvas center */
  snapToCenter?: boolean;
  /** Enable snapping to other elements */
  snapToElements?: boolean;
}

/**
 * Hook to detect and manage snap guides for drag-and-drop positioning
 * 
 * @example
 * ```tsx
 * const { activeGuides, snappedPosition } = useSnapGuides({
 *   currentPosition: dragPosition,
 *   draggingId: activeField?.id,
 *   otherFields: fields.filter(f => f.id !== activeField?.id),
 * });
 * ```
 */
export function useSnapGuides({
  currentPosition,
  draggingId,
  otherFields = [],
  threshold = SNAP_THRESHOLD,
  snapToCenter = true,
  snapToElements = true,
}: UseSnapGuidesOptions): SnapResult {
  return useMemo(() => {
    // Default result when not dragging
    if (!currentPosition || !draggingId) {
      return {
        guides: [],
        activeGuides: [],
        snappedPosition: currentPosition ?? { x: 0, y: 0 },
        isSnappedVertical: false,
        isSnappedHorizontal: false,
      };
    }

    const guides: SnapGuide[] = [];
    let snappedX = currentPosition.x;
    let snappedY = currentPosition.y;
    let isSnappedVertical = false;
    let isSnappedHorizontal = false;

    // Check center guides
    if (snapToCenter) {
      // Vertical center line (x = 0.5)
      const distToVerticalCenter = Math.abs(currentPosition.x - 0.5);
      const isNearVerticalCenter = distToVerticalCenter <= threshold;
      
      guides.push({
        id: 'center-vertical',
        direction: 'vertical',
        position: 0.5,
        type: 'center',
        isActive: isNearVerticalCenter,
      });

      if (isNearVerticalCenter) {
        snappedX = 0.5;
        isSnappedVertical = true;
      }

      // Horizontal center line (y = 0.5)
      const distToHorizontalCenter = Math.abs(currentPosition.y - 0.5);
      const isNearHorizontalCenter = distToHorizontalCenter <= threshold;

      guides.push({
        id: 'center-horizontal',
        direction: 'horizontal',
        position: 0.5,
        type: 'center',
        isActive: isNearHorizontalCenter,
      });

      if (isNearHorizontalCenter) {
        snappedY = 0.5;
        isSnappedHorizontal = true;
      }
    }

    // Check alignment with other elements
    if (snapToElements && otherFields.length > 0) {
      for (const field of otherFields) {
        if (field.id === draggingId) continue;

        // Vertical alignment (same x position)
        const distX = Math.abs(currentPosition.x - field.position.x);
        const isAlignedX = distX <= threshold;

        guides.push({
          id: `element-vertical-${field.id}`,
          direction: 'vertical',
          position: field.position.x,
          type: 'element',
          isActive: isAlignedX,
        });

        if (isAlignedX && !isSnappedVertical) {
          snappedX = field.position.x;
          isSnappedVertical = true;
        }

        // Horizontal alignment (same y position)
        const distY = Math.abs(currentPosition.y - field.position.y);
        const isAlignedY = distY <= threshold;

        guides.push({
          id: `element-horizontal-${field.id}`,
          direction: 'horizontal',
          position: field.position.y,
          type: 'element',
          isActive: isAlignedY,
        });

        if (isAlignedY && !isSnappedHorizontal) {
          snappedY = field.position.y;
          isSnappedHorizontal = true;
        }
      }
    }

    // Filter to only active guides
    const activeGuides = guides.filter((g) => g.isActive);

    return {
      guides,
      activeGuides,
      snappedPosition: { x: snappedX, y: snappedY },
      isSnappedVertical,
      isSnappedHorizontal,
    };
  }, [currentPosition, draggingId, otherFields, threshold, snapToCenter, snapToElements]);
}

/**
 * Helper to check if a position is near a snap point
 */
export function isNearSnapPoint(
  value: number,
  snapPoint: number,
  threshold: number = SNAP_THRESHOLD
): boolean {
  return Math.abs(value - snapPoint) <= threshold;
}

/**
 * Snap a value to the nearest snap point if within threshold
 */
export function snapToPoint(
  value: number,
  snapPoints: number[],
  threshold: number = SNAP_THRESHOLD
): number {
  for (const point of snapPoints) {
    if (isNearSnapPoint(value, point, threshold)) {
      return point;
    }
  }
  return value;
}
