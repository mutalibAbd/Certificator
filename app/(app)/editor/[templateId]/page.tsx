/**
 * Editor Page — Server Component
 *
 * Route: /editor/[templateId]
 *
 * Fetches the template (with its layout) from Supabase via server actions
 * and passes the data to the EditorWorkspace client component.
 *
 * LOADING: Shows a skeleton while the server component resolves.
 * REDIRECT: Sends the user back to /dashboard if the template is not found.
 */

import { redirect } from 'next/navigation';
import { getTemplate, getSignedImageUrl } from '@/lib/actions/templates';
import { EditorWorkspace } from '@/components/EditorWorkspace';

interface EditorPageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { templateId } = await params;

  const { data: template, error } = await getTemplate(templateId);

  if (error || !template) {
    redirect('/dashboard');
  }

  // Create a signed URL so the browser can access the private-bucket image
  const { data: signedUrl } = await getSignedImageUrl(template.image_url);

  return <EditorWorkspace template={template} imageSignedUrl={signedUrl ?? template.image_url} />;
}
