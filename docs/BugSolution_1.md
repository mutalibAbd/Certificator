🐛 Certificate Coordinate Bug Analysis & Solutions
Executive Summary
Your certificate coordinate bug is a classic WYSIWYG (What You See Is What You Get) mismatch between the canvas preview and PDF output. The text positions appear in completely different locations because of inconsistent Y-axis handling during the PDF conversion.
Root Cause: The Y-axis inversion formula in your PDF generator has a subtle but critical bug in how it interacts with text baseline positioning and potentially the container size measurements.
________________________________________
The Problem: What's Actually Happening
Canvas Preview (Image 1)
•	Text placed at position (x: 0.48, y: 0.32) appears correctly
•	You see it exactly where you dragged it
•	This uses normalized coordinates (0-1 range)
PDF Output (Image 2)
•	Same text appears at a completely different vertical position
•	Text is significantly shifted upward or downward
•	This indicates the Y-axis conversion failed
Why this happens:
1.	Canvas uses top-origin coordinates (Y=0 at top, increases downward)
2.	PDF uses bottom-origin coordinates (Y=0 at bottom, increases upward)
3.	Your code correctly inverts the axis: yPoints = pageHeight - (yNormalized * pageHeight)
4.	BUT there's likely a mismatch in how the container size is measured vs. how PDF is rendered
________________________________________
Root Cause Analysis
Hypothesis 1: Container Size Measurement Error ❌ LIKELY
The most common cause of this exact bug:
// In CertificateCanvas.tsx - ResizeObserver measurement
const { containerSize } = useNormalizedCoordinates();
// containerSize.height is in PIXELS
// But you use it for NORMALIZED calculations (0-1 range)

// Then in PDF generator:
// yPoints = 841.89 - (0.32 * 841.89)  ← Uses PDF page height directly
The Problem: If containerHeight is measured incorrectly (e.g., parent container size instead of actual canvas size), the normalized coordinate is wrong from the start.
Example:
Canvas: 500px tall
- User drags to pixel Y: 160px
- Normalized Y: 160 / 500 = 0.32  ✓ Correct

PDF Generation:
- Input normalized Y: 0.32
- yPoints = 841.89 - (0.32 * 841.89) = 572.51  ✓ Should work

BUT if containerHeight was measured as 800px instead of 500px:
- Normalized Y: 160 / 800 = 0.20  ✗ WRONG!
- yPoints = 841.89 - (0.20 * 841.89) = 673.51  ✗ Different position!
________________________________________
Hypothesis 2: Baseline/Font Size Offset Bug ⚠️ POSSIBLE
In drawTextField(), you subtract fontSize for baseline adjustment:
// This is CORRECT for PDF text positioning
// PDF draws from baseline, we want top-left of text box
const converted = convertCoordinates(..., fontSize);
return {
  x: converted.x,
  y: converted.y - fontSize,  // ← Baseline adjustment
};
Potential Issue: If fontSize is being applied twice or incorrectly:
// In convertCoordinates()
return {
  x: points.xPoints,
  y: points.yPoints - fontSize,  // ← First time
};

// In drawTextField()
return {
  y: converted.y - fontSize,     // ← Second time? BUG!
};
________________________________________
Hypothesis 3: Scale Factor Mismatch 🚨 VERY LIKELY
Your canvas scales font sizes to match PDF proportions:
canvasScale = containerHeight / 841.89  // e.g., 500 / 841.89 ≈ 0.594
fontSize = `${field.size * canvasScale}px`  // 24 * 0.594 = 14.3px
But if the container size changes (responsive design), the scale factor becomes inconsistent:
•	At load: containerHeight = 600px → canvasScale = 0.713
•	After window resize: containerHeight = 800px → canvasScale = 0.950
•	Old coordinates stored: 0.32 (based on 600px)
•	New position rendered: 0.32 (displayed with 800px reference)
•	Result: Text jumps to wrong position!
________________________________________
Diagnostic Tests
Before implementing fixes, run these tests to identify the exact problem:
Test 1: Verify Container Size Measurement
Add this to CertificateCanvas.tsx:
const { containerRef, containerSize, isReady } = useNormalizedCoordinates();

