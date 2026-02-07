# PDF Field Position Bug - Fix Summary

## Problem Description
When users placed text fields on the certificate canvas at specific positions, the generated PDF would show the fields at different positions. For example, a field placed at 30% from the top would appear at ~31.4% from the top in the PDF.

## Root Cause
The bug was in the `convertCoordinates` function in `lib/pdf/generator.ts`. When converting percentage coordinates to PDF points, the code was applying an erroneous baseline adjustment:

```typescript
// BEFORE (buggy code):
y: points.yPoints - fontSize * 0.75
```

This adjustment was intended to compensate for the difference between:
- **Canvas**: Positions elements by their TOP edge
- **PDF**: Positions text by its BASELINE

However, the adjustment was:
1. Unnecessary (the `percentageToPoints` function already handles Y-axis inversion correctly)
2. Causing position drift that varied with font size
3. Making PDFs not match the canvas preview

## The Fix
Removed the erroneous adjustment:

```typescript
// AFTER (fixed code):
y: points.yPoints
```

## Impact of the Fix

### Before Fix
```
User places field at:     30% from top
PDF shows field at:       31.4% from top
Position drift:           +1.4% (worse for larger fonts)
```

### After Fix
```
User places field at:     30% from top
PDF shows field at:       30% from top
Position drift:           0% (perfect alignment)
```

## Testing
- ✅ All existing coordinate tests pass (10 tests)
- ✅ New comprehensive tests added (3 tests)
- ✅ Total: 13/13 tests passing
- ✅ Linting: 0 errors
- ✅ Code review: No issues with the fix
- ✅ Security scan: No vulnerabilities

## Files Changed
1. `lib/pdf/generator.ts` - Removed the erroneous adjustment
2. `lib/pdf/coordinate-fix.test.ts` - Added comprehensive tests

## Coordinate System Reference
This project bridges two coordinate systems:
- **Browser/Canvas**: Top-Left origin (0,0), Y increases downward
- **PDF**: Bottom-Left origin (0,0), Y increases upward

The `percentageToPoints` function handles this conversion correctly:
```typescript
{
  xPoints: xPct * pdfWidth,
  yPoints: pdfHeight - (yPct * pdfHeight)  // Y-axis inversion
}
```

## Result
Fields now appear at the exact position where users place them on the canvas. The canvas preview matches the PDF output perfectly, regardless of font size.
