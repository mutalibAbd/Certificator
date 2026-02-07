# PDF-Only Template Migration Plan

## Motivation

The project has suffered from persistent coordinate disagreement between the browser canvas editor and PDF export. The root cause is `computePageSize()` in `lib/pdf/dimensions.ts` — a heuristic that converts image pixel dimensions to PDF points by scaling the longest edge to 841.89pt. This indirect mapping introduces rounding errors and mismatches that have required three consecutive fix commits and still cannot guarantee pixel-perfect alignment.

**By accepting only PDF templates**, the page dimensions are known exactly in PDF points from the source file. No heuristic, no conversion, no disagreement.

### What we gain

- **Exact coordinates**: PDF page size in points comes directly from the file — both the editor and generator use the same values
- **Simpler pipeline**: Remove `computePageSize()`, `computeAspectRatio()`, and `getImageDimensions()`
- **Better template fidelity**: Vector graphics, embedded fonts, and sharp text are preserved (no rasterization)
- **Smaller output files**: Text overlay on existing PDF pages vs embedding a full raster image

### What remains unchanged

- Normalized coordinates (0-1) for field positioning
- Y-axis inversion in `percentageToPoints()` (browser top-left vs PDF bottom-left)
- Drag-and-drop field editing with `@dnd-kit`
- Ghost layer export (text-only PDF for pre-printed paper)

---

## Phase 1: Remove PNG/JPEG Code

### Files to delete

| File | Reason |
|------|--------|
| `components/ImagePreview.tsx` | Renders `<Image>` background for PNG/JPEG templates. Replaced by `PdfPreview`. |

### Functions to remove

| File | Function/Code | Reason |
|------|---------------|--------|
| `components/UploadModal.tsx` | `getImageDimensions()` (lines 32-44) | Extracts pixel dimensions via `Image.naturalWidth/Height`. Replaced by PDF dimension extraction. |
| `lib/pdf/dimensions.ts` | `computePageSize()` | Pixel-to-point heuristic — source of coordinate bugs. |
| `lib/pdf/dimensions.ts` | `computeAspectRatio()` | Wrapper for `width_px / height_px`. Replaced by direct `width_pt / height_pt`. |
| `components/CertificateCanvas.tsx` | `backgroundUrl` prop + `<Image>` block (lines 372-383) | Background rendering moves to `PdfPreview` parent component. |

### Constants/config to remove

| File | Item | Reason |
|------|------|--------|
| `components/UploadModal.tsx` | `ACCEPTED_MIME_TYPES` (`image/jpeg`, `image/png`) | Replace with `application/pdf`. |
| `components/UploadModal.tsx` | `ACCEPTED_EXTENSIONS` (`.jpg`, `.jpeg`, `.png`) | Replace with `.pdf`. |
| `components/UploadModal.tsx` | `import Image from 'next/image'` | No longer rendering image thumbnails. |
| `components/CertificateCanvas.tsx` | `import Image from 'next/image'` | Background image removed from this component. |
| `components/TemplateCard.tsx` | `import Image from 'next/image'` | Template thumbnails change to PDF icon. |

### Database columns to drop

| Column | Replacement |
|--------|-------------|
| `templates.image_url` | `templates.pdf_url` |
| `templates.width_px` | `templates.width_pt` (NUMERIC, PDF points) |
| `templates.height_px` | `templates.height_pt` (NUMERIC, PDF points) |

---

## Phase 2: Implementation Steps

### Step 1 — Install pdfjs-dist and configure worker

**Files**: `package.json`, `next.config.ts`, new `lib/pdf/pdfjs-setup.ts`

Install `pdfjs-dist` for client-side PDF rendering:

```bash
npm install pdfjs-dist
```

Create `lib/pdf/pdfjs-setup.ts`:

```ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export { pdfjsLib };
```

Update `next.config.ts`:

```ts
serverExternalPackages: ['pdf-lib', '@pdf-lib/fontkit'],
// Add webpack alias to prevent pdf.js from importing node canvas
webpack: (config) => {
  config.resolve.alias.canvas = false;
  return config;
},
```

