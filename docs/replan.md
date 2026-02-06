# Certificator Replan: Gap Analysis & Corrective Action Plan

## The Core Misunderstanding

The project was built with the wrong mental model. Here is the difference:

| Aspect | What Was Built | What It Should Be |
|--------|---------------|-------------------|
| Upload | User uploads a **PDF template** | User uploads a **photo/image** (JPG/PNG) of the certificate |
| Reference layer | PDF rendered in `<object>/<iframe>` | Image displayed as `<img>` (visual reference only) |
| Field creation | User **manually** adds fields and types labels | **CSV/Excel columns** auto-create draggable "sticker" fields |
| Generated PDF | Text drawn **ON TOP** of the template PDF (full certificate embedded) | **Blank white A4 page** with ONLY text (no background) |
| Printing | User prints the PDF as-is (the certificate + text are baked in) | User prints on **pre-printed paper** — only the text ink hits the paper |

**The "Ghost Layer" principle**: The generated PDF is invisible glass with ink. The fancy certificate paper is already in the printer tray.

---

## Part 1: What's OK (Keep As-Is)

These parts are correctly built and need no changes:

### Infrastructure & Auth
- `app/(auth)/login/page.tsx` — Login page
- `app/(auth)/signup/page.tsx` — Signup page
- `app/(auth)/callback/route.ts` — OAuth callback
- `middleware.ts` — Session refresh + route protection
- `utils/supabase/server.ts` — Server-side Supabase client
- `utils/supabase/client.ts` — Browser-side Supabase client
- `lib/env.ts` — Environment variable validation
- `.env.local.example` — Example env config

### Design System & UI Shell
- `app/globals.css` — CSS variables, z-index scale, design tokens (all correct)
- `app/layout.tsx` — Root layout with Inter font
- `app/(app)/layout.tsx` — App shell with sign-out
- `app/(app)/actions.ts` — Sign-out server action
- `components/ToastProvider.tsx` — Toast notification system
- `hooks/useToast.ts` — Toast hook
- `lib/fonts.ts` — Font loading via next/font

### Error Handling & Skeletons
- `app/(app)/error.tsx` — Error boundary
- `app/(app)/loading.tsx` — Generic skeleton
- `app/(app)/dashboard/loading.tsx` — Dashboard skeleton
- `app/(app)/editor/[templateId]/loading.tsx` — Editor skeleton
- `app/(app)/editor/[templateId]/not-found.tsx` — Template 404
- `app/not-found.tsx` — Global 404
- `app/page.tsx` — Landing/redirect page

### Database Schema (partially)
- `supabase/migrations/20240101000000_initial_schema.sql` — Tables, RLS, triggers
  - `templates` table structure is fine (rename `pdf_url` to `image_url` later)
  - `layouts` table with JSONB config is correct
  - `system_health` table is fine
  - All RLS policies are correct
- `supabase/migrations/20240102000000_storage_setup.sql` — Storage bucket + policies

### Server Action Patterns
- `lib/actions/templates.ts` — `table()` helper, `{ data, error }` pattern, `extractStoragePath()`, `getSignedPdfUrl()`
- `lib/actions/layouts.ts` — `saveLayout()`, `getLayout()`, `deleteLayout()` all correct

### DevOps
- `.github/workflows/ci.yml` — CI pipeline

### Coordinate System
- Normalized 0-1 coordinates throughout — **correct**
- `percentageToPoints()` and `pointsToPercentage()` in generator.ts — **correct math**
- Browser Y-axis inversion (`browserYToPdfY`) — **correct**
- `types/database.types.ts` coordinate interfaces — **correct**

### Dashboard
- `app/(app)/dashboard/page.tsx` — Template listing (server component)
- `components/DashboardContent.tsx` — Grid layout, empty state
- `components/TemplateCard.tsx` — Card with edit/delete (minor label changes needed)

---

## Part 2: What Must Change

### Change 1: Upload accepts IMAGE (not PDF)

**Files:** `components/UploadModal.tsx`, storage bucket config

**Current behavior:** Only accepts `.pdf` files. Uploads to Supabase Storage `templates` bucket with `contentType: 'application/pdf'`.

**Required behavior:** Accept `.jpg`, `.jpeg`, `.png` image files. These are photos of the physical certificate — the "Reference Layer" used only for visual alignment in the editor.

**Specific changes:**
- File validation: Accept `image/jpeg`, `image/png` instead of `application/pdf`
- Storage upload: Use `contentType: 'image/jpeg'` or `'image/png'` based on the file
- File size limit: Keep 10MB (fine for photos)
- Storage bucket: Update allowed MIME types (or allow both image + PDF for backwards compat)
- `templates.pdf_url` column: Rename to `image_url` (migration) or keep the column name but store image URLs

### Change 2: Editor shows IMAGE (not PDF viewer)

**Files:** `components/PDFPreview.tsx`, `components/EditorWorkspace.tsx`

