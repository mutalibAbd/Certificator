# Coordinate System — Complete Structure & Code Reference

This document details **every piece of code** responsible for positioning text on the canvas (PNG/JPEG preview) and in the generated PDF. It covers the full pipeline: from user interaction (drag/keyboard) through normalized storage to final PDF rendering.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Three Coordinate Systems](#2-three-coordinate-systems)
3. [End-to-End Flow Diagram](#3-end-to-end-flow-diagram)
4. [File Index](#4-file-index)
5. [Layer 1 — Type Definitions](#5-layer-1--type-definitions)
6. [Layer 2 — Normalized Coordinate Hook](#6-layer-2--normalized-coordinate-hook)
7. [Layer 3 — Snap Guides Hook](#7-layer-3--snap-guides-hook)
8. [Layer 4 — Canvas Components](#8-layer-4--canvas-components)
9. [Layer 5 — Canvas-to-DB Bridge](#9-layer-5--canvas-to-db-bridge)
10. [Layer 6 — PDF Coordinate Conversion & Rendering](#10-layer-6--pdf-coordinate-conversion--rendering)
11. [Layer 7 — Snap Guide Rendering](#11-layer-7--snap-guide-rendering)
12. [Font Size Scaling (Canvas vs PDF)](#12-font-size-scaling-canvas-vs-pdf)
13. [Constants Reference](#13-constants-reference)
14. [Formulas Summary](#14-formulas-summary)

---

## 1. Architecture Overview

The coordinate system has **6 layers** stacked from data storage → user interaction → PDF output:

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 6: PDF Generation (lib/pdf/generator.ts)          │
│  Converts normalized → PDF points, inverts Y axis        │
├──────────────────────────────────────────────────────────┤
│  LAYER 5: DB Bridge (components/EditorWorkspace.tsx)      │
│  LayoutField ←→ CanvasField conversion                   │
├──────────────────────────────────────────────────────────┤
│  LAYER 4: Canvas Components                              │
│  CertificateCanvas.tsx + DraggableField.tsx               │
│  Drag-and-drop, keyboard nudge, CSS percentage rendering  │
├──────────────────────────────────────────────────────────┤
│  LAYER 3: Snap Guides (hooks/useSnapGuides.ts)           │
│  Alignment detection in normalized space                  │
├──────────────────────────────────────────────────────────┤
│  LAYER 2: Coordinate Hook (hooks/useNormalizedCoords.ts) │
│  Pixel ←→ Normalized conversion, container tracking       │
├──────────────────────────────────────────────────────────┤
│  LAYER 1: Type Definitions (types/database.types.ts)     │
│  LayoutField { x, y }, BrowserCoordinate, PDFCoordinate   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Three Coordinate Systems

### 2.1 Browser / Canvas Coordinates
- **Origin**: Top-Left corner `(0, 0)`
- **X axis**: Increases rightward
- **Y axis**: Increases **downward**
- **Used by**: HTML/CSS rendering, dnd-kit drag events

### 2.2 Normalized Coordinates (0.0 – 1.0)
- **Origin**: Top-Left corner `(0, 0)` — same as browser
- **Range**: `0.0` to `1.0` (percentage of container dimensions)
- **X**: `0.0` = left edge, `0.5` = horizontal center, `1.0` = right edge
- **Y**: `0.0` = top edge, `0.5` = vertical center, `1.0` = bottom edge
- **Used by**: Database storage, all internal state, snap detection
- **Why**: Device-independent, responsive, easy PDF conversion

### 2.3 PDF Coordinates (Points)
- **Origin**: Bottom-Left corner `(0, 0)`
- **X axis**: Increases rightward (same as browser)
- **Y axis**: Increases **upward** (OPPOSITE of browser)
- **Unit**: PDF points (1 point = 1/72 inch)
- **A4 page**: 595.28 x 841.89 points
- **Used by**: pdf-lib drawText() calls

### Visual Reference

```
BROWSER / NORMALIZED                    PDF
(0,0)────────────(1,0)       (0,841.89)────────(595.28,841.89)
  │                 │              │                     │
  │    Y increases  │              │    Y increases      │
  │    DOWNWARD ↓   │              │    UPWARD ↑         │
  │                 │              │                     │
(0,1)────────────(1,1)       (0,0)──────────────(595.28,0)
```

**Critical Y-axis formula**: `Y_pdf = pageHeight - Y_browser`

---

## 3. End-to-End Flow Diagram

```
USER DRAG ON CANVAS
       │
       ▼
dnd-kit reports pixel delta { x: 47px, y: -23px }
       │
       ▼ deltaToNormalized()                    [hooks/useNormalizedCoordinates.ts]
       │
       │   normalizedDelta.x = 47 / containerWidth
       │   normalizedDelta.y = -23 / containerHeight
       │
       ▼ clampNormalized()                       [hooks/useNormalizedCoordinates.ts]
       │
       │   newPosition = {
       │     x: clamp(oldPosition.x + normalizedDelta.x, 0, 1),
       │     y: clamp(oldPosition.y + normalizedDelta.y, 0, 1),
       │   }
       │
       ▼ useSnapGuides()                         [hooks/useSnapGuides.ts]
       │
       │   if |newPosition.x - 0.5| <= 0.02 → snap x to 0.5
       │   if |newPosition.y - otherField.y| <= 0.02 → snap y
       │
       ▼ Store in CanvasField.position           [components/CertificateCanvas.tsx]
       │
       │   field.position = { x: 0.48, y: 0.32 }
       │   field.x = 0.48   (kept in sync for DB)
       │   field.y = 0.32
       │
       ▼ CSS Rendering                           [components/DraggableField.tsx]
       │
       │   left: 48%
       │   top: 32%
       │   fontSize: field.size * canvasScale   (e.g. 24 * 0.59 = 14.2px)
       │
       ▼ canvasFieldsToLayoutFields()           [components/EditorWorkspace.tsx]
       │
       │   Strips .position, keeps flat { x: 0.48, y: 0.32 }
       │
       ▼ saveLayout() → Supabase JSONB          [lib/actions/layouts.ts]
       │
       │   layouts.config = [{ id, x: 0.48, y: 0.32, font, size, ... }]
       │
       ▼ generatePDF() with coordinateMode: 'percentage'
       │                                         [lib/pdf/generator.ts]
       │
       ▼ convertCoordinates(0.48, 0.32, 595.28, 841.89, 'percentage', 24)
       │
       │   percentageToPoints:
       │     xPoints = 0.48 * 595.28 = 285.73
       │     yPoints = 841.89 - (0.32 * 841.89) = 571.69
       │   baseline adjustment:
       │     y = 571.69 - 24 = 547.69
       │
       ▼ calculateAlignedX() for text alignment
       │
       │   if align === 'center':
       │     finalX = 285.73 - (textWidth / 2)
       │   if align === 'right':
       │     finalX = 285.73 - textWidth
       │   if align === 'left':
       │     finalX = 285.73
       │
       ▼ page.drawText(text, { x: finalX, y: 547.69, ... })
```

---

## 4. File Index

| File | Layer | Role |
|------|-------|------|
| `types/database.types.ts` | 1 | LayoutField type, BrowserCoordinate, PDFCoordinate, browserToPDF(), pdfToBrowser() |
| `hooks/useNormalizedCoordinates.ts` | 2 | Pixel ↔ Normalized conversion, container size tracking via ResizeObserver |
| `hooks/useSnapGuides.ts` | 3 | Snap detection in normalized space (center + element alignment) |
| `components/CertificateCanvas.tsx` | 4 | Main canvas: drag handlers, keyboard nudge, canvasScale, snap integration |
| `components/DraggableField.tsx` | 4 | Individual field: CSS percentage positioning, font scaling, rotation transform |
| `components/SnapGuides.tsx` | 7 | Visual snap guide lines (blue dashed, percentage-positioned) |
| `components/EditorWorkspace.tsx` | 5 | CanvasField ↔ LayoutField mapping, save/load bridge |
| `lib/pdf/generator.ts` | 6 | PDF rendering: percentageToPoints(), Y-inversion, alignment, drawTextField() |
| `lib/actions/generate.ts` | 6 | Server actions calling generator with `coordinateMode: 'percentage'` |

---

## 5. Layer 1 — Type Definitions

**File: `types/database.types.ts`**

### LayoutField — The database coordinate type

```typescript
// types/database.types.ts:60-77

export interface LayoutField {
  id: string;
  x: number;           // Normalized 0-1 (percentage of page width)
  y: number;           // Normalized 0-1 (percentage of page height)
  font: string;
  size: number;        // Font size in PDF points
  type: 'text' | 'date' | 'signature' | 'image';
  label?: string;
  value?: string;
  color?: string;      // Hex color e.g. '#FF0000'
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  rotation?: number;   // Degrees 0-359
  width?: number;
  height?: number;
  source?: 'data' | 'static';
}
```

### BrowserCoordinate & PDFCoordinate — Conversion utilities

```typescript
// types/database.types.ts:218-258

export interface BrowserCoordinate {
  x: number;
  y: number;
}

export interface PDFCoordinate {
  x: number;
  y: number;
}

/**
 * Convert Browser coordinates to PDF coordinates
 * Y_pdf = pageHeight - Y_browser
 */
export function browserToPDF(
  browser: BrowserCoordinate,
  pageHeight: number
): PDFCoordinate {
  return {
    x: browser.x,
    y: pageHeight - browser.y,
  };
}

/**
 * Convert PDF coordinates to Browser coordinates
 * Y_browser = pageHeight - Y_pdf
 */
export function pdfToBrowser(
  pdf: PDFCoordinate,
  pageHeight: number
): BrowserCoordinate {
  return {
    x: pdf.x,
    y: pageHeight - pdf.y,
  };
}
```

---

## 6. Layer 2 — Normalized Coordinate Hook

**File: `hooks/useNormalizedCoordinates.ts`**

This is the core coordinate engine. It attaches to the canvas container div via a ref, tracks its pixel dimensions with `ResizeObserver`, and provides conversion functions.

### Type Definitions

```typescript
// hooks/useNormalizedCoordinates.ts:24-44

export interface NormalizedCoordinate {
  x: number; // 0.0 to 1.0 (percentage of width)
  y: number; // 0.0 to 1.0 (percentage of height)
}

export interface PixelCoordinate {
  x: number; // Actual pixels from left
  y: number; // Actual pixels from top
}

export interface ContainerSize {
  width: number;
  height: number;
}
```

### The Hook

```typescript
// hooks/useNormalizedCoordinates.ts:95-224

export function useNormalizedCoordinates(): UseNormalizedCoordinatesReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<ContainerSize>({
    width: 0,
    height: 0,
  });

  // Track container size changes via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize(); // Initial measurement

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // ---- Normalized (0-1) → Pixel ----
  const toPixels = useCallback(
    (normalized: NormalizedCoordinate): PixelCoordinate => ({
      x: normalized.x * containerSize.width,
      y: normalized.y * containerSize.height,
    }),
    [containerSize.width, containerSize.height]
  );

  // ---- Pixel → Normalized (0-1) ----
  const toNormalized = useCallback(
    (pixel: PixelCoordinate): NormalizedCoordinate => {
      if (containerSize.width === 0 || containerSize.height === 0) {
        return { x: 0, y: 0 }; // Prevent division by zero
      }
      return {
        x: pixel.x / containerSize.width,
        y: pixel.y / containerSize.height,
      };
    },
    [containerSize.width, containerSize.height]
  );

  // ---- Pixel DELTA → Normalized DELTA (for drag operations) ----
  // This is the key function used during drag-end to convert
  // the pixel movement reported by dnd-kit into a normalized offset.
  const deltaToNormalized = useCallback(
    (pixelDelta: PixelCoordinate): NormalizedCoordinate => {
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

  // ---- Clamp to 0-1 range ----
  const clampNormalized = useCallback(
    (coord: NormalizedCoordinate): NormalizedCoordinate => ({
      x: Math.max(0, Math.min(1, coord.x)),
      y: Math.max(0, Math.min(1, coord.y)),
    }),
    []
  );

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
```

### Static Utility Functions

```typescript
// hooks/useNormalizedCoordinates.ts:233-256

/**
 * Convert normalized position directly to CSS style object
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
 * Validate that coordinates are within the 0-1 range
 */
export function isValidNormalized(coord: NormalizedCoordinate): boolean {
  return (
    coord.x >= 0 && coord.x <= 1 &&
    coord.y >= 0 && coord.y <= 1 &&
    !isNaN(coord.x) && !isNaN(coord.y)
  );
}
```

---

## 7. Layer 3 — Snap Guides Hook

**File: `hooks/useSnapGuides.ts`**

Detects when a dragged element's position is near a snap target and returns corrected coordinates + active guide lines for visual feedback.

### Constants & Types

```typescript
// hooks/useSnapGuides.ts:25

const SNAP_THRESHOLD = 0.02; // 2% of container size
```

```typescript
// hooks/useSnapGuides.ts:30-65

export interface SnapGuide {
  id: string;
  direction: 'vertical' | 'horizontal';
  position: number;        // Normalized 0-1
  type: 'center' | 'element';
  isActive: boolean;
}

export interface SnapResult {
  guides: SnapGuide[];
  activeGuides: SnapGuide[];
  snappedPosition: NormalizedCoordinate;
  isSnappedVertical: boolean;
  isSnappedHorizontal: boolean;
}

export interface SnapFieldPosition {
  id: string;
  position: NormalizedCoordinate;
}
```

### The Hook — Full Logic

```typescript
// hooks/useSnapGuides.ts:97-212

export function useSnapGuides({
  currentPosition,
  draggingId,
  otherFields = [],
  threshold = SNAP_THRESHOLD,
  snapToCenter = true,
  snapToElements = true,
}: UseSnapGuidesOptions): SnapResult {
  return useMemo(() => {
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

    // --- Check CANVAS CENTER guides ---
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

    // --- Check ELEMENT ALIGNMENT guides ---
    if (snapToElements && otherFields.length > 0) {
      for (const field of otherFields) {
        if (field.id === draggingId) continue;

        // Vertical alignment (same X position as another field)
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

        // Horizontal alignment (same Y position as another field)
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
```

### Helper Functions

```typescript
// hooks/useSnapGuides.ts:217-239

export function isNearSnapPoint(
  value: number,
  snapPoint: number,
  threshold: number = SNAP_THRESHOLD
): boolean {
  return Math.abs(value - snapPoint) <= threshold;
}

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
```

---

## 8. Layer 4 — Canvas Components

### 8.1 CertificateCanvas — The Main Canvas

**File: `components/CertificateCanvas.tsx`**

The orchestrator component. Sets up dnd-kit, hooks into coordinate system, handles all position changes.

#### CanvasField Type (extends LayoutField)

```typescript
// components/CertificateCanvas.tsx:55-58

export interface CanvasField extends LayoutField {
  /** Normalized position (0-1) */
  position: NormalizedCoordinate;
}
```

#### Constants

```typescript
// components/CertificateCanvas.tsx:46-50

const NUDGE_INCREMENT = 0.01;        // Arrow key: 1% of container
const NUDGE_INCREMENT_LARGE = 0.05;  // Shift+Arrow: 5% of container
const PDF_PAGE_HEIGHT = 841.89;      // A4 height in PDF points
```

#### Coordinate System Initialization

```typescript
// components/CertificateCanvas.tsx:127-149

// Get coordinate conversion functions from the hook
const {
  containerRef,     // Attach to canvas div
  containerSize,    // Current { width, height } in pixels
  deltaToNormalized,// Convert pixel delta → normalized delta
  clampNormalized,  // Clamp to 0-1 range
  isReady,          // True when container has been measured
} = useNormalizedCoordinates();

// Font size scale factor: makes canvas font sizes match PDF proportions
// field.size is in PDF points; multiply by canvasScale to get canvas pixels
const canvasScale = containerSize.height > 0
  ? containerSize.height / PDF_PAGE_HEIGHT
  : 1;

// Snap guides integration
const { activeGuides, snappedPosition } = useSnapGuides({
  currentPosition: currentDragPosition,
  draggingId: activeField?.id ?? null,
  otherFields: fields.filter(f => f.id !== activeField?.id).map(f => ({
    id: f.id,
    position: f.position,
  })),
});
```

#### Drag Start Handler

```typescript
// components/CertificateCanvas.tsx:171-178

const handleDragStart = useCallback((event: DragStartEvent) => {
  const { active } = event;
  const field = fields.find((f) => f.id === active.id);
  if (field) {
    setActiveField(field);
    setCurrentDragPosition(field.position); // Start snap tracking
  }
}, [fields]);
```

#### Drag Move Handler (for live snap detection)

```typescript
// components/CertificateCanvas.tsx:183-195

const handleDragMove = useCallback((event: DragMoveEvent) => {
  const { active, delta } = event;
  const field = fields.find((f) => f.id === active.id);
  if (!field) return;

  // Convert pixel movement to normalized
  const normalizedDelta = deltaToNormalized({ x: delta.x, y: delta.y });
  const newPosition = clampNormalized({
    x: field.position.x + normalizedDelta.x,
    y: field.position.y + normalizedDelta.y,
  });
  setCurrentDragPosition(newPosition); // Feed to snap guides
}, [fields, deltaToNormalized, clampNormalized]);
```

#### Drag End Handler (commits position)

```typescript
// components/CertificateCanvas.tsx:205-255

const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, delta } = event;

  if (readOnly) {
    setActiveField(null);
    setCurrentDragPosition(null);
    return;
  }

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

  // Calculate raw new position (no snap)
  const rawPosition = clampNormalized({
    x: field.position.x + normalizedDelta.x,
    y: field.position.y + normalizedDelta.y,
  });

  // Use snapped position if snap was active during drag
  const newPosition = currentDragPosition ? snappedPosition : rawPosition;

  // Update fields array immutably
  const updatedFields = [...fields];
  updatedFields[fieldIndex] = {
    ...field,
    position: newPosition,
    // Keep x/y in sync for DB storage compatibility
    x: newPosition.x,
    y: newPosition.y,
  };

  onFieldsChange(updatedFields);
  setActiveField(null);
  setCurrentDragPosition(null);
}, [fields, deltaToNormalized, clampNormalized, onFieldsChange,
    readOnly, currentDragPosition, snappedPosition]);
```

#### Keyboard Nudge Handler

```typescript
// components/CertificateCanvas.tsx:280-321

const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
  if (readOnly || !selectedFieldId) return;

  const field = fields.find(f => f.id === selectedFieldId);
  if (!field) return;

  const increment = e.shiftKey ? NUDGE_INCREMENT_LARGE : NUDGE_INCREMENT;
  // Arrow = 1% (0.01), Shift+Arrow = 5% (0.05)

  let newPosition: NormalizedCoordinate | null = null;

  switch (e.key) {
    case 'ArrowLeft':
      newPosition = {
        x: clamp(field.position.x - increment),
        y: field.position.y,
      };
      break;
    case 'ArrowRight':
      newPosition = {
        x: clamp(field.position.x + increment),
        y: field.position.y,
      };
      break;
    case 'ArrowUp':
      newPosition = {
        x: field.position.x,
        y: clamp(field.position.y - increment),
      };
      break;
    case 'ArrowDown':
      newPosition = {
        x: field.position.x,
        y: clamp(field.position.y + increment),
      };
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

// Helper used above
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
```

#### DndContext Setup

```typescript
// components/CertificateCanvas.tsx:347-415

<DndContext
  sensors={readOnly ? undefined : sensors}
  modifiers={[restrictToParentElement]}  // Prevents dragging outside canvas
  onDragStart={handleDragStart}
  onDragMove={handleDragMove}
  onDragEnd={handleDragEnd}
>
  {/* Canvas surface — containerRef attached here */}
  <div ref={containerRef} className="absolute inset-0 ...">

    {/* Draggable fields rendered with positions */}
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

    {/* Snap guide lines */}
    {activeField && <SnapGuides guides={activeGuides} />}
  </div>

  {/* Drag overlay (ghost element shown while dragging) */}
  <DragOverlay>
    {activeField ? (
      <div style={{
        fontFamily: getCssFontFamily(activeField.font),
        fontSize: `${activeField.size * canvasScale}px`,
        color: activeField.color || 'inherit',
        fontWeight: activeField.bold ? 'bold' : 'normal',
        fontStyle: activeField.italic ? 'italic' : 'normal',
        transform: activeField.rotation
          ? `rotate(${activeField.rotation}deg)`
          : undefined,
      }}>
        {activeField.value || activeField.label || `[${activeField.type}]`}
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
```

#### createCanvasField — Default Field Factory

```typescript
// components/CertificateCanvas.tsx:432-454

export function createCanvasField(
  partial: Partial<CanvasField> & { id: string; type: LayoutField['type'] }
): CanvasField {
  return {
    id: partial.id,
    type: partial.type,
    x: partial.x ?? 0.5,            // Default: horizontal center
    y: partial.y ?? 0.5,            // Default: vertical center
    font: partial.font ?? 'Inter',
    size: partial.size ?? 16,       // 16 PDF points
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
```

---

### 8.2 DraggableField — Individual Field Rendering

**File: `components/DraggableField.tsx`**

Each text field on the canvas. Handles CSS positioning, font scaling, rotation, and drag state.

#### CSS Position Calculation (the key part)

```typescript
// components/DraggableField.tsx:76-124

export function DraggableField({
  field,
  position,       // NormalizedCoordinate { x: 0-1, y: 0-1 }
  canvasScale = 1, // containerHeight / 841.89
  ...
}: DraggableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,    // Drag translation from dnd-kit
    isDragging,
  } = useDraggable({ id: field.id, data: { field, position } });

  // Combine dnd-kit drag translation with field rotation
  const dragTranslate = CSS.Translate.toString(transform);
  const rotationDeg = field.rotation || 0;
  const combinedTransform = [
    dragTranslate,
    rotationDeg ? `rotate(${rotationDeg}deg)` : '',
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = {
    // ========== POSITION (normalized → CSS percentage) ==========
    position: 'absolute',
    left: `${position.x * 100}%`,   // 0.48 → "48%"
    top: `${position.y * 100}%`,    // 0.32 → "32%"

    // ========== DRAG + ROTATION TRANSFORM ==========
    transform: combinedTransform || undefined,

    // ========== CURSOR ==========
    cursor: isDragging ? 'grabbing' : 'grab',

    // ========== TOUCH TARGET (WCAG: minimum 44px) ==========
    minWidth: '44px',
    minHeight: '44px',

    // ========== Z-INDEX ==========
    zIndex: isDragging ? 'var(--z-field-active)' : 'var(--z-fields)',

    // ========== TYPOGRAPHY (scaled to match PDF proportions) ==========
    fontFamily: getCssFontFamily(field.font),
    fontSize: `${field.size * canvasScale}px`,  // PDF points × scale
    color: field.color || 'inherit',
    fontWeight: field.bold ? 'bold' : 'normal',
    fontStyle: field.italic ? 'italic' : 'normal',
    textAlign: field.align || 'left',

    // ========== MISC ==========
    userSelect: 'none',
    transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
  };

  // ... render with ref, style, listeners, attributes
}
```

---

## 9. Layer 5 — Canvas-to-DB Bridge

**File: `components/EditorWorkspace.tsx`**

Handles the conversion between `LayoutField` (flat x/y, stored in DB) and `CanvasField` (has `.position` object, used in canvas).

### LayoutField → CanvasField (on page load)

```typescript
// components/EditorWorkspace.tsx:53-60

function layoutFieldsToCanvasFields(fields: LayoutField[]): CanvasField[] {
  return fields.map((f) =>
    createCanvasField({
      ...f,
      position: { x: f.x, y: f.y },  // Derive position from flat x/y
    }),
  );
}
```

### CanvasField → LayoutField (on save)

```typescript
// components/EditorWorkspace.tsx:66-72

function canvasFieldsToLayoutFields(fields: CanvasField[]): LayoutField[] {
  return fields.map(({ position, ...rest }) => ({
    ...rest,
    x: position.x,  // Flatten position back to x/y
    y: position.y,
  }));
}
```

### Auto-positioning imported data fields

```typescript
// components/EditorWorkspace.tsx:229-245

// When importing CSV/XLSX data, new fields are stacked vertically:
filteredData.headers.forEach((header, index) => {
  const exists = fields.some(f => f.label?.toLowerCase() === header.toLowerCase());
  if (!exists) {
    newFields.push(createCanvasField({
      id: crypto.randomUUID(),
      label: header,
      type: 'text',
      value: filteredData.rows[0]?.[index] || header,
      font: 'Helvetica',
      size: 16,
      color: '#000000',
      align: 'center',
      position: {
        x: 0.5,                    // Horizontally centered
        y: 0.15 + index * 0.1,    // Stack vertically: 15%, 25%, 35%, ...
      },
      source: 'data',
    }));
  }
});
```

---

## 10. Layer 6 — PDF Coordinate Conversion & Rendering

**File: `lib/pdf/generator.ts`**

This is the server-side PDF generation engine. It reads normalized coordinates from the layout and converts them to PDF points with Y-axis inversion.

### Page Size Constants

```typescript
// lib/pdf/generator.ts:20-22

const A4_WIDTH = 595.28;   // A4 width in PDF points (210mm)
const A4_HEIGHT = 841.89;  // A4 height in PDF points (297mm)
// 1 PDF point = 1/72 inch
```

### Coordinate Mode Type

```typescript
// lib/pdf/generator.ts:38-39

export type CoordinateMode = 'pixels' | 'percentage';
// 'percentage' is what the canvas uses (0-1 normalized)
```

### PercentageCoordinate & PDFPointCoordinate Types

```typescript
// lib/pdf/generator.ts:185-197

export interface PercentageCoordinate {
  xPct: number; // 0-1 range
  yPct: number; // 0-1 range (0 = top, 1 = bottom)
}

export interface PDFPointCoordinate {
  xPoints: number;
  yPoints: number; // PDF origin: 0 = bottom
}
```

### percentageToPoints — THE CRITICAL CONVERSION

```typescript
// lib/pdf/generator.ts:225-238

/**
 * Convert percentage (0-1) to PDF points.
 *
 * FORMULAS:
 *   xPoints = xPct * pdfWidth
 *   yPoints = pdfHeight - (yPct * pdfHeight)   ← Y-AXIS INVERSION
 *
 * Input:  (0,0) = top-left,  Y increases downward  (browser)
 * Output: (0,0) = bottom-left, Y increases upward  (PDF)
 */
export function percentageToPoints(
  coord: PercentageCoordinate,
  pdfWidth: number,
  pdfHeight: number
): PDFPointCoordinate {
  const xPct = Math.max(0, Math.min(1, coord.xPct));
  const yPct = Math.max(0, Math.min(1, coord.yPct));

  return {
    xPoints: xPct * pdfWidth,
    yPoints: pdfHeight - (yPct * pdfHeight),
  };
}
```

**Example calculations**:
| Input (normalized) | A4 Page (595.28 x 841.89) | Output (PDF points) |
|---|---|---|
| `(0, 0)` top-left | | `(0, 841.89)` top-left in PDF |
| `(0.5, 0.5)` center | | `(297.64, 420.95)` center |
| `(1, 1)` bottom-right | | `(595.28, 0)` bottom-right in PDF |
| `(0.48, 0.32)` | | `(285.73, 572.51)` |

### pointsToPercentage — Inverse Conversion

```typescript
// lib/pdf/generator.ts:249-258

export function pointsToPercentage(
  points: PDFPointCoordinate,
  pdfWidth: number,
  pdfHeight: number
): PercentageCoordinate {
  return {
    xPct: points.xPoints / pdfWidth,
    yPct: (pdfHeight - points.yPoints) / pdfHeight,
  };
}
```

### browserYToPdfY — Legacy Pixel Mode

```typescript
// lib/pdf/generator.ts:272-276

function browserYToPdfY(
  browserY: number,
  pageHeight: number,
  fontSize: number = 0
): number {
  // Y_pdf = PageHeight - Y_browser - fontSize (baseline adjustment)
  return pageHeight - browserY - fontSize;
}
```

### convertCoordinates — Mode Dispatcher

```typescript
// lib/pdf/generator.ts:289-312

function convertCoordinates(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number,
  mode: CoordinateMode,
  fontSize: number = 0
): { x: number; y: number } {
  if (mode === 'percentage') {
    // Percentage mode: x and y are 0-1 values
    const points = percentageToPoints(
      { xPct: x, yPct: y },
      pageWidth,
      pageHeight
    );
    // Subtract fontSize for text baseline positioning
    // (text is drawn from its baseline upward)
    return {
      x: points.xPoints,
      y: points.yPoints - fontSize,
    };
  }

  // Pixel mode: direct conversion (legacy)
  return {
    x: x,
    y: browserYToPdfY(y, pageHeight, fontSize),
  };
}
```

### calculateAlignedX — Text Alignment

```typescript
// lib/pdf/generator.ts:323-340

function calculateAlignedX(
  x: number,
  textWidth: number,
  align: 'left' | 'center' | 'right' = 'left',
  fieldWidth?: number
): number {
  switch (align) {
    case 'center':
      return x - (textWidth / 2);     // Shift left by half text width
    case 'right':
      return fieldWidth
        ? x + fieldWidth - textWidth   // Right-align within field box
        : x - textWidth;              // Right-align at anchor point
    case 'left':
    default:
      return x;                        // No adjustment
  }
}
```

### drawTextField — Full Rendering Pipeline

```typescript
// lib/pdf/generator.ts:637-706

async function drawTextField(
  page: PDFPage,
  field: LayoutField,
  text: string,
  fontMap: Map<string, PDFFont>,
  pdfDoc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  coordinateMode: CoordinateMode = 'pixels',
  debug?: DebugOptions
): Promise<void> {
  // 1. Get font
  let font = fontMap.get(field.font);
  if (!font) {
    font = await loadFont(pdfDoc, field.font, {
      bold: field.bold,
      italic: field.italic,
    });
    fontMap.set(field.font, font);
  }

  const fontSize = field.size || 12;

  // 2. Calculate text width (needed for alignment)
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  // 3. Convert coordinates (normalized → PDF points)
  const converted = convertCoordinates(
    field.x,           // Normalized x (0-1)
    field.y,           // Normalized y (0-1)
    pageWidth,         // 595.28 for A4
    pageHeight,        // 841.89 for A4
    coordinateMode,    // 'percentage'
    fontSize           // For baseline adjustment
  );

  // 4. Apply text alignment
  let finalX = converted.x;
  if (field.align === 'center') {
    finalX = converted.x - (textWidth / 2);
  } else if (field.align === 'right') {
    finalX = field.width
      ? converted.x + field.width - textWidth
      : converted.x - textWidth;
  }

  const finalY = converted.y;

  // 5. Parse color
  const color = field.color
    ? hexToRgb(field.color)
    : { r: 0, g: 0, b: 0 };

  // 6. Debug bounding box (optional)
  if (debug?.enabled) {
    drawDebugBoundingBox(page, finalX, finalY, textWidth, fontSize, debug);
  }

  // 7. DRAW THE TEXT on the PDF page
  page.drawText(text, {
    x: finalX,
    y: finalY,
    size: fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
    rotate: field.rotation ? degrees(field.rotation) : undefined,
  });
}
```

### Server Actions — How Generation is Called

```typescript
// lib/actions/generate.ts:88-95 (single certificate)

const result = await generatePDF(
  {
    layout: layout.config,        // LayoutField[] from DB
    userData: data,                // Record<string, string>
    coordinateMode: 'percentage', // Always percentage mode
  },
  'base64',
);

// lib/actions/generate.ts:176-183 (batch certificates)

const result = await generateMergedBatchPDF(
  layout.config,
  dataRows,
  'base64',
  {
    coordinateMode: 'percentage', // Always percentage mode
  },
);
```

---

## 11. Layer 7 — Snap Guide Rendering

**File: `components/SnapGuides.tsx`**

Visual feedback during drag operations. Renders blue dashed lines at snap positions.

```typescript
// components/SnapGuides.tsx:53-87

function SnapGuideLine({ guide }: { guide: SnapGuide }) {
  const baseClasses = 'snap-line absolute pointer-events-none z-snap-lines transition-opacity duration-150';
  const isCenterGuide = guide.type === 'center';
  const opacity = guide.isActive
    ? (isCenterGuide ? 'opacity-100' : 'opacity-75')
    : 'opacity-0';

  if (guide.direction === 'vertical') {
    // Vertical line: positioned by LEFT percentage
    return (
      <div
        className={`${baseClasses} ${opacity} top-0 bottom-0 w-px border-l-2`}
        style={{
          left: `${guide.position * 100}%`,  // Normalized → CSS %
          borderColor: isCenterGuide
            ? 'var(--color-snap-guide)'
            : 'var(--color-snap-guide-element, var(--color-snap-guide))',
        }}
      />
    );
  }

  // Horizontal line: positioned by TOP percentage
  return (
    <div
      className={`${baseClasses} ${opacity} left-0 right-0 h-px border-t-2`}
      style={{
        top: `${guide.position * 100}%`,  // Normalized → CSS %
        borderColor: isCenterGuide
          ? 'var(--color-snap-guide)'
          : 'var(--color-snap-guide-element, var(--color-snap-guide))',
      }}
    />
  );
}
```

---

## 12. Font Size Scaling (Canvas vs PDF)

A field's `size` property is stored in **PDF points** (e.g., `24` means 24pt in the final PDF). The canvas is much smaller than an A4 page (841.89pt tall), so we must scale the font size proportionally.

### The Scale Factor

```
canvasScale = containerHeight / 841.89
```

| Container Height | Scale Factor | 24pt field renders as |
|:---:|:---:|:---:|
| 500px | 0.594 | 14.3px |
| 700px | 0.831 | 19.9px |
| 841.89px (1:1) | 1.000 | 24.0px |

### Where It's Applied

1. **DraggableField** (canvas preview):
   ```typescript
   fontSize: `${field.size * canvasScale}px`
   ```

2. **DragOverlay** (ghost element during drag):
   ```typescript
   fontSize: `${activeField.size * canvasScale}px`
   ```

3. **PDF Generator** (final output) — uses `field.size` directly as PDF points:
   ```typescript
   const fontSize = field.size || 12;
   page.drawText(text, { size: fontSize, ... });
   ```

---

## 13. Constants Reference

| Constant | Value | File | Purpose |
|---|---|---|---|
| `A4_WIDTH` | `595.28` | `lib/pdf/generator.ts` | PDF page width in points (210mm) |
| `A4_HEIGHT` | `841.89` | `lib/pdf/generator.ts` | PDF page height in points (297mm) |
| `PDF_PAGE_HEIGHT` | `841.89` | `components/CertificateCanvas.tsx` | Same value, used for canvasScale |
| `NUDGE_INCREMENT` | `0.01` | `components/CertificateCanvas.tsx` | Arrow key nudge: 1% |
| `NUDGE_INCREMENT_LARGE` | `0.05` | `components/CertificateCanvas.tsx` | Shift+Arrow nudge: 5% |
| `SNAP_THRESHOLD` | `0.02` | `hooks/useSnapGuides.ts` | Snap detection distance: 2% |

---

## 14. Formulas Summary

### Pixel → Normalized
```
normalized.x = pixel.x / containerWidth
normalized.y = pixel.y / containerHeight
```

### Normalized → CSS Percentage
```
left = normalized.x * 100 + "%"
top  = normalized.y * 100 + "%"
```

### Normalized → PDF Points (with Y-inversion)
```
xPoints = xNormalized * pageWidth
yPoints = pageHeight - (yNormalized * pageHeight)
```

### PDF Points → Normalized (inverse)
```
xNormalized = xPoints / pageWidth
yNormalized = (pageHeight - yPoints) / pageHeight
```

### Text Baseline Adjustment
```
finalY = yPoints - fontSize
```
(PDF draws text from baseline upward, so we offset down by font size)

### Text Alignment X Adjustment
```
if align === 'center':  finalX = xPoints - (textWidth / 2)
if align === 'right':   finalX = xPoints - textWidth
if align === 'left':    finalX = xPoints
```

### Canvas Font Scale
```
canvasScale = containerHeight / 841.89
canvasFontSize = field.size * canvasScale
```

### Browser ↔ PDF Y Conversion
```
Y_pdf     = pageHeight - Y_browser
Y_browser = pageHeight - Y_pdf
```

### Snap Detection
```
isSnapped = |currentPosition - snapTarget| <= 0.02
```
