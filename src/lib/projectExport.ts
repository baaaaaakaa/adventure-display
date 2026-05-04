import type { ProjectState } from '../types/adventure'

export type ProjectExportPackage = {
  kind: 'adventure-display-project'
  version: 1
  exportedAt: string
  project: ProjectState
}

export function createProjectExportPackage(project: ProjectState): ProjectExportPackage {
  return {
    kind: 'adventure-display-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
  }
}