**Current behavior:** Uses `<object type="application/pdf">` with `<iframe>` fallback to render a PDF. The CertificateCanvas sits on top as an overlay.

**Required behavior:** Show the uploaded certificate image using a simple `<img>` tag. The CertificateCanvas overlay sits on top of the image for drag-and-drop field positioning.

**Specific changes:**
- Replace `PDFPreview.tsx` internals: swap `<object>/<iframe>` for Next.js `<Image>` or a plain `<img>`
- Keep the same overlay architecture (children rendered on top)
- Rename component to `TemplatePreview` or `ReferenceImage` for clarity
- The signed URL approach (`getSignedPdfUrl`) still works — just serving an image instead of a PDF

### Change 3: Data file (CSV/Excel) drives field creation

**Files:** `components/EditorWorkspace.tsx`, `components/FieldPanel.tsx`, new component needed

**Current behavior:** User manually clicks "Add Text" / "Add Date" buttons to create fields, then types a label for each. This is disconnected from the data.

**Required behavior:**
1. User uploads a CSV or Excel file **in the editor**
2. The app reads column headers (e.g., `Name`, `Score`, `Rank`)
3. For each column, a movable "sticker" / "tag" is auto-created with the column header as its label
4. User drags each sticker onto the certificate image to position it
5. User styles each sticker (font, size, color, bold, etc.)
6. When they hit "Generate", the app loops through the spreadsheet rows and places the real values

**Specific changes:**
- Add a data file upload zone in the editor (top toolbar or side panel)
- Parse CSV (reuse existing parser) and Excel (.xlsx — add a library like `xlsx`/SheetJS or `exceljs`)
- Auto-generate CanvasField[] from column headers
- Keep manual "Add Field" as secondary option (for static text like "Certificate of Achievement")
- Store the data file reference or parsed data in state (not in the DB — data changes per batch)
- The FieldPanel's purpose shifts from "create fields" to "style fields" (font, size, position tweaks)

### Change 4: PDF generator creates BLANK pages (not template copies)

**Files:** `lib/pdf/generator.ts`, `lib/actions/generate.ts`

**Current behavior:** `generatePDF()` fetches the template PDF, loads it with `PDFDocument.load()`, gets the first page, and draws text on top of it. Output = full certificate with embedded text.

**Required behavior:** `generatePDF()` creates a **new blank A4 page** (`PDFDocument.create()`, then `addPage([595.28, 841.89])`), places only text at the saved coordinates. Output = white page with just text. No template image. No background.

**This is the #1 most critical change.**

**Specific changes in `generator.ts`:**
```
// REMOVE: Fetching template PDF
// REMOVE: PDFDocument.load(templateBytes)
// REMOVE: pdfDoc.getPages()[0]

// ADD:
const pdfDoc = await PDFDocument.create()
const page = pdfDoc.addPage([595.28, 841.89]) // A4 in points
// Then draw text fields on this blank page
```

**Specific changes in `lib/actions/generate.ts`:**
- `generateCertificate()`: No longer needs `template.pdf_url` for PDF fetching — only needs the layout config
- `generateBatchCertificates()`: Same — creates blank pages, no template fetch
- Remove the template URL fetch timeout logic
- The signed URL / storage path is only needed for the editor preview, not for generation

### Change 5: Batch generation output = multi-page single PDF

**Current behavior:** Generates individual PDFs (one per certificate, each containing the template), then merges with `copyPages`. Already produces a single merged PDF.

**Required behavior:** Same multi-page output, but each page is a blank A4 page with only text. The merge logic in `generateBatchCertificates()` is fine — just the individual PDFs change.

**Specific changes:**
- `generateBatchPDF()` in generator.ts needs the same blank-page treatment as `generatePDF()`
- Remove the "fetch template once" optimization since there's no template to fetch
- Each iteration: `PDFDocument.create()` → `addPage(A4)` → draw text → serialize
- The merge step in `generate.ts` stays the same

### Change 6: Add Excel (.xlsx) support

**Files:** `components/BatchGenerateModal.tsx`, new utility

**Current behavior:** Only parses `.csv` files with a custom zero-dependency parser.

**Required behavior:** Also support `.xlsx` (Excel) files. The user's description explicitly mentions "Excel file".

**Specific changes:**
- Add `xlsx` (SheetJS) package: `npm install xlsx`
- Create a utility that detects file type and routes to CSV parser or xlsx parser
- The existing CSV parser can stay for .csv files
- xlsx parser extracts the first sheet, converts to the same `{ headers, rows }` format

---

## Part 3: What Should Be Removed

### Remove 1: `lib/pdf/font-optimizer.ts` (636 lines)

**Why:** This entire module is over-engineered for the actual use case. It provides fontkit-based subsetting for custom fonts. For a "text on blank page" tool using pre-printed paper, standard PDF fonts (Helvetica, Times, Courier) plus maybe one decorative web font are sufficient.

**The fontkit import was already broken** (the build error we fixed earlier). This is a sign the module adds complexity without corresponding value.

