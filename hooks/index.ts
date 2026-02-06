/**
 * Hooks Index
 * Export all custom hooks from a single entry point
 */

export {
  useNormalizedCoordinates,
  normalizedToStyle,
  isValidNormalized,
  type NormalizedCoordinate,
  type PixelCoordinate,
  type ContainerSize,
  type UseNormalizedCoordinatesReturn,
} from './useNormalizedCoordinates';

export {
  useSnapGuides,
  isNearSnapPoint,
  snapToPoint,
  type SnapGuide,
  type SnapResult,
  type SnapFieldPosition,
  type UseSnapGuidesOptions,
} from './useSnapGuides';

export { useToast } from './useToast';
