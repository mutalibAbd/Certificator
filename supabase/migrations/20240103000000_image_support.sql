-- Rename pdf_url column to image_url (certificates now upload images, not PDFs)
ALTER TABLE public.templates RENAME COLUMN pdf_url TO image_url;

-- Update the CHECK constraint
ALTER TABLE public.templates DROP CONSTRAINT templates_pdf_url_not_empty;
ALTER TABLE public.templates ADD CONSTRAINT templates_image_url_not_empty CHECK (char_length(image_url) > 0);

-- Update documentation
COMMENT ON COLUMN public.templates.image_url IS 'URL to the certificate photo (JPG/PNG) in Supabase Storage — used as visual reference for field positioning only';