> **Note**: `pdfjs-dist` is client-side only. Do NOT add it to `serverExternalPackages`.

---

### Step 2 — Database migration

**New file**: `supabase/migrations/20240105000000_pdf_only_templates.sql`

```sql
-- Rename image_url back to pdf_url
ALTER TABLE public.templates RENAME COLUMN image_url TO pdf_url;

-- Update constraint
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_image_url_not_empty;
ALTER TABLE public.templates ADD CONSTRAINT templates_pdf_url_not_empty
  CHECK (char_length(pdf_url) > 0);

-- Replace pixel dimensions with PDF point dimensions
ALTER TABLE public.templates DROP COLUMN IF EXISTS width_px;
ALTER TABLE public.templates DROP COLUMN IF EXISTS height_px;
ALTER TABLE public.templates ADD COLUMN width_pt NUMERIC NULL;
ALTER TABLE public.templates ADD COLUMN height_pt NUMERIC NULL;

COMMENT ON COLUMN public.templates.pdf_url IS
  'URL to the certificate PDF template in Supabase Storage';
COMMENT ON COLUMN public.templates.width_pt IS
  'PDF page width in points (1pt = 1/72 inch)';
COMMENT ON COLUMN public.templates.height_pt IS
  'PDF page height in points (1pt = 1/72 inch)';

-- Restrict storage bucket to PDF only
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'templates';
```

---

### Step 3 — Update TypeScript types

**File**: `types/database.types.ts`

```ts
export interface Template {
  id: string;
  owner_id: string;
  pdf_url: string;           // was image_url
  name: string;
  created_at: string;
  width_pt: number | null;   // PDF points (was width_px)
  height_pt: number | null;  // PDF points (was height_px)
}
```

Apply the same renames to `TemplateInsert` and `TemplateUpdate`.

---

### Step 4 — Update template server actions

**File**: `lib/actions/templates.ts`

| Change | Details |
|--------|---------|
| `createTemplate()` params | `imageUrl` -> `pdfUrl`, `widthPx/heightPx` -> `widthPt/heightPt` |
| `createTemplate()` payload | `image_url` -> `pdf_url`, `width_px` -> `width_pt`, `height_px` -> `height_pt` |
| `deleteTemplate()` | `.image_url` -> `.pdf_url` |
| `getSignedImageUrl()` | Rename to `getSignedPdfUrl()` |
| `getSignedImageUrls()` | Rename to `getSignedPdfUrls()` |

---

### Step 5 — Create PDF dimension extraction utility

**New file**: `lib/pdf/extract-dimensions.ts`

Client-side extraction using pdfjs-dist (for UploadModal):

```ts
import { pdfjsLib } from './pdfjs-setup';

export interface PdfDimensions {
  widthPt: number;
  heightPt: number;
  pageCount: number;
}

export async function extractPdfDimensions(file: File): Promise<PdfDimensions> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 }); // scale=1 = PDF points

  return {
    widthPt: viewport.width,
    heightPt: viewport.height,
    pageCount: pdf.numPages,
  };
}
```

Server-side extraction using pdf-lib (for server actions if needed):

```ts
import { PDFDocument } from 'pdf-lib';

export async function extractPdfDimensionsFromBytes(pdfBytes: Uint8Array): Promise<PdfDimensions> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(0);
  const { width, height } = page.getSize();
  return { widthPt: width, heightPt: height, pageCount: doc.getPageCount() };
}
```

---

### Step 6 — Rewrite UploadModal for PDF input

**File**: `components/UploadModal.tsx`

Key changes:
- `ACCEPTED_MIME_TYPES` = `Set(['application/pdf'])`
- `ACCEPTED_EXTENSIONS` = `Set(['.pdf'])`
- Replace `getImageDimensions()` call with `extractPdfDimensions()`
- State: `imageDimensions` -> `pdfDimensions: PdfDimensions | null`
- Replace `<Image>` thumbnail with a PDF icon + dimension info
- Show warning when `pageCount > 1`: "Only page 1 will be used as the template"
- Call `createTemplate(name, url, pdfDimensions.widthPt, pdfDimensions.heightPt)`
- Update all user-facing copy: "photo" -> "PDF", "JPG or PNG" -> "PDF"
- File input `accept` attribute: `"application/pdf,.pdf"`