**Action:** Delete entirely. If custom font subsetting is needed later, it can be reimplemented more simply. Standard fonts from pdf-lib don't need subsetting.

### Remove 2: `fontkit` and `@pdf-lib/fontkit` dependencies

**Why:** Only used by font-optimizer.ts. With that module removed and standard fonts used, these dependencies are unnecessary. They caused the "Export default doesn't exist" build error.

**Action:** `npm uninstall fontkit @pdf-lib/fontkit`

### Remove 3: Template PDF fetching logic in generator.ts

**Why:** The entire "fetch template PDF" code path in both `generatePDF()` and `generateBatchPDF()` is wrong. The tool should never download or embed the certificate image.

**Action:** Remove fetch calls, timeout logic, and `PDFDocument.load()` of template bytes. Replace with `PDFDocument.create()`.

### Remove 4: PDF-specific parts of `PDFPreview.tsx`

**Why:** The `<object type="application/pdf">` / `<iframe>` approach is for rendering PDFs in the browser. Since uploads are now images, this is replaced by a simple `<img>` tag.

**Action:** Rewrite component to use `<img>` or Next.js `<Image>`. Keep the overlay container architecture.

---

## Part 4: Implementation Order

### Wave A: Foundation Changes (no dependencies between tasks)
1. **Rewrite UploadModal** — Accept images instead of PDFs
2. **Rewrite PDFPreview → ImagePreview** — Show uploaded image with `<img>` tag
3. **Rewrite generator.ts** — Blank A4 pages, no template fetching
4. **Remove font-optimizer.ts + fontkit deps** — Clean up dead code

### Wave B: Data-Driven Fields (depends on Wave A)
5. **Add Excel parser** — Install xlsx, create unified parse utility
6. **Add data file upload to editor** — CSV/Excel upload in the editor toolbar or panel
7. **Auto-create fields from columns** — Column headers become draggable stickers
8. **Update FieldPanel** — Shift focus from "create" to "style" (font, size, color)

### Wave C: Generate Flow Updates (depends on Wave A)
9. **Update generate.ts server actions** — Remove template URL dependency, use blank pages
10. **Update GenerateModal** — Adjust for new field-creation flow
11. **Update BatchGenerateModal** — Support both CSV and Excel, same blank-page output

### Wave D: Polish
12. **Update schema** — Rename `pdf_url` → `image_url` (SQL migration)
13. **Update dashboard** — Show image thumbnails instead of generic PDF icons
14. **Test full flow** — Upload image → import Excel → drag fields → generate → print alignment check

---

## Part 5: File Impact Summary

| File | Action | Reason |
|------|--------|--------|
| `lib/pdf/font-optimizer.ts` | **DELETE** | Over-engineered, caused build errors, not needed for standard fonts |
| `lib/pdf/generator.ts` | **REWRITE** | Must create blank A4 pages instead of loading template PDFs |
| `lib/actions/generate.ts` | **MODIFY** | Remove template PDF fetch, use blank page generator |
| `components/UploadModal.tsx` | **REWRITE** | Accept images (JPG/PNG) instead of PDFs |
| `components/PDFPreview.tsx` | **REWRITE** → `ImagePreview.tsx` | Use `<img>` instead of `<object>/<iframe>` |
| `components/EditorWorkspace.tsx` | **MODIFY** | Add data file upload, use ImagePreview, auto-create fields from columns |
| `components/FieldPanel.tsx` | **MODIFY** | Shift from field creation to field styling |
| `components/BatchGenerateModal.tsx` | **MODIFY** | Add Excel support alongside CSV |
| `components/GenerateModal.tsx` | **MINOR** | Works mostly as-is, adjust for new field flow |
| `components/CertificateCanvas.tsx` | **MINOR** | Already fixed (transparent overlay). May need label display for stickers |
| `types/database.types.ts` | **MINOR** | Rename `pdf_url` → `image_url` in Template interface |
| `supabase/migrations/` | **ADD** | New migration to rename column + update bucket MIME types |
| `package.json` | **MODIFY** | Remove `fontkit`, `@pdf-lib/fontkit`. Add `xlsx` |
| Everything else | **KEEP** | Auth, middleware, dashboard, design system, toasts, error pages — all fine |

---
---

# Corrective Task List with Prompts

## Phase R1: Cleanup & Foundation

### Task R1: Remove font-optimizer and fontkit dependencies

**What**: Delete `lib/pdf/font-optimizer.ts` (636 lines) and uninstall `fontkit` + `@pdf-lib/fontkit` npm packages. These caused the "Export default doesn't exist" build error and are over-engineered for the actual use case (standard pdf-lib fonts are sufficient). Remove all imports of font-optimizer from generator.ts.

**Depends on**: Nothing (start here)

