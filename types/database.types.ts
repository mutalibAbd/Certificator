/**
 * Database Type Definitions
 * Auto-generated types for Supabase tables
 * 
 * IMPORTANT: These types represent the PostgreSQL schema.
 * Keep in sync with supabase/migrations/*.sql
 */

// ============================================================================
// ENUMS
// ============================================================================

export type SystemHealthStatus = 'healthy' | 'degraded' | 'offline';

// ============================================================================
// TABLE: templates
// ============================================================================

/**
 * Template represents a certificate template
 * Images are stored in Supabase Storage, not in the database
 */
export interface Template {
  id: string; // UUID
  owner_id: string; // UUID - Foreign key to auth.users
  image_url: string; // URL to certificate image (JPG/PNG) in Supabase Storage
  name: string; // User-defined name
  created_at: string; // ISO 8601 timestamp
  width_px: number | null; // Natural image width in pixels (NULL for legacy templates)
  height_px: number | null; // Natural image height in pixels (NULL for legacy templates)
}

/**
 * Template insert - used when creating a new template
 * Omits auto-generated fields
 */
export interface TemplateInsert {
  owner_id: string;
  image_url: string;
  name: string;
  width_px?: number | null;
  height_px?: number | null;
}

/**
 * Template update - used when updating a template
 * All fields are optional except what's being updated
 */
export interface TemplateUpdate {
  image_url?: string;
  name?: string;
  width_px?: number | null;
  height_px?: number | null;
}

// ============================================================================
// TABLE: layouts
// ============================================================================

/**
 * Field configuration for a certificate layout
 * Coordinates are in Browser coordinate system (Top-Left Origin)
 * 
 * CRITICAL: When rendering to PDF, convert from Browser (TL) to PDF (BL) coordinates
 */
export interface LayoutField {
  id: string; // Unique field identifier
  x: number; // X coordinate (pixels, Browser origin)
  y: number; // Y coordinate (pixels, Browser origin)
  font: string; // Font family name
  size: number; // Font size in pixels
  type: 'text' | 'date' | 'signature' | 'image'; // Field type
  label?: string; // Optional label for the field
  value?: string; // Default value (if any)
  color?: string; // Text color (hex format)
  bold?: boolean; // Font weight
  italic?: boolean; // Font style
  align?: 'left' | 'center' | 'right'; // Text alignment
  rotation?: number; // Rotation angle in degrees (0-359)
  width?: number; // Field width (for wrapping)
  height?: number; // Field height (for multi-line)
  source?: 'data' | 'static'; // Origin: 'data' = imported from CSV/Excel, 'static' = manually added
}

/**
 * Parsed data source persisted alongside the layout.
 * Stores the imported CSV/XLSX file contents so users don't have to re-upload.
 */
export interface DataSource {
  fileName: string;
  headers: string[];
  rows: string[][];
}

/**
 * Layout represents the field configuration for a template
 * Uses JSONB to store flexible field arrays
 */
export interface Layout {
  id: string; // UUID
  template_id: string; // UUID - Foreign key to templates
  config: LayoutField[]; // Array of field configurations (stored as JSONB)
  data_source?: DataSource | null; // Persisted imported data file (JSONB)
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp (auto-updated)
}

/**
 * Layout insert - used when creating a new layout
 * Omits auto-generated fields
 */
export interface LayoutInsert {
  template_id: string;
  config: LayoutField[];
  data_source?: DataSource | null;
}

/**
 * Layout update - used when updating a layout
 * Updated_at is auto-updated by trigger
 */
export interface LayoutUpdate {
  config?: LayoutField[];
  data_source?: DataSource | null;
}

// ============================================================================
// TABLE: system_health
// ============================================================================

/**
 * SystemHealth represents the keep-alive mechanism
 * 
 * SECURITY: Only accessible via service_role key
 * Public anon key has zero access to this table
 */
export interface SystemHealth {
  id: string; // UUID
  last_pulse: string; // ISO 8601 timestamp
  status: SystemHealthStatus;
  created_at: string; // ISO 8601 timestamp
}

/**
 * SystemHealth update - used by keep-alive service
 * Only updates last_pulse and status
 */
export interface SystemHealthUpdate {
  last_pulse?: string;
  status?: SystemHealthStatus;
}

// ============================================================================
// DATABASE TYPE (Root)
// ============================================================================

/**
 * Complete database schema
 * Use this type for type-safe Supabase client
 * 
 * This follows the Supabase generated types format for proper type inference.
 */
export type Database = {
  public: {
    Tables: {
      templates: {
        Row: Template;
        Insert: TemplateInsert;
        Update: TemplateUpdate;
        Relationships: [];
      };
      layouts: {
        Row: Layout;
        Insert: LayoutInsert;
        Update: LayoutUpdate;
        Relationships: [
          {
            foreignKeyName: 'layouts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          }
        ];
      };
      system_health: {
        Row: SystemHealth;
        Insert: Omit<SystemHealth, 'id' | 'created_at'>;
        Update: SystemHealthUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      system_health_status: SystemHealthStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Template with its associated layout
 * Useful for fetching templates with their configurations
 */
export interface TemplateWithLayout extends Template {
  layout?: Layout;
}

/**
 * Coordinate conversion utilities
 * CRITICAL: Browser uses Top-Left (0,0), PDF uses Bottom-Left (0,0)
 */
export interface BrowserCoordinate {
  x: number;
  y: number;
}

export interface PDFCoordinate {
  x: number;
  y: number;
}

/**
 * Convert Browser coordinates to PDF coordinates
 * @param browser Browser coordinate (Top-Left origin)
 * @param pageHeight Height of the PDF page in pixels
 * @returns PDF coordinate (Bottom-Left origin)
 */
export function browserToPDF(
  browser: BrowserCoordinate,
  pageHeight: number
): PDFCoordinate {
  return {
    x: browser.x,
    y: pageHeight - browser.y,
  };
}

/**
 * Convert PDF coordinates to Browser coordinates
 * @param pdf PDF coordinate (Bottom-Left origin)
 * @param pageHeight Height of the PDF page in pixels
 * @returns Browser coordinate (Top-Left origin)
 */
export function pdfToBrowser(
  pdf: PDFCoordinate,
  pageHeight: number
): BrowserCoordinate {
  return {
    x: pdf.x,
    y: pageHeight - pdf.y,
  };
}