---

### Step 7 — Create PdfPreview component

**New file**: `components/PdfPreview.tsx`

Replaces `ImagePreview.tsx`. Renders page 1 of a PDF onto a `<canvas>` element using pdfjs-dist.

Key design:
- Accept props: `pdfUrl: string`, `aspectRatio: number`, `children?: ReactNode`
- On mount, load PDF with `pdfjsLib.getDocument(pdfUrl)`
- Render page 1 to a `<canvas>` element
- Use `ResizeObserver` to re-render on container resize
- Render at `devicePixelRatio` (capped at 2x) for crisp display
- Cache the `PDFDocumentProxy` to avoid re-parsing on resize
- Show loading spinner until canvas is rendered
- Children are overlaid via `position: absolute` (same pattern as `ImagePreview`)

---

### Step 8 — Update EditorWorkspace

**File**: `components/EditorWorkspace.tsx`

```ts
import { PdfPreview } from '@/components/PdfPreview';
import { A4_WIDTH, A4_HEIGHT } from '@/lib/pdf/dimensions';

// Direct dimension access — no heuristic
const widthPt = template.width_pt ?? A4_WIDTH;
const heightPt = template.height_pt ?? A4_HEIGHT;
const aspectRatio = widthPt / heightPt;
const pdfPageHeight = heightPt;
```

Replace `<ImagePreview>` with `<PdfPreview>` in JSX. Rename prop `imageSignedUrl` to `pdfSignedUrl`.

---

### Step 9 — Simplify CertificateCanvas

**File**: `components/CertificateCanvas.tsx`

- Remove `backgroundUrl` prop
- Remove `import Image from 'next/image'`
- Remove the `{backgroundUrl && <Image ...>}` JSX block
- The component becomes a pure transparent field overlay

---

### Step 10 — Update editor page

**File**: `app/(app)/editor/[templateId]/page.tsx`

```ts
import { getTemplate, getSignedPdfUrl } from '@/lib/actions/templates';

const { data: signedUrl } = await getSignedPdfUrl(template.pdf_url);
return <EditorWorkspace template={template} pdfSignedUrl={signedUrl ?? template.pdf_url} />;
```

---

### Step 11 — Update PDF generation actions

**File**: `lib/actions/generate.ts`

Replace all three `computePageSize()` calls:

```ts
const pageSize: [number, number] = [
  template.width_pt ?? A4_WIDTH,
  template.height_pt ?? A4_HEIGHT,
];
```

This is the change that **directly fixes the coordinate bug**. Instead of a pixel-to-point heuristic, we use the exact PDF dimensions.

---

### Step 12 — Update Dashboard and TemplateCard

**Files**: `app/(app)/dashboard/page.tsx`, `components/DashboardContent.tsx`, `components/TemplateCard.tsx`

- Rename `getSignedImageUrls` -> `getSignedPdfUrls`
- Rename `signedImageUrl` -> `signedPdfUrl` throughout
- Replace `<Image>` thumbnail in `TemplateCard` with a PDF file icon placeholder
- Update empty-state and UI copy: "photo" -> "PDF template"

> PDF canvas thumbnails on the dashboard are a future enhancement. For now, a static PDF icon keeps the dashboard fast and avoids loading pdfjs-dist on that route.

---

### Step 13 — Clean up dimensions.ts

**File**: `lib/pdf/dimensions.ts`

Reduce to constants only:

```ts
/** A4 page dimensions in PDF points (1pt = 1/72 inch) */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
```

Delete `computePageSize()` and `computeAspectRatio()`. Update `lib/pdf/index.ts` exports.

---

## Phase 3: Design Decisions

### Multi-page PDF templates

- Only page 1 is used as the template
- `extractPdfDimensions()` returns `pageCount`
- UploadModal shows a warning if `pageCount > 1`
- Future extension: add a `page` field to `LayoutField` if multi-page is ever needed