**Prompt**:
> Remove the font optimization subsystem from Certificator:
>
> 1. Delete the file `lib/pdf/font-optimizer.ts` entirely
> 2. Run `npm uninstall fontkit @pdf-lib/fontkit`
> 3. In `lib/pdf/generator.ts`, remove all imports from `./font-optimizer` (loadOptimizedFont, subsetFont, collectTextForFont, extractUniqueChars, SubsetResult)
> 4. In `lib/pdf/generator.ts`, remove the `import fontkit from '@pdf-lib/fontkit'` line
> 5. In `lib/pdf/generator.ts`, remove the `pdfDoc.registerFontkit(fontkit)` calls
> 6. In `lib/pdf/generator.ts`, remove the `optimizedFontCache` Map and all subsetting logic in `loadFont()`
> 7. Simplify `loadFont()` to only support standard PDF fonts (Helvetica, Times, Courier and their variants) — remove all custom font fetching, caching, and subsetting code
> 8. Remove the `FontLoadOptions` fields related to subsetting: `textToRender`, `enableSubsetting`, `logStats`
> 9. Run `npx tsc --noEmit` to verify no type errors remain
>
> Keep the `STANDARD_FONTS` mapping and the basic `loadFont()` that selects from standard fonts. The font-optimizer was designed for custom web fonts with subsetting — for printing text on blank paper, standard PDF fonts are perfect.

---

### Task R2: Create storage migration for image support

**What**: Create a new SQL migration to: (a) rename `templates.pdf_url` → `templates.image_url`, and prepare storage for image MIME types. Also update the TypeScript types to match.

**Depends on**: Nothing (can run in parallel with R1)

**Prompt**:
> Create a new Supabase migration and update types for image-based uploads:
>
> 1. Create `supabase/migrations/20240103000000_image_support.sql`:
>    - `ALTER TABLE public.templates RENAME COLUMN pdf_url TO image_url;`
>    - Update the CHECK constraint: `ALTER TABLE public.templates DROP CONSTRAINT templates_pdf_url_not_empty; ALTER TABLE public.templates ADD CONSTRAINT templates_image_url_not_empty CHECK (char_length(image_url) > 0);`
>    - Add a SQL comment: `COMMENT ON COLUMN public.templates.image_url IS 'URL to the certificate photo (JPG/PNG) in Supabase Storage — used as visual reference for field positioning only';`
>
> 2. Update `types/database.types.ts`:
>    - In the `Template` interface, rename `pdf_url: string` → `image_url: string`
>    - In `TemplateInsert`, rename `pdf_url` → `image_url`
>    - In `TemplateUpdate`, rename `pdf_url?` → `image_url?`
>    - Update all JSDoc comments referencing PDF → image
>
> 3. After renaming, search the ENTIRE codebase for any remaining `pdf_url` references and update them to `image_url`:
>    - `lib/actions/templates.ts` — `createTemplate()`, `deleteTemplate()`, `getSignedPdfUrl()` (rename to `getSignedImageUrl()`), `extractStoragePath()`
>    - `lib/actions/generate.ts` — remove `template.pdf_url` usage (generation no longer needs the image)
>    - `components/UploadModal.tsx` — where the URL is passed to `createTemplate()`
>    - `components/EditorWorkspace.tsx` — where `template.pdf_url` is referenced
>    - `app/(app)/editor/[templateId]/page.tsx` — where `getSignedPdfUrl` is called
>
> 4. Run `npx tsc --noEmit` to verify all references are updated

---

### Task R3: Install xlsx (SheetJS) for Excel support

**What**: Install the `xlsx` package and create a unified data parser utility that handles both CSV and Excel files, returning a common `{ headers, rows }` format.

**Depends on**: Nothing (can run in parallel with R1 and R2)

**Prompt**:
> Add Excel (.xlsx) support to Certificator:
>
> 1. Run `npm install xlsx`
>
> 2. Create `lib/data-parser.ts` — a unified data file parser:
>    ```typescript
>    export interface ParsedData {
>      headers: string[];
>      rows: string[][];
>    }
>    ```
>    - Export `parseDataFile(file: File): Promise<ParsedData>` — detects file type by extension:
>      - `.csv` → use the existing CSV parser logic (move it from BatchGenerateModal.tsx into this file)
>      - `.xlsx`, `.xls` → use the `xlsx` library to read the first sheet
>    - Export `parseCSVText(text: string): ParsedData` — the core CSV parser (moved from BatchGenerateModal)
>    - Export `parseExcelBuffer(buffer: ArrayBuffer): ParsedData` — xlsx parser:
>      - `const workbook = XLSX.read(buffer, { type: 'array' })`
>      - Get first sheet: `workbook.Sheets[workbook.SheetNames[0]]`
>      - Convert to array of arrays: `XLSX.utils.sheet_to_json(sheet, { header: 1 })`
>      - First row = headers, rest = data rows
>      - Convert all values to strings (numbers, dates → string)
>    - Validate: at least 1 header and 1 data row, throw descriptive error otherwise
>
> 3. Update `components/BatchGenerateModal.tsx`:
>    - Remove the inline `parseCSV()`, `parseLine()`, `parseQuotedField()`, `parseUnquotedField()` functions (~160 lines)
>    - Import `parseDataFile` from `lib/data-parser.ts` instead
>    - Update the file input to accept `.csv,.xlsx,.xls`
>    - File validation: accept CSV and Excel files
>
> 4. Run `npx tsc --noEmit` to verify

