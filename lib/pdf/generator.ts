/**
 * PDF Generation Service
 * 
 * AGENT: Typesetter - PDF Engineering Specialist
 * 
 * This module handles certificate PDF generation using pdf-lib.
 * It bridges the "Physical-Digital Gap" by converting Browser coordinates
 * (Top-Left Origin) to PDF coordinates (Bottom-Left Origin).
 * 
 * CRITICAL COORDINATE MATH:
 * - Browser: (0,0) at Top-Left, Y increases downward
 * - PDF: (0,0) at Bottom-Left, Y increases upward
 * - Conversion: Y_pdf = PageHeight - Y_browser
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { LayoutField } from '@/types/database.types';

/** A4 page dimensions in PDF points (1 point = 1/72 inch) */
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// ============================================================================
// TYPES
// ============================================================================

/**
 * User data mapping for certificate fields
 * Key = field.id or field.label, Value = text to render
 */
export type UserData = Record<string, string>;

/**
 * Coordinate system mode
 * - 'pixels': Coordinates are in absolute pixels (legacy)
 * - 'percentage': Coordinates are in 0-1 range (percentage of page dimensions)
 */
export type CoordinateMode = 'pixels' | 'percentage';

/**
 * Debug options for visual verification during development
 */
export interface DebugOptions {
  /** Enable debug mode to draw visual markers */
  enabled: boolean;
  /** Draw bounding boxes around text fields */
  showBoundingBoxes?: boolean;
  /** Draw cross markers at field positions */
  showPositionMarkers?: boolean;
  /** Color for debug elements (hex format, default: #FF0000) */
  color?: string;
  /** Line width for debug elements (default: 0.5) */
  lineWidth?: number;
}

/**
 * Input for PDF generation
 */
export interface GeneratePDFInput {
  /** Layout configuration with field positions */
  layout: LayoutField[];
  /** User-provided data to fill in fields */
  userData: UserData;
  /** Optional: Page size as [width, height] in PDF points (defaults to A4) */
  pageSize?: [number, number];
  /** Optional: Custom fonts to load (URL -> font name mapping) */
  customFonts?: Record<string, string>;
  /** Coordinate mode: 'pixels' (default) or 'percentage' (0-1 range) */
  coordinateMode?: CoordinateMode;
  /** Debug options for visual verification */
  debug?: DebugOptions;
}

/**
 * Output format options
 */
export type OutputFormat = 'base64' | 'buffer' | 'uint8array';

/**
 * Result of PDF generation
 */
export interface GeneratePDFResult {
  /** Generated PDF data */
  data: string | Buffer | Uint8Array;
  /** Format of the data */
  format: OutputFormat;
  /** Page count of the generated PDF */
  pageCount: number;
}

// ============================================================================
// STANDARD FONTS
// ============================================================================

/**
 * Standard font mapping for pdf-lib
 * These don't require external font files
 */
const STANDARD_FONTS: Record<string, StandardFonts> = {
  'Helvetica': StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Helvetica-Oblique': StandardFonts.HelveticaOblique,
  'Helvetica-BoldOblique': StandardFonts.HelveticaBoldOblique,
  'Times-Roman': StandardFonts.TimesRoman,
  'Times-Bold': StandardFonts.TimesRomanBold,
  'Times-Italic': StandardFonts.TimesRomanItalic,
  'Times-BoldItalic': StandardFonts.TimesRomanBoldItalic,
  'Courier': StandardFonts.Courier,
  'Courier-Bold': StandardFonts.CourierBold,
  'Courier-Oblique': StandardFonts.CourierOblique,
  'Courier-BoldOblique': StandardFonts.CourierBoldOblique,
};

/**
 * Google Font family names -> Google Fonts API names.
 * Used to fetch TTF files for embedding in PDFs.
 */
const GOOGLE_FONT_FAMILIES: Record<string, string> = {
  'Pinyon Script': 'Pinyon+Script',
  'Great Vibes': 'Great+Vibes',
  'Dancing Script': 'Dancing+Script',
  'Sacramento': 'Sacramento',
  'Pacifico': 'Pacifico',
  'Caveat': 'Caveat',
};

