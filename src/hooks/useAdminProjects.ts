import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Project } from '../types/project'
import type { Database } from '../types/database'

export type ProjectDraft = Omit<Project, 'id' | 'created_at'>

type InsertRow = Database['public']['Tables']['projects']['Insert']
type UpdateRow = Database['public']['Tables']['projects']['Update']

export function useAdminProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const { data, error: err } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (showLoading) setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setProjects((data ?? []) as Project[])
    setError(null)
  }, [])

  useEffect(() => { load(true) }, [load])

  async function create(draft: ProjectDraft): Promise<string | null> {
    const { error: err } = await supabase.from('projects').insert([draft as InsertRow])
    if (err) return err.message
    await load(false)
    return null
  }

  async function update(id: string, draft: Partial<ProjectDraft>): Promise<string | null> {
    const { error: err } = await supabase.from('projects').update(draft as UpdateRow).eq('id', id)
    if (err) return err.message
    // Optimistic local update so the UI updates instantly
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...draft } as Project : p))
    // Silently refresh in the background
    load(false)
    return null
  }

  async function remove(id: string): Promise<string | null> {
    const { error: err } = await supabase.from('projects').delete().eq('id', id)
    if (err) return err.message
    // Optimistic local remove so the row disappears instantly
    setProjects(prev => prev.filter(p => p.id !== id))
    // Silently refresh in the background
    load(false)
    return null
  }

  return { projects, loading, error, create, update, remove, reload: load }
}
