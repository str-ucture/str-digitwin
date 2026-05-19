import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Project, ProjectFilters } from '../types/project'

export function useProjects(filters: ProjectFilters) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchProjects() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('projects')
        .select('*')
        .eq('visible', true)
        .order('featured', { ascending: false })
        .order('completion_date', { ascending: false })

      if (filters.type !== 'all') {
        query = query.eq('type', filters.type)
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters.year !== null) {
        query = query
          .gte('completion_date', `${filters.year}-01-01`)
          .lte('completion_date', `${filters.year}-12-31`)
      }
      if (filters.search.trim()) {
        const term = filters.search.trim()
        query = query.or(
          `name_en.ilike.%${term}%,name_de.ilike.%${term}%,address.ilike.%${term}%,client.ilike.%${term}%`,
        )
      }

      const { data, error: err } = await query

      if (cancelled) return

      if (err) {
        setError(err.message)
        setProjects([])
      } else {
        setProjects((data ?? []) as Project[])
      }
      setLoading(false)
    }

    fetchProjects()
    return () => {
      cancelled = true
    }
  }, [filters, reloadTrigger])

  const reload = useCallback(() => setReloadTrigger(t => t + 1), [])

  return { projects, loading, error, reload }
}
