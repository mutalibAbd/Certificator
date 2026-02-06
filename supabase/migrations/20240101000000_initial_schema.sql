-- ============================================================================
-- Certificator Database Schema - Initial Migration
-- ============================================================================
-- Purpose: Establish core tables for certificate template management
-- Target: Supabase PostgreSQL (Free Tier optimized)
-- Author: Architect Agent
-- Date: 2024-01-01
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: templates
-- ============================================================================
-- Purpose: Store PDF template metadata and references
-- Design Decision: Store PDF URLs (Supabase Storage links) instead of binary
--                  data to stay within 500MB database limit
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pdf_url TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT templates_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT templates_pdf_url_not_empty CHECK (char_length(pdf_url) > 0)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_templates_owner_id ON public.templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON public.templates(created_at DESC);

-- Comment on table and columns for documentation
COMMENT ON TABLE public.templates IS 'Stores PDF template metadata. PDFs are stored in Supabase Storage, not in the database.';
COMMENT ON COLUMN public.templates.owner_id IS 'Foreign key to auth.users. Each template belongs to a single user.';
COMMENT ON COLUMN public.templates.pdf_url IS 'URL to the PDF file in Supabase Storage (e.g., https://[project].supabase.co/storage/v1/object/public/templates/...)';
COMMENT ON COLUMN public.templates.name IS 'User-defined name for the template (e.g., "Certificate of Achievement")';

-- ============================================================================
-- TABLE: layouts
-- ============================================================================
-- Purpose: Store field configurations for certificate layouts
-- Design Decision: Use JSONB for flexible field storage to avoid schema
--                  migrations when field requirements change (MVP priority)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT layouts_config_is_array CHECK (jsonb_typeof(config) = 'array')
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_layouts_template_id ON public.layouts(template_id);
CREATE INDEX IF NOT EXISTS idx_layouts_config_gin ON public.layouts USING GIN(config);

-- Comment on table and columns for documentation
COMMENT ON TABLE public.layouts IS 'Stores field configurations for templates using JSONB for flexibility.';
COMMENT ON COLUMN public.layouts.template_id IS 'Foreign key to templates. Each layout belongs to a single template.';
COMMENT ON COLUMN public.layouts.config IS 'JSONB array of field objects: [{id, x, y, font, size, type, ...}]. Coordinate system: Browser (Top-Left Origin).';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on layouts table
CREATE TRIGGER update_layouts_updated_at BEFORE UPDATE ON public.layouts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE: system_health
-- ============================================================================
-- Purpose: Keep-Alive mechanism to prevent Supabase from pausing after 7 days
-- Design Decision: Dedicated table for health checks, restricted to service role
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    last_pulse TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'healthy',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT system_health_status_valid CHECK (status IN ('healthy', 'degraded', 'offline'))
);

-- Insert initial health record (idempotent)
INSERT INTO public.system_health (id, last_pulse, status)
VALUES ('00000000-0000-0000-0000-000000000001', NOW(), 'healthy')
ON CONFLICT (id) DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_system_health_last_pulse ON public.system_health(last_pulse DESC);

-- Comment on table and columns for documentation
COMMENT ON TABLE public.system_health IS 'Keep-Alive table. External service pings this to prevent Supabase from pausing.';
COMMENT ON COLUMN public.system_health.last_pulse IS 'Timestamp of last keep-alive ping. External service updates this periodically.';
COMMENT ON COLUMN public.system_health.status IS 'Current system status: healthy, degraded, or offline.';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Security Model: Complete data isolation between users
-- Default: Deny all access, whitelist specific actions
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: templates
-- ============================================================================

-- Policy: Users can SELECT only their own templates
CREATE POLICY "Users can view their own templates"
    ON public.templates
    FOR SELECT
    USING (auth.uid() = owner_id);

-- Policy: Users can INSERT their own templates
CREATE POLICY "Users can insert their own templates"
    ON public.templates
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can UPDATE only their own templates
CREATE POLICY "Users can update their own templates"
    ON public.templates
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can DELETE only their own templates
CREATE POLICY "Users can delete their own templates"
    ON public.templates
    FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- RLS POLICIES: layouts
-- ============================================================================

-- Policy: Users can SELECT layouts for their own templates
CREATE POLICY "Users can view layouts for their own templates"
    ON public.layouts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.templates
            WHERE templates.id = layouts.template_id
            AND templates.owner_id = auth.uid()
        )
    );

-- Policy: Users can INSERT layouts for their own templates
CREATE POLICY "Users can insert layouts for their own templates"
    ON public.layouts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.templates
            WHERE templates.id = layouts.template_id
            AND templates.owner_id = auth.uid()
        )
    );

-- Policy: Users can UPDATE layouts for their own templates
CREATE POLICY "Users can update layouts for their own templates"
    ON public.layouts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.templates
            WHERE templates.id = layouts.template_id
            AND templates.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.templates
            WHERE templates.id = layouts.template_id
            AND templates.owner_id = auth.uid()
        )
    );

-- Policy: Users can DELETE layouts for their own templates
CREATE POLICY "Users can delete layouts for their own templates"
    ON public.layouts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.templates
            WHERE templates.id = layouts.template_id
            AND templates.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS POLICIES: system_health
-- ============================================================================
-- Security: ONLY service_role can access this table
-- The public anon key has absolutely no access
-- ============================================================================

-- Policy: Deny all access to anonymous users (default)
-- No policies defined = no access for anon key

-- Service role bypasses RLS by default, so it can access system_health

-- Comment on security model
COMMENT ON TABLE public.system_health IS 'SECURITY: Only accessible via service_role key. Anon key has zero access.';

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Ensure authenticated users can access templates and layouts
-- System_health remains inaccessible to public

GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layouts TO authenticated;

-- No grants for system_health - service_role only

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