---

## Phase R2: Upload & Preview Overhaul

### Task R4: Rewrite UploadModal to accept images

**What**: Change the upload modal from accepting PDF files to accepting JPG/PNG images. The uploaded image is the "Reference Layer" — a photo of the physical certificate used for visual alignment only.

**Depends on**: Task R2 (schema rename pdf_url → image_url)

**Prompt**:
> Rewrite `components/UploadModal.tsx` to accept certificate images instead of PDFs:
>
> 1. Change file validation:
>    - Accept: `.jpg`, `.jpeg`, `.png` (NOT `.pdf`)
>    - MIME types: `image/jpeg`, `image/png`
>    - Keep 10MB max file size
>    - Update the drag-and-drop zone text: "Drag & drop a photo of your certificate" and "JPG or PNG, max 10MB"
>    - Update the file input `accept` attribute: `accept="image/jpeg,image/png,.jpg,.jpeg,.png"`
>
> 2. Update Supabase Storage upload:
>    - Storage path: `{userId}/{uuid}.{extension}` (use `.jpg` or `.png` based on the file)
>    - Set `contentType` to the actual file MIME type (`file.type`)
>    - Bucket name stays `templates`
>
> 3. Update the `createTemplate()` call:
>    - Pass the storage URL as `image_url` (or whatever the renamed parameter is after Task R2)
>
> 4. Update preview after file selection:
>    - Show an `<img>` thumbnail of the selected image (use `URL.createObjectURL(file)`)
>    - Remove any PDF-specific preview logic
>
> 5. Update error messages: "Please select an image file (JPG or PNG)" instead of "Please select a PDF file"
>
> The user is uploading a photo they took of their blank certificate paper. This image is ONLY used as a visual reference in the editor — it is never embedded in the generated PDF.
>
> Also: The Supabase Storage bucket `templates` needs its allowed MIME types updated. Since this is a hosted Supabase config, note in a comment that the user needs to go to Supabase Dashboard → Storage → templates bucket → Settings and update allowed MIME types to `image/jpeg, image/png` (or remove the restriction).

---

### Task R5: Rewrite PDFPreview → ImagePreview

**What**: Replace the PDF viewer component (`<object>/<iframe>`) with a simple image display component. The uploaded certificate photo is shown as a reference layer, with the CertificateCanvas overlaid on top for field positioning.

**Depends on**: Task R4 (uploads are now images)

**Prompt**:
> Rewrite `components/PDFPreview.tsx` into `components/ImagePreview.tsx`:
>
> 1. Rename the file from `PDFPreview.tsx` to `ImagePreview.tsx`
> 2. Rename the component from `PDFPreview` to `ImagePreview`
> 3. Update props:
>    - Rename `pdfUrl` → `imageUrl`
>    - Keep `aspectRatio` prop (default to A4: 210/297)
>    - Keep `children` prop (for the CertificateCanvas overlay)
>
> 4. Replace the rendering:
>    - REMOVE: `<object type="application/pdf">` and `<iframe>` fallback
>    - ADD: `<img src={imageUrl} alt="Certificate template" />` with:
>      - `className="absolute inset-0 w-full h-full object-contain"` to fill the container
>      - `draggable={false}` to prevent browser drag
>    - Keep the outer container with `position: relative` and the `aspect-ratio` CSS
>    - Keep the children overlay `<div className="absolute inset-0 z-canvas">` on top
>
> 5. Update all imports across the codebase:
>    - `components/EditorWorkspace.tsx`: change `import { PDFPreview }` → `import { ImagePreview }` and update JSX usage
>    - `app/(app)/editor/[templateId]/page.tsx`: rename `pdfSignedUrl` → `imageSignedUrl` in the prop
>    - `lib/actions/templates.ts`: rename `getSignedPdfUrl` → `getSignedImageUrl`
>
> 6. Delete any leftover PDF-specific CSS or logic
>
> The image is the "Reference Layer" — just a visual guide. The CertificateCanvas sits on top of it as a transparent overlay where the user positions their field stickers.

---

## Phase R3: Ghost Layer Generator

### Task R6: Rewrite generator.ts — Blank A4 pages

**What**: Rewrite the PDF generation engine to create blank white A4 pages with only text. No template fetching, no background image, no fontkit. This is the "Ghost Layer" — invisible text that aligns with pre-printed certificate paper.

**Depends on**: Task R1 (fontkit removed)