/** In-memory cache for downloaded font bytes (avoids re-fetching per page) */
const fontBytesCache = new Map<string, Uint8Array>();

/**
 * Fetch a Google Font TTF and return the raw bytes.
 * Results are cached in memory for the lifetime of the process.
 */
async function fetchGoogleFontBytes(fontFamily: string): Promise<Uint8Array | null> {
  if (fontBytesCache.has(fontFamily)) {
    return fontBytesCache.get(fontFamily)!;
  }

  const apiName = GOOGLE_FONT_FAMILIES[fontFamily];
  if (!apiName) return null;

  try {
    // Request CSS from Google Fonts with a User-Agent that returns TTF URLs
    const cssUrl = `https://fonts.googleapis.com/css2?family=${apiName}&display=swap`;
    const cssRes = await fetch(cssUrl, {
      headers: {
        // This User-Agent causes Google Fonts to return TTF (not woff2)
        'User-Agent': 'Mozilla/5.0 (compatible; pdf-generator) AppleWebKit/537.36',
      },
    });

    if (!cssRes.ok) return null;
    const css = await cssRes.text();

    // Extract the first font file URL from the CSS
    const urlMatch = css.match(/url\(([^)]+\.ttf[^)]*)\)/i)
      || css.match(/url\(([^)]+)\)/i);

    if (!urlMatch?.[1]) return null;

    const fontUrl = urlMatch[1].replace(/['"]/g, '');
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;

    const buffer = await fontRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    fontBytesCache.set(fontFamily, bytes);
    return bytes;
  } catch (err) {
    console.warn(`Failed to fetch Google Font "${fontFamily}":`, err);
    return null;
  }
}

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

/**
 * Percentage-based coordinate in 0-1 range
 * (0, 0) = top-left corner
 * (1, 1) = bottom-right corner
 */
export interface PercentageCoordinate {
  xPct: number; // 0-1 range (percentage of width)
  yPct: number; // 0-1 range (percentage of height)
}

/**
 * PDF coordinate in points
 * (0, 0) = bottom-left corner (PDF standard)
 */
export interface PDFPointCoordinate {
  xPoints: number;
  yPoints: number;
}

/**
 * Convert percentage coordinates to PDF points
 * 
 * CRITICAL FORMULA (per Typesetter Protocol):
 * - xPoints = xPct * pdfWidth
 * - yPoints = pdfHeight - (yPct * pdfHeight)
 * 
 * This handles the Y-axis inversion automatically:
 * - Input: (0,0) at top-left, Y increases downward (browser/percentage)
 * - Output: (0,0) at bottom-left, Y increases upward (PDF)
 * 
 * @param coord - Percentage coordinate (0-1 range)
 * @param pdfWidth - Width of the PDF page in points
 * @param pdfHeight - Height of the PDF page in points
 * @returns PDF coordinate in points
 * 
 * @example
 * // Center of page
 * percentageToPoints({ xPct: 0.5, yPct: 0.5 }, 612, 792)
 * // Returns: { xPoints: 306, yPoints: 396 }
 * 
 * @example
 * // Top-left corner
 * percentageToPoints({ xPct: 0, yPct: 0 }, 612, 792)
 * // Returns: { xPoints: 0, yPoints: 792 }
 */
export function percentageToPoints(
  coord: PercentageCoordinate,
  pdfWidth: number,
  pdfHeight: number
): PDFPointCoordinate {
  // Validate percentage range (clamp to 0-1)
  const xPct = Math.max(0, Math.min(1, coord.xPct));
  const yPct = Math.max(0, Math.min(1, coord.yPct));

  return {
    xPoints: xPct * pdfWidth,
    yPoints: pdfHeight - (yPct * pdfHeight),
  };
}

