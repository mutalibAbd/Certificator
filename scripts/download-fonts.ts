/**
 * Download Google Fonts for local bundling
 *
 * This script downloads the TTF files for fonts used in PDF generation.
 * Run with: npx tsx scripts/download-fonts.ts
 *
 * @description Downloads fonts from Google Fonts to public/fonts/
 */

import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const FONTS_DIR = join(process.cwd(), 'public', 'fonts');

const FONTS_TO_DOWNLOAD: { name: string; apiName: string; filename: string }[] = [
    { name: 'Pinyon Script', apiName: 'Pinyon+Script', filename: 'PinyonScript-Regular.ttf' },
    { name: 'Great Vibes', apiName: 'Great+Vibes', filename: 'GreatVibes-Regular.ttf' },
    { name: 'Dancing Script', apiName: 'Dancing+Script', filename: 'DancingScript-Regular.ttf' },
    { name: 'Sacramento', apiName: 'Sacramento', filename: 'Sacramento-Regular.ttf' },
    { name: 'Pacifico', apiName: 'Pacifico', filename: 'Pacifico-Regular.ttf' },
    { name: 'Caveat', apiName: 'Caveat', filename: 'Caveat-Regular.ttf' },
];

async function downloadFont(apiName: string): Promise<Uint8Array | null> {
    try {
        // Request CSS from Google Fonts with a User-Agent that returns TTF URLs
        const cssUrl = `https://fonts.googleapis.com/css2?family=${apiName}&display=swap`;
        const cssRes = await fetch(cssUrl, {
            headers: {
                // This User-Agent causes Google Fonts to return TTF (not woff2)
                'User-Agent': 'Mozilla/5.0 (compatible; pdf-generator) AppleWebKit/537.36',
            },
        });

        if (!cssRes.ok) {
            console.error(`  Failed to fetch CSS for ${apiName}: ${cssRes.status}`);
            return null;
        }

        const css = await cssRes.text();

        // Extract the first font file URL from the CSS
        const urlMatch = css.match(/url\(([^)]+\.ttf[^)]*)\)/i)
            || css.match(/url\(([^)]+)\)/i);

        if (!urlMatch?.[1]) {
            console.error(`  Could not find font URL in CSS for ${apiName}`);
            return null;
        }

        const fontUrl = urlMatch[1].replace(/['"]/g, '');
        console.log(`  Downloading from: ${fontUrl.substring(0, 80)}...`);

        const fontRes = await fetch(fontUrl);
        if (!fontRes.ok) {
            console.error(`  Failed to download font: ${fontRes.status}`);
            return null;
        }

        const buffer = await fontRes.arrayBuffer();
        return new Uint8Array(buffer);
    } catch (err) {
        console.error(`  Error downloading font: ${err}`);
        return null;
    }
}

async function main() {
    console.log('📦 Downloading Google Fonts for PDF generation...\n');

    // Ensure fonts directory exists
    if (!existsSync(FONTS_DIR)) {
        await mkdir(FONTS_DIR, { recursive: true });
        console.log(`Created directory: ${FONTS_DIR}\n`);
    }

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const font of FONTS_TO_DOWNLOAD) {
        const filePath = join(FONTS_DIR, font.filename);

        // Check if font already exists
        if (existsSync(filePath)) {
            console.log(`⏭️  ${font.name}: Already exists, skipping`);
            skipped++;
            continue;
        }

        console.log(`⬇️  ${font.name}...`);
        const bytes = await downloadFont(font.apiName);

        if (bytes) {
            await writeFile(filePath, bytes);
            console.log(`✅ ${font.name}: Saved to ${font.filename} (${(bytes.length / 1024).toFixed(1)} KB)`);
            downloaded++;
        } else {
            console.log(`❌ ${font.name}: Failed to download`);
            failed++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   Downloaded: ${downloaded}`);
    console.log(`   Skipped:    ${skipped}`);
    console.log(`   Failed:     ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