**Prompt**:
> Rewrite `lib/pdf/generator.ts` to implement the "Ghost Layer" generation model:
>
> **CRITICAL CHANGE**: The generator must create BLANK pages, not load template PDFs.
>
> 1. Remove the `templateUrl` field from `GeneratePDFInput`. The generator no longer needs a template URL.
>    - New required fields: `layout: LayoutField[]`, `userData: UserData`
>    - Keep optional fields: `coordinateMode`, `debug`, `customFonts` (for future use)
>
> 2. Rewrite `generatePDF()`:
>    - REMOVE: All template fetching code (fetch call, AbortController, timeout, error handling)
>    - REMOVE: `PDFDocument.load(templateBytes)` — don't load any external PDF
>    - REMOVE: `pdfDoc.registerFontkit(fontkit)` — fontkit is gone
>    - ADD: `const pdfDoc = await PDFDocument.create()`
>    - ADD: `const page = pdfDoc.addPage([595.28, 841.89])` — A4 size in PDF points
>    - Keep: `const { width: pageWidth, height: pageHeight } = page.getSize()`
>    - Keep: All the coordinate conversion logic (`convertCoordinates`, `percentageToPoints`)
>    - Keep: The `drawTextField()` function and text rendering logic
>    - Keep: The `hexToRgb()` color parser
>    - Keep: The alignment logic (`calculateAlignedX`)
>    - Keep: The debug visualization (`drawDebugBoundingBox`)
>    - Keep: The `uint8ArrayToBase64` helper
>
> 3. Simplify `loadFont()`:
>    - Only support standard PDF fonts from the `STANDARD_FONTS` map
>    - If a font name isn't found, log a warning and fall back to Helvetica
>    - Remove all custom font fetching, caching, and subsetting code
>    - Remove `fontCache`, `optimizedFontCache` Maps
>    - Keep it under 20 lines
>
> 4. Rewrite `generateBatchPDF()`:
>    - REMOVE: Template fetching (no `templateUrl` parameter)
>    - Each certificate: `PDFDocument.create()` → `addPage(A4)` → draw text → serialize
>    - Keep: The sequential generation pattern (memory-safe)
>    - Keep: The `UserData[]` parameter and per-certificate text rendering
>
> 5. Update exported types:
>    - Remove `templateUrl` from `GeneratePDFInput`
>    - Add `pageSize?: [number, number]` to allow custom page sizes (default A4)
>    - Keep `CoordinateMode`, `DebugOptions`, `UserData`, `GeneratePDFResult`, `OutputFormat`
>
> 6. Add A4 constants at the top:
>    ```typescript
>    /** A4 page dimensions in PDF points (1 point = 1/72 inch) */
>    const A4_WIDTH = 595.28;
>    const A4_HEIGHT = 841.89;
>    ```
>
> The generated PDF is a "Ghost Layer" — blank pages with only text. The user prints this on pre-printed fancy certificate paper. The text lands on the right spots because the coordinates were calibrated using the reference image in the editor.

---

### Task R7: Update generate.ts server actions

**What**: Update the server actions for PDF generation to use the new blank-page generator. Remove template PDF fetching since generation no longer needs the uploaded image.

**Depends on**: Task R6 (generator rewritten)

**Prompt**:
> Update `lib/actions/generate.ts` to work with the new Ghost Layer generator:
>
> 1. Update `generateCertificate()`:
>    - Still fetch template + layout via `getTemplate()` (need the layout config)
>    - REMOVE: `template.pdf_url` / `template.image_url` usage — generation doesn't need the image
>    - REMOVE: The check `if (!template.pdf_url)` — image is irrelevant for generation
>    - Update the `generatePDF()` call: remove `templateUrl` parameter
>    - Pass only: `{ layout: layout.config, userData: data, coordinateMode: 'percentage' }`
>
> 2. Update `generateBatchCertificates()`:
>    - Same changes: remove image URL from the `generateBatchPDF()` call
>    - Update the function signature for `generateBatchPDF()` — no `templateUrl` parameter
>    - Keep the merge logic (PDFDocument.create → copyPages → single merged PDF)
>    - Keep the max 50 batch size limit
>    - Keep the `{ data, error }` return pattern
>
> 3. Keep all auth checks, input validation, and error handling
>
> 4. Run `npx tsc --noEmit` to verify

---

## Phase R4: Data-Driven Editor

### Task R8: Add data file upload to the editor

**What**: Add a CSV/Excel file upload zone in the editor that reads column headers and auto-creates draggable field stickers. This is the core workflow change — fields come from the data, not manual creation.

**Depends on**: Task R3 (data parser utility), Task R5 (ImagePreview)

