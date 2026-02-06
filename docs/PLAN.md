# Certificator — Remaining Work: Task List with Prompts

## Phase 2: Authentication & Middleware

### Task 1: Supabase Auth — Middleware & Route Protection ✅ DONE

**What**: Create `middleware.ts` at project root that refreshes auth sessions and protects app routes. Unauthenticated users get redirected to `/login`.

**Depends on**: Nothing (foundational)

**Completed**: `middleware.ts` created — session refresh via `getUser()`, route protection for `/dashboard`, `/editor`, `/api` (except `/api/system/pulse`), auth redirects for `/login` and `/signup`, defensive env guard.

**Prompt**:
> Create a Next.js middleware.ts at the project root using @supabase/ssr. It must:
> 1. Call `updateSession()` to refresh the Supabase auth cookie on every request
> 2. Protect all routes under `/dashboard`, `/editor`, and `/api` (except `/api/system/pulse`) — redirect unauthenticated users to `/login`
> 3. Redirect already-authenticated users away from `/login` and `/signup` to `/dashboard`
> 4. Export a `config.matcher` that excludes static files, `_next`, and public assets
>
> Use the existing Supabase server client pattern from `utils/supabase/server.ts`. Follow the project's zero-cost, defensive coding philosophy from `.github/copilot-instructions.md`. No paid services. Keep it simple.

---

### Task 2: Login & Signup Pages ✅ DONE

**What**: Create `/login` and `/signup` pages with email/password auth using Supabase. Clean "Admin Vibe" aesthetic.

**Depends on**: Task 1

**Completed**: `app/(auth)/layout.tsx` (centered card layout), `app/(auth)/login/page.tsx` + `LoginForm.tsx` + `actions.ts` (email/password sign-in with Server Actions), `app/(auth)/signup/page.tsx` + `SignupForm.tsx` + `actions.ts` (sign-up with confirm password validation), `components/SubmitButton.tsx` (reusable loading-state form button).

**Prompt**:
> Create login and signup pages for Certificator using Supabase Auth:
>
> 1. `app/(auth)/login/page.tsx` — email + password form, "Sign In" button, link to signup, error display
> 2. `app/(auth)/signup/page.tsx` — email + password + confirm password form, "Create Account" button, link to login, error display
> 3. `app/(auth)/layout.tsx` — centered card layout on slate-50 background, the project's "Admin Vibe" aesthetic
>
> Use Server Actions for form submission (not client-side fetch). Use `utils/supabase/server.ts` `createClient()` for auth calls. After successful login redirect to `/dashboard`. After signup show a "Check your email" confirmation message.
>
> Style with Tailwind CSS using the existing design system in `globals.css` (use the CSS variables: `--background`, `--foreground`, `--primary`, etc.). Forms must show loading state on submit. All inputs must have proper labels, and the forms must be accessible.
>
> Do NOT use any auth libraries — just `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()`. Do NOT add OAuth providers yet.

---

### Task 3: Auth Callback Route ✅ DONE

**What**: Handle Supabase email confirmation callback that exchanges the code for a session.

**Depends on**: Task 2

**Completed**: `app/(auth)/auth/callback/route.ts` — GET handler that exchanges auth code for session and redirects to `/dashboard` on success or `/login?error=auth_failed` on failure.

**Prompt**:
> Create `app/(auth)/auth/callback/route.ts` — a GET route handler that:
> 1. Reads the `code` query parameter from the URL
> 2. Uses the Supabase server client to call `exchangeCodeForSession(code)`
> 3. On success, redirects to `/dashboard`
> 4. On failure, redirects to `/login?error=auth_failed`
>
> Use the existing `utils/supabase/server.ts` server client. Use `next/navigation` redirect. Keep it minimal and defensive.

---

## Phase 3: Storage & Template CRUD

### Task 4: Supabase Storage Setup Migration ✅ DONE

**What**: Create a SQL migration to set up the `templates` storage bucket with RLS policies.

