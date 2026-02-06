'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Template, TemplateWithLayout } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the storage path from a Supabase Storage URL.
 *
 * URLs follow one of these patterns:
 *   Public:  https://<project>.supabase.co/storage/v1/object/public/templates/<userId>/<file>
 *   Signed:  https://<project>.supabase.co/storage/v1/object/sign/templates/<userId>/<file>?token=...
 *   Auth:    https://<project>.supabase.co/storage/v1/object/authenticated/templates/<userId>/<file>
 *
 * We need the portion *after* the bucket name ("templates/"), i.e. "<userId>/<file>".
 */
function extractStoragePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl)
    const segments = url.pathname.split('/storage/v1/object/')
    if (segments.length < 2) return null

    const afterObject = segments[1]
    const bucketMarker = 'templates/'
    const bucketIdx = afterObject.indexOf(bucketMarker)
    if (bucketIdx === -1) return null

    return afterObject.substring(bucketIdx + bucketMarker.length)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Type assertion helper
// ---------------------------------------------------------------------------

/**
 * Return a loosely-typed table reference from the Supabase client.
 *
 * The hand-written Database generic does not fully resolve through the
 * Supabase SDK's deep conditional type chain (same limitation the
 * keep-alive pulse route works around). Casting `.from()` to `any` is
 * the pragmatic fix recommended by the Supabase team for hand-written
 * (non-generated) types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(supabase: Awaited<ReturnType<typeof createClient>>, name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(name)
}

// ---------------------------------------------------------------------------
// CRUD Actions
// ---------------------------------------------------------------------------

/**
 * Create a template record after the image has been uploaded to storage.
 *
 * The client uploads the file directly to Supabase Storage (to avoid the
 * Vercel 4.5 MB body limit), then calls this action with the resulting URL.
 */
export async function createTemplate(
  name: string,
  imageUrl: string,
): Promise<{ data: Template | null; error: string | null }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: null, error: authError?.message ?? 'Not authenticated' }
    }

    const { data, error } = await table(supabase, 'templates')
      .insert({
        owner_id: user.id,
        name,
        image_url: imageUrl,
      })
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    revalidatePath('/dashboard')
    return { data, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create template'
    return { data: null, error: message }
  }
}

/**
 * Get all templates for the current user, ordered by created_at DESC.
 *
 * RLS ensures only the authenticated user's templates are returned.
 */
export async function getTemplates(): Promise<{
  data: Template[]
  error: string | null
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await table(supabase, 'templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { data: [], error: error.message }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch templates'
    return { data: [], error: message }
  }
}

/**
 * Get a single template together with its layout (if one exists).
 */
export async function getTemplate(
  id: string,
): Promise<{ data: TemplateWithLayout | null; error: string | null }> {
  try {
    const supabase = await createClient()

    const { data: template, error: templateError } = await table(supabase, 'templates')
      .select('*')
      .eq('id', id)
      .single()

    if (templateError) {
      return { data: null, error: templateError.message }
    }

    if (!template) {
      return { data: null, error: 'Template not found' }
    }

    const { data: layout, error: layoutError } = await table(supabase, 'layouts')
      .select('*')
      .eq('template_id', id)
      .maybeSingle()

    if (layoutError) {
      return {
        data: { ...(template as Template), layout: undefined },
        error: layoutError.message,
      }
    }

    const result: TemplateWithLayout = {
      ...(template as Template),
      layout: layout ?? undefined,
    }

    return { data: result, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch template'
    return { data: null, error: message }
  }
}

/**
 * Delete a template, its associated layout (via CASCADE), and the
 * corresponding image file in Supabase Storage.
 */
export async function deleteTemplate(
  id: string,
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()

    const { data: template, error: fetchError } = await table(supabase, 'templates')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      return { error: fetchError.message }
    }

    if (!template) {
      return { error: 'Template not found' }
    }

    const { error: deleteError } = await table(supabase, 'templates')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return { error: deleteError.message }
    }

    // Best-effort storage cleanup
    const storagePath = extractStoragePath((template as Template).image_url)
    if (storagePath) {
      await supabase.storage.from('templates').remove([storagePath])
    }

    revalidatePath('/dashboard')
    return { error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete template'
    return { error: message }
  }
}

/**
 * Generate a signed URL for a template image stored in a private bucket.
 * Signed URLs expire after 1 hour — sufficient for an editing session.
 */
export async function getSignedImageUrl(
  imageUrl: string,
): Promise<{ data: string | null; error: string | null }> {
  try {
    const storagePath = extractStoragePath(imageUrl)
    if (!storagePath) {
      return { data: null, error: 'Invalid image URL' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('templates')
      .createSignedUrl(storagePath, 3600) // 1 hour

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data.signedUrl, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create signed URL'
    return { data: null, error: message }
  }
}

/**
 * Generate signed URLs for multiple images in a single Supabase client call.
 * Much faster than calling getSignedImageUrl() N times (avoids N client
 * instantiations and uses createSignedUrls batch API).
 */
export async function getSignedImageUrls(
  imageUrls: string[],
): Promise<{ data: Map<string, string>; error: string | null }> {
  const result = new Map<string, string>()
  if (imageUrls.length === 0) return { data: result, error: null }

  try {
    const paths: { original: string; storagePath: string }[] = []
    for (const url of imageUrls) {
      const storagePath = extractStoragePath(url)
      if (storagePath) {
        paths.push({ original: url, storagePath })
      }
    }

    if (paths.length === 0) return { data: result, error: null }

    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('templates')
      .createSignedUrls(
        paths.map((p) => p.storagePath),
        3600,
      )

    if (error) {
      return { data: result, error: error.message }
    }

    if (data) {
      data.forEach((item, index) => {
        if (item.signedUrl) {
          result.set(paths[index].original, item.signedUrl)
        }
      })
    }

    return { data: result, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create signed URLs'
    return { data: result, error: message }
  }
}

/**
 * Rename an existing template.
 */
export async function renameTemplate(
  id: string,
  name: string,
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await table(supabase, 'templates')
      .update({ name })
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to rename template'
    return { error: message }
  }
}
