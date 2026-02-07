-- PDF-Only Template Migration
--
-- Renames image-related columns to PDF-specific names and switches
-- from pixel dimensions to PDF point dimensions.

-- Rename image_url -> pdf_url
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
