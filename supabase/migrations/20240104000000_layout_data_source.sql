-- Migration: Add data_source column to layouts table
-- Purpose: Persist imported CSV/XLSX data (parsed headers + rows + filename)
--          alongside the layout so users don't have to re-upload every session.
--
-- Shape: { "fileName": "data.xlsx", "headers": ["Name", "Date"], "rows": [["Alice", "2024-01-01"], ...] }

ALTER TABLE layouts
ADD COLUMN data_source JSONB DEFAULT NULL;

COMMENT ON COLUMN layouts.data_source IS 'Parsed data file (fileName, headers, rows) stored as JSONB for batch certificate generation';
