/**
 * Types Index
 * 
 * Central export for all type definitions.
 * Import from '@/types' for convenience.
 */

// Database types
export type {
    SystemHealthStatus,
    Template,
    TemplateInsert,
    TemplateUpdate,
    LayoutField,
    DataSource,
    Layout,
    LayoutInsert,
    LayoutUpdate,
    SystemHealth,
    SystemHealthUpdate,
    Database,
    TemplateWithLayout,
    BrowserCoordinate,
    PDFCoordinate,
} from './database.types';

export { browserToPDF, pdfToBrowser } from './database.types';

// UI types
export type {
    ModalBaseProps,
    DisableableProps,
    LoadingProps,
    SelectOption,
    ValidationResult,
    ToastVariant,
    ToastConfig,
    Position,
    Size,
    BoundingBox,
    TextAlign,
    FontStyle,
} from './ui.types';
