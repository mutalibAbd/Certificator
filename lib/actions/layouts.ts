'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DataSource, Layout, LayoutField } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Type assertion helper
// ---------------------------------------------------------------------------

/**
 * Return a loosely-typed table reference from the Supabase client.
 *
 * Same workaround used in templates.ts and the keep-alive pulse route:
 * the hand-written Database generic does not fully resolve through the
 * Supabase SDK's deep conditional type chain.
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
 * Save (upsert) a layout for a template.
 *
 * If a layout already exists for the given template_id, its config is updated.
 * Otherwise a new layout row is inserted.
 *
 * Uses a select-then-insert/update pattern because the layouts table does not
 * have a unique constraint on template_id.
 *
 * @param dataSource - When provided, persists the imported data file alongside
 *   the layout. Pass `null` to explicitly clear stored data. Pass `undefined`
 *   (or omit) to leave the existing data_source unchanged.
 */
export async function saveLayout(
  templateId: string,
  config: LayoutField[],
  dataSource?: DataSource | null,
): Promise<{ data: Layout | null; error: string | null }> {
  try {
    const supabase = await createClient()

    // Check whether a layout already exists for this template
    const { data: existing, error: fetchError } = await table(supabase, 'layouts')
      .select('*')
      .eq('template_id', templateId)
      .maybeSingle()

    if (fetchError) {
      return { data: null, error: fetchError.message }
    }

    // Build the payload — only include data_source when explicitly provided
    const payload: Record<string, unknown> = { config }
    if (dataSource !== undefined) {
      payload.data_source = dataSource
    }

    if (existing) {
      // Update the existing layout
      const { data, error } = await table(supabase, 'layouts')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return { data: null, error: error.message }
      }

      revalidatePath('/dashboard')
      return { data, error: null }
    }

    // Insert a new layout
    const { data, error } = await table(supabase, 'layouts')
      .insert({ template_id: templateId, ...payload })
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    revalidatePath('/dashboard')
    return { data, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to save layout'
    return { data: null, error: message }
  }
}

/**
 * Get the layout for a template.
 *
 * Returns null (without error) when the template has no layout yet.
 * RLS ensures the caller can only access layouts belonging to their templates.
 */
export async function getLayout(
  templateId: string,
): Promise<{ data: Layout | null; error: string | null }> {
  try {
    const supabase = await createClient()

    const { data, error } = await table(supabase, 'layouts')
      .select('*')
      .eq('template_id', templateId)
      .maybeSingle()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data ?? null, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch layout'
    return { data: null, error: message }
  }
}

/**
 * Delete the layout for a template.
 *
 * This is a no-op (succeeds silently) when the template has no layout.
 * RLS ensures the caller can only delete layouts belonging to their templates.
 */
export async function deleteLayout(
  templateId: string,
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await table(supabase, 'layouts')
      .delete()
      .eq('template_id', templateId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete layout'
    return { error: message }
  }
}
