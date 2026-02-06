-- ============================================================================
-- Certificator Storage Setup - Storage Migration
-- ============================================================================
-- Purpose: Configure Supabase Storage bucket and RLS policies for PDF
--          template uploads
-- Target: Supabase Storage (free tier: 1GB storage, 50MB file limit)
-- Author: Architect Agent
-- Date: 2024-01-02
-- Depends on: 20240101000000_initial_schema.sql
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKET: templates
-- ============================================================================
-- Purpose: Store uploaded PDF templates, organized by user UUID folders
-- Design Decision: Private bucket (public = false) so all access goes through
--                  RLS policies. Signed URLs are used for downloads.
-- Folder Structure: templates/<user_uuid>/<filename>.pdf
-- ============================================================================

-- Create the templates bucket (idempotent via ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'templates',
    'templates',
    false,
    10485760,                    -- 10MB file size limit
    ARRAY['application/pdf']     -- Only PDF files allowed
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN storage.buckets.id IS 'Bucket ID doubles as the bucket name for URL routing.';

-- ============================================================================
-- RLS POLICIES: storage.objects (templates bucket)
-- ============================================================================
-- Security Model: Users can only access files within their own UUID folder.
--                 The first path segment (folder name) must match auth.uid().
-- Pattern: templates/<auth.uid()>/filename.pdf
-- Role: authenticated (anonymous users have zero access)
-- ============================================================================

-- Policy: Authenticated users can upload PDFs to their own folder
-- Enforces that the first folder segment matches the uploader's UUID,
-- preventing users from writing to other users' folders.
CREATE POLICY "Users can upload templates to their own folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'templates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Authenticated users can read/download their own uploaded files
-- Ensures users can only generate signed URLs and download files from
-- their own folder path, maintaining complete data isolation.
CREATE POLICY "Users can read their own template uploads"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'templates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Authenticated users can update (overwrite) their own uploaded files
-- Allows re-uploading or replacing a PDF without deleting the old one first.
-- Both USING and WITH CHECK ensure the file stays within the user's folder.
CREATE POLICY "Users can update their own template uploads"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'templates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'templates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Authenticated users can delete their own uploaded files
-- Permits cleanup when a template record is removed or a file needs
-- to be replaced via delete-then-upload.
CREATE POLICY "Users can delete their own template uploads"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'templates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- 1. The bucket is PRIVATE (public = false). No anonymous access is possible.
-- 2. All policies scope to bucket_id = 'templates' to avoid affecting other
--    buckets that may be added in the future.
-- 3. The folder-based isolation pattern (storage.foldername(name))[1] ensures
--    that each user's files live under their own UUID prefix.
-- 4. file_size_limit (10MB) and allowed_mime_types (PDF only) are enforced
--    at the bucket level by Supabase Storage, not via RLS.
-- 5. Service role bypasses RLS and can access all files regardless of folder.
-- ============================================================================

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
