/**
 * Components Index
 * Export all components from a single entry point
 */

export {
  CertificateCanvas,
  createCanvasField,
  type CanvasField,
  type CertificateCanvasProps,
} from './CertificateCanvas';

export {
  BatchGenerateModal,
  type BatchGenerateModalProps,
} from './BatchGenerateModal';

export {
  DraggableField,
  FieldTypeBadge,
  type DraggableFieldProps,
} from './DraggableField';

export {
  DraggableText,
  getTextAlignClass,
  type DraggableTextProps,
} from './DraggableText';

export {
  SnapGuides,
  CenterGuides,
  type SnapGuidesProps,
} from './SnapGuides';

export {
  ToastProvider,
  ToastContext,
  type ToastType,
} from './ToastProvider';

// Modular components extracted in Phase 2
export { EditorToolbar, type EditorToolbarProps } from './EditorToolbar';
export { ColumnPickerModal, type ColumnPickerModalProps } from './ColumnPickerModal';

// Batch step components
export {
  BatchStepInput,
  BatchStepConfirm,
  BatchStepGenerate,
  BatchStepComplete,
  CHUNK_SIZE,
  PREVIEW_ROW_COUNT,
  type ColumnMapping,
  type BatchStep,
  type ChunkResult,
  type BatchProgress,
  type BatchStepBaseProps,
  type BatchStepInputProps,
  type BatchStepConfirmProps,
  type BatchStepGenerateProps,
  type BatchStepCompleteProps,
} from './batch';

// UX components
export { ErrorBoundary } from './ErrorBoundary';
export {
  LoadingSpinner,
  LoadingOverlay,
  Skeleton,
  SkeletonCard,
} from './LoadingStates';

