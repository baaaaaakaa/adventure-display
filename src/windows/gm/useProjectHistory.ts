import { useCallback, useEffect, useRef, useState } from 'react'
import { syncProjectState } from '../../lib/playerDisplay'
import type { ProjectState } from '../../types/adventure'

export type ProjectSnapshotEntry = {
  id: string
  label: string
  timestamp: string
  state: ProjectState
}

type CommitProjectStateOptions = {
  label?: string
  recordHistory?: boolean
  resetRedo?: boolean
}

const projectHistoryLimit = 40
const projectSnapshotLimit = 18

function projectStatesEqual(left: ProjectState, right: ProjectState) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneProjectState(state: ProjectState): ProjectState {
  return JSON.parse(JSON.stringify(state)) as ProjectState
}

function createSnapshotId() {
  return `snapshot-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createProjectSnapshot(state: ProjectState, label: string): ProjectSnapshotEntry {
  return {
    id: createSnapshotId(),
    label,
    timestamp: new Date().toISOString(),
    state: cloneProjectState(state),
  }
}

export function useProjectHistory(initialProjectState: ProjectState) {
  const [projectState, setProjectState] = useState<ProjectState>(() => initialProjectState)
  const [projectSnapshots, setProjectSnapshots] = useState<ProjectSnapshotEntry[]>(() => [
    createProjectSnapshot(initialProjectState, 'Старт проекта'),
  ])
  const [undoStack, setUndoStack] = useState<ProjectState[]>([])
  const [redoStack, setRedoStack] = useState<ProjectState[]>([])
  const projectStateRef = useRef(projectState)

  useEffect(() => {
    projectStateRef.current = projectState
  }, [projectState])

  const commitProjectState = useCallback(
    (
      nextStateOrUpdater: ProjectState | ((currentState: ProjectState) => ProjectState),
      options?: CommitProjectStateOptions,
    ) => {
      setProjectState((currentState) => {
        const nextState = syncProjectState(
          typeof nextStateOrUpdater === 'function'
            ? nextStateOrUpdater(currentState)
            : nextStateOrUpdater,
        )

        if (projectStatesEqual(currentState, nextState)) {
          return currentState
        }

        if (options?.recordHistory ?? true) {
          setUndoStack((currentUndoStack) => [
            ...currentUndoStack.slice(-(projectHistoryLimit - 1)),
            currentState,
          ])
          setProjectSnapshots((currentSnapshots) => [
            ...currentSnapshots.slice(-(projectSnapshotLimit - 1)),
            createProjectSnapshot(nextState, options?.label ?? 'Новая точка восстановления'),
          ])
        }

        if (options?.resetRedo ?? true) {
          setRedoStack([])
        }

        return nextState
      })
    },
    [],
  )

  const updateProjectState = useCallback(
    (updater: (currentState: ProjectState) => ProjectState, label = 'Изменение проекта') => {
      commitProjectState(updater, { label })
    },
    [commitProjectState],
  )

  const undoLastChange = useCallback(() => {
    setUndoStack((currentUndoStack) => {
      if (currentUndoStack.length === 0) {
        return currentUndoStack
      }

      const previousState = currentUndoStack[currentUndoStack.length - 1]
      const currentSnapshot = projectStateRef.current

      setRedoStack((currentRedoStack) => [
        ...currentRedoStack.slice(-(projectHistoryLimit - 1)),
        currentSnapshot,
      ])
      setProjectSnapshots((currentSnapshots) => [
        ...currentSnapshots.slice(-(projectSnapshotLimit - 1)),
        createProjectSnapshot(previousState, 'Отмена изменения'),
      ])
      setProjectState(syncProjectState(previousState))

      return currentUndoStack.slice(0, -1)
    })
  }, [])

  const redoLastChange = useCallback(() => {
    setRedoStack((currentRedoStack) => {
      if (currentRedoStack.length === 0) {
        return currentRedoStack
      }

      const nextState = currentRedoStack[currentRedoStack.length - 1]
      const currentSnapshot = projectStateRef.current

      setUndoStack((currentUndoStack) => [
        ...currentUndoStack.slice(-(projectHistoryLimit - 1)),
        currentSnapshot,
      ])
      setProjectSnapshots((currentSnapshots) => [
        ...currentSnapshots.slice(-(projectSnapshotLimit - 1)),
        createProjectSnapshot(nextState, 'Повтор изменения'),
      ])
      setProjectState(syncProjectState(nextState))

      return currentRedoStack.slice(0, -1)
    })
  }, [])

  const restoreProjectSnapshot = useCallback(
    (snapshotId: string) => {
      const targetSnapshot = projectSnapshots.find((snapshot) => snapshot.id === snapshotId)

      if (!targetSnapshot) {
        return
      }

      commitProjectState(cloneProjectState(targetSnapshot.state), {
        label: `Восстановлен снимок: ${targetSnapshot.label}`,
      })
    },
    [commitProjectState, projectSnapshots],
  )

  return {
    projectState,
    projectSnapshots,
    undoStack,
    redoStack,
    commitProjectState,
    updateProjectState,
    undoLastChange,
    redoLastChange,
    restoreProjectSnapshot,
  }
}
