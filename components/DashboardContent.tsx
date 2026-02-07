'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Template } from '@/types/database.types'
import TemplateCard from '@/components/TemplateCard'

const UploadModal = dynamic(
  () => import('@/components/UploadModal'),
  { ssr: false },
)

type TemplateWithSignedUrl = Template & { signedPdfUrl: string }

interface DashboardContentProps {
  templates: TemplateWithSignedUrl[]
}

export default function DashboardContent({ templates }: DashboardContentProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  return (
    <>
      {templates.length === 0 ? (
        /* ------------------------------------------------------------------ */
        /* Empty state                                                        */
        /* ------------------------------------------------------------------ */
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 py-16 px-4 text-center">
          {/* Document icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--foreground-muted)] mb-4"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>

          <p className="text-[var(--foreground-muted)] mb-6 max-w-sm">
            No templates yet — upload a PDF certificate to get started
          </p>

          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Template
          </button>
        </div>
      ) : (
        /* ------------------------------------------------------------------ */
        /* Template grid                                                      */
        /* ------------------------------------------------------------------ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* New template trigger card */}
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-[var(--foreground-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors min-h-[180px] cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="mt-2 text-sm font-medium">
              Upload New Template
            </span>
          </button>

          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} signedPdfUrl={template.signedPdfUrl} />
          ))}
        </div>
      )}

      {isUploadOpen && (
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />
      )}
    </>
  )
}
