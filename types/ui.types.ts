/**
 * UI Component Types
 * 
 * Centralized type definitions for UI components.
 * Import from here for consistent typing across the application.
 */

// ============================================================================
// COMMON PROPS
// ============================================================================

/**
 * Base props for modal components
 */
export interface ModalBaseProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback when the modal should close */
    onClose: () => void;
}

/**
 * Props for components that can be disabled
 */
export interface DisableableProps {
    /** Whether the component is disabled */
    disabled?: boolean;
}

/**
 * Props for components that can show loading state
 */
export interface LoadingProps {
    /** Whether the component is in a loading state */
    loading?: boolean;
    /** Optional loading text to display */
    loadingText?: string;
}

// ============================================================================
// FORM & INPUT TYPES
// ============================================================================

/**
 * Select option with value and label
 */
export interface SelectOption<T = string> {
    value: T;
    label: string;
    disabled?: boolean;
}

/**
 * Generic field validation result
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

// ============================================================================
// TOAST & NOTIFICATION TYPES
// ============================================================================

/**
 * Toast notification types
 */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast notification configuration
 */
export interface ToastConfig {
    id?: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
    dismissible?: boolean;
}

// ============================================================================
// EDITOR TYPES
// ============================================================================

/**
 * Generic 2D position
 */
export interface Position {
    x: number;
    y: number;
}

/**
 * Size dimensions
 */
export interface Size {
    width: number;
    height: number;
}

/**
 * Bounding box (position + size)
 */
export interface BoundingBox extends Position, Size { }

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Font style configuration
 */
export interface FontStyle {
    family: string;
    size: number;
    color: string;
    bold?: boolean;
    italic?: boolean;
}