/**
 * Convert PDF points back to percentage coordinates
 * Inverse of percentageToPoints for round-trip conversions
 * 
 * @param points - PDF coordinate in points
 * @param pdfWidth - Width of the PDF page in points
 * @param pdfHeight - Height of the PDF page in points
 * @returns Percentage coordinate (0-1 range)
 */
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

/**
 * Convert Browser Y coordinate to PDF Y coordinate
 * 
 * CRITICAL: This is the "Physical-Digital Gap" conversion
 * Browser: Top-Left origin, Y increases downward
 * PDF: Bottom-Left origin, Y increases upward
 * 
 * @param browserY - Y coordinate in Browser coordinate system
 * @param pageHeight - Height of the PDF page in points
 * @param fontSize - Font size (text baseline adjustment)
 * @returns Y coordinate in PDF coordinate system
 */
function browserYToPdfY(browserY: number, pageHeight: number, fontSize: number = 0): number {
  // Y_pdf = PageHeight - Y_browser
  // We subtract fontSize to account for text baseline (text draws from baseline up)
  return pageHeight - browserY - fontSize;
}

/**
 * Convert pixel coordinates to PDF points based on coordinate mode
 * 
 * @param x - X coordinate (pixels or percentage)
 * @param y - Y coordinate (pixels or percentage)
 * @param pageWidth - PDF page width in points
 * @param pageHeight - PDF page height in points
 * @param mode - Coordinate mode ('pixels' or 'percentage')
 * @param fontSize - Font size for baseline adjustment
 * @returns { x, y } in PDF points
 */
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
    const points = percentageToPoints({ xPct: x, yPct: y }, pageWidth, pageHeight);
    // Adjust for text baseline.
    // pdf-lib drawText positions text at the baseline. The canvas positions
    // the field's top edge at y%. A typical font ascender is ~80% of the
    // em-square, so we shift UP by fontSize to position the baseline correctly.
    // In PDF coordinates (Y increases upward), we ADD to move UP.
    return {
      x: points.xPoints,
      y: points.yPoints,  // No baseline adjustment - let the text position naturally
    };
  }

  // Pixel mode: direct conversion
  return {
    x: x,
    y: browserYToPdfY(y, pageHeight, fontSize),
  };
}

/**
 * Calculate X position for text alignment
 * 
 * @param x - Original X position
 * @param textWidth - Width of the text being drawn
 * @param align - Alignment mode
 * @param fieldWidth - Optional field width for right alignment
 * @returns Adjusted X position
 */
function _calculateAlignedX(
  x: number,
  textWidth: number,
  align: 'left' | 'center' | 'right' = 'left',
  fieldWidth?: number
): number {
  switch (align) {
    case 'center':
      // X_draw = X_point - (W_text / 2)
      return x - (textWidth / 2);
    case 'right':
      // For right align, either use field width or just offset by text width
      return fieldWidth ? x + fieldWidth - textWidth : x - textWidth;
    case 'left':
    default:
      return x;
  }
}

/**
 * Parse hex color to RGB values
 * Supports formats: #RGB, #RRGGBB, RGB, RRGGBB
 * 
 * @param hex - Hex color string
 * @returns RGB object with values 0-1
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  let r: number, g: number, b: number;

  if (cleanHex.length === 3) {
    // Short format: #RGB -> #RRGGBB
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  } else {
    // Fallback to black
    return { r: 0, g: 0, b: 0 };
  }

  // Convert 0-255 to 0-1 range for pdf-lib
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255,
  };
}

// ============================================================================
// FONT LOADING
// ============================================================================

/**
 * Options for font loading
 */
interface FontLoadOptions {
  /** Whether to use bold variant */
  bold?: boolean;
  /** Whether to use italic variant */
  italic?: boolean;
}

/**
 * Load a font into the PDF document.
 * 1. Try standard PDF fonts (Helvetica, Times, Courier families)
 * 2. Try fetching a Google Font TTF and embedding it
 * 3. Fall back to Helvetica
 */
