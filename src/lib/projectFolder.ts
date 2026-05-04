import type {
  Adventure,
  MonsterBlock,
  ProjectState,
  SessionState,
} from '../types/adventure'

type LegacyProjectFolderPackage = {
  kind: 'adventure-display-project'
  version: 2
  exportedAt: string
  project: ProjectState
}

type ProjectFolderIndexEntry = {
  id: string
  path: string
}

type ProjectFolderIndex = {
  kind: 'adventure-display-project'
  version: 3
  exportedAt: string
  activeAdventureId: string | null
  adventureOrder: string[]
  adventures: ProjectFolderIndexEntry[]
  monsterLibraryPath: string
}

type MonsterLibraryEntry = {
  id: string
  monsterId: string
  sourceAdventureId?: string
  sourceSceneId?: string
  monster: MonsterBlock
}

type MonsterLibraryPackage = {
  kind: 'adventure-display-monster-library'
  version: 1
  exportedAt: string
  monsters: MonsterLibraryEntry[]
}

type RememberedProjectDirectoryMeta = {
  name: string
  updatedAt: string
}

type DirectoryPickerOptions = {
  id?: string
  mode?: 'read' | 'readwrite'
}

type MaybeDirectoryPickerWindow = Window & {
  showDirectoryPicker?: (
    options?: DirectoryPickerOptions,
  ) => Promise<FileSystemDirectoryHandle>
}

type FileSystemPermissionMode = 'read' | 'readwrite'

type MaybePermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>
  requestPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>
}

const textEncoder = new TextEncoder()
const projectFolderPickerId = 'adventure-display-project-folder'
const projectFolderHandleDatabaseName = 'adventure-display-project-folder-db'
const projectFolderHandleStoreName = 'handles'
const defaultProjectFolderHandleKey = 'default'
const defaultProjectFolderMetaKey = 'default-meta'
const monsterLibraryPath = 'monsters/library.json'

function isAssetPathReference(value: string) {
  return /^assets\//.test(value) || /^adventures\//.test(value) || /^monsters\//.test(value)
}

function isRuntimeAssetUrl(value: string) {
  return value.startsWith('blob:') || value.startsWith('data:')
}

function sanitizePathSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'asset'
  )
}

function inferExtension(mimeType: string, originalName: string, fallback = 'bin') {
  const fromName = originalName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()

  if (fromName) {
    return fromName
  }

  if (mimeType === 'image/png') {
    return 'png'
  }

  if (mimeType === 'image/jpeg') {
    return 'jpg'
  }

  if (mimeType === 'image/webp') {
    return 'webp'
  }

  if (mimeType === 'image/gif') {
    return 'gif'
  }

  if (mimeType === 'audio/mpeg') {
    return 'mp3'
  }

  if (mimeType === 'audio/ogg') {
    return 'ogg'
  }

  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
    return 'wav'
  }

  return fallback
}

function cloneProjectState(project: ProjectState) {
  return JSON.parse(JSON.stringify(project)) as ProjectState
}

function cloneMonsterBlock(monster: MonsterBlock) {
  return JSON.parse(JSON.stringify(monster)) as MonsterBlock
}

function buildAdventureFolderPath(adventureId: string) {
  return `adventures/${sanitizePathSegment(adventureId)}`
}

async function ensureDirectory(root: FileSystemDirectoryHandle, relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  let current = root

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true })
  }

  return current
}

async function getDirectory(root: FileSystemDirectoryHandle, relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  let current = root

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment)
  }

  return current
}

async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string,
) {
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    throw new Error('Не удалось определить имя файла для сохранения.')
  }

  const directory = await ensureDirectory(root, segments.join('/'))
  const fileHandle = await directory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(textEncoder.encode(content))
  await writable.close()
}

async function writeBlobFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  blob: Blob,
) {
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    throw new Error('Не удалось определить имя файла ассета.')
  }

  const directory = await ensureDirectory(root, segments.join('/'))
  const fileHandle = await directory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

async function readTextFile(root: FileSystemDirectoryHandle, relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    throw new Error('Не удалось определить имя файла проекта.')
  }

  const directory = await getDirectory(root, segments.join('/'))
  const fileHandle = await directory.getFileHandle(fileName)
  const file = await fileHandle.getFile()

  return file.text()
}

async function readBlobFromPath(root: FileSystemDirectoryHandle, relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    throw new Error('Не удалось определить имя файла ассета.')
  }

  const directory = await getDirectory(root, segments.join('/'))
  const fileHandle = await directory.getFileHandle(fileName)

  return fileHandle.getFile()
}