### Ghost layer vs template overlay

- **Ghost layer** (text-only PDF) remains the default — matches the current pre-printed paper use case
- **Template overlay** (text on top of template PDF) is a future enhancement
  - Would use `PDFDocument.copyPages()` from pdf-lib to embed the template page
  - Add a "Include template background" toggle in GenerateModal
  - Requires downloading template PDF bytes server-side during generation

### Existing image-based templates

- After migration, existing templates will have valid Storage URLs in `pdf_url` but the files are actually PNG/JPEG
- `PdfPreview` should handle this gracefully: if pdf.js fails to render, show a message prompting the user to re-upload as PDF
- No data migration needed — old templates degrade gracefully

---

## Phase 4: Performance Improvements

### Font caching

| Improvement | Details |
|-------------|---------|
| **Deprecate `generateBatchPDF`** | Use `generateMergedBatchPDF` exclusively — it loads fonts once and reuses across pages |
| **Pre-warm font cache** | Add an endpoint or server action that pre-fetches all configured Google Font TTFs on first use |
| **Local font files** | Bundle frequently-used Google Font TTFs in `public/fonts/` to eliminate external API dependency at generation time |

### PDF rendering in browser

| Improvement | Details |
|-------------|---------|
| **Canvas caching** | After rendering a PDF page, cache the canvas ImageData. Re-render only when container size changes by >50px. |
| **Resolution cap** | Render at `devicePixelRatio` but cap at 2x to limit memory. A 1000px container at 2x = 2000px canvas. |
| **Lazy dashboard thumbnails** | If PDF thumbnails are added to the dashboard later, use `IntersectionObserver` to render only visible cards. |
| **Worker reuse** | pdf.js already uses a Web Worker for parsing. Ensure the worker is a singleton via `pdfjs-setup.ts`. |

### Bundle size management

| Concern | Mitigation |
|---------|------------|
| **pdfjs-dist ~250KB gzipped** | Dynamic import in `PdfPreview` and `UploadModal` only. Never import in server components. |
| **pdf.js worker ~100KB** | Loaded as a separate Web Worker — does not count toward main JS bundle. |
| **Route-based splitting** | Dashboard page does NOT load pdf.js (uses icon thumbnails). Only editor + upload modal load it. |
| **Minimal build** | Use `pdfjs-dist/build/pdf.min.mjs` for the smallest client bundle. |

### Batch generation

| Improvement | Details |
|-------------|---------|
| **Template PDF caching** | If overlay mode is added, download template bytes once and reuse across all pages in a batch |
| **Chunk size** | Keep at 50 (matches `MAX_BATCH_SIZE` in `generate.ts`) to stay within Vercel memory limits |
| **Font deduplication** | `generateMergedBatchPDF` already embeds fonts once per document — no change needed |

---

## File Change Summary

| Action | File |
|--------|------|
| **Delete** | `components/ImagePreview.tsx` |
| **Create** | `lib/pdf/pdfjs-setup.ts` |
| **Create** | `lib/pdf/extract-dimensions.ts` |
| **Create** | `components/PdfPreview.tsx` |
| **Create** | `supabase/migrations/20240105000000_pdf_only_templates.sql` |
| **Rewrite** | `components/UploadModal.tsx` |
| **Modify** | `types/database.types.ts` |
| **Modify** | `lib/actions/templates.ts` |
| **Modify** | `lib/actions/generate.ts` |
| **Modify** | `lib/pdf/dimensions.ts` (reduce to constants) |
| **Modify** | `lib/pdf/index.ts` |
| **Modify** | `components/EditorWorkspace.tsx` |
| **Modify** | `components/CertificateCanvas.tsx` |
| **Modify** | `components/TemplateCard.tsx` |
| **Modify** | `components/DashboardContent.tsx` |
| **Modify** | `app/(app)/editor/[templateId]/page.tsx` |
| **Modify** | `app/(app)/dashboard/page.tsx` |
| **Modify** | `next.config.ts` |