useEffect(() => {
  console.log('✓ Container Size:', containerSize);
  console.log('✓ Canvas Scale:', containerSize.height / 841.89);
  console.log('✓ Is Ready:', isReady);
  
  if (containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    console.log('✓ Direct getBoundingClientRect:', {
      width: rect.width,
      height: rect.height,
    });
  }
}, [containerSize, isReady]);
Check: Do both measurements match? If not, ResizeObserver is tracking the wrong element.
________________________________________
Test 2: Verify Normalized Coordinates Are Consistent
When you place text and save:
const field = {
  x: 0.48,
  y: 0.32,
  size: 24,
  // ...
};

console.log('📋 Canvas Field:', field);
console.log('📋 Canvas Height:', containerSize.height);
console.log('📋 Canvas Scale:', containerSize.height / 841.89);

// Immediately before generating PDF:
console.log('📋 Saved Field:', layoutField);
console.log('📋 Page Size:', { width: 595.28, height: 841.89 });
Check: Does the field's x, y values match what you see on canvas?
________________________________________
Test 3: Trace PDF Coordinate Conversion
Add logging to drawTextField():
async function drawTextField(
  page,
  field,
  text,
  // ...
) {
  const fontSize = field.size || 12;
  
  console.log('🔷 Field Input:', {
    x: field.x,
    y: field.y,
    size: field.size,
  });
  
  const converted = convertCoordinates(
    field.x, field.y, 595.28, 841.89, 'percentage', fontSize
  );
  
  console.log('🔷 Converted to PDF Points:', converted);
  
  // Text alignment
  let finalX = converted.x;
  if (field.align === 'center') {
    finalX = converted.x - (textWidth / 2);
  }
  
  console.log('🔷 Final Position:', { x: finalX, y: converted.y });
  console.log('🔷 Draw Position:', {
    x: finalX,
    y: converted.y,
    fontSize,
  });
  
  page.drawText(text, {
    x: finalX,
    y: converted.y,
    size: fontSize,
    // ...
  });
}
Check: Compare the calculated PDF points with where text actually appears in the PDF.
________________________________________
Solution 1: Fix Container Size Measurement (RECOMMENDED)
The Issue
ResizeObserver might be tracking the wrong element. Verify it's measuring the actual canvas div, not a parent wrapper.
The Fix
File: hooks/useNormalizedCoordinates.ts
export function useNormalizedCoordinates(): UseNormalizedCoordinatesReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<ContainerSize>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Option 1: Use ResizeObserver (current approach)
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      // ADD VALIDATION
      if (rect.width === 0 || rect.height === 0) {
        console.warn('⚠️ Container has zero dimensions! Check CSS.');
        return;
      }
      
      // Log for debugging
      console.log('📏 Container Size Updated:', {
        width: rect.width,
        height: rect.height,
        timestamp: new Date().toISOString(),
      });
      
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };

    // Initial measurement (critical: do this AFTER DOM is fully painted)
    const initialTimer = setTimeout(updateSize, 50);

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    
    resizeObserver.observe(container);
    
    return () => {
      clearTimeout(initialTimer);
      resizeObserver.disconnect();
    };
  }, []);

  // Rest of hook...
}
Verify the Fix
1.	Open DevTools Console
2.	Look for the "📏 Container Size Updated" logs
3.	Check that height matches the visual canvas height
4.	If it's always 0 or wrong, check CSS:
/* Make sure your canvas container has explicit dimensions */
.certificate-canvas {
  width: 100%;
  height: 600px;  /* ← Must be explicit, not 'auto' */
  display: block;
}
________________________________________
Solution 2: Decouple Canvas Display Scale from Coordinate System
The Issue
The canvas visually scales fonts (canvasScale) but this shouldn't affect coordinate calculations.
The Fix
File: components/CertificateCanvas.tsx
// BEFORE: canvasScale affected everything
const canvasScale = containerSize.height > 0
  ? containerSize.height / 841.89
  : 1;

// AFTER: Separate visual scale from coordinate space
const REFERENCE_PAGE_HEIGHT = 841.89;  // PDF page height
const canvasVisualScale = containerSize.height > 0
  ? containerSize.height / REFERENCE_PAGE_HEIGHT
  : 1;  // Only for CSS rendering, not coordinates

