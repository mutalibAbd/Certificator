/**
 * Font Configuration for Certificator
 *
 * BROWSER PREVIEW:
 * - Inter (UI font): loaded globally in layout.tsx
 * - Certificate fonts: loaded via next/font/google, applied in canvas area
 *
 * PDF GENERATION:
 * - Standard fonts (Helvetica, Times, Courier): built into pdf-lib
 * - Google Fonts: TTF fetched at generation time and embedded via pdf-lib
 */

import {
  Inter,
  Pinyon_Script,
  Great_Vibes,
  Dancing_Script,
  Sacramento,
  Pacifico,
  Caveat,
} from "next/font/google";

/* -------------------------------------------------------------------------- */
/*  Font instances (next/font/google)                                          */
/* -------------------------------------------------------------------------- */

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const pinyonScript = Pinyon_Script({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pinyon",
});

export const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-great-vibes",
});

export const dancingScript = Dancing_Script({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dancing-script",
});

export const sacramento = Sacramento({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sacramento",
});

export const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pacifico",
});

export const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-caveat",
});

/* -------------------------------------------------------------------------- */
/*  Font registry — single source of truth for all layers                      */
/* -------------------------------------------------------------------------- */

export interface FontEntry {
  /** Display name shown in the UI dropdown */
  name: string;
  /** CSS font-family value for the canvas */
  cssFontFamily: string;
  /** Is this a standard PDF font (built into pdf-lib)? */
  isStandard: boolean;
}

/**
 * All available fonts, keyed by the name stored in LayoutField.font.
 * This key is what gets saved to the database.
 */
export const FONT_REGISTRY: Record<string, FontEntry> = {
  Helvetica: {
    name: "Helvetica",
    cssFontFamily: "var(--font-inter), sans-serif",
    isStandard: true,
  },
  "Times-Roman": {
    name: "Times New Roman",
    cssFontFamily: "'Times New Roman', Times, serif",
    isStandard: true,
  },
  Courier: {
    name: "Courier",
    cssFontFamily: "'Courier New', Courier, monospace",
    isStandard: true,
  },
  "Pinyon Script": {
    name: "Pinyon Script",
    cssFontFamily: "var(--font-pinyon), cursive",
    isStandard: false,
  },
  "Great Vibes": {
    name: "Great Vibes",
    cssFontFamily: "var(--font-great-vibes), cursive",
    isStandard: false,
  },
  "Dancing Script": {
    name: "Dancing Script",
    cssFontFamily: "var(--font-dancing-script), cursive",
    isStandard: false,
  },
  Sacramento: {
    name: "Sacramento",
    cssFontFamily: "var(--font-sacramento), cursive",
    isStandard: false,
  },
  Pacifico: {
    name: "Pacifico",
    cssFontFamily: "var(--font-pacifico), cursive",
    isStandard: false,
  },
  Caveat: {
    name: "Caveat",
    cssFontFamily: "var(--font-caveat), cursive",
    isStandard: false,
  },
};

/** Ordered list of font keys for the dropdown */
export const FONT_OPTIONS = Object.keys(FONT_REGISTRY);

/**
 * Get the CSS font-family string for a given font key.
 * Used by DraggableField to style preview text on the canvas.
 */
export function getCssFontFamily(fontKey: string): string {
  return FONT_REGISTRY[fontKey]?.cssFontFamily ?? "var(--font-inter), sans-serif";
}

/**
 * Get the space-separated className string that activates all
 * certificate font CSS variables. Attach to a wrapper element.
 */
export function getAllFontVariableClasses(): string {
  return [
    pinyonScript.variable,
    greatVibes.variable,
    dancingScript.variable,
    sacramento.variable,
    pacifico.variable,
    caveat.variable,
  ].join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Legacy / shared exports                                                    */
/* -------------------------------------------------------------------------- */

export const DEFAULT_FONTS = {
  ui: "Inter",
  script: "Pinyon Script",
  body: "Inter",
} as const;

export const FONT_SIZE_PRESETS = {
  sm: 12,
  base: 16,
  lg: 20,
  xl: 28,
  "2xl": 36,
  "3xl": 48,
} as const;

export type FontSizePreset = keyof typeof FONT_SIZE_PRESETS;