async function loadFont(
  pdfDoc: PDFDocument,
  fontName: string,
  options: FontLoadOptions = {}
): Promise<PDFFont> {
  const { bold = false, italic = false } = options;

  // Build font variant name for standard fonts
  let variantName = fontName;
  if (bold && italic) {
    variantName = `${fontName}-BoldOblique`;
  } else if (bold) {
    variantName = `${fontName}-Bold`;
  } else if (italic) {
    variantName = `${fontName}-Oblique`;
  }

  // Try standard fonts first
  const standardFont = STANDARD_FONTS[variantName] || STANDARD_FONTS[fontName];
  if (standardFont) {
    return pdfDoc.embedFont(standardFont);
  }

  // Try Google Font (TTF embedding)
  const fontBytes = await fetchGoogleFontBytes(fontName);
  if (fontBytes) {
    return pdfDoc.embedFont(fontBytes);
  }

  // Fallback to Helvetica
  console.warn(`Font "${fontName}" not available, falling back to Helvetica`);
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generate a certificate PDF on a blank page with text fields
 *
 * This is the main entry point for PDF generation.
 * Creates a blank page (ghost layer) and draws text fields on it.
 *
 * @param input - Generation input (layout, user data, optional page size)
 * @param format - Output format (default: 'base64')
 * @returns Generated PDF result
 *
 * @example
 * ```typescript
 * const result = await generatePDF({
 *   layout: layoutFields,
 *   userData: { name: 'John Doe', date: '2024-01-15' },
 *   coordinateMode: 'percentage',
 * });
 * ```
 */
export async function generatePDF(
  input: GeneratePDFInput,
  format: OutputFormat = 'base64'
): Promise<GeneratePDFResult> {
  const { layout, userData } = input;

  // ===== STEP 1: Create Blank PDF Page =====
  const [pageWidth, pageHeight] = input.pageSize || [A4_WIDTH, A4_HEIGHT];
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Coordinate mode (default to pixels for backward compatibility)
  const coordinateMode = input.coordinateMode || 'pixels';

  // ===== STEP 2: Load Fonts =====
  const uniqueFonts = new Set(layout.map(field => field.font));
  const fontMap = new Map<string, PDFFont>();

  for (const fontName of uniqueFonts) {
    const font = await loadFont(pdfDoc, fontName);
    fontMap.set(fontName, font);
  }

  // ===== STEP 3: Draw Fields =====
  for (const field of layout) {
    // Get text value from userData, fallback to field.value, then field.label
    const text = getUserDataValue(field, userData);

    if (!text) {
      // Skip empty fields
      continue;
    }

    // Only handle text-type fields for now
    if (field.type === 'text' || field.type === 'date') {
      await drawTextField(
        page,
        field,
        text,
        fontMap,
        pdfDoc,
        pageWidth,
        pageHeight,
        coordinateMode,
        input.debug
      );
    }
    // TODO: Add image and signature support in future iterations
  }

  // ===== STEP 4: Serialize PDF =====
  const pdfBytes = await pdfDoc.save();

  // ===== STEP 5: Convert to Requested Format =====
  let data: string | Buffer | Uint8Array;

  switch (format) {
    case 'base64':
      // Convert Uint8Array to base64 string
      data = uint8ArrayToBase64(pdfBytes);
      break;
    case 'buffer':
      // Node.js Buffer
      data = Buffer.from(pdfBytes);
      break;
    case 'uint8array':
    default:
      data = pdfBytes;
      break;
  }

  return {
    data,
    format,
    pageCount: 1,
  };
}

/**
 * Get user data value for a field
 * Priority: userData[field.id] > userData[field.label] > field.value
 */
function getUserDataValue(field: LayoutField, userData: UserData): string {
  // Check by field id first
  if (userData[field.id]) {
    return userData[field.id];
  }

  // Check by field label
  if (field.label && userData[field.label]) {
    return userData[field.label];
  }

  // Fallback to field's default value
  return field.value || '';
}

// ============================================================================
// DEBUG VISUALIZATION
// ============================================================================

/**
 * Draw debug bounding box around text
 * Used for visual verification during development
 *
 * @param page - PDF page to draw on
 * @param x - X position of text
 * @param y - Y position of text baseline
 * @param textWidth - Width of the text
 * @param textHeight - Height of the text (fontSize)
 * @param debug - Debug options
 * @param pdfDoc - PDF document (for font embedding)
 * @param fieldLabel - Optional label showing field name and coordinates
 */
async function drawDebugBoundingBox(
  page: PDFPage,
  x: number,
  y: number,
  textWidth: number,
  textHeight: number,
  debug: DebugOptions,
  pdfDoc?: PDFDocument,
  fieldLabel?: string,
): Promise<void> {
  const color = debug.color ? hexToRgb(debug.color) : { r: 1, g: 0, b: 0 }; // Default red
  const lineWidth = debug.lineWidth ?? 0.5;
  const padding = 2; // Small padding around text

  // Draw bounding box (rectangle around text)
  if (debug.showBoundingBoxes !== false) {
    page.drawRectangle({
      x: x - padding,
      y: y - padding,
      width: textWidth + (padding * 2),
      height: textHeight + (padding * 2),
      borderColor: rgb(color.r, color.g, color.b),
      borderWidth: lineWidth,
      opacity: 0.8,
    });
  }

  // Draw position marker (crosshair at anchor point)
  if (debug.showPositionMarkers) {
    const markerSize = 8;

    // Vertical line
    page.drawLine({
      start: { x: x, y: y - markerSize },
      end: { x: x, y: y + textHeight + markerSize },
      color: rgb(color.r, color.g, color.b),
      thickness: lineWidth,
    });

    // Horizontal line at baseline
    page.drawLine({
      start: { x: x - markerSize, y: y },
      end: { x: x + textWidth + markerSize, y: y },
      color: rgb(color.r, color.g, color.b),
      thickness: lineWidth,
    });

    // Small circle at anchor point
    page.drawCircle({
      x: x,
      y: y,
      size: 3,
      borderColor: rgb(color.r, color.g, color.b),
      borderWidth: lineWidth,
    });

    // Draw coordinate label if provided
    if (fieldLabel && pdfDoc) {
      try {
        const labelFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const labelSize = 7;
        page.drawText(fieldLabel, {
          x: x + 6,
          y: y + textHeight + 4,
          size: labelSize,
          font: labelFont,
          color: rgb(color.r, color.g, color.b),
        });
      } catch {
        // Silently skip label if font embedding fails
      }
    }
  }
}

/**
 * Draw a text field on the PDF page
 * Handles coordinate conversion, alignment, styling, and debug visualization
 * 
 * @param page - PDF page to draw on
 * @param field - Field configuration from layout
 * @param text - Text to render
 * @param fontMap - Cached font map
 * @param pdfDoc - PDF document
 * @param pageWidth - Page width in points
 * @param pageHeight - Page height in points
 * @param coordinateMode - Coordinate system mode
 * @param debug - Optional debug options
 */
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
  // Get or load font with variants
  let font = fontMap.get(field.font);

  if (!font) {
    // Load font if not in cache (shouldn't happen, but defensive)
    font = await loadFont(pdfDoc, field.font, {
      bold: field.bold,
      italic: field.italic,
    });
    fontMap.set(field.font, font);
  }

  // Font size (default to 12 if not specified)
  const fontSize = field.size || 12;

  // Calculate text width for alignment
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  // Convert coordinates based on mode
  const converted = convertCoordinates(
    field.x,
    field.y,
    pageWidth,
    pageHeight,
    coordinateMode,
    fontSize
  );

  // Calculate aligned X position
  // Note: For percentage mode, alignment is relative to the converted point
  let finalX = converted.x;
  if (field.align === 'center') {
    finalX = converted.x - (textWidth / 2);
  } else if (field.align === 'right') {
    finalX = field.width
      ? converted.x + field.width - textWidth
      : converted.x - textWidth;
  }

  const finalY = converted.y;

  // Parse color (default to black)
  const color = field.color ? hexToRgb(field.color) : { r: 0, g: 0, b: 0 };

  // Draw debug visualization if enabled
  if (debug?.enabled) {
    const debugLabel = `${field.label || field.id} (${(field.x * 100).toFixed(0)}%,${(field.y * 100).toFixed(0)}%) -> pdf(${finalX.toFixed(0)},${finalY.toFixed(0)})`;
    await drawDebugBoundingBox(page, finalX, finalY, textWidth, fontSize, debug, pdfDoc, debugLabel);
  }

  // Draw the text
  // CRITICAL: When Y-axis is inverted (browser to PDF), rotation must also be negated
  // Browser: Y increases downward, counter-clockwise rotation is positive
  // PDF: Y increases upward, so the same visual rotation requires negated angle
  const adjustedRotation = field.rotation ? -field.rotation : undefined;

  page.drawText(text, {
    x: finalX,
    y: finalY,
    size: fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
    rotate: adjustedRotation !== undefined ? degrees(adjustedRotation) : undefined,
  });
}

