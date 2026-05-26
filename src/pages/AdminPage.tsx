import { useState } from 'react'
import { useAdminProjects } from '../hooks/useAdminProjects'
import type { Project } from '../types/project'
import type { ProjectDraft } from '../hooks/useAdminProjects'
import ProjectForm from '../components/Admin/ProjectForm'
import ConfirmDialog from '../components/Admin/ConfirmDialog'
import Toast, { useToast } from '../components/Admin/Toast'
import AdminHeader from '../components/Admin/AdminHeader'
import AdminSearchBar from '../components/Admin/AdminSearchBar'
import ProjectTable from '../components/Admin/ProjectTable'
import ProjectGrid from '../components/Admin/ProjectGrid'
import Header from '../components/UI/Header'

export default function AdminPage() {
  const { projects, loading, error, create, update, remove } = useAdminProjects()
  const { toasts, showToast } = useToast()
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return (
      p.name_en.toLowerCase().includes(q) ||
      p.name_de.toLowerCase().includes(q) ||
      (p.client ?? '').toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q)
    )
  })

  async function handleSave(draft: ProjectDraft, id?: string) {
    const err = id ? await update(id, draft) : await create(draft)
    if (err) {
      showToast(err, 'error')
    } else {
      if (id) {
        showToast('Project updated successfully', 'success')
        setEditing(prev => prev && prev !== 'new' ? ({ ...prev, ...draft } as Project) : prev)
      } else {
        showToast('Project created successfully', 'success')
        setEditing(null)
      }
    }
  }

  async function handleDelete() {
    if (!deletingId) return
    const err = await remove(deletingId)
    if (err) showToast(err, 'error')
    else showToast('Project deleted', 'success')
    setDeletingId(null)
  }

  async function handleToggleVisible(id: string, currentVisible: boolean) {
    const nextVisible = !currentVisible
    const err = await update(id, { visible: nextVisible })
    if (err) {
      showToast(err, 'error')
    }
  }

  const deletingProject = projects.find(p => p.id === deletingId)

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <AdminHeader
        activeTab="admin"
        loading={loading}
        projectCount={projects.length}
      />

      <div className="flex-1 p-6 flex flex-col min-h-0">
        <AdminSearchBar
          value={search}
          onChange={setSearch}
          resultsCount={filtered.length}
          showResultsCount={!!search}
          onAddProject={() => setEditing('new')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-400 text-sm animate-pulse">Loading projects…</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-sm text-red-600 font-medium">Failed to load projects</p>
            <p className="text-xs text-red-400 mt-1">{error}</p>
          </div>
        ) : viewMode === 'table' ? (
          <ProjectTable
            projects={filtered}
            onEdit={setEditing}
            onDelete={setDeletingId}
            onToggleVisible={handleToggleVisible}
            onAddNew={() => setEditing('new')}
            isSearching={!!search}
          />
        ) : (
          <ProjectGrid
            projects={filtered}
            onEdit={setEditing}
            onDelete={setDeletingId}
            onToggleVisible={handleToggleVisible}
            onAddNew={() => setEditing('new')}
            isSearching={!!search}
          />
        )}
      </div>

      {editing !== null && (
        <ProjectForm
          project={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deletingId && (
        <ConfirmDialog
          title="Delete project"
          message={`"${deletingProject?.name_en ?? 'This project'}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
          destructive
        />
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
