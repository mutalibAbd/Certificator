# Bundled Fonts for PDF Generation

This directory contains pre-bundled TrueType fonts (.ttf) used for PDF generation.

## Why Bundle Fonts?

Loading fonts from Google Fonts API during PDF generation adds **100-500ms** latency per unique font. By bundling fonts locally, we reduce this to **1-5ms** per font.

## Supported Fonts

The following fonts should be placed in this directory:

| Font Family | Filename | Google Fonts URL |
|-------------|----------|------------------|
| Pinyon Script | `PinyonScript-Regular.ttf` | [Download](https://fonts.google.com/specimen/Pinyon+Script) |
| Great Vibes | `GreatVibes-Regular.ttf` | [Download](https://fonts.google.com/specimen/Great+Vibes) |
| Dancing Script | `DancingScript-Regular.ttf` | [Download](https://fonts.google.com/specimen/Dancing+Script) |
| Sacramento | `Sacramento-Regular.ttf` | [Download](https://fonts.google.com/specimen/Sacramento) |
| Pacifico | `Pacifico-Regular.ttf` | [Download](https://fonts.google.com/specimen/Pacifico) |
| Caveat | `Caveat-Regular.ttf` | [Download](https://fonts.google.com/specimen/Caveat) |

## How to Download Fonts

### Option 1: Manual Download
1. Visit each font's Google Fonts page
2. Click "Download Family"
3. Extract the TTF file and rename if necessary
4. Place in this directory

### Option 2: Use the Download Script (Recommended)
```bash
npm run fonts:download
```

This will automatically download all required fonts.

## Fallback Behavior

If a font is not found locally, the system will:
1. Try to fetch from Google Fonts API (slower)
2. Fall back to Helvetica (standard PDF font)

## License

All fonts listed above are licensed under the [Open Font License (OFL)](https://scripts.sil.org/OFL).