/**
 * Convert Uint8Array to base64 string
 * Works in both Node.js and browser environments
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  // Browser environment
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================================================
// BATCH GENERATION (Memory Efficient)
// ============================================================================

/**
 * Options for batch PDF generation
 */
export interface BatchGenerateOptions {
  /** Coordinate mode: 'pixels' (default) or 'percentage' (0-1 range) */
  coordinateMode?: CoordinateMode;
  /** Debug options for visual verification */
  debug?: DebugOptions;
  /** Page size as [width, height] in PDF points (defaults to A4) */
  pageSize?: [number, number];
}

/**
 * Generate multiple certificates as blank pages with text fields (batch mode)
 * This is more memory-efficient than calling generatePDF multiple times
 * because it avoids redundant setup overhead.
 *
 * @param layout - Layout configuration
 * @param userDataList - Array of user data for each certificate
 * @param customFonts - Optional custom fonts
 * @param format - Output format
 * @param options - Additional options (coordinate mode, debug, page size)
 * @returns Array of generated PDF results
 *
 * @example
 * ```typescript
 * const results = await generateBatchPDF(
 *   layout,
 *   [
 *     { name: 'Alice', course: 'TypeScript' },
 *     { name: 'Bob', course: 'TypeScript' },
 *   ],
 *   undefined,
 *   'base64',
 *   { coordinateMode: 'percentage', debug: { enabled: true } }
 * );
 * ```
 */
