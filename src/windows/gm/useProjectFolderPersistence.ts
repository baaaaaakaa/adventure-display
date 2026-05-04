import { useEffect, useRef, useState } from 'react'
import {
  ensureProjectDirectoryPermission,
  isMissingProjectFolderFileError,
  loadProjectFromDirectory,
  pickProjectDirectory,
  rememberProjectDirectory,
  restoreProjectDirectory,
  restoreRememberedProjectDirectoryMeta,
  saveProjectToDirectory,
  supportsProjectFolders,
} from '../../lib/projectFolder'
import type { ProjectState } from '../../types/adventure'

type ImportFeedback = {
  tone: 'success' | 'error'
  text: string
}

type ProjectDirectoryAccessMode = 'readonly' | 'readwrite' | null
type ProjectPersistenceStatus = 'disconnected' | 'permission' | 'readonly' | 'saving' | 'saved' | 'error'

type LoadedProjectOptions = {
  feedbackText: string
  historyLabel: string
  skipFeedback?: boolean
}

type UseProjectFolderPersistenceOptions = {
  projectState: ProjectState
  onProjectLoaded: (project: ProjectState, options: LoadedProjectOptions) => void
  setImportFeedback: (feedback: ImportFeedback) => void
}

export function useProjectFolderPersistence({
  projectState,
  onProjectLoaded,
  setImportFeedback,
}: UseProjectFolderPersistenceOptions) {
  const [projectDirectoryHandle, setProjectDirectoryHandle] =
    useState<FileSystemDirectoryHandle | null>(null)
  const [projectDirectoryAccessMode, setProjectDirectoryAccessMode] =
    useState<ProjectDirectoryAccessMode>(null)
  const [projectPersistenceStatus, setProjectPersistenceStatus] =
    useState<ProjectPersistenceStatus>('disconnected')
  const [projectPersistenceError, setProjectPersistenceError] = useState<string | null>(null)
  const [lastProjectSaveAt, setLastProjectSaveAt] = useState<number | null>(null)
  const [rememberedProjectDirectoryName, setRememberedProjectDirectoryName] = useState<string | null>(null)
  const [isProjectReconnectModalOpen, setIsProjectReconnectModalOpen] = useState(false)
  const [isProjectReconnectPending, setIsProjectReconnectPending] = useState(false)
  const autosaveRequestRef = useRef(0)
  const hasRestoredProjectDirectoryRef = useRef(false)
  const onProjectLoadedRef = useRef(onProjectLoaded)
  const isProjectFoldersSupported = supportsProjectFolders()

  useEffect(() => {
    onProjectLoadedRef.current = onProjectLoaded
  }, [onProjectLoaded])

  useEffect(() => {
    if (!supportsProjectFolders() || hasRestoredProjectDirectoryRef.current) {
      return
    }

    hasRestoredProjectDirectoryRef.current = true
    let isCancelled = false

    void (async () => {
      let directoryHandle: FileSystemDirectoryHandle | null = null
      let rememberedDirectoryName: string | null = null

      try {
        const rememberedMeta = await restoreRememberedProjectDirectoryMeta()
        rememberedDirectoryName = rememberedMeta?.name ?? null
        if (!isCancelled) {
          setRememberedProjectDirectoryName(rememberedDirectoryName)
        }
        directoryHandle = await restoreProjectDirectory()
      } catch {
        if (rememberedDirectoryName && !isCancelled) {
          setProjectPersistenceStatus('permission')
          setProjectPersistenceError(null)
          setLastProjectSaveAt(null)
        }
        return
      }

      if (!directoryHandle) {
        if (rememberedDirectoryName && !isCancelled) {
          setProjectPersistenceStatus('permission')
          setProjectPersistenceError(null)
          setLastProjectSaveAt(null)
        }
        return
      }

      try {
        const hasWritePermission = await ensureProjectDirectoryPermission(directoryHandle, 'readwrite', {
          request: false,
        })

        const hasReadPermission =
          hasWritePermission ||
          (await ensureProjectDirectoryPermission(directoryHandle, 'read', {
            request: false,
          }))

        if (!hasReadPermission) {
          if (isCancelled) {
            return
          }

          setProjectDirectoryHandle(directoryHandle)
          setProjectDirectoryAccessMode(null)
          setProjectPersistenceStatus('permission')
          setProjectPersistenceError(null)
          setLastProjectSaveAt(null)
          return
        }

        const loadedProject = await loadProjectFromDirectory(directoryHandle)

        if (isCancelled) {
          return
        }

        setProjectDirectoryHandle(directoryHandle)
        setRememberedProjectDirectoryName(directoryHandle.name)
        setProjectDirectoryAccessMode(hasWritePermission ? 'readwrite' : 'readonly')
        setProjectPersistenceStatus(hasWritePermission ? 'saved' : 'readonly')
        setProjectPersistenceError(null)
        setLastProjectSaveAt(null)
        onProjectLoadedRef.current(loadedProject, {
          feedbackText: `Проект открыт из папки "${directoryHandle.name}".`,
          historyLabel: 'Открыт проект из папки по умолчанию',
          skipFeedback: true,
        })
      } catch {
        return
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      projectPersistenceStatus === 'permission' &&
      (projectDirectoryHandle || rememberedProjectDirectoryName)
    ) {
      setIsProjectReconnectModalOpen(true)
      return
    }

    setIsProjectReconnectModalOpen(false)
    setIsProjectReconnectPending(false)
  }, [projectDirectoryHandle, projectPersistenceStatus, rememberedProjectDirectoryName])

  useEffect(() => {
    if (!projectDirectoryHandle) {
      setProjectDirectoryAccessMode(null)
      setProjectPersistenceStatus(rememberedProjectDirectoryName ? 'permission' : 'disconnected')
      setProjectPersistenceError(null)
      setLastProjectSaveAt(null)
      return
    }

    if (projectDirectoryAccessMode === null) {
      setProjectPersistenceStatus('permission')
      setProjectPersistenceError(null)
      return
    }

    if (projectDirectoryAccessMode !== 'readwrite') {
      setProjectPersistenceStatus('readonly')
      setProjectPersistenceError(null)
      return
    }

    const requestId = autosaveRequestRef.current + 1
    autosaveRequestRef.current = requestId
    const timeoutId = window.setTimeout(() => {
      setProjectPersistenceStatus('saving')
      setProjectPersistenceError(null)

      void saveProjectToDirectory(projectDirectoryHandle, projectState)
        .then(() => {
          if (autosaveRequestRef.current !== requestId) {
            return
          }

          setProjectPersistenceStatus('saved')
          setProjectPersistenceError(null)
          setLastProjectSaveAt(Date.now())
        })
        .catch((error: unknown) => {
          if (autosaveRequestRef.current !== requestId) {
            return
          }

          setProjectPersistenceStatus('error')
          setProjectPersistenceError(
            error instanceof Error ? error.message : 'Не удалось сохранить проект в папку.',
          )
        })
    }, 600)

    return () => window.clearTimeout(timeoutId)
  }, [projectDirectoryAccessMode, projectDirectoryHandle, projectState, rememberedProjectDirectoryName])

  const projectPersistenceMessage = !projectDirectoryHandle
    ? supportsProjectFolders()
      ? rememberedProjectDirectoryName
        ? `Ранее была выбрана папка "${rememberedProjectDirectoryName}", но браузер просит заново подтвердить доступ.`
        : 'Папка проекта не подключена. Изменения не переживут перезагрузку страницы.'
      : 'Этот браузер не поддерживает папки проекта. Сохраняй проект экспортом файла.'
    : projectDirectoryAccessMode === null
      ? `Папка "${projectDirectoryHandle.name}" запомнена, но браузер требует заново подтвердить доступ. Нажми открыть или сохранить папку.`
      : projectDirectoryAccessMode === 'readonly'
        ? `Папка "${projectDirectoryHandle.name}" подключена в режиме чтения. Для автосохранения заново выбери или сохрани папку.`
      : projectPersistenceStatus === 'saving'
        ? `Сохраняем изменения в папку "${projectDirectoryHandle.name}"...`
      : projectPersistenceStatus === 'error'
        ? projectPersistenceError ?? `Не удалось сохранить проект в папку "${projectDirectoryHandle.name}".`
        : lastProjectSaveAt
          ? `Автосохранено в папку "${projectDirectoryHandle.name}" в ${new Date(lastProjectSaveAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}.`
          : `Папка "${projectDirectoryHandle.name}" подключена. Автосохранение включено.`

  async function handleOpenProjectFolder(forcePicker = false) {
    if (!supportsProjectFolders()) {
      setImportFeedback({
        tone: 'error',
        text: 'Этот браузер не поддерживает открытие папок проекта.',
      })
      return
    }

    try {
      const rememberedDirectoryHandle =
        !forcePicker &&
        projectDirectoryHandle &&
        (projectDirectoryAccessMode === null || projectDirectoryAccessMode === 'readonly')
          ? projectDirectoryHandle
          : null
      const directoryHandle =
        rememberedDirectoryHandle ?? (await pickProjectDirectory('readwrite'))
      const hasPermission = await ensureProjectDirectoryPermission(directoryHandle, 'readwrite', {
        request: true,
      })

      if (!hasPermission) {
        setProjectDirectoryHandle(directoryHandle)
        setProjectDirectoryAccessMode(null)
        setProjectPersistenceStatus('permission')
        setProjectPersistenceError(null)
        return
      }

      let loadedProject: ProjectState | null = null
      let didInitializeEmptyFolder = false

      try {
        loadedProject = await loadProjectFromDirectory(directoryHandle)
      } catch (error) {
        if (!isMissingProjectFolderFileError(error)) {
          throw error
        }

        await saveProjectToDirectory(directoryHandle, projectState)
        didInitializeEmptyFolder = true
      }

      await rememberProjectDirectory(directoryHandle).catch(() => undefined)

      setProjectDirectoryHandle(directoryHandle)
      setRememberedProjectDirectoryName(directoryHandle.name)
      setProjectDirectoryAccessMode('readwrite')
      setProjectPersistenceStatus('saved')
      setProjectPersistenceError(null)
      setLastProjectSaveAt(didInitializeEmptyFolder ? Date.now() : null)

      if (loadedProject) {
        onProjectLoaded(loadedProject, {
          feedbackText: `Проект открыт из папки "${directoryHandle.name}".`,
          historyLabel: 'Открыт проект из папки',
        })
        return
      }

      setImportFeedback({
        tone: 'success',
        text: `Папка "${directoryHandle.name}" подключена. Текущий проект сохранён в неё.`,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось открыть папку проекта.',
      })
    }
  }

  async function handleReconnectRememberedProjectDirectory() {
    if (!projectDirectoryHandle) {
      return
    }

    setIsProjectReconnectPending(true)

    try {
      const hasWritePermission = await ensureProjectDirectoryPermission(
        projectDirectoryHandle,
        'readwrite',
        {
          request: true,
        },
      )
      const hasReadPermission =
        hasWritePermission ||
        (await ensureProjectDirectoryPermission(projectDirectoryHandle, 'read', {
          request: true,
        }))

      if (!hasReadPermission) {
        setProjectDirectoryAccessMode(null)
        setProjectPersistenceStatus('permission')
        setProjectPersistenceError(null)
        return
      }

      const loadedProject = await loadProjectFromDirectory(projectDirectoryHandle)
      await rememberProjectDirectory(projectDirectoryHandle).catch(() => undefined)

      setProjectDirectoryAccessMode(hasWritePermission ? 'readwrite' : 'readonly')
      setProjectPersistenceStatus(hasWritePermission ? 'saved' : 'readonly')
      setProjectPersistenceError(null)
      setLastProjectSaveAt(null)
      onProjectLoaded(loadedProject, {
        feedbackText: `Папка "${projectDirectoryHandle.name}" снова подключена.`,
        historyLabel: 'Подтверждён доступ к папке проекта',
      })
      setIsProjectReconnectModalOpen(false)
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось подтвердить доступ к папке проекта.',
      })
    } finally {
      setIsProjectReconnectPending(false)
    }
  }

  async function handleSaveProjectFolder() {
    if (!supportsProjectFolders()) {
      setImportFeedback({
        tone: 'error',
        text: 'Этот браузер не поддерживает сохранение проекта в папку.',
      })
      return
    }

    try {
      const directoryHandle = projectDirectoryHandle ?? (await pickProjectDirectory('readwrite'))
      const hasPermission = await ensureProjectDirectoryPermission(directoryHandle, 'readwrite', {
        request: true,
      })

      if (!hasPermission) {
        setProjectDirectoryHandle(directoryHandle)
        setProjectDirectoryAccessMode(null)
        setProjectPersistenceStatus('permission')
        setProjectPersistenceError(null)
        return
      }

      await saveProjectToDirectory(directoryHandle, projectState)
      await rememberProjectDirectory(directoryHandle).catch(() => undefined)
      setProjectDirectoryHandle(directoryHandle)
      setRememberedProjectDirectoryName(directoryHandle.name)
      setProjectDirectoryAccessMode('readwrite')
      setProjectPersistenceStatus('saved')
      setProjectPersistenceError(null)
      setLastProjectSaveAt(Date.now())
      setImportFeedback({
        tone: 'success',
        text: `Проект сохранён в папку "${directoryHandle.name}".`,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить проект в папку.',
      })
      setProjectPersistenceStatus('error')
      setProjectPersistenceError(
        error instanceof Error ? error.message : 'Не удалось сохранить проект в папку.',
      )
    }
  }

  return {
    projectDirectoryHandle,
    isProjectFoldersSupported,
    projectPersistenceStatus,
    projectPersistenceMessage,
    rememberedProjectDirectoryName,
    isProjectReconnectModalOpen,
    isProjectReconnectPending,
    setIsProjectReconnectModalOpen,
    handleOpenProjectFolder,
    handleReconnectRememberedProjectDirectory,
    handleSaveProjectFolder,
  }
}
