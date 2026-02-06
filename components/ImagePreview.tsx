'use client';

import type { ReactNode } from 'react';

/**
 * Props for ImagePreview component
 */
export interface ImagePreviewProps {
  /** Signed URL of the certificate image */
  imageUrl: string;
  /** Aspect ratio width/height (default: A4 = 210/297) */
  aspectRatio?: number;
  /** Children rendered on top of the image (typically CertificateCanvas) */
  children?: ReactNode;
}

/**
 * ImagePreview - Display a certificate template image as the background
 * for the certificate editor. Children (e.g. CertificateCanvas) are
 * rendered as an overlay on top.
 *
 * @example
 * ```tsx
 * <ImagePreview imageUrl={signedUrl}>
 *   <CertificateCanvas fields={fields} onFieldsChange={setFields} />
 * </ImagePreview>
 * ```
 */
export function ImagePreview({
  imageUrl,
  aspectRatio = 210 / 297,
  children,
}: ImagePreviewProps) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-white shadow"
      style={{ aspectRatio }}
    >
      <img
        src={imageUrl}
        alt="Certificate template"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain"
      />
      <div className="absolute inset-0 z-canvas">
        {children}
      </div>
    </div>
  );
}