async function blobFromUrl(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Не удалось прочитать ассет: ${response.status}`)
  }

  return response.blob()
}

type PersistContext = {
  root: FileSystemDirectoryHandle
  writtenBySource: Map<string, string>
}

async function persistAssetUrl(
  context: PersistContext,
  sourceUrl: string | null | undefined,
  preferredPath: string,
  mimeType: string,
  originalName: string,
) {
  if (!sourceUrl) {
    return sourceUrl ?? null
  }

  if (!isRuntimeAssetUrl(sourceUrl)) {
    return sourceUrl
  }

  const cachedPath = context.writtenBySource.get(sourceUrl)

  if (cachedPath) {
    return cachedPath
  }

  const blob = await blobFromUrl(sourceUrl)
  const extension = inferExtension(mimeType || blob.type, originalName)
  const nextPath = `${preferredPath}.${extension}`

  await writeBlobFile(context.root, nextPath, blob)
  context.writtenBySource.set(sourceUrl, nextPath)

  return nextPath
}

function buildMonsterLibrary(project: ProjectState): MonsterLibraryPackage {
  const monsters: MonsterLibraryEntry[] = project.monsterLibrary.map((monster) => ({
    id: monster.id,
    monsterId: monster.id,
    monster: cloneMonsterBlock(monster),
  }))

  return {
    kind: 'adventure-display-monster-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    monsters,
  }
}

async function persistProjectAssets(
  root: FileSystemDirectoryHandle,
  projectState: ProjectState,
) {
  const project = cloneProjectState(projectState)
  const context: PersistContext = {
    root,
    writtenBySource: new Map(),
  }

  for (const adventureId of project.adventureOrder) {
    const adventure = project.adventures[adventureId]
    const session = project.sessions[adventureId]

    if (!adventure || !session) {
      continue
    }

    const adventureFolderPath = buildAdventureFolderPath(adventure.id)

    for (const asset of adventure.assetLibrary) {
      asset.dataUrl =
        (await persistAssetUrl(
          context,
          asset.dataUrl,
          `${adventureFolderPath}/assets/library/${asset.kind}/${sanitizePathSegment(asset.id)}`,
          asset.mimeType,
          asset.originalName,
        )) ?? asset.dataUrl
    }

    for (const character of adventure.characters ?? []) {
      character.avatarSrc =
        (await persistAssetUrl(
          context,
          character.avatarSrc,
          `${adventureFolderPath}/characters/${sanitizePathSegment(character.id)}/avatar`,
          'image/webp',
          `${character.id}.webp`,
        )) ?? character.avatarSrc
    }

    for (const monster of adventure.monsterLibrary ?? []) {
      monster.imageSrc =
        (await persistAssetUrl(
          context,
          monster.imageSrc,
          `${adventureFolderPath}/monsters/${sanitizePathSegment(monster.id)}`,
          'image/webp',
          `${monster.id}.webp`,
        )) ?? monster.imageSrc
    }

    for (const scene of adventure.scenes) {
      const sceneFolderPath = `${adventureFolderPath}/scenes/${sanitizePathSegment(scene.id)}`

      scene.map.imageSrc =
        (await persistAssetUrl(
          context,
          scene.map.imageSrc,
          `${sceneFolderPath}/map`,
          'image/webp',
          `${scene.id}-map.webp`,
        )) ?? scene.map.imageSrc
      scene.splash.imageSrc =
        (await persistAssetUrl(
          context,
          scene.splash.imageSrc,
          `${sceneFolderPath}/splash`,
          'image/webp',
          `${scene.id}-splash.webp`,
        )) ?? scene.splash.imageSrc

      for (const handout of scene.handouts) {
        handout.imageSrc =
          (await persistAssetUrl(
            context,
            handout.imageSrc,
            `${sceneFolderPath}/handouts/${sanitizePathSegment(handout.id)}`,
            'image/webp',
            `${handout.id}.webp`,
          )) ?? handout.imageSrc
      }

      for (const monster of scene.monsterBlocks) {
        monster.imageSrc =
          (await persistAssetUrl(
            context,
            monster.imageSrc,
            `monsters/assets/${sanitizePathSegment(adventure.id)}/${sanitizePathSegment(scene.id)}/${sanitizePathSegment(monster.id)}`,
            'image/webp',
            `${monster.id}.webp`,
          )) ?? monster.imageSrc
      }

      const sceneState = session.sceneStates[scene.id]

      if (!sceneState) {
        continue
      }

      sceneState.mapImageSrc =
        (await persistAssetUrl(
          context,
          sceneState.mapImageSrc,
          `${adventureFolderPath}/runtime/${sanitizePathSegment(scene.id)}/map`,
          'image/webp',
          `${scene.id}-runtime-map.webp`,
        )) ?? sceneState.mapImageSrc

      for (const layer of sceneState.mapLayers) {
        layer.imageSrc =
          (await persistAssetUrl(
            context,
            layer.imageSrc,
            `${adventureFolderPath}/runtime/${sanitizePathSegment(scene.id)}/layers/${sanitizePathSegment(layer.id)}`,
            'image/webp',
            `${layer.id}.webp`,
          )) ?? layer.imageSrc
      }

      for (const token of sceneState.tokens) {
        token.imageSrc =
          (await persistAssetUrl(
            context,
            token.imageSrc,
            `${adventureFolderPath}/runtime/${sanitizePathSegment(scene.id)}/tokens/${sanitizePathSegment(token.id)}`,
            'image/webp',
            `${token.id}.webp`,
          )) ?? token.imageSrc
      }
    }
  }

  for (const monster of project.monsterLibrary) {
    monster.imageSrc =
      (await persistAssetUrl(
        context,
        monster.imageSrc,
        `monsters/assets/library/${sanitizePathSegment(monster.id)}`,
        'image/webp',
        `${monster.id}.webp`,
      )) ?? monster.imageSrc
  }

  return project
}

export async function saveProjectToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  projectState: ProjectState,
) {
  const project = await persistProjectAssets(directoryHandle, projectState)
  const exportedAt = new Date().toISOString()
  const indexEntries: ProjectFolderIndexEntry[] = []

  for (const adventureId of project.adventureOrder) {
    const adventure = project.adventures[adventureId]
    const session = project.sessions[adventureId]

    if (!adventure || !session) {
      continue
    }

    const adventureFolderPath = buildAdventureFolderPath(adventure.id)

    indexEntries.push({
      id: adventure.id,
      path: adventureFolderPath,
    })

    await writeTextFile(
      directoryHandle,
      `${adventureFolderPath}/adventure.json`,
      JSON.stringify(adventure, null, 2),
    )
    await writeTextFile(
      directoryHandle,
      `${adventureFolderPath}/session.json`,
      JSON.stringify(session, null, 2),
    )
  }

  const projectIndex: ProjectFolderIndex = {
    kind: 'adventure-display-project',
    version: 3,
    exportedAt,
    activeAdventureId: project.activeAdventureId,
    adventureOrder: project.adventureOrder,
    adventures: indexEntries,
    monsterLibraryPath,
  }

  await writeTextFile(directoryHandle, 'project.json', JSON.stringify(projectIndex, null, 2))
  await writeTextFile(
    directoryHandle,
    monsterLibraryPath,
    JSON.stringify(buildMonsterLibrary(project), null, 2),
  )
}

type ResolveContext = {
  root: FileSystemDirectoryHandle
  objectUrlsByPath: Map<string, string>
}

async function resolveAssetPath(
  context: ResolveContext,
  value: string | null | undefined,
) {
  if (!value) {
    return value ?? null
  }

  if (!isAssetPathReference(value)) {
    return value
  }

  const cachedUrl = context.objectUrlsByPath.get(value)

  if (cachedUrl) {
    return cachedUrl
  }

  const blob = await readBlobFromPath(context.root, value)
  const objectUrl = URL.createObjectURL(blob)
  context.objectUrlsByPath.set(value, objectUrl)

  return objectUrl
}

async function resolveProjectAssets(
  root: FileSystemDirectoryHandle,
  projectState: ProjectState,
) {
  const resolvedProject = cloneProjectState(projectState)
  const context: ResolveContext = {
    root,
    objectUrlsByPath: new Map(),
  }

  for (const adventureId of resolvedProject.adventureOrder) {
    const adventure = resolvedProject.adventures[adventureId]
    const session = resolvedProject.sessions[adventureId]

    if (!adventure || !session) {
      continue
    }

    for (const asset of adventure.assetLibrary) {
      asset.dataUrl = (await resolveAssetPath(context, asset.dataUrl)) ?? asset.dataUrl
    }

    for (const character of adventure.characters ?? []) {
      character.avatarSrc =
        (await resolveAssetPath(context, character.avatarSrc)) ?? character.avatarSrc
    }

    for (const monster of adventure.monsterLibrary ?? []) {
      monster.imageSrc = (await resolveAssetPath(context, monster.imageSrc)) ?? monster.imageSrc
    }

    for (const scene of adventure.scenes) {
      scene.map.imageSrc = (await resolveAssetPath(context, scene.map.imageSrc)) ?? scene.map.imageSrc
      scene.splash.imageSrc =
        (await resolveAssetPath(context, scene.splash.imageSrc)) ?? scene.splash.imageSrc

      for (const handout of scene.handouts) {
        handout.imageSrc = (await resolveAssetPath(context, handout.imageSrc)) ?? handout.imageSrc
      }

      for (const monster of scene.monsterBlocks) {
        monster.imageSrc = (await resolveAssetPath(context, monster.imageSrc)) ?? monster.imageSrc
      }

      const sceneState = session.sceneStates[scene.id]

      if (!sceneState) {
        continue
      }

      sceneState.mapImageSrc =
        (await resolveAssetPath(context, sceneState.mapImageSrc)) ?? sceneState.mapImageSrc

      for (const layer of sceneState.mapLayers) {
        layer.imageSrc = (await resolveAssetPath(context, layer.imageSrc)) ?? layer.imageSrc
      }

      for (const token of sceneState.tokens) {
        token.imageSrc = (await resolveAssetPath(context, token.imageSrc)) ?? token.imageSrc
      }
    }
  }

  for (const monster of resolvedProject.monsterLibrary) {
    monster.imageSrc = (await resolveAssetPath(context, monster.imageSrc)) ?? monster.imageSrc
  }

  return resolvedProject
}

function isLegacyProjectFolderPackage(
  value: unknown,
): value is LegacyProjectFolderPackage {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'kind' in value &&
    value.kind === 'adventure-display-project' &&
    'version' in value &&
    value.version === 2 &&
    'project' in value
  )
}

function isProjectFolderIndex(value: unknown): value is ProjectFolderIndex {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'kind' in value &&
    value.kind === 'adventure-display-project' &&
    'version' in value &&
    value.version === 3 &&
    'adventureOrder' in value &&
    Array.isArray(value.adventureOrder) &&
    'adventures' in value &&
    Array.isArray(value.adventures)
  )
}

async function loadProjectFromIndex(
  directoryHandle: FileSystemDirectoryHandle,
  index: ProjectFolderIndex,
) {
  const project: ProjectState = {
    activeAdventureId: index.activeAdventureId,
    adventureOrder: [...index.adventureOrder],
    adventures: {},
    sessions: {},
    monsterLibrary: [],
  }

  for (const entry of index.adventures) {
    const rawAdventure = await readTextFile(directoryHandle, `${entry.path}/adventure.json`)
    const rawSession = await readTextFile(directoryHandle, `${entry.path}/session.json`)
    const adventure = JSON.parse(rawAdventure) as Adventure
    const session = JSON.parse(rawSession) as SessionState

    project.adventures[adventure.id] = adventure
    project.sessions[adventure.id] = session
  }

  try {
    const rawMonsterLibrary = await readTextFile(
      directoryHandle,
      index.monsterLibraryPath || monsterLibraryPath,
    )
    const monsterLibrary = JSON.parse(rawMonsterLibrary) as MonsterLibraryPackage

    if (
      monsterLibrary &&
      monsterLibrary.kind === 'adventure-display-monster-library' &&
      Array.isArray(monsterLibrary.monsters)
    ) {
      project.monsterLibrary = monsterLibrary.monsters
        .map((entry) => entry.monster)
        .filter(Boolean)
    }
  } catch {
    project.monsterLibrary = []
  }

  return resolveProjectAssets(directoryHandle, project)
}

export async function loadProjectFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
) {
  const rawText = await readTextFile(directoryHandle, 'project.json')
  const parsed = JSON.parse(rawText) as ProjectFolderIndex | LegacyProjectFolderPackage | ProjectState

  if (isProjectFolderIndex(parsed)) {
    return loadProjectFromIndex(directoryHandle, parsed)
  }

  const project =
    parsed && typeof parsed === 'object' && isLegacyProjectFolderPackage(parsed)
      ? parsed.project
      : (parsed as ProjectState)

  return resolveProjectAssets(directoryHandle, project)
}

export function isMissingProjectFolderFileError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'NotFoundError' ||
      /requested file or directory could not be found/i.test(error.message))
  )
}

function openProjectDirectoryHandleDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(projectFolderHandleDatabaseName, 1)

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Не удалось открыть хранилище папки проекта.'))
    })

    request.addEventListener('upgradeneeded', () => {
      const database = request.result

      if (!database.objectStoreNames.contains(projectFolderHandleStoreName)) {
        database.createObjectStore(projectFolderHandleStoreName)
      }
    })

    request.addEventListener('success', () => {
      resolve(request.result)
    })
  })
}

async function withProjectDirectoryHandleStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T> | T,
) {
  const database = await openProjectDirectoryHandleDatabase()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(projectFolderHandleStoreName, mode)
      const store = transaction.objectStore(projectFolderHandleStoreName)
      let didSettle = false
      let result: T | undefined

      const rejectOnce = (error: unknown) => {
        if (didSettle) {
          return
        }

        didSettle = true
        reject(error)
      }

      Promise.resolve(action(store))
        .then((value) => {
          result = value
        })
        .catch(rejectOnce)

      transaction.addEventListener('complete', () => {
        if (didSettle) {
          return
        }

        didSettle = true
        resolve(result as T)
      })

      transaction.addEventListener('error', () => {
        rejectOnce(transaction.error ?? new Error('Не удалось выполнить операцию с папкой проекта.'))
      })

      transaction.addEventListener('abort', () => {
        rejectOnce(transaction.error ?? new Error('Операция с папкой проекта была прервана.'))
      })
    })
  } finally {
    database.close()
  }
}

export async function rememberProjectDirectory(
  directoryHandle: FileSystemDirectoryHandle,
) {
  const metadata: RememberedProjectDirectoryMeta = {
    name: directoryHandle.name,
    updatedAt: new Date().toISOString(),
  }

  await withProjectDirectoryHandleStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.put(metadata, defaultProjectFolderMetaKey)

      request.addEventListener('success', () => {
        resolve()
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Не удалось запомнить метку папки проекта.'))
      })
    })
  })

  await withProjectDirectoryHandleStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.put(directoryHandle, defaultProjectFolderHandleKey)

      request.addEventListener('success', () => {
        resolve()
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Не удалось запомнить папку проекта.'))
      })
    })
  })
}

export async function restoreProjectDirectory() {
  return withProjectDirectoryHandleStore('readonly', (store) => {
    return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const request = store.get(defaultProjectFolderHandleKey)

      request.addEventListener('success', () => {
        resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null)
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Не удалось восстановить папку проекта.'))
      })
    })
  })
}

export async function restoreRememberedProjectDirectoryMeta() {
  return withProjectDirectoryHandleStore('readonly', (store) => {
    return new Promise<RememberedProjectDirectoryMeta | null>((resolve, reject) => {
      const request = store.get(defaultProjectFolderMetaKey)

      request.addEventListener('success', () => {
        const value = request.result as RememberedProjectDirectoryMeta | undefined
        resolve(value ?? null)
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Не удалось восстановить метку папки проекта.'))
      })
    })
  })
}

export async function clearRememberedProjectDirectory() {
  await withProjectDirectoryHandleStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(defaultProjectFolderHandleKey)

      request.addEventListener('success', () => {
        resolve()
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Не удалось очистить папку проекта по умолчанию.'))
      })
    })
  })

  await withProjectDirectoryHandleStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(defaultProjectFolderMetaKey)

      request.addEventListener('success', () => {
        resolve()
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Не удалось очистить метку папки проекта.'))
      })
    })
  })
}

export async function ensureProjectDirectoryPermission(
  directoryHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
  options: {
    request?: boolean
  } = {},
) {
  const permissionHandle = directoryHandle as MaybePermissionDirectoryHandle
  const descriptor = { mode }

  if (typeof permissionHandle.queryPermission === 'function') {
    const currentState = await permissionHandle.queryPermission(descriptor)

    if (currentState === 'granted') {
      return true
    }
  }

  if (options.request !== false && typeof permissionHandle.requestPermission === 'function') {
    const nextState = await permissionHandle.requestPermission(descriptor)

    return nextState === 'granted'
  }

  return true
}

export function supportsProjectFolders() {
  return typeof (window as MaybeDirectoryPickerWindow).showDirectoryPicker === 'function'
}

export async function pickProjectDirectory(mode: 'read' | 'readwrite' = 'readwrite') {
  const pickerWindow = window as MaybeDirectoryPickerWindow

  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('Этот браузер не поддерживает выбор папки проекта.')
  }

  return pickerWindow.showDirectoryPicker({
    id: projectFolderPickerId,
    mode,
  })
}
