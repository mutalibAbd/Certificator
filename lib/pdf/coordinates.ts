/**
 * PDF Coordinate Utilities
 * 
 * Re-exports coordinate conversion functions from the main generator.
 * Provides a cleaner import path for coordinate-related operations.
 * 
 * @example
 * import { percentageToPoints, pointsToPercentage } from '@/lib/pdf/coordinates';
 */

export {
    percentageToPoints,
    pointsToPercentage,
    type PercentageCoordinate,
    type PDFPointCoordinate,
} from './generator';
