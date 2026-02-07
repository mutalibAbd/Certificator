/**
 * PDF Font Loader Module
 *
 * Optimized font loading for PDF generation with multiple strategies:
 * 1. Standard fonts (Helvetica, Times, Courier) - built into pdf-lib
 * 2. Bundled fonts (/public/fonts/*.ttf) - fastest, no network
 * 3. Google Fonts API fallback - for fonts not bundled locally
 *
 * PERFORMANCE:
 * - Local fonts: ~1-5ms load time
 * - Google Fonts: ~100-500ms load time
 * - Results cached in memory across requests
 */

import { StandardFonts, type PDFDocument, type PDFFont } from 'pdf-lib';

// ============================================================================
// TYPES
// ============================================================================

export interface FontLoadOptions {
    /** Whether to use bold variant */
    bold?: boolean;
    /** Whether to use italic variant */
    italic?: boolean;
}

// ============================================================================
// STANDARD FONTS
// ============================================================================

/**
 * Standard font mapping for pdf-lib
 * These don't require external font files
 */
export const STANDARD_FONTS: Record<string, StandardFonts> = {
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

// ============================================================================
// BUNDLED FONTS CONFIGURATION
// ============================================================================

/**
 * Mapping of font family names to their local file paths.
 * Fonts should be placed in /public/fonts/ directory.
 *
 * To add a new font:
 * 1. Download the .ttf file from Google Fonts
 * 2. Place it in /public/fonts/
 * 3. Add the mapping here
 */
export const BUNDLED_FONTS: Record<string, string> = {
    'Pinyon Script': '/fonts/PinyonScript-Regular.ttf',
    'Great Vibes': '/fonts/GreatVibes-Regular.ttf',
    'Dancing Script': '/fonts/DancingScript-Regular.ttf',
    'Sacramento': '/fonts/Sacramento-Regular.ttf',
    'Pacifico': '/fonts/Pacifico-Regular.ttf',
    'Caveat': '/fonts/Caveat-Regular.ttf',
};

/**
 * Google Font family names -> Google Fonts API names.
 * Used as fallback when local fonts are not available.
 */
export const GOOGLE_FONT_FAMILIES: Record<string, string> = {
    'Pinyon Script': 'Pinyon+Script',
    'Great Vibes': 'Great+Vibes',
    'Dancing Script': 'Dancing+Script',
    'Sacramento': 'Sacramento',
    'Pacifico': 'Pacifico',
    'Caveat': 'Caveat',
};

// ============================================================================
// FONT CACHE
// ============================================================================

/** In-memory cache for downloaded font bytes (avoids re-fetching per request) */
const fontBytesCache = new Map<string, Uint8Array>();

/** Track which bundled fonts failed to load (avoid repeated attempts) */
const failedLocalFonts = new Set<string>();

// ============================================================================
// FONT LOADING FUNCTIONS
// ============================================================================

/**
 * Fetch a local bundled font from /public/fonts/
 *
 * @param fontFamily - Font family name (e.g., "Pinyon Script")
 * @returns Font bytes or null if not found
 */
async function fetchLocalFontBytes(fontFamily: string): Promise<Uint8Array | null> {
    const cacheKey = `local:${fontFamily}`;

    // Check cache first
    if (fontBytesCache.has(cacheKey)) {
        return fontBytesCache.get(cacheKey)!;
    }

    // Skip if previously failed
    if (failedLocalFonts.has(fontFamily)) {
        return null;
    }

    const localPath = BUNDLED_FONTS[fontFamily];
    if (!localPath) {
        return null;
    }

    try {
        // In server context, fetch from filesystem
        // In browser context, fetch from public URL
        const response = await fetch(localPath);

        if (!response.ok) {
            failedLocalFonts.add(fontFamily);
            return null;
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        fontBytesCache.set(cacheKey, bytes);
        return bytes;
    } catch {
        failedLocalFonts.add(fontFamily);
        return null;
    }
}

/**
 * Fetch a Google Font TTF and return the raw bytes.
 * Results are cached in memory for the lifetime of the process.
 *
 * @param fontFamily - Font family name (e.g., "Pinyon Script")
 * @returns Font bytes or null if not found
 */
async function fetchGoogleFontBytes(fontFamily: string): Promise<Uint8Array | null> {
    const cacheKey = `google:${fontFamily}`;

    if (fontBytesCache.has(cacheKey)) {
        return fontBytesCache.get(cacheKey)!;
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
        fontBytesCache.set(cacheKey, bytes);
        return bytes;
    } catch (err) {
        console.warn(`Failed to fetch Google Font "${fontFamily}":`, err);
        return null;
    }
}

/**
 * Get font bytes for a given font family.
 * Tries local bundled fonts first, then falls back to Google Fonts.
 *
 * @param fontFamily - Font family name
 * @returns Font bytes or null if not available
 */
export async function getFontBytes(fontFamily: string): Promise<Uint8Array | null> {
    // 1. Try local bundled font first (fastest)
    const localBytes = await fetchLocalFontBytes(fontFamily);
    if (localBytes) {
        return localBytes;
    }

    // 2. Fall back to Google Fonts (slower but always available)
    return fetchGoogleFontBytes(fontFamily);
}

/**
 * Load a font into the PDF document.
 *
 * Priority order:
 * 1. Try standard PDF fonts (Helvetica, Times, Courier families)
 * 2. Try local bundled fonts from /public/fonts/
 * 3. Try fetching from Google Fonts API
 * 4. Fall back to Helvetica
 *
 * @param pdfDoc - PDF document to embed font into
 * @param fontName - Font family name
 * @param options - Font style options (bold, italic)
 * @returns Embedded PDF font
 */
export async function loadFont(
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

    // 1. Try standard fonts first (no network required)
    const standardFont = STANDARD_FONTS[variantName] || STANDARD_FONTS[fontName];
    if (standardFont) {
        return pdfDoc.embedFont(standardFont);
    }

    // 2. Try to get font bytes (local first, then Google)
    const fontBytes = await getFontBytes(fontName);
    if (fontBytes) {
        return pdfDoc.embedFont(fontBytes);
    }

    // 3. Fallback to Helvetica
    console.warn(`Font "${fontName}" not available, falling back to Helvetica`);
    return pdfDoc.embedFont(StandardFonts.Helvetica);
}

/**
 * Preload all bundled fonts into memory cache.
 * Call this on app startup to ensure fonts are ready for PDF generation.
 *
 * @returns Number of fonts successfully preloaded
 */
export async function preloadBundledFonts(): Promise<number> {
    const fontNames = Object.keys(BUNDLED_FONTS);
    let loaded = 0;

    await Promise.allSettled(
        fontNames.map(async (fontName) => {
            const bytes = await fetchLocalFontBytes(fontName);
            if (bytes) loaded++;
        })
    );

    return loaded;
}

/**
 * Clear the font cache.
 * Useful for testing or when fonts need to be reloaded.
 */
export function clearFontCache(): void {
    fontBytesCache.clear();
    failedLocalFonts.clear();
}

/**
 * Get cache statistics for debugging.
 */
export function getFontCacheStats(): { cached: number; failed: number } {
    return {
        cached: fontBytesCache.size,
        failed: failedLocalFonts.size,
    };
}