// Coordinates always stay 0-1 normalized
const toPixelCoordinate = (normalized) => ({
  x: normalized.x * containerSize.width,
  y: normalized.y * containerSize.height,
});

const toNormalizedCoordinate = (pixel) => ({
  x: pixel.x / containerSize.width,
  y: pixel.y / containerSize.height,
});
Update DraggableField
<DraggableField
  field={field}
  position={field.position}  // Always 0-1 normalized
  canvasScale={canvasVisualScale}  // Only for font sizing
/>
________________________________________
Solution 3: Fix Y-Axis Inversion (Most Critical)
The Correct Formula
File: lib/pdf/generator.ts
Ensure your Y-inversion formula is absolutely correct:
/**
 * CRITICAL: Normalize to PDF conversion with proper Y-axis inversion
 * 
 * Canvas/Normalized: Y=0 at TOP, increases DOWNWARD
 * PDF: Y=0 at BOTTOM, increases UPWARD
 * 
 * Formula: yPoints = pageHeight - (yNormalized * pageHeight)
 * 
 * Examples (A4: 841.89 height):
 * - yNormalized=0.0 (top)      → yPoints=841.89 (top in PDF)
 * - yNormalized=0.5 (center)   → yPoints=420.945 (center)
 * - yNormalized=1.0 (bottom)   → yPoints=0 (bottom in PDF)
 */
export function percentageToPoints(
  coord: PercentageCoordinate,
  pdfWidth: number,
  pdfHeight: number
): PDFPointCoordinate {
  // Clamp to 0-1 range (defensive programming)
  const xPct = Math.max(0, Math.min(1, coord.xPct));
  const yPct = Math.max(0, Math.min(1, coord.yPct));

  const xPoints = xPct * pdfWidth;
  
  // ✓ CORRECT Y-axis inversion
  const yPoints = pdfHeight - (yPct * pdfHeight);

  return { xPoints, yPoints };
}
Verify No Double-Inversion
Check that you're NOT inverting Y twice:
// ❌ WRONG: Inverting twice
function convertCoordinates(x, y, pageWidth, pageHeight, mode, fontSize) {
  if (mode === 'percentage') {
    const points = percentageToPoints(
      { xPct: x, yPct: y },
      pageWidth,
      pageHeight
    );  // ← Already inverted here
    
    return {
      x: points.xPoints,
      y: points.yPoints - fontSize,  // ← OK for baseline
      // But NOT: y: pageHeight - (y * pageHeight) again!
    };
  }
}

// ✓ CORRECT: Invert once in percentageToPoints
function convertCoordinates(x, y, pageWidth, pageHeight, mode, fontSize) {
  if (mode === 'percentage') {
    const points = percentageToPoints(
      { xPct: x, yPct: y },
      pageWidth,
      pageHeight
    );  // ← Only inversion here
    
    return {
      x: points.xPoints,
      y: points.yPoints - fontSize,  // ← Only baseline adjustment
    };
  }
}
________________________________________
Solution 4: Add Coordinate Validation & Debug Mode
Add to lib/pdf/generator.ts
export interface DebugOptions {
  enabled: boolean;
  logCoordinates?: boolean;
  drawBoundingBoxes?: boolean;
  showGridLines?: boolean;
}