**Prompt**:
> Add data-driven field creation to `components/EditorWorkspace.tsx`:
>
> 1. Add a "Data Source" section in the top toolbar (or as a collapsible panel):
>    - File upload button: "Import Data (CSV/Excel)"
>    - Accept `.csv`, `.xlsx`, `.xls` files
>    - When a file is uploaded, use `parseDataFile()` from `lib/data-parser.ts`
>    - Store the parsed data in state: `const [parsedData, setParsedData] = useState<ParsedData | null>(null)`
>    - Show a chip/badge with the filename and row count: "data.xlsx (50 rows)"
>    - "Clear" button to remove the data source
>
> 2. Auto-create fields from column headers:
>    - When `parsedData` changes and has headers, auto-generate one `CanvasField` per header:
>      - `id`: generate a UUID
>      - `label`: the column header name (e.g., "Name", "Score")
>      - `type`: "text" (all columns default to text)
>      - `position`: spread them vertically down the center ({x: 0.5, y: 0.1}, {x: 0.5, y: 0.2}, etc.)
>      - `font`: "Helvetica", `size`: 16, `color`: "#000000", `align`: "center"
>      - `value`: first row's value for that column (preview text, e.g., "Aliyev Veli")
>    - If fields already exist (user saved a layout previously), DON'T overwrite — keep existing positions
>    - Only create fields for NEW columns that don't already have a matching field label
>
> 3. Update the "Generate" and "Batch Generate" buttons:
>    - "Generate" (single): opens GenerateModal as before (fill in values manually)
>    - "Batch Generate": ONLY enabled when `parsedData` is loaded. Pass the parsed data rows directly instead of requiring a separate CSV upload in the BatchGenerateModal
>
> 4. Keep the manual "Add Field" functionality in FieldPanel as a secondary option (for static labels like "Certificate of Achievement" that aren't from the data)
>
> 5. Store parsed data in component state only — NOT in the database. The data file changes per batch run. Only the field positions/styles (layout config) are saved to Supabase.
>
> Style the data upload area cleanly with the existing "Admin Vibe" aesthetic. Show the parsed data as a small indicator, not a full table (the table preview is in the BatchGenerateModal).

---

### Task R9: Update FieldPanel for data-driven workflow

**What**: Shift the FieldPanel from "create fields manually" to "style existing fields from data". Keep manual field creation as a secondary option for static text.

**Depends on**: Task R8 (fields auto-created from data)

**Prompt**:
> Update `components/FieldPanel.tsx` for the data-driven workflow:
>
> 1. Reorder the panel sections:
>    - **Top**: Field list (scrollable) — shows all fields with their labels as "sticker" badges
>    - Show a colored badge indicating source: "Data" (blue badge) for auto-created fields from CSV/Excel, "Static" (gray badge) for manually added fields
>    - Click to select (same as before)
>    - Delete button only on "Static" fields. "Data" fields can be hidden but not deleted
>
> 2. **Middle**: Properties section (shown when a field is selected) — keep as-is:
>    - Label (read-only for data fields, editable for static fields)
>    - Font dropdown
>    - Size dropdown
>    - Color picker
>    - Bold / Italic toggles
>    - Alignment (left/center/right)
>
> 3. **Bottom**: "Add Static Field" button (replaces the old "Add Text" / "Add Date" buttons)
>    - Opens a small inline form: label input + "Add" button
>    - Creates a field with source: "static"
>    - Use case: adding text like "Certificate of Achievement" that doesn't come from data
>
> 4. Add a `source` property to `CanvasField` type in `CertificateCanvas.tsx`:
>    - `source?: 'data' | 'static'` — optional, defaults to 'static' for backward compat
>    - Data-sourced fields show the column header as their label
>    - Static fields show user-typed label
>
> 5. The field list should clearly show which fields are from the data and which are static, so the user understands the difference.

---

## Phase R5: Generation UI Updates

### Task R10: Update GenerateModal

**What**: Adjust the single-certificate generation modal to work with the new data-driven field flow. Fields now come from data columns (auto-created), and form inputs should use data column labels.

**Depends on**: Task R7 (server actions updated), Task R8 (data-driven fields)

**Prompt**:
> Update `components/GenerateModal.tsx` for the Ghost Layer workflow:
>
> 1. The form should still auto-generate one input per field (same as before)
> 2. If parsed data is available (passed as prop), pre-fill inputs with the FIRST row's values:
>    - Props: add `initialData?: Record<string, string>` — pre-populated from first data row
>    - Each field input shows the first row's value as initial content
>    - User can edit before generating (useful for testing alignment)
>
> 3. Add a note below the form: "This generates a blank page with text only — print on your pre-printed certificate paper"
>
> 4. Update the download filename: `{templateName}_test_{date}.pdf` (indicate it's a test/single print)
>
> 5. Keep everything else: loading spinner, error handling, base64-to-Blob download, Escape/backdrop close
>
> The GenerateModal is primarily for testing — the user generates one certificate to check if the text lands on the right spots before committing to a full batch.

---

### Task R11: Update BatchGenerateModal with data pass-through

**What**: Update the batch modal to accept already-parsed data from the editor (when user uploaded CSV/Excel via the toolbar) and also keep the standalone CSV/Excel upload as fallback.

**Depends on**: Task R3 (data parser), Task R7 (server actions)

**Prompt**:
> Update `components/BatchGenerateModal.tsx`:
>
> 1. Add props for pre-loaded data:
>    - `preloadedData?: ParsedData` — data already parsed from the editor's file upload
>    - If `preloadedData` is provided, skip Step 1 (file upload) and go directly to the column mapping / confirmation step
>    - If no `preloadedData`, show the file upload step as before (fallback)
>
> 2. Update file upload to accept Excel:
>    - Change `accept=".csv"` → `accept=".csv,.xlsx,.xls"`
>    - Use `parseDataFile()` from `lib/data-parser.ts` instead of the inline CSV parser
>    - The inline CSV parser code has already been moved to `lib/data-parser.ts` in Task R3
>
> 3. Add a note in the confirmation step: "Each certificate will be a blank page with text positioned at your saved coordinates. Print the output on your pre-printed certificate paper."
>
> 4. Update download filename: `{templateName}_batch_{date}.pdf`
>
> 5. Keep everything else: column mapping, chunk-based generation (50/chunk), progress bar, error tracking, download

---

## Phase R6: Integration & Verification

### Task R12: Update dashboard for image thumbnails

**What**: Update the template card on the dashboard to show a small thumbnail of the uploaded certificate image instead of a generic PDF icon.

**Depends on**: Task R2 (schema rename), Task R4 (images uploaded)

**Prompt**:
> Update the dashboard to show image thumbnails:
>
> 1. `components/TemplateCard.tsx`:
>    - Add a thumbnail section at the top of each card
>    - Fetch a signed URL for the image (reuse `getSignedImageUrl()` or create a thumbnail URL)
>    - Show the image as a small preview: `<img>` with fixed height (~120px), `object-cover`, rounded top corners
>    - If image fails to load, show a gray placeholder with an image icon
>    - Keep: template name, created date, Edit/Delete buttons
>
> 2. `components/DashboardContent.tsx`:
>    - Update the empty state text: "No templates yet — upload a photo of your certificate to get started"
>
> 3. `app/(app)/dashboard/page.tsx`:
>    - For each template, generate a signed image URL server-side and pass it to the card
>    - This avoids making N separate signed URL requests from the client
>
> Style thumbnails with the "Admin Vibe" aesthetic — subtle border, rounded corners, consistent card height.

---

### Task R13: Full flow test and build verification

**What**: Run the complete build, verify no type errors, and test the end-to-end flow: upload image → import data → position fields → save → generate single → generate batch.

**Depends on**: All previous tasks

**Prompt**:
> Run final verification on the Certificator project:
>
> 1. Run `npx tsc --noEmit` — fix any type errors
> 2. Run `npm run build` — fix any build errors
> 3. Run `npm run lint` — fix any lint errors (if eslint configured)
>
> 4. Manual verification checklist (document what to test):
>    - [ ] Upload a JPG/PNG photo of a certificate → appears on dashboard
>    - [ ] Click Edit → image shows as reference layer in editor
>    - [ ] Import CSV/Excel → column stickers auto-appear on canvas
>    - [ ] Drag stickers to position them on the certificate image
>    - [ ] Style a field: change font size, color, alignment
>    - [ ] Save layout → reload page → positions preserved
>    - [ ] Generate single → downloads a blank PDF with text at correct positions
>    - [ ] Generate batch → downloads multi-page PDF, one blank page per data row
>    - [ ] Print test: print a generated PDF on plain paper, overlay on the certificate → text aligns
>
> 5. Verify no leftover references to:
>    - `pdf_url` (should all be `image_url`)
>    - `font-optimizer` (should be deleted)
>    - `fontkit` or `@pdf-lib/fontkit` (should be uninstalled)
>    - `PDFDocument.load` in the generator (should only use `PDFDocument.create`)

---

## Quick Reference: Build Order

```
Wave A (parallel — no dependencies):
  Task R1 ──── Remove font-optimizer + fontkit
  Task R2 ──── Schema migration (pdf_url → image_url)
  Task R3 ──── Install xlsx + data parser utility

Wave B (depends on Wave A):
  Task R4 ──── Rewrite UploadModal (images) ............ needs R2
  Task R5 ──── PDFPreview → ImagePreview ............... needs R4
  Task R6 ──── Rewrite generator.ts (blank pages) ..... needs R1

Wave C (depends on Wave B):
  Task R7 ──── Update generate.ts server actions ....... needs R6
  Task R8 ──── Data file upload in editor .............. needs R3, R5

Wave D (depends on Wave C):
  Task R9 ──── Update FieldPanel (data-driven) ......... needs R8
  Task R10 ─── Update GenerateModal .................... needs R7, R8
  Task R11 ─── Update BatchGenerateModal ............... needs R3, R7

Wave E (depends on Wave D):
  Task R12 ─── Dashboard image thumbnails .............. needs R2, R4
  Task R13 ─── Full flow test + build verification ..... needs ALL
```

**13 tasks across 5 waves.** Each wave can be executed in parallel within itself.