export async function generateBatchPDF(
  layout: LayoutField[],
  userDataList: UserData[],
  customFonts?: Record<string, string>,
  format: OutputFormat = 'base64',
  options?: BatchGenerateOptions
): Promise<GeneratePDFResult[]> {
  const [pageWidth, pageHeight] = options?.pageSize || [A4_WIDTH, A4_HEIGHT];
  const coordinateMode = options?.coordinateMode || 'pixels';

  // Generate PDFs sequentially to avoid memory spikes
  const results: GeneratePDFResult[] = [];

  for (const userData of userDataList) {
    // Create a fresh blank PDF for each certificate
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Load standard fonts
    const uniqueFonts = new Set(layout.map(f => f.font));
    const fontMap = new Map<string, PDFFont>();

    for (const fontName of uniqueFonts) {
      const font = await loadFont(pdfDoc, fontName);
      fontMap.set(fontName, font);
    }

    // Draw fields
    for (const field of layout) {
      const text = getUserDataValue(field, userData);
      if (!text) continue;

      if (field.type === 'text' || field.type === 'date') {
        await drawTextField(
          page,
          field,
          text,
          fontMap,
          pdfDoc,
          pageWidth,
          pageHeight,
          coordinateMode,
          options?.debug
        );
      }
    }

    // Serialize
    const pdfBytes = await pdfDoc.save();

    let data: string | Buffer | Uint8Array;
    switch (format) {
      case 'base64':
        data = uint8ArrayToBase64(pdfBytes);
        break;
      case 'buffer':
        data = Buffer.from(pdfBytes);
        break;
      default:
        data = pdfBytes;
    }

    results.push({
      data,
      format,
      pageCount: 1,
    });
  }

  return results;
}

