import { getTemplates, getSignedPdfUrls } from '@/lib/actions/templates'
import DashboardContent from '@/components/DashboardContent'

export const metadata = {
  title: 'Dashboard | Certificator',
}

export default async function DashboardPage() {
  const { data: templates, error } = await getTemplates()

  // Batch-sign all PDF URLs in one Supabase call (1 client, 1 request)
  const pdfUrls = (templates || []).map((t) => t.pdf_url)
  const { data: signedUrlMap } = await getSignedPdfUrls(pdfUrls)

  const templatesWithUrls = (templates || []).map((t) => ({
    ...t,
    signedPdfUrl: signedUrlMap.get(t.pdf_url) || t.pdf_url,
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Templates
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Manage your certificate templates
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load templates: {error}
        </div>
      )}

      <DashboardContent templates={templatesWithUrls} />
    </div>
  )
}
