import { useProjects } from '../../hooks/useProjects'

interface ProjectSelectorProps {
  selectedProjectId: number | null
  onSelectProject: (projectId: number) => void
  projectTypeFilter?: 'audio' | 'text'
}

export default function ProjectSelector({
  selectedProjectId,
  onSelectProject,
  projectTypeFilter,
}: ProjectSelectorProps) {
  const { data: projects, isLoading } = useProjects()
  const filteredProjects = projects?.filter((project) =>
    projectTypeFilter ? project.project_type === projectTypeFilter : true
  )

  if (isLoading) {
    return (
      <select className="block w-full px-3 py-2 bg-input border border-border rounded-lg shadow-sm text-foreground">
        <option>Loading...</option>
      </select>
    )
  }

  if (!filteredProjects || filteredProjects.length === 0) {
    return (
      <div className="text-sm text-muted-foreground"></div>
    )
  }

  return (
    <select
      value={selectedProjectId || ''}
      onChange={(e) => {
        const id = parseInt(e.target.value)
        if (id) onSelectProject(id)
      }}
      className="block w-full px-3 py-2 bg-input border border-border rounded-lg shadow-sm text-input-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
    >
      <option value="">Select a project...</option>
      {filteredProjects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.project_type === 'text' ? '✍️' : '🎙️'} {project.name}
        </option>
      ))}
    </select>
  )
}