async function drawTextField(
  page: PDFPage,
  field: LayoutField,
  text: string,
  fontMap: Map<string, PDFFont>,
  pdfDoc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  coordinateMode: CoordinateMode = 'percentage',
  debug?: DebugOptions
): Promise<void> {
  const fontSize = field.size || 12;

  if (debug?.logCoordinates) {
    console.log(`\n📍 Field: ${field.label || field.id}`);
    console.log(`  Input (Normalized): x=${field.x.toFixed(3)}, y=${field.y.toFixed(3)}`);
  }

  // Get font & calculate text width
  let font = fontMap.get(field.font);
  if (!font) {
    font = await loadFont(pdfDoc, field.font, {
      bold: field.bold,
      italic: field.italic,
    });
    fontMap.set(field.font, font);
  }

  const textWidth = font.widthOfTextAtSize(text, fontSize);

  // Convert coordinates
  const converted = convertCoordinates(
    field.x,
    field.y,
    pageWidth,
    pageHeight,
    coordinateMode,
    fontSize
  );

  if (debug?.logCoordinates) {
    console.log(`  Converted (PDF Points):`);
    console.log(`    Before alignment: x=${converted.x.toFixed(2)}, y=${converted.y.toFixed(2)}`);
    console.log(`    Page: ${pageWidth.toFixed(2)} × ${pageHeight.toFixed(2)}`);
  }

  // Apply text alignment
  let finalX = converted.x;
  if (field.align === 'center') {
    finalX = converted.x - (textWidth / 2);
  } else if (field.align === 'right') {
    finalX = field.width
      ? converted.x + field.width - textWidth
      : converted.x - textWidth;
  }

  if (debug?.logCoordinates) {
    console.log(`  Final Position: x=${finalX.toFixed(2)}, y=${converted.y.toFixed(2)}`);
    console.log(`  Text: "${text.substring(0, 30)}..." (${text.length} chars)`);
  }

  // Optional: Draw bounding box for verification
  if (debug?.drawBoundingBoxes) {
    page.drawRectangle({
      x: finalX,
      y: converted.y - fontSize,
      width: textWidth,
      height: fontSize,
      borderColor: rgb(1, 0, 0),
      borderWidth: 0.5,
    });
  }

  // Draw the text
  const color = field.color ? hexToRgb(field.color) : { r: 0, g: 0, b: 0 };
  page.drawText(text, {
    x: finalX,
    y: converted.y,
    size: fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
    rotate: field.rotation ? degrees(field.rotation) : undefined,
  });
}
Enable Debug Mode During Testing
File: lib/actions/generate.ts
const result = await generatePDF(
  {
    layout: layout.config,
    userData: data,
    coordinateMode: 'percentage',
    debug: {
      enabled: true,  // ← Set to true for testing
      logCoordinates: true,
      drawBoundingBoxes: true,  // See text boxes in PDF
    },
  },
  'base64'
);
This will print detailed coordinate info to the server logs, and draw red boxes around each text field in the PDF so you can visually verify positions.
________________________________________
Solution 5: Create a Coordinate Validation Test
Add Test File: __tests__/coordinate-conversion.test.ts
import { percentageToPoints, pointsToPercentage } from '@/lib/pdf/generator';