**Depends on**: Nothing (can run in parallel with auth tasks)

**Completed**: `supabase/migrations/20240102000000_storage_setup.sql` created — `templates` bucket (private, 10MB limit, PDF only), 4 RLS policies on `storage.objects` (INSERT/SELECT/UPDATE/DELETE scoped to user's UUID folder).

**Prompt**:
> Create a new Supabase migration file at `supabase/migrations/20240102000000_storage_setup.sql` that:
> 1. Creates a `templates` storage bucket (public: false) using `INSERT INTO storage.buckets`
> 2. Adds RLS policies on `storage.objects` for the `templates` bucket:
>    - Users can upload files to their own folder: `auth.uid()::text = (storage.foldername(name))[1]`
>    - Users can read their own uploads
>    - Users can delete their own uploads
> 3. Set file size limit to 10MB, allowed MIME types: `application/pdf`
>
> Follow the project's idempotent SQL style (use IF NOT EXISTS where possible). Comment every policy explaining what it does. Reference the Architect agent persona in `.github/agent/architect.md` for style.

---

### Task 5: Template Server Actions (CRUD) ✅ DONE

**What**: Server actions for creating, reading, updating, and deleting templates. Includes file upload to Supabase Storage.

**Depends on**: Task 4

**Completed**: `lib/actions/templates.ts` — 5 server actions (`createTemplate`, `getTemplates`, `getTemplate`, `deleteTemplate`, `renameTemplate`) with `{ data, error }` return pattern, storage cleanup on delete, `table()` helper for SDK type workaround.

**Prompt**:
> Create `lib/actions/templates.ts` with the following Server Actions using `"use server"`:
>
> 1. `uploadTemplate(formData: FormData)` — accepts a PDF file + name string:
>    - Validates file is PDF and under 10MB
>    - Uploads to Supabase Storage bucket `templates` under path `{userId}/{uuid}.pdf`
>    - Inserts row into `templates` table with the storage URL
>    - Returns the new template object or error
>
> 2. `getTemplates()` — fetches all templates for the current user, ordered by `created_at DESC`
>
> 3. `getTemplate(id: string)` — fetches single template with its layout (join `layouts` table)
>
> 4. `deleteTemplate(id: string)` — deletes the template row AND the storage file
>
> 5. `renameTemplate(id: string, name: string)` — updates template name
>
> Use the server Supabase client from `utils/supabase/server.ts`. Use types from `types/database.types.ts`. Return `{ data, error }` pattern consistently. Handle errors defensively (Supabase might be slow or paused). Revalidate path `/dashboard` after mutations using `revalidatePath`.

---

### Task 6: Layout Server Actions (CRUD) ✅ DONE

**What**: Server actions for saving and loading layout field configurations.

**Depends on**: Task 5

**Completed**: `lib/actions/layouts.ts` — 3 server actions (`saveLayout` upsert, `getLayout`, `deleteLayout`) with `{ data, error }` return pattern, select-then-insert/update pattern for upsert, same `table()` helper for SDK type workaround.

**Prompt**:
> Create `lib/actions/layouts.ts` with the following Server Actions using `"use server"`:
>
> 1. `saveLayout(templateId: string, config: LayoutField[])` — upserts layout for a template:
>    - If layout exists for this template, UPDATE the `config` JSONB
>    - If no layout exists, INSERT a new one
>    - Use the existing `LayoutField` type from `types/database.types.ts`
>    - Return the saved layout or error
>
> 2. `getLayout(templateId: string)` — fetches the layout config for a template
>
> 3. `deleteLayout(templateId: string)` — deletes the layout for a template
>
> Use server Supabase client. The JSONB `config` column stores `LayoutField[]`. All coordinates in the config are normalized (0-1). Keep it simple — no validation beyond type safety. Return `{ data, error }` pattern.

---

## Phase 4: Dashboard & Template Management UI

### Task 7: Dashboard Layout & Navigation ✅ DONE

**What**: Create the authenticated app shell with a header/nav and layout wrapper for all `/dashboard` routes.

**Depends on**: Task 1 (middleware)

**Completed**: `app/(app)/layout.tsx` (server component with user fetch, header with sign-out form, `ToastProvider` wrapper), `app/(app)/actions.ts` (`signOut` server action).

**Prompt**:
> Create the authenticated app layout:
>
> 1. `app/(app)/layout.tsx` — wraps all authenticated pages:
>    - Header with: app name "Certificator" on the left, user email + "Sign Out" button on the right
>    - Sign out uses a Server Action calling `supabase.auth.signOut()` then redirects to `/login`
>    - Main content area with max-width container and padding
>    - Use the "Admin Vibe" aesthetic: `bg-slate-50` background, white content cards with subtle shadows
>
> 2. This layout should fetch the current user session server-side using the Supabase server client
>    - If no session, redirect to `/login` (defense in depth, middleware already handles this)
>
> Style with Tailwind CSS using the project's existing CSS variables. Keep it minimal and professional. No sidebar — just a clean top header.

---

### Task 8: Dashboard Page — Template List ✅ DONE

**What**: The main dashboard showing all user templates as a grid of cards with upload button.

**Depends on**: Task 5, Task 7

**Completed**: `app/(app)/dashboard/page.tsx` (server component fetching templates), `components/DashboardContent.tsx` (client wrapper managing modal state, responsive grid, empty state), `components/TemplateCard.tsx` (card with edit/delete, `useTransition` for delete, toast notifications).

**Prompt**:
> Create `app/(app)/dashboard/page.tsx` — the main dashboard page:
>
> 1. Fetch templates using the `getTemplates()` server action from `lib/actions/templates.ts`
> 2. Display as a responsive grid of template cards (1 col mobile, 2 col tablet, 3 col desktop)
> 3. Each card shows:
>    - Template name
>    - Created date (formatted nicely)
>    - "Edit" button → navigates to `/editor/{templateId}`
>    - "Delete" button → calls `deleteTemplate()` with confirmation dialog
> 4. "Upload New Template" card/button at the start of the grid — opens an upload modal or navigates to upload page
> 5. Empty state: when no templates, show centered message "No templates yet — upload your first PDF to get started" with upload button
>
> Use Tailwind CSS with the project's "Admin Vibe" aesthetic. Cards should be white with subtle border and shadow on hover. Use `Inter` font. Loading states must be visible (use `useTransition` for delete actions).
>
> Create a separate client component `components/TemplateCard.tsx` for the card with delete functionality and `components/UploadModal.tsx` for the upload form.

---

### Task 9: Template Upload Component ✅ DONE

**What**: Modal or form to upload a PDF template file with name input.

**Depends on**: Task 5, Task 8

**Completed**: `components/UploadModal.tsx` — modal with drag-and-drop PDF upload zone, file validation (PDF only, 10MB max), client-side upload to Supabase Storage (bypasses Vercel 4.5MB body limit), then `createTemplate()` server action for DB record. Loading states, Escape/backdrop close, cleanup on failure.

**Prompt**:
> Create `components/UploadModal.tsx` — a modal dialog for uploading PDF templates:
>
> 1. Modal overlay with white card, closes on backdrop click or Escape key
> 2. Form with:
>    - "Template Name" text input (required)
>    - PDF file input with drag-and-drop zone (accept only `.pdf`)
>    - File size validation: max 10MB, show error if exceeded
>    - Preview: show filename and file size after selection
>    - "Upload" submit button with loading spinner during upload
>    - "Cancel" button
> 3. On submit, call the `uploadTemplate()` server action with FormData
> 4. On success, close modal (parent should revalidate/refresh the template list)
> 5. On error, show error message inline
>
> This is a Client Component (`"use client"`). Style with Tailwind CSS using the project's design system. The drag zone should have a dashed border that highlights on dragover. Keep the file upload client-side to Supabase Storage to avoid the 4.5MB serverless body limit — reference the Backend agent notes.
>
> IMPORTANT: Upload directly to Supabase Storage from the client using `@supabase/supabase-js` browser client from `utils/supabase/client.ts`, then pass the resulting URL to the server action to create the database record. This avoids the Vercel 4.5MB body limit.

---

## Phase 5: Certificate Editor Page

### Task 10: Editor Page — Wire Canvas to Data ✅ DONE

**What**: The main editor page that loads a template, renders its PDF as background, shows the field canvas, and allows saving.

**Depends on**: Task 5, Task 6, Task 8 (all CRUD actions + components exist)

**Completed**: `app/(app)/editor/[templateId]/page.tsx` (server component fetching template + layout), `app/(app)/editor/[templateId]/loading.tsx` (skeleton), `components/EditorWorkspace.tsx` (main editor client component with LayoutField↔CanvasField mapping, split layout, save/dirty tracking, field CRUD, toolbar).

**Prompt**:
> Create `app/(app)/editor/[templateId]/page.tsx` — the certificate editor page:
>
> 1. Server component that fetches the template + layout using `getTemplate(templateId)` from `lib/actions/templates.ts`
> 2. If template not found or not owned by user, redirect to `/dashboard`
> 3. Renders a client component `components/EditorWorkspace.tsx` passing template data and initial layout config
>
> Create `components/EditorWorkspace.tsx` — the main editor client component (`"use client"`):
> 1. State: array of `CanvasField[]` initialized from the layout config (or empty if new)
> 2. Left side (70% width): The `CertificateCanvas` component from `components/CertificateCanvas.tsx`
>    - Pass the template's PDF URL as background image (render first page as image — use pdf-lib to extract or just show as-is)
>    - Pass fields and `onFieldsChange` callback to update state
> 3. Right side (30% width): Field properties panel:
>    - List of fields with add/remove buttons
>    - "Add Field" button with field type selector (text, date)
>    - When a field is selected on canvas, show its properties: label, font, size, color, bold, italic, align
>    - Editable inputs that update the field in state
> 4. Top toolbar:
>    - "Save" button — calls `saveLayout()` server action with current field config
>    - "Generate PDF" button — triggers PDF generation (placeholder for now, show "Coming soon" toast)
>    - "Back to Dashboard" link
> 5. Save indicator: "Saved" / "Unsaved changes" status
>
> Use the existing `CertificateCanvas`, `DraggableField`, and `SnapGuides` components. Use the existing `useNormalizedCoordinates` and `useSnapGuides` hooks. Use types from `types/database.types.ts`. Style with Tailwind CSS "Admin Vibe" aesthetic. All coordinates must be normalized (0-1), NEVER absolute pixels.

---

### Task 11: Field Properties Panel Component ✅ DONE

**What**: Side panel for editing selected field properties (font, size, color, etc.)

**Depends on**: Task 10

**Completed**: `components/FieldPanel.tsx` — scrollable field list with type badges, click-to-select, delete buttons, add text/date field buttons, properties section (label, default value, font dropdown, size dropdown, color picker, bold/italic toggles, alignment 3-button group with SVG icons).

**Prompt**:
> Create `components/FieldPanel.tsx` — a client component for the editor's right-side properties panel:
>
> 1. Props: `fields: CanvasField[]`, `selectedFieldId: string | null`, `onFieldUpdate`, `onFieldAdd`, `onFieldRemove`
>
> 2. Field list section at top:
>    - Scrollable list of all fields showing label and type badge
>    - Click to select (highlights active)
>    - Delete button (X icon) per field
>    - "Add Text Field" and "Add Date Field" buttons at bottom
>
> 3. Properties section below (shown when a field is selected):
>    - Label: text input
>    - Default Value: text input
>    - Font: dropdown with font presets from `lib/fonts.ts` (Inter, Pinyon Script, etc.)
>    - Size: dropdown using the typography scale from `lib/fonts.ts` (sm/base/lg/xl/2xl/3xl)
>    - Color: simple color input (hex)
>    - Bold: toggle checkbox
>    - Italic: toggle checkbox
>    - Alignment: 3-button group (left/center/right)
>
> 4. Changes apply immediately to state (parent handles saving)
>
> Use Tailwind CSS, Inter font for UI labels, compact form layout. Minimize wasted space. All form elements must have proper labels for accessibility.

---

### Task 12: PDF-to-Image Preview for Canvas Background ✅ DONE

**What**: Convert the first page of the uploaded PDF template into an image to display as the canvas background.

**Depends on**: Task 10

**Completed**: `components/PDFPreview.tsx` — uses native `<object type="application/pdf">` with `<iframe>` fallback, hides PDF viewer chrome via URL fragment, A4 aspect ratio, `position: relative` container with children overlay at `z-canvas`. No heavy dependencies (bandwidth miser).

**Prompt**:
> Create `lib/pdf/preview.ts` with a function to render a PDF page as an image:
>
> 1. `generatePDFPreview(pdfUrl: string): Promise<string>` — returns a base64 data URL of the first page
> 2. Use `pdf-lib` to load the PDF, get page dimensions
> 3. Since pdf-lib can't rasterize, use one of these approaches:
>    - Option A (preferred): Use the browser's built-in PDF rendering via an OffscreenCanvas or a hidden `<canvas>` element with pdfjs-dist (BUT check if this breaks the zero-cost/bandwidth constraint)
>    - Option B: Just display the PDF in an `<iframe>` or `<object>` tag as the canvas background and overlay the drag-and-drop fields on top
>    - Option C: Use the PDF URL directly and layer the canvas component on top with `position: absolute`
>
> Go with the simplest option that works without adding heavy dependencies. The project is a "Bandwidth Miser" — avoid large libraries. Option C (layering) is likely the most pragmatic. If you go with Option C, just create a `components/PDFPreview.tsx` component that renders the PDF as a background layer using `<object>` or `<embed>` tag with the PDF URL, and position the CertificateCanvas absolutely on top of it.
>
> Whatever approach you choose, ensure the aspect ratio matches the PDF page dimensions. Use `pdf-lib` to read page width/height and set the container's `aspect-ratio` CSS accordingly.

---

## Phase 6: Certificate Generation Flow

### Task 13: Generate PDF Server Action ✅ DONE

**What**: Wire the existing PDF generation engine into a server action that accepts layout + data and returns a downloadable PDF.

**Depends on**: Task 6 (layout actions), PDF engine already exists

**Completed**: `lib/actions/generate.ts` — `generateCertificate()` (single PDF, fetches template + layout, calls `generatePDF()` with `coordinateMode: 'percentage'`, returns base64) and `generateBatchCertificates()` (max 50 rows, merges individual PDFs via pdf-lib `copyPages`, returns single base64 merged PDF).

**Prompt**:
> Create `lib/actions/generate.ts` with Server Actions for PDF generation:
>
> 1. `generateCertificate(templateId: string, data: Record<string, string>)`:
>    - Fetches the template PDF from Supabase Storage
>    - Fetches the layout config from the layouts table
>    - Calls `generatePDF()` from `lib/pdf/generator.ts` with the template bytes, layout fields, and data values
>    - Returns the generated PDF as base64 string
>    - Use `export const maxDuration = 60` for the long-running generation
>
> 2. `generateBatchCertificates(templateId: string, dataRows: Record<string, string>[])`:
>    - Same as above but for multiple recipients
>    - Uses `generateBatchPDF()` from the existing PDF engine
>    - Returns a single merged PDF (all certificates) as base64
>    - Limit batch to 50 certificates per request to stay within memory limits
>
> Use the existing PDF generation engine in `lib/pdf/generator.ts` and font optimizer in `lib/pdf/font-optimizer.ts`. Map the layout fields to the data: each field's `label` matches a key in the data `Record`. Coordinates in the layout are normalized (0-1), the PDF generator handles the conversion to PDF points.
>
> Error handling: wrap in try-catch, return `{ data, error }` pattern. Log generation time for monitoring. Respect the 10s default timeout (use maxDuration = 60).

---

### Task 14: Generation UI — Single Certificate ✅ DONE

**What**: UI in the editor to generate a single test certificate with manual data entry.

**Depends on**: Task 10, Task 13

**Completed**: `components/GenerateModal.tsx` — modal with auto-generated form from field labels, loading spinner, base64-to-Blob download as `{templateName}_{date}.pdf`. Integrated into `EditorWorkspace.tsx` replacing the "Coming soon" toast.

**Prompt**:
> Create `components/GenerateModal.tsx` — a modal for generating a single certificate:
>
> 1. Modal overlay triggered by "Generate PDF" button in the editor toolbar
> 2. Shows a form with one input per layout field (auto-generated from the current fields):
>    - Each field's `label` becomes a form label
>    - Text input for each field value
>    - Pre-filled with field's `value` if it has a default
> 3. "Generate" button:
>    - Calls `generateCertificate()` server action
>    - Shows loading spinner with "Generating your certificate..." message (loading states are MANDATORY per project constitution)
>    - On success: triggers browser download of the PDF file
>    - On error: shows error message
> 4. "Cancel" button to close
>
> For the download: convert base64 to Blob, create an Object URL, trigger download with a hidden `<a>` tag. Filename: `{templateName}_{date}.pdf`.
>
> Style with Tailwind CSS "Admin Vibe" aesthetic. The loading state should be prominent — users must know PDF is generating.

---

### Task 15: Batch Generation — CSV Import & Multi-Certificate ✅ DONE

**What**: Allow users to upload a CSV file with recipient data and generate certificates in batch.

**Depends on**: Task 13, Task 14

**Completed**: `components/BatchGenerateModal.tsx` — 4-step modal (data input → confirmation → generation → complete). Built-in RFC 4180 CSV parser (~160 lines, zero dependencies). Auto-maps CSV headers to field labels (case-insensitive) with manual remap dropdowns. Preview table, progress bar, chunk-based generation (50/chunk), per-chunk error tracking, multi-download support. Integrated into `EditorWorkspace.tsx` toolbar.

**Prompt**:
> Create `components/BatchGenerateModal.tsx` — a modal for batch certificate generation:
>
> 1. Step 1 — Data Input:
>    - CSV file upload input (accept `.csv`)
>    - Parse CSV client-side (no library needed — use a simple split-based parser or the native `FileReader` + line splitting)
>    - Show preview table of first 5 rows after parsing
>    - Column mapping: auto-match CSV headers to layout field labels (case-insensitive). Show dropdown per field to manually remap if needed.
>    - Show total row count
>
> 2. Step 2 — Confirmation:
>    - Summary: "Generate {N} certificates using template {name}"
>    - Warning if N > 50: "Large batches will be split into groups of 50"
>    - "Generate Batch" button
>
> 3. Step 3 — Generation:
>    - Show progress: "Generating... {completed}/{total}"
>    - Call `generateBatchCertificates()` in chunks of 50
>    - On completion: trigger download of the merged PDF
>    - Error handling: show which rows failed
>
> 4. "Cancel" at any step closes the modal
>
> Parse CSV defensively: handle quoted fields, different line endings. No external CSV library — keep bundle small (bandwidth miser). Style with Tailwind CSS. Loading/progress state is mandatory.

---

## Phase 7: Error Handling & Polish

### Task 16: Error and Loading Boundaries ✅ DONE

**What**: Add Next.js error boundaries and loading states for all route groups.

**Depends on**: Tasks 7-10 (pages must exist first)

**Completed**: `app/(app)/error.tsx` (client error boundary with reset + dashboard link), `app/(app)/loading.tsx` (generic skeleton), `app/(app)/dashboard/loading.tsx` (6-card grid skeleton), `app/(app)/editor/[templateId]/not-found.tsx` (template not found), `app/not-found.tsx` (global 404).

**Prompt**:
> Add Next.js error and loading boundaries:
>
> 1. `app/(app)/error.tsx` — client component error boundary for authenticated routes:
>    - Shows friendly error message: "Something went wrong"
>    - "Try again" button calling `reset()`
>    - "Go to Dashboard" link as fallback
>    - Style: centered card on slate-50 background
>
> 2. `app/(app)/loading.tsx` — loading skeleton for authenticated routes:
>    - Pulsing gray rectangles mimicking the dashboard card grid layout
>    - Use Tailwind `animate-pulse` on `bg-slate-200` blocks
>
> 3. `app/(app)/dashboard/loading.tsx` — dashboard-specific loading:
>    - 6 skeleton cards in the grid matching the real layout
>
> 4. `app/(app)/editor/[templateId]/loading.tsx` — editor-specific loading:
>    - Skeleton with canvas area (70%) + panel area (30%)
>
> 5. `app/(app)/editor/[templateId]/not-found.tsx` — shown when template doesn't exist:
>    - "Template not found" message with "Back to Dashboard" link
>
> 6. `app/not-found.tsx` — global 404 page
>
> All styled with the "Admin Vibe" aesthetic. Use Tailwind CSS. Keep them simple.

---

### Task 17: Environment Validation ✅ DONE

**What**: Runtime check that all required environment variables are set, with helpful error messages.

**Depends on**: Nothing

**Completed**: `lib/env.ts` created with `validateEnv()`, `getSupabaseUrl()`, `getSupabaseAnonKey()`, `getServiceRoleKey()`, `getCronSecret()`. Updated `lib/supabase.ts` to import from `lib/env.ts` instead of duplicating env access functions.

**Prompt**:
> Create `lib/env.ts` — environment variable validation:
>
> 1. Export a function `validateEnv()` that checks all required env vars are set:
>    - `NEXT_PUBLIC_SUPABASE_URL`
>    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
>    - `SUPABASE_SERVICE_ROLE_KEY`
>    - `CRON_SECRET`
> 2. Throws a descriptive error if any are missing: "Missing environment variable: {name}. Check .env.local.example for setup instructions."
> 3. Call this function in `lib/supabase.ts` at the top level (runs once on import)
> 4. Export typed env accessor functions: `getSupabaseUrl()`, `getSupabaseAnonKey()`, etc. — so env vars are accessed through this module, not scattered `process.env` calls
>
> Keep it minimal. No external validation libraries. Just string checks and clear error messages.

---

### Task 18: Toast/Notification System ✅ DONE

**What**: Lightweight toast notification for success/error feedback across the app.

**Depends on**: Nothing (utility, can be done anytime)

**Completed**: `components/ToastProvider.tsx` (context provider, max 3 toasts, 4s auto-dismiss, slide-in animation, close button), `hooks/useToast.ts` (convenience hook), barrel exports updated in `hooks/index.ts` and `components/index.ts`.

**Prompt**:
> Create a minimal toast notification system with NO external libraries:
>
> 1. `components/Toast.tsx` — the toast component:
>    - Fixed position bottom-right
>    - Supports types: success (green), error (red), info (blue)
>    - Auto-dismisses after 4 seconds
>    - Close button (X)
>    - Smooth slide-in animation with Tailwind
>    - Uses z-index `--z-toast` (70) from the design system
>
> 2. `components/ToastProvider.tsx` — React context provider:
>    - Wraps the app in `app/(app)/layout.tsx`
>    - Provides `showToast(message, type)` function via context
>    - Manages toast queue (max 3 visible)
>
> 3. `hooks/useToast.ts` — hook to access `showToast` from any component
>
> Keep it dead simple. No external libraries, no animation libraries. Use CSS transitions + Tailwind classes. This is a "Bandwidth Miser" project.

---

## Phase 8: Final Integration & Deployment Readiness

### Task 19: Wire Everything Together — Home Page & Routing ✅ DONE

**What**: Replace the default Next.js home page, set up proper routing.

**Depends on**: Tasks 1-8 (auth + dashboard exist)

**Completed**: `app/page.tsx` replaced — server component that redirects authenticated users to `/dashboard`, shows minimal landing page for unauthenticated visitors (heading, description, 3 feature highlights, "Get Started" → signup, "Sign in" link).

**Prompt**:
> Update the app's entry point and routing:
>
> 1. Replace `app/page.tsx` — make it a simple landing/redirect:
>    - If user is authenticated (check session server-side), redirect to `/dashboard`
>    - If not authenticated, show a minimal landing page:
>      - App name "Certificator" as heading
>      - One-line description: "Create beautiful certificates from PDF templates"
>      - "Get Started" button → links to `/login`
>      - Clean, centered layout with "Admin Vibe" aesthetic
>    - Keep it lightweight — no heavy graphics or animations
>
> 2. Ensure route group structure is correct:
>    - `(auth)` group: `/login`, `/signup`, `/auth/callback`
>    - `(app)` group: `/dashboard`, `/editor/[templateId]`
>
> Use the existing design system. Inter font. Tailwind CSS. Minimal landing — this is a utility tool, not a marketing page.

---

### Task 20: Deployment Checklist & CI ✅ DONE

**What**: Add a build/lint CI workflow and verify everything works for Vercel deployment.

**Depends on**: All previous tasks

**Completed**: `.github/workflows/ci.yml` created (lint + type-check + build on push/PR to main/master, placeholder env vars for build, concurrency control). `.env.local.example` updated (fixed Supabase dashboard URL). `next.config.ts` verified deployment-ready (no changes needed).

**Prompt**:
> Create deployment readiness:
>
> 1. `.github/workflows/ci.yml` — CI workflow:
>    - Triggers on push to `main` and pull requests
>    - Steps: checkout, setup Node 20, install deps, run lint, run build
>    - Fails if lint or build fails
>    - Keep it minimal — free GitHub Actions minutes are limited
>
> 2. Verify `next.config.ts` is correct for Vercel deployment:
>    - output mode should be default (not 'export')
>    - Check all env vars are referenced correctly
>    - Ensure security headers are still in place
>
> 3. Update `.env.local.example` if any new env vars were added during development
>
> 4. Update `README.md` with:
>    - Quick start instructions (clone, install, set env vars, run dev)
>    - List of all required environment variables and where to get them
>    - Deployment instructions for Vercel
>
> No paid CI services. No complex pipelines. One workflow file, minimal steps.

---

## Quick Reference: Build Order

```
Task 17 ✅ ──────────────────────────────────────── (env validation)
Task 4  ✅ ──────────────────────────────────────── (storage migration)
Task 18 ✅ ──────────────────────────────────────── (toast system)
Task 1  ✅ ── Task 2 ✅ ── Task 3 ✅                  (auth flow)
               │
Task 7  ✅ ────┘                                     (app layout)
Task 5  ✅ ── Task 6 ✅                               (CRUD actions)
             │
Task 8  ✅ ── Task 9 ✅                               (dashboard + upload)
Task 10 ✅ ── Task 11 ✅ ── Task 12 ✅                 (editor)
Task 13 ✅ ── Task 14 ✅ ── Task 15 ✅                 (generation)
Task 16 ✅ ──────────────────────────────────────── (error boundaries)
Task 19 ✅ ──────────────────────────────────────── (home page + routing)
Task 20 ✅ ──────────────────────────────────────── (CI + deploy)
```

**ALL 20 TASKS COMPLETE** ✅ — Project is fully implemented and deployment-ready.