// ============================================================================
// MERGED BATCH GENERATION (Single Document, Multiple Pages)
// ============================================================================

/**
 * Generate multiple certificates as pages in a single PDF document.
 * More efficient than generateBatchPDF because:
 * - Creates a single PDFDocument with PDFDocument.create()
 * - Loads fonts once and reuses across all pages
 * - No post-merge step required
 *
 * @param layout - Layout configuration
 * @param userDataList - Array of user data for each certificate
 * @param format - Output format (default: 'base64')
 * @param options - Additional options (coordinate mode, debug, page size)
 * @returns Single GeneratePDFResult with all pages merged
 *
 * @example
 * ```typescript
 * const result = await generateMergedBatchPDF(
 *   layout,
 *   [
 *     { name: 'Alice', course: 'TypeScript' },
 *     { name: 'Bob', course: 'TypeScript' },
 *   ],
 *   'base64',
 *   { coordinateMode: 'percentage' }
 * );
 * ```
 */
export async function generateMergedBatchPDF(
  layout: LayoutField[],
  userDataList: UserData[],
  format: OutputFormat = 'base64',
  options?: BatchGenerateOptions
): Promise<GeneratePDFResult> {
  const [pageWidth, pageHeight] = options?.pageSize || [A4_WIDTH, A4_HEIGHT];
  const coordinateMode = options?.coordinateMode || 'pixels';

  // Single document for all pages
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load fonts once and reuse across all pages
  const uniqueFonts = new Set(layout.map(f => f.font));
  const fontMap = new Map<string, PDFFont>();

  for (const fontName of uniqueFonts) {
    const font = await loadFont(pdfDoc, fontName);
    fontMap.set(fontName, font);
  }

  // Add a page per data row
  for (const userData of userDataList) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    for (const field of layout) {
      const text = getUserDataValue(field, userData);
      if (!text) continue;

      if (field.type === 'text' || field.type === 'date') {
        await drawTextField(
          page,
          field,
          text,
          fontMap,
          pdfDoc,
          pageWidth,
          pageHeight,
          coordinateMode,
          options?.debug
        );
      }
    }
  }

  // Serialize
  const pdfBytes = await pdfDoc.save();

  let data: string | Buffer | Uint8Array;
  switch (format) {
    case 'base64':
      data = uint8ArrayToBase64(pdfBytes);
      break;
    case 'buffer':
      data = Buffer.from(pdfBytes);
      break;
    case 'uint8array':
    default:
      data = pdfBytes;
      break;
  }

  return {
    data,
    format,
    pageCount: userDataList.length,
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
//
// Main Functions:
// - generatePDF(input, format): Generate single certificate on blank page
// - generateBatchPDF(layout, userDataList, ...): Generate multiple certificates (individual)
// - generateMergedBatchPDF(layout, userDataList, ...): Generate merged multi-page PDF
// - percentageToPoints(coord, width, height): Convert % to PDF points
// - pointsToPercentage(points, width, height): Convert PDF points to %
//
// Constants:
// - A4_WIDTH: 595.28 points (210mm)
// - A4_HEIGHT: 841.89 points (297mm)
//
// Types:
// - UserData: Record<string, string> - Field values mapping
// - GeneratePDFInput: Input configuration (layout, userData, pageSize)
// - GeneratePDFResult: Output with data, format, page count
// - OutputFormat: 'base64' | 'buffer' | 'uint8array'
// - CoordinateMode: 'pixels' | 'percentage'
// - DebugOptions: Debug visualization settings
// - BatchGenerateOptions: Batch generation options (coordinateMode, debug, pageSize)
// - PercentageCoordinate: { xPct, yPct } in 0-1 range
// - PDFPointCoordinate: { xPoints, yPoints } in PDF points
// ============================================================================