describe('Coordinate Conversion', () => {
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  describe('percentageToPoints', () => {
    it('should convert top-left (0,0) correctly', () => {
      const result = percentageToPoints(
        { xPct: 0, yPct: 0 },
        A4_WIDTH,
        A4_HEIGHT
      );
      expect(result.xPoints).toBeCloseTo(0);
      expect(result.yPoints).toBeCloseTo(841.89);  // Top of PDF
    });

    it('should convert center (0.5, 0.5) correctly', () => {
      const result = percentageToPoints(
        { xPct: 0.5, yPct: 0.5 },
        A4_WIDTH,
        A4_HEIGHT
      );
      expect(result.xPoints).toBeCloseTo(297.64, 1);
      expect(result.yPoints).toBeCloseTo(420.945, 1);
    });

    it('should convert bottom-right (1,1) correctly', () => {
      const result = percentageToPoints(
        { xPct: 1, yPct: 1 },
        A4_WIDTH,
        A4_HEIGHT
      );
      expect(result.xPoints).toBeCloseTo(595.28);
      expect(result.yPoints).toBeCloseTo(0);  // Bottom of PDF
    });

    it('should round-trip convert without loss', () => {
      const original = { xPct: 0.48, yPct: 0.32 };
      const toPoints = percentageToPoints(original, A4_WIDTH, A4_HEIGHT);
      const backToPercent = pointsToPercentage(toPoints, A4_WIDTH, A4_HEIGHT);
      
      expect(backToPercent.xPct).toBeCloseTo(original.xPct, 5);
      expect(backToPercent.yPct).toBeCloseTo(original.yPct, 5);
    });

    it('should handle edge case: very top (0, 0.01)', () => {
      const result = percentageToPoints(
        { xPct: 0.5, yPct: 0.01 },
        A4_WIDTH,
        A4_HEIGHT
      );
      // Y should be very close to page height
      expect(result.yPoints).toBeCloseTo(832.93, 1);
    });
  });

  describe('Round-trip consistency', () => {
    it('should maintain positions through multiple conversions', () => {
      const testPositions = [
        { xPct: 0.25, yPct: 0.25 },
        { xPct: 0.5, yPct: 0.5 },
        { xPct: 0.75, yPct: 0.75 },
      ];

      testPositions.forEach(original => {
        const points = percentageToPoints(original, A4_WIDTH, A4_HEIGHT);
        const back = pointsToPercentage(points, A4_WIDTH, A4_HEIGHT);
        
        expect(back.xPct).toBeCloseTo(original.xPct, 5);
        expect(back.yPct).toBeCloseTo(original.yPct, 5);
      });
    });
  });
});
Run tests: npm test -- coordinate-conversion
________________________________________
Quick Checklist Before Redeploying
•	[ ] Verify container size is measured correctly
o	Open DevTools → check "📏 Container Size Updated" logs
o	Confirm height matches visual canvas
•	[ ] Confirm no double Y-inversion
o	Search codebase for 841.89 - ( (should appear only once per field)
o	Check convertCoordinates doesn't invert after percentageToPoints
•	[ ] Check coordinate round-trip
o	Place text at (0.5, 0.5) - should be center
o	Save and generate PDF
o	Text should be at center of page
o	If not at center, Y-inversion is broken
•	[ ] Validate container ref attachment
o	<div ref={containerRef}> in CertificateCanvas
o	This div must have explicit CSS height (not auto)
•	[ ] Test responsive resize
o	Drag text to position (e.g., 0.48, 0.32)
o	Resize window → text should stay at same relative position
o	Generate PDF → text should be at same position as preview
•	[ ] Enable debug mode
o	Generate PDF with debug: { enabled: true, ... }
o	Check server logs for coordinate values
o	Verify PDF has red bounding boxes around text
________________________________________
Expected Results After Fix
Before Fix (Buggy)
Canvas:        Text at Y=32% of container
               Appears correct visually ✓
               
PDF:           Text at Y=45% of page (WRONG!)
               Position is completely off ✗
After Fix (Correct)
Canvas:        Text at Y=32% of container
               Appears correct visually ✓
               
PDF:           Text at Y=32% of page
               Position matches preview perfectly ✓
________________________________________
Implementation Order
1.	First: Run diagnostic tests (Test 1, 2, 3) to identify which solution applies
2.	Second: Implement Solution 1 (container size measurement)
3.	Third: Implement Solution 4 (debug mode with logging)
4.	Fourth: Run Solution 5 tests to validate conversions
5.	Fifth: Test with your actual certificate data
________________________________________
If Bug Persists After Solutions
If text is STILL misaligned after all fixes:
1.	Check PDF library version: Ensure pdf-lib is up to date
2.	npm list pdf-lib
3.	npm install pdf-lib@latest
4.	Verify no CSS transform interference:
5.	/* ❌ These break coordinate calculations */
6.	transform: scale() | rotate() | skew()
7.	
8.	/* ✓ Use rotation in PDF instead */
9.	field.rotation = 45;  // In degrees
10.	Test with absolute pixel coordinates (fallback):
11.	// Instead of normalized 0-1, try pixel coordinates
12.	coordinateMode: 'pixels'  // Uses browserYToPdfY directly
13.	Check font baseline handling:
o	Some fonts have different baselines
o	Try adjusting fontSize offset in convertCoordinates
________________________________________
Questions to Answer While Debugging
1.	Describe the misalignment:
o	Is text too high or too low?
o	By how much? (inches/cm estimate)
o	Is it consistent for all text or different per field?
2.	Does it scale with container size?
o	Place text, resize window, generate PDF
o	Does error increase/decrease with window size?
3.	Does font size affect it?
o	Try a large font (48pt) and small font (12pt)
o	Is the offset proportional to font size?
These answers will pinpoint the exact issue.
________________________________________
Contact & Debugging Support
If you implement these solutions and still have issues:
1.	Share the debug logs from Solution 4
2.	Screenshot of canvas preview and PDF side-by-side
3.	Your container CSS dimensions
4.	Field data: { x, y, size, font, align }
This will make identifying the bug trivial.

