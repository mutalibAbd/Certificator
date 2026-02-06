/**
 * useNormalizedCoordinates Hook
 * 
 * CRITICAL: This hook implements the coordinate normalization system described in
 * the Frontend Agent specification. Coordinates are stored as percentages (0.0 to 1.0)
 * to ensure responsiveness across different screen sizes.
 * 
 * COORDINATE SYSTEMS:
 * - Normalized: 0.0 to 1.0 (percentage of container)
 * - Pixel: Actual pixel values for rendering
 * - Browser: Top-Left Origin (0,0 at upper-left)
 * - PDF: Bottom-Left Origin (0,0 at lower-left) - handled in database.types.ts
 * 
 * This hook handles Browser <-> Normalized conversions.
 * For Browser <-> PDF conversions, use browserToPDF/pdfToBrowser from database.types.ts
 */

import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Normalized coordinate (0.0 to 1.0)
 * This is what gets stored in the database
 */
export interface NormalizedCoordinate {
  x: number; // 0.0 to 1.0 (percentage of width)
  y: number; // 0.0 to 1.0 (percentage of height)
}

/**
 * Pixel coordinate for rendering
 * This is used for display in the browser
 */
export interface PixelCoordinate {
  x: number; // Actual pixels from left
  y: number; // Actual pixels from top
}

/**
 * Container dimensions
 */
export interface ContainerSize {
  width: number;
  height: number;
}

/**
 * Return type for the useNormalizedCoordinates hook
 */
export interface UseNormalizedCoordinatesReturn {
  /** Reference to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  
  /** Current container dimensions */
  containerSize: ContainerSize;
  
  /** Convert normalized (0-1) to pixel coordinates */
  toPixels: (normalized: NormalizedCoordinate) => PixelCoordinate;
  
  /** Convert pixel to normalized (0-1) coordinates */
  toNormalized: (pixel: PixelCoordinate) => NormalizedCoordinate;
  
  /** Calculate normalized delta from pixel delta (for drag operations) */
  deltaToNormalized: (pixelDelta: PixelCoordinate) => NormalizedCoordinate;
  
  /** Clamp normalized coordinates to valid range (0-1) */
  clampNormalized: (coord: NormalizedCoordinate) => NormalizedCoordinate;
  
  /** Check if container has valid dimensions */
  isReady: boolean;
}

/**
 * Hook for converting between normalized (percentage) and pixel coordinates
 * 
 * USAGE:
 * ```tsx
 * const { containerRef, toPixels, toNormalized, isReady } = useNormalizedCoordinates();
 * 
 * // Attach ref to container
 * <div ref={containerRef}>...</div>
 * 
 * // Convert stored normalized coords to pixels for rendering
 * const pixelPos = toPixels({ x: 0.5, y: 0.5 }); // Center of container
 * 
 * // Convert drag result to normalized coords for storage
 * const normalizedPos = toNormalized({ x: 200, y: 150 });
 * ```
 * 
 * WHY NORMALIZED COORDINATES?
 * - Device independence: Same layout on any screen size
 * - Responsive design: Position adapts when container resizes
 * - PDF accuracy: Easy to convert to PDF coordinates at any resolution
 * - Future-proof: Works with any canvas size
 */
export function useNormalizedCoordinates(): UseNormalizedCoordinatesReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<ContainerSize>({
    width: 0,
    height: 0,
  });

  // Track container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };

    // Initial size
    updateSize();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * Convert normalized coordinates (0-1) to pixel coordinates
   * 
   * @example
   * toPixels({ x: 0.5, y: 0.5 }) // Returns center of container in pixels
   * toPixels({ x: 0, y: 0 })     // Returns { x: 0, y: 0 } (top-left)
   * toPixels({ x: 1, y: 1 })     // Returns bottom-right corner in pixels
   */
  const toPixels = useCallback(
    (normalized: NormalizedCoordinate): PixelCoordinate => {
      return {
        x: normalized.x * containerSize.width,
        y: normalized.y * containerSize.height,
      };
    },
    [containerSize.width, containerSize.height]
  );

  /**
   * Convert pixel coordinates to normalized coordinates (0-1)
   * 
   * IMPORTANT: This is what you call on drag end to get the storage value
   * 
   * @example
   * // On drag end:
   * const normalized = toNormalized({ x: event.clientX, y: event.clientY });
   * // Store normalized in database
   */
  const toNormalized = useCallback(
    (pixel: PixelCoordinate): NormalizedCoordinate => {
      // Prevent division by zero
      if (containerSize.width === 0 || containerSize.height === 0) {
        return { x: 0, y: 0 };
      }

      return {
        x: pixel.x / containerSize.width,
        y: pixel.y / containerSize.height,
      };
    },
    [containerSize.width, containerSize.height]
  );

  /**
   * Convert a pixel delta (movement) to normalized delta
   * Useful for updating positions during drag operations
   * 
   * @example
   * // During drag:
   * const normalizedDelta = deltaToNormalized({ x: dragEvent.delta.x, y: dragEvent.delta.y });
   * newPosition.x = oldPosition.x + normalizedDelta.x;
   * newPosition.y = oldPosition.y + normalizedDelta.y;
   */
  const deltaToNormalized = useCallback(
    (pixelDelta: PixelCoordinate): NormalizedCoordinate => {
      // Prevent division by zero
      if (containerSize.width === 0 || containerSize.height === 0) {
        return { x: 0, y: 0 };
      }

      return {
        x: pixelDelta.x / containerSize.width,
        y: pixelDelta.y / containerSize.height,
      };
    },
    [containerSize.width, containerSize.height]
  );

  /**
   * Clamp normalized coordinates to valid range (0-1)
   * Ensures elements stay within the container bounds
   * 
   * NOTE: restrictToParentElement modifier in dnd-kit handles this during drag,
   * but this is useful as a safety check when loading/saving data
   */
  const clampNormalized = useCallback(
    (coord: NormalizedCoordinate): NormalizedCoordinate => {
      return {
        x: Math.max(0, Math.min(1, coord.x)),
        y: Math.max(0, Math.min(1, coord.y)),
      };
    },
    []
  );

  // Container is ready when it has valid dimensions
  const isReady = containerSize.width > 0 && containerSize.height > 0;

  return {
    containerRef,
    containerSize,
    toPixels,
    toNormalized,
    deltaToNormalized,
    clampNormalized,
    isReady,
  };
}

/**
 * Utility: Convert normalized position to CSS style object
 * 
 * @example
 * const style = normalizedToStyle({ x: 0.5, y: 0.3 });
 * // Returns { left: '50%', top: '30%' }
 */
export function normalizedToStyle(
  normalized: NormalizedCoordinate
): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${normalized.x * 100}%`,
    top: `${normalized.y * 100}%`,
  };
}

/**
 * Utility: Validate normalized coordinates
 * Returns true if coordinates are within valid range
 */
export function isValidNormalized(coord: NormalizedCoordinate): boolean {
  return (
    coord.x >= 0 &&
    coord.x <= 1 &&
    coord.y >= 0 &&
    coord.y <= 1 &&
    !isNaN(coord.x) &&
    !isNaN(coord.y)
  );
}
