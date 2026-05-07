import {
  lazy,
  Suspense,
  startTransition,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { sampleAdventure } from '../../data/sampleAdventure'
import { StyledSelect } from '../../components/StyledSelect'
import { AudioEditorPanel } from './AudioEditorPanel'
import { ChecksEditorPanel } from './ChecksEditorPanel'
import { GmNotesPanel } from './GmNotesPanel'
import { HandoutsEditorPanel } from './HandoutsEditorPanel'
import { InitiativeTracker } from './InitiativeTracker'
import { MapCornerPanel } from './MapCornerPanel'
import { MapGridModal } from './MapGridModal'
import { MapLayersModal } from './MapLayersModal'
import { MapParamsModal } from './MapParamsModal'
import { MapTitleBadge } from './MapTitleBadge'
import { MapUtilityPanel, type MapInteractionMode } from './MapUtilityPanel'
import { ProjectReconnectModal } from './ProjectReconnectModal'
import { SceneEditorActions, type EditorTab } from './SceneEditorActions'
import { ServiceMarkerModal } from './ServiceMarkerModal'
import { TokenModal } from './TokenModal'
import { useProjectHistory } from './useProjectHistory'
import { useProjectFolderPersistence } from './useProjectFolderPersistence'
import { mapScaleStep, useMapViewportControls } from './useMapViewportControls'
import { ZoneModal } from './ZoneModal'
import {
  createInitialProjectState,
  createInitialSessionState,
  getActiveAdventureBundle,
  playerDisplayChannelName,
  syncProjectState,
} from '../../lib/playerDisplay'
import { collectProjectObjectUrls, revokeObjectUrls } from '../../lib/objectUrls'
import { createProjectExportPackage } from '../../lib/projectExport'
import { createCssUrl } from '../../lib/css'
import { createPlayerCharacterFromLssJson } from '../../lib/lssCharacterImport'
import {
  loadBuiltInBestiarySummaries,
  loadBuiltInMonsterDetail,
  type MonsterSummary,
} from '../../library/bestiary/bestiaryRepository'
import { getMonsterImageRef } from '../../library/bestiary/monsterImages'
import { loadBuiltInSpellLibrary } from '../../library/spells/spellRepository'
import {
  defaultMapGrid,
  sceneAccentLabels,
  sceneAccentValues,
  tokenSpaceFootprints,
  tokenSpaceLabels,
  tokenSpaceValues,
} from '../../types/adventure'
import type {
  Adventure,
  AdventureScene,
  AssetKind,
  AssetRecord,
  AudioTrack,
  AudioTrackKind,
  Handout,
  CheckClueEntry,
  MapGridSettings,
  MapLayerInstance,
  MapZone,
  MapViewport,
  MonsterBlock,
  MonsterFeature,
  PlayerCharacter,
  ProjectState,
  SpellBlock,
  SceneAccent,
  SceneSplash,
  SceneRuntimeState,
  SessionState,
  ServiceMarker,
  TokenInstance,
  TokenKind,
  TokenSpace,
} from '../../types/adventure'
const CharacterModal = lazy(() =>
  import('./CharacterModal').then((module) => ({ default: module.CharacterModal })),
)
const SpellLibraryModal = lazy(() =>
  import('./SpellLibraryModal').then((module) => ({ default: module.SpellLibraryModal })),
)
const BestiaryModal = lazy(() =>
  import('./BestiaryModal').then((module) => ({ default: module.BestiaryModal })),
)
function LibraryLoadingModal({
  error,
  label,
  onClose,
}: {
  error: string | null
  label: string
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section className="confirm-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{label}</h3>
        <p>{error ?? 'Загружаю данные справочника...'}</p>
        {error ? (
          <button className="ghost-button compact-button" onClick={onClose} type="button">
            Закрыть
          </button>
        ) : null}
      </section>
    </div>
  )
}
const playerWindowFeatures = [
  'popup=yes',
  'width=1500',
  'height=920',
  'left=80',
  'top=60',
].join(',')
type FogSelectionRect = {
  left: number
  top: number
  width: number
  height: number
}
type ZoneSelectionRect = FogSelectionRect
type ZoneResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
function getZoneResizeHandle(zoneElement: HTMLDivElement, clientX: number, clientY: number): ZoneResizeHandle | null {
  const rect = zoneElement.getBoundingClientRect()
  const edgeThreshold = Math.max(8, Math.min(14, Math.min(rect.width, rect.height) * 0.18))
  const nearLeft = clientX - rect.left <= edgeThreshold
  const nearRight = rect.right - clientX <= edgeThreshold
  const nearTop = clientY - rect.top <= edgeThreshold
  const nearBottom = rect.bottom - clientY <= edgeThreshold
  if (nearTop && nearLeft) {
    return 'nw'
  }
  if (nearTop && nearRight) {
    return 'ne'
  }
  if (nearBottom && nearLeft) {
    return 'sw'
  }
  if (nearBottom && nearRight) {
    return 'se'
  }
  if (nearTop) {
    return 'n'
  }
  if (nearRight) {
    return 'e'
  }
  if (nearBottom) {
    return 's'
  }
  if (nearLeft) {
    return 'w'
  }
  return null
}
function getZoneResizeCursor(handle: ZoneResizeHandle | null) {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    default:
      return 'grab'
  }
}
function normalizeMapGridValue(value: number, fallback: number) {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : fallback))
}
function normalizeMapGrid(mapGrid?: Partial<MapGridSettings> | null): MapGridSettings {
  return {
    columns: normalizeMapGridValue(mapGrid?.columns ?? defaultMapGrid.columns, defaultMapGrid.columns),
    rows: normalizeMapGridValue(mapGrid?.rows ?? defaultMapGrid.rows, defaultMapGrid.rows),
  }
}
const tokenDragThreshold = 6
const tokenRotateHoldDelay = 650
const tokenRotateHoldMoveTolerance = 16
const editorTabLabels: Record<EditorTab, string> = {
  scene: 'Сцена',
  splash: 'Сплеш',
  handouts: 'Раздатки',
  checks: 'Проверки',
  monsters: 'Монстры и NPC',
  audio: 'Аудио',
}
function createEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}
function slugify(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}
async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
function useBroadcastChannel() {
  const channelRef = useRef<BroadcastChannel | null>(null)
  useEffect(() => {
    const channel = new BroadcastChannel(playerDisplayChannelName)
    channelRef.current = channel
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [])
  return channelRef
}
const playerDisplayReadyMessageType = 'player-display-ready'
function isPlayerDisplayReadyMessage(value: unknown): value is { type: typeof playerDisplayReadyMessageType } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === playerDisplayReadyMessageType
  )
}
function ensurePlayerVisibleMapLayer(session: SessionState, sceneId: string): SessionState {
  const sceneState = session.sceneStates[sceneId]

  if (
    !sceneState ||
    sceneState.mapLayers.some((layer) => layer.visibleToPlayers && layer.imageSrc)
  ) {
    return session
  }

  const firstImageLayerIndex = sceneState.mapLayers.findIndex((layer) => layer.imageSrc)

  if (firstImageLayerIndex < 0) {
    return session
  }

  return {
    ...session,
    sceneStates: {
      ...session.sceneStates,
      [sceneId]: {
        ...sceneState,
        mapLayers: sceneState.mapLayers.map((layer, index) =>
          index === firstImageLayerIndex
            ? {
                ...layer,
                visibleToPlayers: true,
              }
            : layer,
        ),
      },
    },
  }
}
function resolveMapBoardPosition(
  board: HTMLDivElement,
  clientX: number,
  clientY: number,
  viewport: MapViewport,
) {
  const rect = board.getBoundingClientRect()
  const normalizedX = Math.min(
    0.96,
    Math.max(0.04, (clientX - rect.left - viewport.offsetX) / (rect.width * viewport.scale)),
  )
  const normalizedY = Math.min(
    0.94,
    Math.max(0.06, (clientY - rect.top - viewport.offsetY) / (rect.height * viewport.scale)),
  )
  const x = normalizedX * 100
  const y = normalizedY * 100
  return { x, y }
}
function getNormalizedMapBoardPosition(
  board: HTMLDivElement,
  clientX: number,
  clientY: number,
  viewport: MapViewport,
) {
  const rect = board.getBoundingClientRect()
  const normalizedX = Math.min(
    0.9999,
    Math.max(0, (clientX - rect.left - viewport.offsetX) / (rect.width * viewport.scale)),
  )
  const normalizedY = Math.min(
    0.9999,
    Math.max(0, (clientY - rect.top - viewport.offsetY) / (rect.height * viewport.scale)),
  )
  return {
    normalizedX,
    normalizedY,
    percentX: normalizedX * 100,
    percentY: normalizedY * 100,
  }
}
function getFogCellId(
  board: HTMLDivElement,
  clientX: number,
  clientY: number,
  viewport: MapViewport,
  mapGrid: MapGridSettings,
) {
  const { normalizedX, normalizedY } = getNormalizedMapBoardPosition(
    board,
    clientX,
    clientY,
    viewport,
  )
  const column = Math.floor(normalizedX * mapGrid.columns)
  const row = Math.floor(normalizedY * mapGrid.rows)
  return `${column}:${row}`
}
function getFogCellIdsForPercentBounds(
  leftPercent: number,
  topPercent: number,
  rightPercent: number,
  bottomPercent: number,
  mapGrid: MapGridSettings,
) {
  const minX = Math.max(0, Math.min(leftPercent, rightPercent))
  const maxX = Math.min(100, Math.max(leftPercent, rightPercent))
  const minY = Math.max(0, Math.min(topPercent, bottomPercent))
  const maxY = Math.min(100, Math.max(topPercent, bottomPercent))
  const startColumn = Math.max(0, Math.floor((minX / 100) * mapGrid.columns))
  const endColumn = Math.min(
    mapGrid.columns - 1,
    Math.floor((Math.max(minX, maxX - 0.0001) / 100) * mapGrid.columns),
  )
  const startRow = Math.max(0, Math.floor((minY / 100) * mapGrid.rows))
  const endRow = Math.min(
    mapGrid.rows - 1,
    Math.floor((Math.max(minY, maxY - 0.0001) / 100) * mapGrid.rows),
  )
  const cellIds: string[] = []
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      cellIds.push(`${column}:${row}`)
    }
  }
  return cellIds
}
function getFogCellIdsForZone(zone: MapZone, mapGrid: MapGridSettings) {
  return getFogCellIdsForPercentBounds(
    zone.x,
    zone.y,
    zone.x + zone.width,
    zone.y + zone.height,
    mapGrid,
  )
}
function getFogCellStyle(cellId: string, mapGrid: MapGridSettings) {
  const [columnRaw, rowRaw] = cellId.split(':')
  const column = Number(columnRaw)
  const row = Number(rowRaw)
  return {
    left: `${(column / mapGrid.columns) * 100}%`,
    top: `${(row / mapGrid.rows) * 100}%`,
    width: `${100 / mapGrid.columns}%`,
    height: `${100 / mapGrid.rows}%`,
  }
}
function getZoneFogStyle(zone: Pick<MapZone, 'x' | 'y' | 'width' | 'height'>) {
  return {
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.width}%`,
    height: `${zone.height}%`,
  }
}
function createBaseMapLayer(
  scene: AdventureScene,
  imageSrc: string | null,
): MapLayerInstance {
  return {
    id: `${scene.id}-base-layer`,
    title: scene.map.title || 'Базовая карта',
    imageSrc,
    visibleToGm: true,
    visibleToPlayers: true,
    isActive: true,
    scale: 1,
    rotation: 0,
  }
}
function clampZoneSize(value: number, fallback: number) {
  return Math.min(80, Math.max(6, Number.isFinite(value) ? value : fallback))
}
function clampZoneCoordinate(value: number, fallback: number) {
  return Math.min(96, Math.max(4, Number.isFinite(value) ? value : fallback))
}
function clampSpawnCount(value: number, fallback = 1) {
  return Math.min(12, Math.max(1, Number.isFinite(value) ? Math.round(value) : fallback))
}
function normalizeRotationDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}
function getTokenRotation(token: TokenInstance) {
  return Number.isFinite(token.rotation) ? token.rotation : 0
}
function parseHitPointsValue(value: string) {
  const match = value.match(/\d+/)
  if (!match) {
    return null
  }
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}
function formatTokenHitPointsMax(token: TokenInstance) {
  const maxHitPoints = token.hitPointsMax ?? '—'
  const tempHitPoints = token.hitPointsTemp
  return typeof tempHitPoints === 'number' && tempHitPoints > 0
    ? `${maxHitPoints} (+${tempHitPoints})`
    : String(maxHitPoints)
}
function formatTokenHitPoints(token: TokenInstance) {
  return `${token.hitPointsCurrent ?? '—'}/${formatTokenHitPointsMax(token)}`
}
function sortTokensByInitiative(tokens: TokenInstance[]) {
  return [...tokens].sort((left, right) => {
    const leftInitiative =
      typeof left.initiative === 'number' ? left.initiative : Number.NEGATIVE_INFINITY
    const rightInitiative =
      typeof right.initiative === 'number' ? right.initiative : Number.NEGATIVE_INFINITY
    if (rightInitiative !== leftInitiative) {
      return rightInitiative - leftInitiative
    }
    return left.name.localeCompare(right.name, 'ru')
  })
}
function splitLines(value: string) {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
function getAssetDataUrl(
  assetLibrary: AssetRecord[],
  assetId: string | null | undefined,
  fallback: string | null | undefined,
) {
  if (assetId) {
    const linkedAsset = assetLibrary.find((asset) => asset.id === assetId)
    if (linkedAsset) {
      return linkedAsset.dataUrl
    }
  }
  return fallback ?? null
}
function inferAudioMimeType(originalName: string, fallback: string) {
  if (fallback && fallback !== 'audio/*' && fallback !== 'application/octet-stream') {
    return fallback
  }
  const extension = originalName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg'
    case 'm4a':
      return 'audio/mp4'
    case 'ogg':
      return 'audio/ogg'
    case 'wav':
      return 'audio/wav'
    case 'webm':
      return 'audio/webm'
    case 'flac':
      return 'audio/flac'
    default:
      return fallback || 'audio/mpeg'
  }
}
function normalizeAudioDataUrl(dataUrl: string, asset: AssetRecord | null) {
  if (!asset || !dataUrl.startsWith('data:')) {
    return dataUrl
  }
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) {
    return dataUrl
  }
  const header = dataUrl.slice(0, commaIndex)
  if (/^data:audio\//i.test(header)) {
    return dataUrl
  }
  const mimeType = inferAudioMimeType(asset.originalName, asset.mimeType)
  return `data:${mimeType};base64${dataUrl.slice(commaIndex)}`
}
function getAssetFileLabel(
  assets: AssetRecord[],
  assetId: string | null | undefined,
  fallbackSrc: string | null | undefined,
  emptyLabel = 'Файл не выбран',
) {
  const asset = assets.find((currentAsset) => currentAsset.id === assetId)
  if (asset) {
    return asset.originalName || asset.title
  }
  return fallbackSrc ? 'Файл загружен' : emptyLabel
}
function createFallbackSceneSplash(
  title: string,
  location: string,
  gmSummary: string,
): SceneSplash {
  return {
    title,
    subtitle: location,
    body: gmSummary,
    imageAssetId: null,
    imageSrc: null,
  }
}
function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tagName = target.tagName
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  )
}
async function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
function isBlobUrl(value: string) {
  return value.startsWith('blob:')
}
function isProjectAssetPathReference(value: string) {
  return /^assets\//.test(value) || /^adventures\//.test(value) || /^monsters\//.test(value)
}
function isPlayerDisplayAssetField(fieldName: string | null) {
  return fieldName === 'imageSrc' || fieldName === 'avatarSrc' || fieldName === 'dataUrl'
}
async function readProjectAssetBlob(
  root: FileSystemDirectoryHandle,
  assetPath: string,
) {
  const segments = assetPath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    return null
  }

  try {
    let directory = root

    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment)
    }

    const fileHandle = await directory.getFileHandle(fileName)
    return fileHandle.getFile()
  } catch {
    return null
  }
}
async function resolvePlayerDisplayAssetUrl(
  value: string,
  cache: Map<string, string>,
  projectDirectoryHandle: FileSystemDirectoryHandle | null,
) {
  if (!isBlobUrl(value) && !isProjectAssetPathReference(value)) {
    return value
  }

  const cachedValue = cache.get(value)

  if (cachedValue) {
    return cachedValue
  }

  try {
    if (isProjectAssetPathReference(value) && !projectDirectoryHandle) {
      return value
    }

    const blob = isProjectAssetPathReference(value)
      ? await readProjectAssetBlob(projectDirectoryHandle, value)
      : await fetch(value).then((response) => (response.ok ? response.blob() : null))

    if (!blob) {
      return value
    }

    const dataUrl = await readBlobAsDataUrl(blob)
    cache.set(value, dataUrl)
    return dataUrl
  } catch {
    return value
  }
}
async function hydratePlayerDisplayAssetUrls(
  value: unknown,
  cache: Map<string, string>,
  projectDirectoryHandle: FileSystemDirectoryHandle | null,
  fieldName: string | null = null,
): Promise<unknown> {
  if (typeof value === 'string') {
    return isPlayerDisplayAssetField(fieldName)
      ? resolvePlayerDisplayAssetUrl(value, cache, projectDirectoryHandle)
      : value
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = await hydratePlayerDisplayAssetUrls(
        value[index],
        cache,
        projectDirectoryHandle,
      )
    }
    return value
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    for (const [key, entry] of Object.entries(record)) {
      record[key] = await hydratePlayerDisplayAssetUrls(
        entry,
        cache,
        projectDirectoryHandle,
        key,
      )
    }
  }

  return value
}
async function createPlayerDisplayProjectState(
  projectState: ProjectState,
  cache: Map<string, string>,
  projectDirectoryHandle: FileSystemDirectoryHandle | null,
) {
  const projectStateForPlayer = JSON.parse(JSON.stringify(projectState)) as ProjectState
  await hydratePlayerDisplayAssetUrls(projectStateForPlayer, cache, projectDirectoryHandle)
  return projectStateForPlayer
}
async function createAssetRecordFromFile(
  file: File,
  kind: AssetKind,
  title?: string,
): Promise<AssetRecord> {
  return {
    id: createEntityId('asset'),
    title: title?.trim() || file.name.replace(/\.[^/.]+$/, '') || 'Новый ассет',
    kind,
    mimeType: file.type || (kind === 'audio' ? 'audio/*' : 'image/*'),
    originalName: file.name,
    dataUrl: await readFileAsDataUrl(file),
  }
}
function triggerJsonDownload(adventure: Adventure) {
  const blob = new Blob([JSON.stringify(adventure, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${adventure.id || 'adventure'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
function triggerProjectDownload(project: ProjectState) {
  const projectPackage = createProjectExportPackage(project)
  const blob = new Blob([JSON.stringify(projectPackage, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `adventure-display-project-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
function createUniqueAdventureId(baseValue: string, existingIds: string[]) {
  const baseId = slugify(baseValue, 'adventure')
  if (!existingIds.includes(baseId)) {
    return baseId
  }
  let suffix = 2
  while (existingIds.includes(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
}
function createUniqueCollectionId(
  baseValue: string,
  existingIds: string[],
  fallback: string,
) {
  const baseId = slugify(baseValue, fallback)
  if (!existingIds.includes(baseId)) {
    return baseId
  }
  let suffix = 2
  while (existingIds.includes(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function readRequiredString(
  source: Record<string, unknown>,
  field: string,
  label: string,
) {
  const value = source[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} должно быть непустой строкой.`)
  }
  return value.trim()
}
function readOptionalString(
  source: Record<string, unknown>,
  field: string,
) {
  const value = source[field]
  if (value == null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} должно быть строкой, если поле передано.`)
  }
  return value.trim()
}
function normalizeImportedAdventure(raw: unknown): Adventure {
  if (!isRecord(raw)) {
    throw new Error('Файл приключения должен содержать JSON-объект в корне.')
  }
  const title = readRequiredString(raw, 'title', 'Название приключения')
  const subtitle = readRequiredString(raw, 'subtitle', 'Подзаголовок приключения')
  const rawScenes = raw.scenes
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('В приключении должна быть хотя бы одна сцена.')
  }
  const rawAudio = raw.audioLibrary
  const rawAssets = raw.assetLibrary
  const assetIds: string[] = []
  const assetLibrary: AssetRecord[] = Array.isArray(rawAssets)
    ? rawAssets.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`Ассет #${index + 1} должен быть объектом.`)
      }
      const titleValue = readRequiredString(
        entry,
        'title',
        `Название ассета #${index + 1}`,
      )
      const kindValue = readOptionalString(entry, 'kind') ?? 'image'
      if (!['image', 'audio'].includes(kindValue)) {
        throw new Error(
          `У ассета "${titleValue}" некорректный тип "${kindValue}".`,
        )
      }
      const idValue = createUniqueCollectionId(
        readOptionalString(entry, 'id') ?? titleValue,
        assetIds,
        'asset',
      )
      assetIds.push(idValue)
      return {
        id: idValue,
        title: titleValue,
        kind: kindValue as AssetKind,
        mimeType: readOptionalString(entry, 'mimeType') ?? '',
        originalName: readOptionalString(entry, 'originalName') ?? titleValue,
        dataUrl: readRequiredString(entry, 'dataUrl', `Данные ассета "${titleValue}"`),
      }
    })
    : []
  const audioIds: string[] = []
  const audioLibrary: AudioTrack[] = Array.isArray(rawAudio)
    ? rawAudio.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`Аудиотрек #${index + 1} должен быть объектом.`)
      }
      const titleValue = readRequiredString(
        entry,
        'title',
        `Название аудиотрека #${index + 1}`,
      )
      const kindValue = readOptionalString(entry, 'kind') ?? 'music'
      if (!['music', 'ambience', 'sfx'].includes(kindValue)) {
        throw new Error(
          `У аудиотрека "${titleValue}" некорректный тип "${kindValue}".`,
        )
      }
      const idValue = createUniqueCollectionId(
        readOptionalString(entry, 'id') ?? titleValue,
        audioIds,
        'audio',
      )
      audioIds.push(idValue)
      const assetId = readOptionalString(entry, 'assetId')
      return {
        id: idValue,
        title: titleValue,
        kind: kindValue as AudioTrackKind,
        assetId,
        src: getAssetDataUrl(assetLibrary, assetId, readOptionalString(entry, 'src')) ?? '',
      }
    })
    : []
  const sceneIds: string[] = []
  const scenes: AdventureScene[] = rawScenes.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Сцена #${index + 1} должна быть объектом.`)
    }
    const titleValue = readRequiredString(entry, 'title', `Название сцены #${index + 1}`)
    const sceneId = createUniqueCollectionId(
      readOptionalString(entry, 'id') ?? titleValue,
      sceneIds,
      'scene',
    )
    sceneIds.push(sceneId)
    const accentValue = readRequiredString(entry, 'accent', `Акцент сцены "${titleValue}"`)
    if (!sceneAccentValues.includes(accentValue as SceneAccent)) {
      throw new Error(`У сцены "${titleValue}" некорректный акцент "${accentValue}".`)
    }
    const locationValue = readRequiredString(
      entry,
      'location',
      `У сцены "${titleValue}" не заполнено поле location`,
    )
    const gmSummaryValue = readRequiredString(
      entry,
      'gmSummary',
      `У сцены "${titleValue}" не заполнено поле gmSummary`,
    )
    const rawSplash = entry.splash
    const splashImageAssetId =
      isRecord(rawSplash) ? readOptionalString(rawSplash, 'imageAssetId') : null
    const splash: SceneSplash = isRecord(rawSplash)
      ? {
        title: readOptionalString(rawSplash, 'title') ?? titleValue,
        subtitle: readOptionalString(rawSplash, 'subtitle') ?? locationValue,
        body: readOptionalString(rawSplash, 'body') ?? gmSummaryValue,
        imageAssetId: splashImageAssetId,
        imageSrc: getAssetDataUrl(
          assetLibrary,
          splashImageAssetId,
          readOptionalString(rawSplash, 'imageSrc'),
        ),
      }
      : createFallbackSceneSplash(titleValue, locationValue, gmSummaryValue)
    const rawMap = entry.map
    if (!isRecord(rawMap)) {
      throw new Error(`Сцена "${titleValue}" должна содержать объект карты.`)
    }
    const handoutIds: string[] = []
    const rawHandouts = entry.handouts
    const handouts: Handout[] = Array.isArray(rawHandouts)
      ? rawHandouts.map((handoutEntry, handoutIndex) => {
        if (!isRecord(handoutEntry)) {
          throw new Error(
            `Р аздатка #${handoutIndex + 1} в сцене "${titleValue}" должна быть объектом.`,
          )
        }
        const handoutTitle = readRequiredString(
          handoutEntry,
          'title',
          `Название раздатки #${handoutIndex + 1} в сцене "${titleValue}"`,
        )
        const handoutId = createUniqueCollectionId(
          readOptionalString(handoutEntry, 'id') ?? handoutTitle,
          handoutIds,
          'handout',
        )
        handoutIds.push(handoutId)
        const imageAssetId = readOptionalString(handoutEntry, 'imageAssetId')
        return {
          id: handoutId,
          title: handoutTitle,
          caption: readOptionalString(handoutEntry, 'caption') ?? '',
          body: readRequiredString(
            handoutEntry,
            'body',
            `Текст раздатки "${handoutTitle}"`,
          ),
          imageAssetId,
          imageSrc: getAssetDataUrl(
            assetLibrary,
            imageAssetId,
            readOptionalString(handoutEntry, 'imageSrc'),
          ),
        }
      })
      : []
    const checkIds: string[] = []
    const rawChecksClues = entry.checksClues
    const checksClues: CheckClueEntry[] = Array.isArray(rawChecksClues)
      ? rawChecksClues.map((checkEntry, checkIndex) => {
        if (!isRecord(checkEntry)) {
          throw new Error(
            `Строка проверки/улики #${checkIndex + 1} в сцене "${titleValue}" должна быть объектом.`,
          )
        }
        const ability = readRequiredString(
          checkEntry,
          'ability',
          `Характеристика строки проверки/улики #${checkIndex + 1} в сцене "${titleValue}"`,
        )
        const id = createUniqueCollectionId(
          readOptionalString(checkEntry, 'id') ?? `${ability}-${checkIndex + 1}`,
          checkIds,
          'check',
        )
        checkIds.push(id)
        return {
          id,
          ability,
          difficulty: readRequiredString(
            checkEntry,
            'difficulty',
            `Сложность для строки проверки/улики "${ability}"`,
          ),
          outcome: readRequiredString(
            checkEntry,
            'outcome',
            `Итог для строки проверки/улики "${ability}"`,
          ),
        }
      })
      : []
    const zoneIds: string[] = []
    const rawZones = entry.zones
    const zones: MapZone[] = Array.isArray(rawZones)
      ? rawZones.map((zoneEntry, zoneIndex) => {
        if (!isRecord(zoneEntry)) {
          throw new Error(
            `Зона #${zoneIndex + 1} в сцене "${titleValue}" должна быть объектом.`,
          )
        }
        const zoneTitle = readRequiredString(
          zoneEntry,
          'title',
          `Название зоны #${zoneIndex + 1} в сцене "${titleValue}"`,
        )
        const zoneId = createUniqueCollectionId(
          readOptionalString(zoneEntry, 'id') ?? zoneTitle,
          zoneIds,
          'zone',
        )
        zoneIds.push(zoneId)
        return {
          id: zoneId,
          title: zoneTitle,
          note: readOptionalString(zoneEntry, 'note') ?? '',
          focusNote: readOptionalString(zoneEntry, 'focusNote') ?? '',
          linkedHandoutId:
            handouts.some(
              (handout) =>
                handout.id === (readOptionalString(zoneEntry, 'linkedHandoutId') ?? null),
            )
              ? (readOptionalString(zoneEntry, 'linkedHandoutId') ?? null)
              : null,
          linkedCheckId:
            checksClues.some(
              (checkEntry) =>
                checkEntry.id === (readOptionalString(zoneEntry, 'linkedCheckId') ?? null),
            )
              ? (readOptionalString(zoneEntry, 'linkedCheckId') ?? null)
              : null,
          linkedMonsterId: readOptionalString(zoneEntry, 'linkedMonsterId') ?? null,
          x: clampZoneCoordinate(Number(zoneEntry.x ?? 50), 50),
          y: clampZoneCoordinate(Number(zoneEntry.y ?? 50), 50),
          width: clampZoneSize(Number(zoneEntry.width ?? 18), 18),
          height: clampZoneSize(Number(zoneEntry.height ?? 14), 14),
          visibleToPlayers: Boolean(zoneEntry.visibleToPlayers),
          autoRevealOnEnter: Boolean(zoneEntry.autoRevealOnEnter),
        }
      })
      : []
    const monsterIds: string[] = []
    const rawMonsterBlocks = entry.monsterBlocks
    const monsterBlocks: MonsterBlock[] = Array.isArray(rawMonsterBlocks)
      ? rawMonsterBlocks.map((monsterEntry, monsterIndex) => {
        if (!isRecord(monsterEntry)) {
          throw new Error(
            `Блок монстра #${monsterIndex + 1} в сцене "${titleValue}" должен быть объектом.`,
          )
        }
        const monsterName = readRequiredString(
          monsterEntry,
          'name',
          `Имя монстра #${monsterIndex + 1} в сцене "${titleValue}"`,
        )
        const monsterId = createUniqueCollectionId(
          readOptionalString(monsterEntry, 'id') ?? monsterName,
          monsterIds,
          'monster',
        )
        monsterIds.push(monsterId)
        const imageAssetId = readOptionalString(monsterEntry, 'imageAssetId')
        return {
          id: monsterId,
          name: monsterName,
          source: readOptionalString(monsterEntry, 'source') ?? '',
          size: readOptionalString(monsterEntry, 'size') ?? '',
          creatureType: readOptionalString(monsterEntry, 'creatureType') ?? '',
          alignment: readOptionalString(monsterEntry, 'alignment') ?? '',
          proficiencyBonus: readOptionalString(monsterEntry, 'proficiencyBonus') ?? '',
          subtitle: readOptionalString(monsterEntry, 'subtitle') ?? '',
          imageAssetId,
          imageSrc: getAssetDataUrl(
            assetLibrary,
            imageAssetId,
            readOptionalString(monsterEntry, 'imageSrc'),
          ),
          armorClass: readRequiredString(
            monsterEntry,
            'armorClass',
            `Класс доспеха монстра "${monsterName}"`,
          ),
          hitPoints: readRequiredString(
            monsterEntry,
            'hitPoints',
            `Хиты монстра "${monsterName}"`,
          ),
          hitPointsFormula: readOptionalString(monsterEntry, 'hitPointsFormula') ?? '',
          speed: readRequiredString(
            monsterEntry,
            'speed',
            `Скорость монстра "${monsterName}"`,
          ),
          strength: Number(monsterEntry.strength ?? 10),
          dexterity: Number(monsterEntry.dexterity ?? 10),
          constitution: Number(monsterEntry.constitution ?? 10),
          intelligence: Number(monsterEntry.intelligence ?? 10),
          wisdom: Number(monsterEntry.wisdom ?? 10),
          charisma: Number(monsterEntry.charisma ?? 10),
          savingThrows: readOptionalString(monsterEntry, 'savingThrows') ?? '',
          skills: readOptionalString(monsterEntry, 'skills') ?? '',
          damageVulnerabilities: readOptionalString(monsterEntry, 'damageVulnerabilities') ?? '',
          damageResistances: readOptionalString(monsterEntry, 'damageResistances') ?? '',
          damageImmunities: readOptionalString(monsterEntry, 'damageImmunities') ?? '',
          conditionImmunities: readOptionalString(monsterEntry, 'conditionImmunities') ?? '',
          senses: readOptionalString(monsterEntry, 'senses') ?? '',
          languages: readOptionalString(monsterEntry, 'languages') ?? '',
          challenge: readOptionalString(monsterEntry, 'challenge') ?? '',
          traits: parseMonsterFeatures(
            monsterEntry.traits,
            `Черты монстра "${monsterName}"`,
          ),
          actions: parseMonsterFeatures(
            monsterEntry.actions,
            `Действия монстра "${monsterName}"`,
          ),
          bonusActions: parseMonsterFeatures(
            monsterEntry.bonusActions,
            `Бонусные действия монстра "${monsterName}"`,
          ),
          reactions: parseMonsterFeatures(
            monsterEntry.reactions,
            `Р еакции монстра "${monsterName}"`,
          ),
          legendaryActions: parseMonsterFeatures(
            monsterEntry.legendaryActions,
            `Легендарные действия монстра "${monsterName}"`,
          ),
          notes: readOptionalString(monsterEntry, 'notes') ?? '',
        }
      })
      : []
    const rawObjectives = entry.objectives
    const objectives =
      Array.isArray(rawObjectives) && rawObjectives.length > 0
        ? rawObjectives
          .filter((objective): objective is string => typeof objective === 'string')
          .map((objective) => objective.trim())
          .filter(Boolean)
        : ['Определи, для чего нужна эта сцена.']
    if (objectives.length === 0) {
      objectives.push('Определи, для чего нужна эта сцена.')
    }
    const rawRecommendedAudio = entry.recommendedAudio
    const recommendedAudio = Array.isArray(rawRecommendedAudio)
      ? rawRecommendedAudio.filter(
        (trackId): trackId is string =>
          typeof trackId === 'string' && audioIds.includes(trackId),
      )
      : []
    const mapImageAssetId = readOptionalString(rawMap, 'imageAssetId')
    return {
      splash,
      id: sceneId,
      title: titleValue,
      location: readRequiredString(entry, 'location', `Локация сцены "${titleValue}"`),
      accent: accentValue as SceneAccent,
      gmSummary: readRequiredString(entry, 'gmSummary', `Кратко для мастера в сцене "${titleValue}"`),
      gmNotes: readRequiredString(entry, 'gmNotes', `Заметки мастера в сцене "${titleValue}"`),
      map: {
        id: createUniqueCollectionId(
          readOptionalString(rawMap, 'id') ?? `${sceneId}-map`,
          [],
          'map',
        ),
        title: readRequiredString(rawMap, 'title', `Название карты сцены "${titleValue}"`),
        imageAssetId: mapImageAssetId,
        placeholder: readRequiredString(
          rawMap,
          'placeholder',
          `Текст заглушки карты сцены "${titleValue}"`,
        ),
        imageSrc: getAssetDataUrl(
          assetLibrary,
          mapImageAssetId,
          readOptionalString(rawMap, 'imageSrc'),
        ),
      },
      zones,
      handouts,
      checksClues,
      monsterIds: Array.isArray(entry.monsterIds)
        ? entry.monsterIds.filter((monsterId): monsterId is string => typeof monsterId === 'string' && monsterId.trim().length > 0)
        : monsterIds,
      monsterBlocks,
      recommendedAudio,
      objectives,
    }
  })
  return {
    id: slugify(readOptionalString(raw, 'id') ?? title, 'adventure'),
    title,
    subtitle,
    assetLibrary,
    audioLibrary,
    characters: Array.isArray(raw.characters) ? (raw.characters as PlayerCharacter[]) : [],
    monsterLibrary: Array.isArray(raw.monsterLibrary)
      ? (raw.monsterLibrary as MonsterBlock[])
      : scenes.flatMap((scene) => scene.monsterBlocks),
    scenes,
  }
}
function normalizeImportedProject(raw: unknown): ProjectState {
  const rawProject =
    isRecord(raw) &&
      raw.kind === 'adventure-display-project' &&
      'project' in raw
      ? raw.project
      : raw
  if (!isRecord(rawProject)) {
    throw new Error('Файл проекта должен содержать JSON-объект библиотеки приключений.')
  }
  if (
    !Array.isArray(rawProject.adventureOrder) ||
    !isRecord(rawProject.adventures) ||
    !isRecord(rawProject.sessions)
  ) {
    throw new Error(
      'Структура файла проекта повреждена. Ожидалась библиотека приключений с adventureOrder, adventures и sessions.',
    )
  }
  return syncProjectState(rawProject as unknown as ProjectState)
}
function mergeImportedProjectIntoCurrent(
  currentState: ProjectState,
  importedState: ProjectState,
) {
  const nextAdventureOrder = [...currentState.adventureOrder]
  const nextAdventures = { ...currentState.adventures }
  const nextSessions = { ...currentState.sessions }
  const nextMonsterLibrary = [...currentState.monsterLibrary]
  let nextActiveAdventureId = currentState.activeAdventureId
  importedState.adventureOrder.forEach((importedAdventureId) => {
    const importedAdventure = importedState.adventures[importedAdventureId]
    const importedSession = importedState.sessions[importedAdventureId]
    if (!importedAdventure || !importedSession) {
      return
    }
    const nextAdventureId = createUniqueAdventureId(
      importedAdventure.id || importedAdventure.title,
      nextAdventureOrder,
    )
    const safeAdventure =
      nextAdventureId === importedAdventure.id
        ? importedAdventure
        : { ...importedAdventure, id: nextAdventureId }
    nextAdventureOrder.push(nextAdventureId)
    nextAdventures[nextAdventureId] = safeAdventure
    nextSessions[nextAdventureId] = importedSession
    if (importedAdventureId === importedState.activeAdventureId) {
      nextActiveAdventureId = nextAdventureId
    }
  })
  for (const importedMonster of importedState.monsterLibrary) {
    nextMonsterLibrary.push({
      ...importedMonster,
      id: createUniqueCollectionId(
        importedMonster.id || importedMonster.name,
        nextMonsterLibrary.map((monster) => monster.id),
        'monster',
      ),
    })
  }
  return syncProjectState({
    activeAdventureId: nextActiveAdventureId,
    adventureOrder: nextAdventureOrder,
    adventures: nextAdventures,
    sessions: nextSessions,
    monsterLibrary: nextMonsterLibrary,
  })
}
function createEmptyAdventure(adventureId: string): Adventure {
  const sceneId = createEntityId('scene')
  return {
    id: adventureId,
    title: 'Новое приключение',
    subtitle: 'Новый локальный проект мастера',
    assetLibrary: [],
    audioLibrary: [],
    characters: [],
    monsterLibrary: [],
    scenes: [
      {
        id: sceneId,
        title: 'Стартовая сцена',
        location: 'Неизвестная локация',
        accent: 'gold',
        gmSummary: 'Определи вступительный эпизод для этого приключения.',
        gmNotes: 'Здесь можно хранить мастерские заметки по подготовке.',
        splash: {
          title: 'Стартовая сцена',
          subtitle: 'Неизвестная локация',
          body: 'Короткое вступление для игроков перед открытием карты.',
          imageAssetId: null,
          imageSrc: null,
        },
        map: {
          id: `${sceneId}-map`,
          title: 'Карта сцены',
          placeholder: 'Загрузи карту для этой сцены.',
        },
        zones: [],
        handouts: [],
        checksClues: [],
        monsterIds: [],
        monsterBlocks: [],
        recommendedAudio: [],
        objectives: ['Определи, чего должна добиться эта стартовая сцена.'],
      },
    ],
  }
}
function createDefaultMonsterFeature(title = 'Новая черта'): MonsterFeature {
  return {
    id: createEntityId('feature'),
    title,
    body: 'Опиши здесь текст способности.',
  }
}
function createDefaultCheckClueEntry(): CheckClueEntry {
  return {
    id: createEntityId('check'),
    ability: 'Внимательность',
    difficulty: 'DC 10',
    outcome: 'Опиши, что найдут игроки при успехе.',
  }
}
const checkAbilityOptions = [
  'Сила',
  'Ловкость',
  'Телосложение',
  'Интеллект',
  'Мудрость',
  'Харизма',
  'Атлетика',
  'Акробатика',
  'Ловкость рук',
  'Скрытность',
  'Магия',
  'История',
  'Анализ',
  'Природа',
  'Религия',
  'Уход за животными',
  'Проницательность',
  'Медицина',
  'Внимательность',
  'Выживание',
  'Обман',
  'Запугивание',
  'Выступление',
  'Убеждение',
  'Пассивная внимательность',
  'Спасбросок Силы',
  'Спасбросок Ловкости',
  'Спасбросок Телосложения',
  'Спасбросок Интеллекта',
  'Спасбросок Мудрости',
  'Спасбросок Харизмы',
  'Инструменты вора',
  'Проверка заклинателя',
] as const
const checkDifficultyOptions = [
  'DC 10',
  'DC 12',
  'DC 13',
  'DC 14',
  'DC 15',
  'DC 16',
  'DC 18',
  'DC 20',
  'Пассивная',
  'Состязание',
  'Против спасброска',
] as const
const monsterSizeOptions = [
  'Крошечный',
  'Маленький',
  'Средний',
  'Большой',
  'Огромный',
  'Гигантский',
] as const
const monsterAlignmentOptions = [
  '',
  'ЗД',
  'НД',
  'ХД',
  'ЗН',
  'Н',
  'ХН',
  'ЗЗ',
  'НЗ',
  'ХЗ',
  'любое мировоззрение',
  'без мировоззрения',
] as const
const monsterChallengeOptions = [
  '0 (10 опыта)',
  '1/8 (25 опыта)',
  '1/4 (50 опыта)',
  '1/2 (100 опыта)',
  '1 (200 опыта)',
  '2 (450 опыта)',
  '3 (700 опыта)',
  '4 (1 100 опыта)',
  '5 (1 800 опыта)',
  '6 (2 300 опыта)',
  '7 (2 900 опыта)',
  '8 (3 900 опыта)',
  '9 (5 000 опыта)',
  '10 (5 900 опыта)',
  '11 (7 200 опыта)',
  '12 (8 400 опыта)',
  '13 (10 000 опыта)',
  '14 (11 500 опыта)',
  '15 (13 000 опыта)',
  '16 (15 000 опыта)',
  '17 (18 000 опыта)',
  '18 (20 000 опыта)',
  '19 (22 000 опыта)',
  '20 (25 000 опыта)',
  '21 (33 000 опыта)',
  '22 (41 000 опыта)',
  '23 (50 000 опыта)',
  '24 (62 000 опыта)',
  '25 (75 000 опыта)',
  '26 (90 000 опыта)',
  '27 (105 000 опыта)',
  '28 (120 000 опыта)',
  '29 (135 000 опыта)',
  '30 (155 000 опыта)',
] as const
function formatMonsterChallengeRating(challenge: number | string) {
  const normalizedChallenge = String(challenge).trim()
  const challengeAliases: Record<string, string> = {
    '0.125': '1/8',
    '0.25': '1/4',
    '0.5': '1/2',
  }
  const challengeValue = challengeAliases[normalizedChallenge] ?? normalizedChallenge
  return (
    monsterChallengeOptions.find((option) => option.startsWith(`${challengeValue} (`)) ??
    challengeValue
  )
}
function createDefaultMonsterBlock(): MonsterBlock {
  return {
    id: createEntityId('monster'),
    name: 'Новый монстр',
    subtitle: '',
    source: '',
    size: 'Средний',
    creatureType: 'существо',
    alignment: 'без мировоззрения',
    proficiencyBonus: '+2',
    imageSrc: null,
    armorClass: '10',
    hitPoints: '11 (2d8 + 2)',
    hitPointsFormula: '2d8 + 2',
    speed: '30 С„С‚.',
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    savingThrows: '',
    skills: '',
    damageVulnerabilities: '',
    damageResistances: '',
    damageImmunities: '',
    conditionImmunities: '',
    senses: 'пассивная внимательность 10',
    languages: '',
    challenge: '1/4 (50 опыта)',
    traits: [],
    actions: [createDefaultMonsterFeature('Атака')],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    notes: '',
  }
}
const foundrySizeLabels: Record<string, string> = {
  tiny: 'Крошечный',
  sm: 'Маленький',
  small: 'Маленький',
  med: 'Средний',
  medium: 'Средний',
  lg: 'Большой',
  large: 'Большой',
  huge: 'Огромный',
  grg: 'Гигантский',
  gargantuan: 'Гигантский',
}
const foundryCreatureTypeLabels: Record<string, string> = {
  aberration: 'аберрация',
  beast: 'зверь',
  celestial: 'небожитель',
  construct: 'конструкт',
  dragon: 'дракон',
  elemental: 'элементаль',
  fey: 'фея',
  fiend: 'исчадие',
  giant: 'великан',
  humanoid: 'гуманоид',
  monstrosity: 'монстр',
  ooze: 'слизь',
  plant: 'растение',
  undead: 'нежить',
}
const foundryMovementLabels: Record<string, string> = {
  walk: 'ходьба',
  burrow: 'копание',
  climb: 'лазание',
  fly: 'полет',
  swim: 'плавание',
}
const foundrySenseLabels: Record<string, string> = {
  blindsight: 'слепое зрение',
  darkvision: 'темное зрение',
  tremorsense: 'чувство вибрации',
  truesight: 'истинное зрение',
}
const foundrySkillLabels: Record<string, string> = {
  acr: 'Акробатика',
  ani: 'Уход за животными',
  arc: 'Магия',
  ath: 'Атлетика',
  dec: 'Обман',
  his: 'История',
  ins: 'Проницательность',
  itm: 'Запугивание',
  inv: 'Расследование',
  med: 'Медицина',
  nat: 'Природа',
  prc: 'Внимательность',
  prf: 'Выступление',
  per: 'Убеждение',
  rel: 'Религия',
  slt: 'Ловкость рук',
  ste: 'Скрытность',
  sur: 'Выживание',
}
const foundrySkillAbilities: Record<string, 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'> = {
  acr: 'dex',
  ani: 'wis',
  arc: 'int',
  ath: 'str',
  dec: 'cha',
  his: 'int',
  ins: 'wis',
  itm: 'cha',
  inv: 'int',
  med: 'wis',
  nat: 'int',
  prc: 'wis',
  prf: 'cha',
  per: 'cha',
  rel: 'int',
  slt: 'dex',
  ste: 'dex',
  sur: 'wis',
}
const foundryAbilityLabels: Record<string, string> = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МДР',
  cha: 'ХАР',
}
const foundryDamageTypeLabels: Record<string, string> = {
  acid: 'кислота',
  bludgeoning: 'дробящий',
  cold: 'холод',
  fire: 'огонь',
  force: 'силовое поле',
  lightning: 'электричество',
  necrotic: 'некротический',
  piercing: 'колющий',
  poison: 'яд',
  psychic: 'психический',
  radiant: 'излучение',
  slashing: 'рубящий',
  thunder: 'звук',
}
const foundryConditionLabels: Record<string, string> = {
  blinded: 'ослепление',
  charmed: 'очарование',
  deafened: 'глухота',
  exhaustion: 'истощение',
  frightened: 'испуг',
  grappled: 'захват',
  incapacitated: 'недееспособность',
  invisible: 'невидимость',
  paralyzed: 'паралич',
  petrified: 'окаменение',
  poisoned: 'отравление',
  prone: 'сбивание с ног',
  restrained: 'опутывание',
  stunned: 'ошеломление',
  unconscious: 'бессознательность',
}
function readRecordField(source: Record<string, unknown>, field: string) {
  const value = source[field]
  return isRecord(value) ? value : null
}
function readNumberField(source: Record<string, unknown> | null, field: string, fallback = 0) {
  if (!source) {
    return fallback
  }
  const value = source[field]
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
function formatSignedNumber(value: number) {
  return value >= 0 ? `+${value}` : String(value)
}
function getAbilityModifier(score: number) {
  return Math.floor((score - 10) / 2)
}
function getMonsterProficiencyBonus(challenge: number) {
  return Math.max(2, Math.ceil((challenge + 7) / 4))
}
function normalizeFoundryString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
function cleanFoundryText(value: unknown) {
  const rawValue = normalizeFoundryString(value)
  if (!rawValue) {
    return ''
  }
  const withFoundryLinks = rawValue
    .replace(/@(?:UUID|Compendium)\[[^\]]+\]\{([^}]+)\}/g, '$1')
    .replace(/\[\[\/r\s*([^\]]+)\]\]/g, '$1')
  if (typeof document !== 'undefined') {
    const template = document.createElement('template')
    template.innerHTML = withFoundryLinks
    return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim()
  }
  return withFoundryLinks.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
function formatFoundryList(
  value: unknown,
  labels: Record<string, string>,
  customValue: unknown,
) {
  const values = Array.isArray(value)
    ? value.map((entry) => labels[String(entry)] ?? String(entry))
    : []
  const custom = cleanFoundryText(customValue)
  return [...values, custom].filter(Boolean).join(', ')
}
function formatFoundryMovement(attributes: Record<string, unknown>) {
  const movement = readRecordField(attributes, 'movement')
  if (!movement) {
    return ''
  }
  const units = normalizeFoundryString(movement.units) || 'ft'
  const unitLabel = units === 'ft' ? 'фт.' : units
  const entries = Object.entries(foundryMovementLabels)
    .map(([key, label]) => {
      const value = readNumberField(movement, key, 0)
      return value > 0 ? `${label === 'ходьба' ? '' : `${label} `}${value} ${unitLabel}`.trim() : ''
    })
    .filter(Boolean)
  if (movement.hover === true && entries.some((entry) => entry.includes('полет'))) {
    entries.push('парение')
  }
  return entries.join(', ')
}
function formatFoundrySenses(attributes: Record<string, unknown>, skills: Record<string, unknown>, wisdom: number) {
  const senses = readRecordField(attributes, 'senses')
  const units = senses ? normalizeFoundryString(senses.units) || 'ft' : 'ft'
  const unitLabel = units === 'ft' ? 'фт.' : units
  const entries = senses
    ? Object.entries(foundrySenseLabels)
      .map(([key, label]) => {
        const value = readNumberField(senses, key, 0)
        return value > 0 ? `${label} ${value} ${unitLabel}` : ''
      })
      .filter(Boolean)
    : []
  const special = senses ? cleanFoundryText(senses.special) : ''
  const perception = readRecordField(skills, 'prc')
  const perceptionProficiency = readNumberField(perception, 'value', 0)
  const passiveBonus = readNumberField(readRecordField(perception ?? {}, 'bonuses'), 'passive', 0)
  const passive = 10 + getAbilityModifier(wisdom) + perceptionProficiency * 2 + passiveBonus
  return [...entries, special, `пассивная Внимательность ${passive}`].filter(Boolean).join(', ')
}
function formatFoundrySkills(
  skills: Record<string, unknown>,
  abilityScores: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>,
  proficiencyBonus: number,
) {
  return Object.entries(skills)
    .map(([skillKey, rawSkill]) => {
      if (!isRecord(rawSkill)) {
        return ''
      }
      const proficiency = readNumberField(rawSkill, 'value', 0)
      const bonus = readNumberField(readRecordField(rawSkill, 'bonuses'), 'check', 0)
      if (proficiency <= 0 && bonus === 0) {
        return ''
      }
      const ability = normalizeFoundryString(rawSkill.ability) || foundrySkillAbilities[skillKey]
      const abilityScore = abilityScores[ability as keyof typeof abilityScores] ?? 10
      const total = getAbilityModifier(abilityScore) + proficiency * proficiencyBonus + bonus
      return `${foundrySkillLabels[skillKey] ?? skillKey} ${formatSignedNumber(total)}`
    })
    .filter(Boolean)
    .join(', ')
}
function formatFoundrySavingThrows(
  abilities: Record<string, unknown>,
  abilityScores: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>,
  proficiencyBonus: number,
) {
  return Object.entries(abilityScores)
    .map(([abilityKey, score]) => {
      const ability = readRecordField(abilities, abilityKey)
      const proficiency = readNumberField(ability, 'proficient', 0)
      const bonus = readNumberField(readRecordField(ability ?? {}, 'bonuses'), 'save', 0)
      if (proficiency <= 0 && bonus === 0) {
        return ''
      }
      const total = getAbilityModifier(score) + proficiency * proficiencyBonus + bonus
      return `${foundryAbilityLabels[abilityKey] ?? abilityKey} ${formatSignedNumber(total)}`
    })
    .filter(Boolean)
    .join(', ')
}
function createMonsterFeatureFromFoundryItem(item: Record<string, unknown>) {
  const system = readRecordField(item, 'system')
  const description = system ? readRecordField(system, 'description') : null
  const body = description ? cleanFoundryText(description.value) : ''
  return {
    id: createEntityId('feature'),
    title: normalizeFoundryString(item.name) || 'Особенность',
    body,
  }
}
async function createAssetRecordFromUrl(
  url: string,
  kind: AssetKind,
  title: string,
): Promise<AssetRecord> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить изображение монстра: ${response.status}`)
  }
  const blob = await response.blob()
  const urlPath = new URL(url, window.location.href).pathname
  const originalName = decodeURIComponent(urlPath.split('/').filter(Boolean).at(-1) ?? `${title}.webp`)
  return {
    id: createEntityId('asset'),
    title: title.trim() || originalName.replace(/\.[^/.]+$/, '') || 'Новый ассет',
    kind,
    mimeType: blob.type || (kind === 'audio' ? 'audio/*' : 'image/*'),
    originalName,
    dataUrl: await readBlobAsDataUrl(blob),
  }
}
function getFoundryItemSection(item: Record<string, unknown>) {
  const system = readRecordField(item, 'system')
  const activation = system ? readRecordField(system, 'activation') : null
  const activationType = activation ? normalizeFoundryString(activation.type) : ''
  const itemType = normalizeFoundryString(item.type)
  if (activationType === 'bonus') {
    return 'bonusActions' as const
  }
  if (activationType === 'reaction') {
    return 'reactions' as const
  }
  if (activationType === 'legendary') {
    return 'legendaryActions' as const
  }
  if (activationType === 'action' || itemType === 'weapon' || itemType === 'spell') {
    return 'actions' as const
  }
  return 'traits' as const
}
function createMonsterBlockFromFoundryActor(rawActor: unknown, existingIds: string[]): MonsterBlock {
  if (!isRecord(rawActor)) {
    throw new Error('JSON монстра должен содержать объект Foundry Actor.')
  }
  const system = readRecordField(rawActor, 'system')
  const abilities = system ? readRecordField(system, 'abilities') : null
  const attributes = system ? readRecordField(system, 'attributes') : null
  const details = system ? readRecordField(system, 'details') : null
  const traits = system ? readRecordField(system, 'traits') : null
  const skills = system ? readRecordField(system, 'skills') : null
  if (!system || !abilities || !attributes || !details || !traits) {
    throw new Error('JSON монстра должен быть экспортом NPC из Foundry/dnd5e.')
  }
  const name = normalizeFoundryString(rawActor.name) || 'Импортированный монстр'
  const type = readRecordField(details, 'type')
  const hp = readRecordField(attributes, 'hp')
  const ac = readRecordField(attributes, 'ac')
  const challenge = readNumberField(details, 'cr', 0)
  const abilityScores = {
    str: readNumberField(readRecordField(abilities, 'str'), 'value', 10),
    dex: readNumberField(readRecordField(abilities, 'dex'), 'value', 10),
    con: readNumberField(readRecordField(abilities, 'con'), 'value', 10),
    int: readNumberField(readRecordField(abilities, 'int'), 'value', 10),
    wis: readNumberField(readRecordField(abilities, 'wis'), 'value', 10),
    cha: readNumberField(readRecordField(abilities, 'cha'), 'value', 10),
  }
  const proficiencyBonus = getMonsterProficiencyBonus(challenge)
  const size = foundrySizeLabels[normalizeFoundryString(traits.size)] ?? normalizeFoundryString(traits.size)
  const creatureTypeValue = type
    ? cleanFoundryText(type.custom) || foundryCreatureTypeLabels[normalizeFoundryString(type.value)] || normalizeFoundryString(type.value)
    : ''
  const subtype = type ? cleanFoundryText(type.subtype) : ''
  const creatureType = [creatureTypeValue, subtype ? `(${subtype})` : ''].filter(Boolean).join(' ')
  const alignment = cleanFoundryText(details.alignment)
  const source = cleanFoundryText(details.source)
  const subtitle = [size, creatureType, alignment].filter(Boolean).join(', ')
  const armorClass = ac
    ? String(ac.flat ?? ac.value ?? (10 + getAbilityModifier(abilityScores.dex)))
    : String(10 + getAbilityModifier(abilityScores.dex))
  const hitPointsValue = readNumberField(hp, 'max', readNumberField(hp, 'value', 0))
  const hitPointsFormula = hp ? cleanFoundryText(hp.formula) : ''
  const foundryItems = Array.isArray(rawActor.items) ? rawActor.items.filter(isRecord) : []
  const featureSections = {
    traits: [] as MonsterFeature[],
    actions: [] as MonsterFeature[],
    bonusActions: [] as MonsterFeature[],
    reactions: [] as MonsterFeature[],
    legendaryActions: [] as MonsterFeature[],
  }
  for (const item of foundryItems) {
    featureSections[getFoundryItemSection(item)].push(createMonsterFeatureFromFoundryItem(item))
  }
  return {
    id: createUniqueCollectionId(name, existingIds, 'monster'),
    name,
    subtitle: subtitle || 'Импортировано из Foundry',
    source,
    size,
    creatureType,
    alignment,
    proficiencyBonus: formatSignedNumber(proficiencyBonus),
    imageSrc: normalizeFoundryString(rawActor.img) || null,
    armorClass,
    hitPoints: hitPointsFormula ? `${hitPointsValue} (${hitPointsFormula})` : String(hitPointsValue || ''),
    hitPointsFormula,
    speed: formatFoundryMovement(attributes),
    strength: abilityScores.str,
    dexterity: abilityScores.dex,
    constitution: abilityScores.con,
    intelligence: abilityScores.int,
    wisdom: abilityScores.wis,
    charisma: abilityScores.cha,
    savingThrows: formatFoundrySavingThrows(abilities, abilityScores, proficiencyBonus),
    skills: skills ? formatFoundrySkills(skills, abilityScores, proficiencyBonus) : '',
    damageVulnerabilities: traits.dv && isRecord(traits.dv)
      ? formatFoundryList(traits.dv.value, foundryDamageTypeLabels, traits.dv.custom)
      : '',
    damageResistances: traits.dr && isRecord(traits.dr)
      ? formatFoundryList(traits.dr.value, foundryDamageTypeLabels, traits.dr.custom)
      : '',
    damageImmunities: traits.di && isRecord(traits.di)
      ? formatFoundryList(traits.di.value, foundryDamageTypeLabels, traits.di.custom)
      : '',
    conditionImmunities: traits.ci && isRecord(traits.ci)
      ? formatFoundryList(traits.ci.value, foundryConditionLabels, traits.ci.custom)
      : '',
    senses: skills ? formatFoundrySenses(attributes, skills, abilityScores.wis) : '',
    languages: traits.languages && isRecord(traits.languages)
      ? formatFoundryList(traits.languages.value, {}, traits.languages.custom)
      : '',
    challenge: formatMonsterChallengeRating(challenge),
    notes: cleanFoundryText(readRecordField(details, 'biography')?.value),
    ...featureSections,
  }
}
function createFallbackMonsterImage(name: string) {
  const label = (name.trim()[0] ?? 'Рњ').toUpperCase()
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs>
<linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
<stop offset="0%" stop-color="#5b2f22" />
<stop offset="100%" stop-color="#b86e3d" />
</linearGradient>
</defs>
<rect width="128" height="128" rx="24" fill="url(#bg)" />
<circle cx="64" cy="64" r="42" fill="rgba(255,255,255,0.12)" />
<text x="64" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#f8f0e2">${label}</text>
</svg>
`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
function parseMonsterFeatures(
  rawValue: unknown,
  sectionLabel: string,
) {
  const featureIds: string[] = []
  if (!Array.isArray(rawValue)) {
    return []
  }
  return rawValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Элемент #${index + 1} в разделе "${sectionLabel}" должен быть объектом.`)
    }
    const title = readRequiredString(
      entry,
      'title',
      `Название элемента #${index + 1} в разделе "${sectionLabel}"`,
    )
    const id = createUniqueCollectionId(
      readOptionalString(entry, 'id') ?? title,
      featureIds,
      'feature',
    )
    featureIds.push(id)
    return {
      id,
      title,
      body: readRequiredString(
        entry,
        'body',
        `Текст элемента "${title}" в разделе "${sectionLabel}"`,
      ),
    }
  })
}
export function GmWindow() {
  const initialProjectState = createInitialProjectState(sampleAdventure)
  const {
    projectState,
    projectSnapshots,
    undoStack,
    redoStack,
    commitProjectState,
    updateProjectState,
    undoLastChange,
    redoLastChange,
    restoreProjectSnapshot,
  } = useProjectHistory(initialProjectState)
  const [activeSceneId, setActiveSceneId] = useState(
    () => sampleAdventure.scenes[0]?.id ?? '',
  )
  const [selectedHandoutId, setSelectedHandoutId] = useState<string | null>(null)
  const [linkedCheckPreviewId, setLinkedCheckPreviewId] = useState<string | null>(null)
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false)
  const [isSpellLibraryModalOpen, setIsSpellLibraryModalOpen] = useState(false)
  const [isBestiaryModalOpen, setIsBestiaryModalOpen] = useState(false)
  const [builtInSpellLibrary, setBuiltInSpellLibrary] = useState<SpellBlock[] | null>(null)
  const [builtInBestiary, setBuiltInBestiary] = useState<MonsterSummary[] | null>(null)
  const [spellLibraryLoadError, setSpellLibraryLoadError] = useState<string | null>(null)
  const [bestiaryLoadError, setBestiaryLoadError] = useState<string | null>(null)
  const [characterImportTargetId, setCharacterImportTargetId] = useState<string | null>(null)
  const [pendingCharacterDeleteId, setPendingCharacterDeleteId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [selectedServiceMarkerId, setSelectedServiceMarkerId] = useState<string | null>(null)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [collapsedMonsterIds, setCollapsedMonsterIds] = useState<string[]>([])
  const [isMonsterListCollapsed, setIsMonsterListCollapsed] = useState(false)
  const [isMonsterLibraryDropdownOpen, setIsMonsterLibraryDropdownOpen] = useState(false)
  const [monsterLibrarySearch, setMonsterLibrarySearch] = useState('')
  const [pendingMonsterLibraryDeleteId, setPendingMonsterLibraryDeleteId] = useState<string | null>(null)
  const [isLiveToolsCollapsed, setIsLiveToolsCollapsed] = useState(false)
  const [isRecoveryPointsCollapsed, setIsRecoveryPointsCollapsed] = useState(true)
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('scene')
  const [isSceneEditorModalOpen, setIsSceneEditorModalOpen] = useState(false)
  const [isSceneEditorActionsOpen, setIsSceneEditorActionsOpen] = useState(false)
  const [isInitiativeTrackerVisible, setIsInitiativeTrackerVisible] = useState(true)
  const [isGmNotesVisible, setIsGmNotesVisible] = useState(false)
  const [mapInteractionMode, setMapInteractionMode] =
    useState<MapInteractionMode>('navigate')
  const [isServiceMarkerModalOpen, setIsServiceMarkerModalOpen] = useState(false)
  const [isMapParamsModalOpen, setIsMapParamsModalOpen] = useState(false)
  const [isMapGridModalOpen, setIsMapGridModalOpen] = useState(false)
  const [isMapLayersModalOpen, setIsMapLayersModalOpen] = useState(false)
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [mapGridCellSize, setMapGridCellSize] = useState<number | null>(null)
  const [openCompactZoneToolsZoneId, setOpenCompactZoneToolsZoneId] = useState<string | null>(null)
  const [hoveredZoneResizeHandle, setHoveredZoneResizeHandle] = useState<{
    zoneId: string
    handle: ZoneResizeHandle | null
  } | null>(null)
  const [rotatingTokenId, setRotatingTokenId] = useState<string | null>(null)
  const sceneEditorActionsRef = useRef<HTMLDivElement | null>(null)
  const layerImageInputRef = useRef<HTMLInputElement | null>(null)
  const zoneDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const zoneDragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const zoneResizeStateRef = useRef<{
    zoneId: string
    handle: ZoneResizeHandle
    startX: number
    startY: number
    zone: Pick<MapZone, 'x' | 'y' | 'width' | 'height'>
  } | null>(null)
  const suppressZoneClickRef = useRef(false)
  const tokenDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const tokenPointerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const tokenRotateHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenInteractionModeRef = useRef<'move' | 'rotate'>('move')
  const tokenRotationGestureRef = useRef<{ tokenId: string; angleOffset: number } | null>(null)
  const suppressTokenClickRef = useRef(false)
  const serviceMarkerDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressServiceMarkerClickRef = useRef(false)
  const [newServiceMarkerLabel] = useState('Служебная метка')
  const [newMonsterSpawnCount, setNewMonsterSpawnCount] = useState(1)
  const [monsterSpawnCounts, setMonsterSpawnCounts] = useState<Record<string, number>>({})
  const [newAssetKind, setNewAssetKind] = useState<AssetKind>('image')
  const [newAssetTitle, setNewAssetTitle] = useState('')
  const [audioVolume, setAudioVolume] = useState(70)
  const [audioLoop, setAudioLoop] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [isServiceMarkerDragging, setIsServiceMarkerDragging] = useState(false)
  const [fogSelectionRect, setFogSelectionRect] = useState<FogSelectionRect | null>(null)
  const [zoneSelectionRect, setZoneSelectionRect] = useState<ZoneSelectionRect | null>(null)
  const [isSceneMenuOpen, setIsSceneMenuOpen] = useState(false)
  const [isProjectActionsOpen, setIsProjectActionsOpen] = useState(false)
  const [editingAdventureField, setEditingAdventureField] = useState<{
    adventureId: string
    field: 'id' | 'title'
  } | null>(null)
  const [editingAdventureValue, setEditingAdventureValue] = useState('')
  const [importFeedback, setImportFeedback] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)
  const {
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
  } = useProjectFolderPersistence({
    projectState,
    onProjectLoaded: applyLoadedProjectState,
    setImportFeedback,
  })
  const mapBoardRef = useRef<HTMLDivElement | null>(null)
  const mapFrameRef = useRef<HTMLDivElement | null>(null)
  const mapTransformLayerRef = useRef<HTMLDivElement | null>(null)
  const projectActionsRef = useRef<HTMLDivElement | null>(null)
  const projectObjectUrlsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const nextObjectUrls = collectProjectObjectUrls(projectState)
    const previousObjectUrls = projectObjectUrlsRef.current
    revokeObjectUrls(
      [...previousObjectUrls].filter((objectUrl) => !nextObjectUrls.has(objectUrl)),
    )
    projectObjectUrlsRef.current = nextObjectUrls
  }, [projectState])
  useEffect(() => {
    return () => {
      revokeObjectUrls(projectObjectUrlsRef.current)
      projectObjectUrlsRef.current = new Set()
    }
  }, [])
  useEffect(() => {
    if (!isSpellLibraryModalOpen && !isCharacterModalOpen) {
      return
    }
    let isCancelled = false
    setSpellLibraryLoadError(null)
    loadBuiltInSpellLibrary()
      .then((spells) => {
        if (!isCancelled) {
          setBuiltInSpellLibrary(spells)
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setSpellLibraryLoadError(error instanceof Error ? error.message : 'Не удалось загрузить библиотеку заклинаний.')
        }
      })
    return () => {
      isCancelled = true
    }
  }, [isCharacterModalOpen, isSpellLibraryModalOpen])
  useEffect(() => {
    if (!isBestiaryModalOpen && !isMonsterLibraryDropdownOpen) {
      return
    }
    let isCancelled = false
    setBestiaryLoadError(null)
    loadBuiltInBestiarySummaries()
      .then((monsters) => {
        if (!isCancelled) {
          setBuiltInBestiary(monsters)
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setBestiaryLoadError(error instanceof Error ? error.message : 'Не удалось загрузить бестиарий.')
        }
      })
    return () => {
      isCancelled = true
    }
  }, [isBestiaryModalOpen, isMonsterLibraryDropdownOpen])
  useEffect(() => {
    if (!isSceneMenuOpen && !isProjectActionsOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isProjectActionsOpen) {
          setIsProjectActionsOpen(false)
          return
        }
        setIsSceneMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProjectActionsOpen, isSceneMenuOpen])
  useEffect(() => {
    if (!isProjectActionsOpen) {
      return
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && projectActionsRef.current?.contains(target)) {
        return
      }
      setIsProjectActionsOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isProjectActionsOpen])
  useEffect(() => {
    if (!isSceneMenuOpen) {
      // Keep dependent flyouts/edit fields closed when the scene drawer closes.
      setIsProjectActionsOpen(false)
      setEditingAdventureField(null)
      setEditingAdventureValue('')
    }
  }, [isSceneMenuOpen])
  useEffect(() => {
    if (!isSceneEditorActionsOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSceneEditorActionsOpen(false)
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && sceneEditorActionsRef.current?.contains(target)) {
        return
      }
      setIsSceneEditorActionsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isSceneEditorActionsOpen])
  useEffect(() => {
    if (!isSceneEditorModalOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSceneEditorModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSceneEditorModalOpen])
  function openSceneEditorSection(tabId: EditorTab) {
    setLinkedCheckPreviewId(null)
    setActiveEditorTab(tabId)
    setIsSceneEditorModalOpen(true)
    setIsSceneEditorActionsOpen(false)
  }
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const projectImportFileInputRef = useRef<HTMLInputElement | null>(null)
  const characterImportFileInputRef = useRef<HTMLInputElement | null>(null)
  const monsterImportFileInputRef = useRef<HTMLInputElement | null>(null)
  const channelRef = useBroadcastChannel()
  const projectStateRef = useRef(projectState)
  const playerDisplayAssetCacheRef = useRef<Map<string, string>>(new Map())
  const playerDisplayBroadcastIdRef = useRef(0)
  const activeSceneStateRef = useRef<SceneRuntimeState | null>(null)
  const activeBundle = getActiveAdventureBundle(projectState)
  const activeAdventureId = activeBundle?.adventureId ?? null
  const adventure = activeBundle?.adventure ?? null
  const adventureMonsters = adventure?.monsterLibrary ?? []
  const sessionState = activeBundle?.session ?? null
  const resolvedActiveSceneId =
    adventure?.scenes.some((scene) => scene.id === activeSceneId)
      ? activeSceneId
      : (adventure?.scenes[0]?.id ?? '')
  async function broadcastProjectStateToPlayer(nextProjectState = projectStateRef.current) {
    const broadcastId = playerDisplayBroadcastIdRef.current + 1
    playerDisplayBroadcastIdRef.current = broadcastId
    const projectStateForPlayer = await createPlayerDisplayProjectState(
      nextProjectState,
      playerDisplayAssetCacheRef.current,
      projectDirectoryHandle,
    )

    if (playerDisplayBroadcastIdRef.current === broadcastId) {
      channelRef.current?.postMessage(projectStateForPlayer)
    }
  }
  useEffect(() => {
    projectStateRef.current = projectState
    void broadcastProjectStateToPlayer(projectState)
  }, [channelRef, projectDirectoryHandle, projectState])
  useEffect(() => {
    const channel = channelRef.current

    if (!channel) {
      return
    }

    const handlePlayerDisplayMessage = (event: MessageEvent) => {
      if (isPlayerDisplayReadyMessage(event.data)) {
        void broadcastProjectStateToPlayer()
      }
    }

    channel.addEventListener('message', handlePlayerDisplayMessage)
    return () => {
      channel.removeEventListener('message', handlePlayerDisplayMessage)
    }
  }, [channelRef])
  useEffect(() => {
    const audio = new Audio()
    const onPlay = () => setIsAudioPlaying(true)
    const onPause = () => setIsAudioPlaying(false)
    const onEnded = () => setIsAudioPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [])
  useEffect(() => {
    if (!audioRef.current) {
      return
    }
    audioRef.current.volume = audioVolume / 100
  }, [audioVolume])
  useEffect(() => {
    if (!audioRef.current) {
      return
    }
    audioRef.current.loop = audioLoop
  }, [audioLoop])
  const activeScene =
    adventure?.scenes.find((scene) => scene.id === resolvedActiveSceneId) ??
    adventure?.scenes[0] ??
    null
  const activeSceneMonsterIds = new Set(activeScene?.monsterIds ?? [])
  const sceneMonsters = adventureMonsters.filter((monster) => activeSceneMonsterIds.has(monster.id))
  const linkedCheckPreviewEntry =
    activeScene?.checksClues.find((entry) => entry.id === linkedCheckPreviewId) ?? null
  const resolvedSelectedHandoutId = activeScene?.handouts.some(
    (handout) => handout.id === selectedHandoutId,
  )
    ? selectedHandoutId
    : null
  const resolvedSelectedAudioId = adventure?.audioLibrary.some(
    (track) => track.id === selectedAudioId,
  )
    ? selectedAudioId
    : (adventure?.audioLibrary[0]?.id ?? null)
  const activeSceneState = activeScene
    ? sessionState?.sceneStates[activeScene.id] ?? null
    : null
  const activeHandout =
    activeScene?.handouts.find(
      (handout) => handout.id === resolvedSelectedHandoutId,
    ) ??
    null
  const resolvedSelectedMonsterId = sceneMonsters.some(
    (monster) => monster.id === selectedMonsterId,
  )
    ? selectedMonsterId
    : (sceneMonsters[0]?.id ?? null)
  const activeMonster =
    sceneMonsters.find(
      (monster) => monster.id === resolvedSelectedMonsterId,
    ) ?? null
  const resolvedSelectedCharacterId = adventure?.characters.some(
    (character) => character.id === selectedCharacterId,
  )
    ? selectedCharacterId
    : (adventure?.characters[0]?.id ?? null)
  const activeCharacter =
    adventure?.characters.find((character) => character.id === resolvedSelectedCharacterId) ?? null
  const isActiveMonsterCollapsed = activeMonster
    ? collapsedMonsterIds.includes(activeMonster.id)
    : false
  const currentPlayerScene = adventure?.scenes.find(
    (scene) => scene.id === sessionState?.playerDisplay.sceneId,
  )
  const currentPlayerHandout =
    currentPlayerScene?.handouts.find(
      (handout) => handout.id === sessionState?.playerDisplay.activeHandoutId,
    ) ?? null
  const currentPlayerDisplay = sessionState?.playerDisplay ?? null
  const currentPlayerSceneId = currentPlayerDisplay?.sceneId ?? null
  const currentPlayerMode = currentPlayerDisplay?.mode ?? 'standby'
  const currentPlayerHandoutId = currentPlayerDisplay?.activeHandoutId ?? null
  const currentPlayerSplash = currentPlayerScene?.splash ?? null
  const visiblePlayerHandout =
    currentPlayerSceneId === activeScene?.id ? currentPlayerHandout : null
  const activeAudioTrack =
    adventure?.audioLibrary.find((track) => track.id === resolvedSelectedAudioId) ??
    null
  const imageAssets = adventure?.assetLibrary.filter((asset) => asset.kind === 'image') ?? []
  const audioAssets = adventure?.assetLibrary.filter((asset) => asset.kind === 'audio') ?? []
  const resolvedSceneMapImage = adventure
    ? getAssetDataUrl(
      adventure.assetLibrary,
      activeScene?.map.imageAssetId,
      activeScene?.map.imageSrc,
    )
    : null
  const resolvedSceneSplashImage = adventure
    ? getAssetDataUrl(
      adventure.assetLibrary,
      activeScene?.splash.imageAssetId,
      activeScene?.splash.imageSrc,
    )
    : null
  const activeToken =
    activeSceneState?.tokens.find((token) => token.id === selectedTokenId) ?? null
  const activeTokenLinkedMonster =
    activeToken?.linkedMonsterId
      ? sceneMonsters.find((monster) => monster.id === activeToken.linkedMonsterId) ?? null
      : null
  const activeTokenLinkedCharacter =
    activeToken?.linkedCharacterId && adventure
      ? adventure.characters.find((character) => character.id === activeToken.linkedCharacterId) ?? null
      : null
  const activeLayer =
    activeSceneState?.mapLayers.find((layer) => layer.isActive) ??
    activeSceneState?.mapLayers.find((layer) => layer.id === selectedLayerId) ??
    activeSceneState?.mapLayers[0] ??
    null
  const quickMapLayer = activeSceneState?.mapLayers.find((layer) => layer.isActive) ?? activeLayer
  const activeServiceMarker =
    activeSceneState?.serviceMarkers.find(
      (marker) => marker.id === selectedServiceMarkerId,
    ) ?? null
  const activeZone =
    activeScene?.zones.find((zone) => zone.id === selectedZoneId) ??
    activeScene?.zones[0] ??
    null
  const quickSceneHandout = activeScene ? getQuickSceneHandout(activeScene) : null
  const isPlayerShowingActiveMap =
    currentPlayerMode === 'map' && currentPlayerSceneId === activeScene?.id
  const isPlayerShowingActiveSplash =
    currentPlayerMode === 'splash' && currentPlayerSceneId === activeScene?.id
  const isPlayerShowingQuickHandout =
    currentPlayerMode === 'map' &&
    currentPlayerSceneId === activeScene?.id &&
    currentPlayerHandoutId === quickSceneHandout?.id
  useEffect(() => {
    if (!activeScene?.zones.length) {
      // The modal cannot remain meaningful after the last zone disappears.
      setIsZoneModalOpen(false)
    }
  }, [activeScene?.zones.length])
  const orderedTokens = [...(activeSceneState?.tokens ?? [])].sort(
    (left, right) => left.zIndex - right.zIndex,
  )
  const initiativeTokens = sortTokensByInitiative(activeSceneState?.tokens ?? [])
  const activeInitiativeToken =
    activeSceneState?.activeInitiativeTokenId
      ? activeSceneState.tokens.find(
        (token) => token.id === activeSceneState.activeInitiativeTokenId,
      ) ?? null
      : null
  const orderedServiceMarkers = [...(activeSceneState?.serviceMarkers ?? [])].sort(
    (left, right) => left.zIndex - right.zIndex,
  )
  const activeMapViewport = activeSceneState?.mapViewport ?? {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
  const {
    beginMapPan,
    isMapPanning,
    resetMapViewport,
    stopMapPan,
    zoomMap,
  } = useMapViewportControls({
    activeSceneId: activeScene?.id ?? null,
    activeMapViewport,
    mapBoardRef,
    updateSceneRuntimeState,
  })
  const activeMapGrid = normalizeMapGrid(activeSceneState?.mapGrid)
  const activeMapGridAspectRatio = activeMapGrid.columns / activeMapGrid.rows
  const activeMapFrameStyle = {
    width: `max(100%, ${activeMapGridAspectRatio * 100}dvh)`,
    height: `max(100%, ${(activeMapGrid.rows / activeMapGrid.columns) * 100}dvw)`,
    aspectRatio: `${activeMapGrid.columns} / ${activeMapGrid.rows}`,
  }
  const isMapGridVisible = activeSceneState?.mapGridVisible ?? true
  const hiddenFogZones =
    activeScene && activeSceneState
      ? activeScene.zones.filter((zone) => activeSceneState.hiddenZoneIds.includes(zone.id))
      : []
  const effectiveFogCells =
    activeSceneState ? activeSceneState.fogCells : []
  useEffect(() => {
    const board = mapFrameRef.current
    if (!board) {
      return
    }
    const updateGridCellSize = () => {
      const rect = board.getBoundingClientRect()
      const nextCellSize = Math.max(
        1,
        Math.min(rect.width / activeMapGrid.columns, rect.height / activeMapGrid.rows),
      )
      setMapGridCellSize((currentCellSize) =>
        currentCellSize != null && Math.abs(currentCellSize - nextCellSize) < 0.5
          ? currentCellSize
          : nextCellSize,
      )
    }
    updateGridCellSize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateGridCellSize)
      return () => {
        window.removeEventListener('resize', updateGridCellSize)
      }
    }
    const resizeObserver = new ResizeObserver(updateGridCellSize)
    resizeObserver.observe(board)
    return () => {
      resizeObserver.disconnect()
    }
  }, [activeMapGrid.columns, activeMapGrid.rows])
  const gmVisibleLayers =
    activeSceneState?.mapLayers.filter(
      (layer) => layer.visibleToGm && layer.imageSrc,
    ) ?? []
  const recentProjectSnapshots = [...projectSnapshots].reverse().slice(0, 6)
  const tokenTrackerEntries = [...activeSceneState.tokens].sort((leftToken, rightToken) => {
    if (leftToken.initiative == null && rightToken.initiative != null) {
      return 1
    }
    if (leftToken.initiative != null && rightToken.initiative == null) {
      return -1
    }
    if (
      leftToken.initiative != null &&
      rightToken.initiative != null &&
      leftToken.initiative !== rightToken.initiative
    ) {
      return rightToken.initiative - leftToken.initiative
    }
    return leftToken.name.localeCompare(rightToken.name, 'ru-RU')
  })
  const initiativeTrackerTokens = initiativeTokens.length > 0 ? initiativeTokens : tokenTrackerEntries
  const initiativeTrackerFocusToken =
    activeInitiativeToken ?? activeToken ?? initiativeTrackerTokens[0] ?? null
  const initiativeTrackerFocusIndex = initiativeTrackerFocusToken
    ? initiativeTrackerTokens.findIndex((token) => token.id === initiativeTrackerFocusToken.id)
    : -1
  const initiativeTrackerWindowSize = 9
  const initiativeTrackerVisibleTokens =
    initiativeTrackerTokens.length <= 11
      ? initiativeTrackerTokens
      : Array.from({ length: initiativeTrackerWindowSize }, (_, index) => {
        const offset = index - Math.floor(initiativeTrackerWindowSize / 2)
        const baseIndex = initiativeTrackerFocusIndex >= 0 ? initiativeTrackerFocusIndex : 0
        const tokenIndex =
          (baseIndex + offset + initiativeTrackerTokens.length) % initiativeTrackerTokens.length
        return initiativeTrackerTokens[tokenIndex]
      })
  const hiddenInitiativeTrackerTokenCount = Math.max(
    0,
    initiativeTrackerTokens.length - initiativeTrackerVisibleTokens.length,
  )
  const playerModeLabel =
    sessionState?.playerDisplay.mode === 'map'
      ? 'карта'
      : sessionState?.playerDisplay.mode === 'handout'
        ? 'раздатка'
        : 'ожидание'
  const effectivePlayerModeLabel =
    sessionState?.playerDisplay.mode === 'splash'
      ? 'Splash-экран'
      : playerModeLabel
  useEffect(() => {
    if (!activeSceneState) {
      activeSceneStateRef.current = null
      return
    }
    activeSceneStateRef.current = activeSceneState
    // Drop token selection when the selected token is removed by scene edits.
    setSelectedTokenId((currentId) => {
      if (currentId && activeSceneState.tokens.some((token) => token.id === currentId)) {
        return currentId
      }
      return null
    })
    setSelectedLayerId((currentId) => {
      if (currentId && activeSceneState.mapLayers.some((layer) => layer.id === currentId)) {
        return currentId
      }
      return activeSceneState.mapLayers.find((layer) => layer.isActive)?.id ?? activeSceneState.mapLayers[0]?.id ?? null
    })
    setSelectedServiceMarkerId((currentId) => {
      if (
        currentId &&
        activeSceneState.serviceMarkers.some((marker) => marker.id === currentId)
      ) {
        return currentId
      }
      return null
    })
  }, [activeSceneState])
  useEffect(() => {
    if (!activeScene) {
      return
    }
    // Drop zone selection when the selected zone is removed by scene edits.
    setSelectedZoneId((currentId) => {
      if (currentId && activeScene.zones.some((zone) => zone.id === currentId)) {
        return currentId
      }
      return activeScene.zones[0]?.id ?? null
    })
  }, [activeScene])
  useEffect(() => {
    if (
      mapInteractionMode !== 'fog-area-draw' &&
      mapInteractionMode !== 'fog-area-erase' &&
      fogSelectionRect
    ) {
      // Clear stale drag affordances when leaving fog tools.
      setFogSelectionRect(null)
    }
    if (mapInteractionMode !== 'zone' && zoneSelectionRect) {
      setZoneSelectionRect(null)
    }
  }, [fogSelectionRect, mapInteractionMode, zoneSelectionRect])
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditableEventTarget(event.target)) {
        return
      }
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoLastChange()
        return
      }
      if (
        event.key.toLowerCase() === 'y' ||
        (event.key.toLowerCase() === 'z' && event.shiftKey)
      ) {
        event.preventDefault()
        redoLastChange()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redoLastChange, redoStack.length, undoLastChange, undoStack.length])
  function updateAdventure(
    updater: (adventure: Adventure) => Adventure,
    label = 'Изменено приключение',
  ) {
    updateProjectState((currentState) => {
      const adventureId = currentState.activeAdventureId
      if (!adventureId || !currentState.adventures[adventureId]) {
        return currentState
      }
      return {
        ...currentState,
        adventures: {
          ...currentState.adventures,
          [adventureId]: updater(currentState.adventures[adventureId]),
        },
      }
    }, label)
  }
  async function addAssetToAdventure(
    file: File | null,
    kind: AssetKind,
    title?: string,
  ) {
    if (!file || !adventure || !activeScene) {
      return null
    }
    const asset = await createAssetRecordFromFile(file, kind, title)
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      assetLibrary: [...currentAdventure.assetLibrary, asset],
    }), `Добавлен ассет: ${asset.title}`)
    return asset
  }
  async function addUrlAssetToAdventure(
    url: string | null | undefined,
    kind: AssetKind,
    title: string,
  ) {
    if (!url || !adventure || !/^https?:\/\//i.test(url)) {
      return null
    }
    const asset = await createAssetRecordFromUrl(url, kind, title)
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      assetLibrary: [...currentAdventure.assetLibrary, asset],
    }), `Добавлен ассет: ${asset.title}`)
    return asset
  }
  function updateSession(
    updater: (session: SessionState) => SessionState,
    label = 'Изменение состояния сессии',
  ) {
    updateProjectState((currentState) => {
      const adventureId = currentState.activeAdventureId
      if (!adventureId || !currentState.sessions[adventureId]) {
        return currentState
      }
      return {
        ...currentState,
        sessions: {
          ...currentState.sessions,
          [adventureId]: updater(currentState.sessions[adventureId]),
        },
      }
    }, label)
  }
  function updateSceneRuntimeState(
    sceneId: string,
    updater: (sceneState: SceneRuntimeState) => SceneRuntimeState,
    label = 'Изменение состояния сцены',
  ) {
    updateSession((currentSession) => ({
      ...currentSession,
      playerDisplay: {
        ...currentSession.playerDisplay,
        updatedAt: new Date().toISOString(),
      },
      sceneStates: {
        ...currentSession.sceneStates,
        [sceneId]: updater(currentSession.sceneStates[sceneId]),
      },
    }), label)
  }
  function updateMapGrid(axis: keyof MapGridSettings, value: number) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      mapGrid: normalizeMapGrid({
        ...sceneState.mapGrid,
        [axis]: value,
      }),
    }))
  }
  function toggleMapGridVisibility() {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      mapGridVisible: !(sceneState.mapGridVisible ?? true),
    }))
  }
  function updateActiveSceneMapLayer(
    layerId: string,
    updater: (layer: MapLayerInstance) => MapLayerInstance,
  ) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => {
      const nextLayers = sceneState.mapLayers.map((layer) =>
        layer.id === layerId ? updater(layer) : layer,
      )
      const nextBaseLayer = nextLayers[0] ?? createBaseMapLayer(activeScene, null)
      return {
        ...sceneState,
        mapImageSrc: nextBaseLayer.imageSrc,
        mapLayers: nextLayers,
      }
    })
  }
  function setActiveSceneMapLayer(layerId: string) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      mapLayers: sceneState.mapLayers.map((layer) => ({
        ...layer,
        isActive: layer.id === layerId,
      })),
    }))
    setSelectedLayerId(layerId)
  }
  async function handleLayerImageReplace(layerId: string, file: File | null) {
    if (!file) {
      return
    }
    const imageSrc = await readFileAsDataUrl(file)
    updateActiveSceneMapLayer(layerId, (layer) => ({
      ...layer,
      imageSrc,
    }))
  }
  function updateScene(
    sceneId: string,
    updater: (scene: AdventureScene) => AdventureScene,
    label = 'Изменена сцена',
  ) {
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      scenes: currentAdventure.scenes.map((scene) =>
        scene.id === sceneId ? updater(scene) : scene,
      ),
    }), label)
  }
  function createDefaultZone(x: number, y: number, width = 18, height = 14): MapZone {
    return {
      id: createEntityId('zone'),
      title: 'Новая зона',
      note: '',
      focusNote: '',
      linkedHandoutId: null,
      linkedCheckId: null,
      linkedMonsterId: null,
      x,
      y,
      width,
      height,
      visibleToPlayers: false,
      autoRevealOnEnter: false,
    }
  }
  function addZoneAt(clientX: number, clientY: number) {
    if (!activeScene || !mapFrameRef.current) {
      return
    }
    const { x, y } = resolveMapBoardPosition(
      mapFrameRef.current,
      clientX,
      clientY,
      activeMapViewport,
    )
    const zone = createDefaultZone(x, y)
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      zones: [...scene.zones, zone],
    }), 'Добавлена зона на карте')
    setSelectedZoneId(zone.id)
  }
  function addZoneFromSelection(bounds: ZoneSelectionRect) {
    if (!activeScene) {
      return
    }
    const minimumWidth = 100 / activeMapGrid.columns
    const minimumHeight = 100 / activeMapGrid.rows
    const width = Math.min(100 - bounds.left, Math.max(bounds.width, minimumWidth))
    const height = Math.min(100 - bounds.top, Math.max(bounds.height, minimumHeight))
    const zone = createDefaultZone(bounds.left, bounds.top, width, height)
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      zones: [...scene.zones, zone],
    }), 'Добавлена зона на карте')
    setSelectedZoneId(zone.id)
  }
  function updateZone(zoneId: string, updater: (zone: MapZone) => MapZone) {
    if (!activeScene) {
      return
    }
    const previousZones = activeScene.zones
    const previousZone = previousZones.find((zone) => zone.id === zoneId)
    const nextZones = previousZones.map((zone) => (zone.id === zoneId ? updater(zone) : zone))
    const nextZone = nextZones.find((zone) => zone.id === zoneId)
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      zones: nextZones,
    }))
    if (
      previousZone &&
      nextZone &&
      activeSceneStateRef.current?.hiddenZoneIds.includes(zoneId)
    ) {
      const legacyHiddenZoneCells = new Set([
        ...getFogCellIdsForZone(previousZone, activeMapGrid),
        ...getFogCellIdsForZone(nextZone, activeMapGrid),
      ])
      if (legacyHiddenZoneCells.size > 0) {
        updateSceneRuntimeState(activeScene.id, (sceneState) => ({
          ...sceneState,
          fogCells: sceneState.fogCells.filter((cellId) => !legacyHiddenZoneCells.has(cellId)),
        }))
      }
    }
  }
  function removeZone(zoneId: string) {
    if (!activeScene) {
      return
    }
    const previousZones = activeScene.zones
    const removedZone = previousZones.find((zone) => zone.id === zoneId)
    const nextZones = previousZones.filter((zone) => zone.id !== zoneId)
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      zones: nextZones,
    }))
    updateSceneRuntimeState(activeScene.id, (sceneState) => {
      const shouldClearLegacyZoneFog =
        removedZone && sceneState.hiddenZoneIds.includes(zoneId)
      const legacyHiddenZoneCells =
        removedZone && shouldClearLegacyZoneFog
          ? new Set(getFogCellIdsForZone(removedZone, activeMapGrid))
          : null
      return {
        ...sceneState,
        fogCells:
          legacyHiddenZoneCells && legacyHiddenZoneCells.size > 0
            ? sceneState.fogCells.filter((cellId) => !legacyHiddenZoneCells.has(cellId))
            : sceneState.fogCells,
        hiddenZoneIds: sceneState.hiddenZoneIds.filter((id) => id !== zoneId),
      }
    })
    if (selectedZoneId === zoneId) {
      setIsZoneModalOpen(false)
    }
    setSelectedZoneId((currentId) => (currentId === zoneId ? null : currentId))
  }
  function moveZone(
    zoneId: string,
    clientX: number,
    clientY: number,
    dragOffset: { x: number; y: number } | null = null,
  ) {
    const mapBoard = mapFrameRef.current
    if (!mapBoard || !activeScene) {
      return
    }
    const { x, y } = resolveMapBoardPosition(
      mapBoard,
      clientX,
      clientY,
      activeMapViewport,
    )
    updateZone(zoneId, (zone) => ({
      ...zone,
      x: clampZoneCoordinate(x - (dragOffset?.x ?? 0), zone.x),
      y: clampZoneCoordinate(y - (dragOffset?.y ?? 0), zone.y),
    }))
  }
  function beginZoneDrag(
    zoneId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (mapInteractionMode !== 'navigate' && mapInteractionMode !== 'zone') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    zoneDragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    const mapBoard = mapFrameRef.current
    const zone = activeScene?.zones.find((entry) => entry.id === zoneId) ?? null
    if (mapBoard && zone) {
      const pointerPosition = resolveMapBoardPosition(
        mapBoard,
        event.clientX,
        event.clientY,
        activeMapViewport,
      )
      zoneDragOffsetRef.current = {
        x: pointerPosition.x - zone.x,
        y: pointerPosition.y - zone.y,
      }
    } else {
      zoneDragOffsetRef.current = null
    }
    suppressZoneClickRef.current = false
    setSelectedZoneId(zoneId)
    const handleMove = (moveEvent: PointerEvent) => {
      if (zoneDragStartRef.current) {
        const deltaX = moveEvent.clientX - zoneDragStartRef.current.x
        const deltaY = moveEvent.clientY - zoneDragStartRef.current.y
        if (Math.hypot(deltaX, deltaY) > tokenDragThreshold) {
          suppressZoneClickRef.current = true
        }
      }
      if (suppressZoneClickRef.current) {
        moveZone(zoneId, moveEvent.clientX, moveEvent.clientY, zoneDragOffsetRef.current)
      }
    }
    const handleUp = () => {
      zoneDragStartRef.current = null
      zoneDragOffsetRef.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function beginZoneResize(
    zoneId: string,
    handle: ZoneResizeHandle,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (mapInteractionMode !== 'navigate' && mapInteractionMode !== 'zone') {
      return
    }
    const mapBoard = mapFrameRef.current
    const zone = activeScene?.zones.find((entry) => entry.id === zoneId) ?? null
    if (!mapBoard || !zone) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const startPointer = resolveMapBoardPosition(
      mapBoard,
      event.clientX,
      event.clientY,
      activeMapViewport,
    )
    suppressZoneClickRef.current = true
    zoneResizeStateRef.current = {
      zoneId,
      handle,
      startX: startPointer.x,
      startY: startPointer.y,
      zone: {
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
      },
    }
    setSelectedZoneId(zoneId)
    const handleMove = (moveEvent: PointerEvent) => {
      const resizeState = zoneResizeStateRef.current
      if (!resizeState || resizeState.zoneId !== zoneId) {
        return
      }
      const pointer = resolveMapBoardPosition(
        mapBoard,
        moveEvent.clientX,
        moveEvent.clientY,
        activeMapViewport,
      )
      const deltaX = pointer.x - resizeState.startX
      const deltaY = pointer.y - resizeState.startY
      const minimumSize = 6
      let left = resizeState.zone.x
      let top = resizeState.zone.y
      let right = resizeState.zone.x + resizeState.zone.width
      let bottom = resizeState.zone.y + resizeState.zone.height
      if (resizeState.handle.includes('w')) {
        left = Math.min(right - minimumSize, Math.max(0, resizeState.zone.x + deltaX))
      }
      if (resizeState.handle.includes('e')) {
        right = Math.max(left + minimumSize, Math.min(100, resizeState.zone.x + resizeState.zone.width + deltaX))
      }
      if (resizeState.handle.includes('n')) {
        top = Math.min(bottom - minimumSize, Math.max(0, resizeState.zone.y + deltaY))
      }
      if (resizeState.handle.includes('s')) {
        bottom = Math.max(top + minimumSize, Math.min(100, resizeState.zone.y + resizeState.zone.height + deltaY))
      }
      updateZone(zoneId, (currentZone) => ({
        ...currentZone,
        x: left,
        y: top,
        width: clampZoneSize(right - left, currentZone.width),
        height: clampZoneSize(bottom - top, currentZone.height),
      }))
    }
    const handleUp = () => {
      zoneResizeStateRef.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function handleZonePointerDown(zoneId: string, event: ReactPointerEvent<HTMLDivElement>) {
    const resizeHandle = getZoneResizeHandle(event.currentTarget, event.clientX, event.clientY)
    if (resizeHandle) {
      beginZoneResize(zoneId, resizeHandle, event)
      return
    }
    beginZoneDrag(zoneId, event)
  }
  function pushMapToPlayer(scene: AdventureScene) {
    if (currentPlayerMode === 'map' && currentPlayerSceneId === scene.id) {
      if (currentPlayerHandoutId) {
        hidePlayerHandout()
      } else {
        setStandby()
      }
      return
    }
    updateSession((currentSession) => {
      const sessionWithVisibleMapLayer = ensurePlayerVisibleMapLayer(currentSession, scene.id)

      return {
        ...sessionWithVisibleMapLayer,
        playerDisplay: {
          ...sessionWithVisibleMapLayer.playerDisplay,
          sceneId: scene.id,
          mode: 'map',
          activeHandoutId: null,
          updatedAt: new Date().toISOString(),
        },
      }
    }, `Игрока показана карта: ${scene.title}`)
  }
  function pushSplashToPlayer(scene: AdventureScene) {
    if (currentPlayerMode === 'splash' && currentPlayerSceneId === scene.id) {
      setStandby()
      return
    }
    updateSession((currentSession) => ({
      ...currentSession,
      playerDisplay: {
        ...currentSession.playerDisplay,
        sceneId: scene.id,
        mode: 'splash',
        activeHandoutId: null,
        updatedAt: new Date().toISOString(),
      },
    }), `Игрока показан splash: ${scene.title}`)
  }
  function pushHandoutToPlayer(scene: AdventureScene, handout: Handout) {
    updateSession((currentSession) => ({
      ...currentSession,
      playerDisplay: {
        ...currentSession.playerDisplay,
        sceneId: scene.id,
        mode: 'map',
        activeHandoutId: handout.id,
        updatedAt: new Date().toISOString(),
      },
    }), `Игрока показана раздатка: ${handout.title}`)
  }
  function hidePlayerHandout() {
    updateSession((currentSession) => ({
      ...currentSession,
      playerDisplay: {
        ...currentSession.playerDisplay,
        activeHandoutId: null,
        updatedAt: new Date().toISOString(),
      },
    }), 'Раздатка скрыта с экрана игроков')
  }
  function getQuickSceneHandout(scene: AdventureScene) {
    const zoneLinkedHandout =
      activeZone?.linkedHandoutId && activeScene?.id === scene.id
        ? scene.handouts.find((handout) => handout.id === activeZone.linkedHandoutId) ?? null
        : null
    if (zoneLinkedHandout) {
      return zoneLinkedHandout
    }
    const selectedHandout =
      selectedHandoutId
        ? scene.handouts.find((handout) => handout.id === selectedHandoutId) ?? null
        : null
    return selectedHandout ?? scene.handouts[0] ?? null
  }
  function pushQuickSceneHandout(scene: AdventureScene) {
    const handout = getQuickSceneHandout(scene)
    if (!handout) {
      return
    }
    if (
      currentPlayerMode === 'map' &&
      currentPlayerSceneId === scene.id &&
      currentPlayerHandoutId === handout.id
    ) {
      hidePlayerHandout()
      return
    }
    setSelectedHandoutId(handout.id)
    pushHandoutToPlayer(scene, handout)
  }
  function focusLinkedHandout(handoutId: string | null | undefined) {
    if (!handoutId) {
      return
    }
    setSelectedHandoutId(handoutId)
    openSceneEditorSection('handouts')
  }
  function focusZoneLinkedHandout(zone: MapZone) {
    focusLinkedHandout(zone.linkedHandoutId)
  }
  function showLinkedHandoutToPlayers(handoutId: string | null | undefined) {
    if (!activeScene || !handoutId) {
      return
    }
    const linkedHandout = activeScene.handouts.find(
      (handout) => handout.id === handoutId,
    )
    if (!linkedHandout) {
      return
    }
    setSelectedHandoutId(linkedHandout.id)
    pushHandoutToPlayer(activeScene, linkedHandout)
  }
  function showZoneLinkedHandoutToPlayers(zone: MapZone) {
    showLinkedHandoutToPlayers(zone.linkedHandoutId)
  }
  function focusLinkedCheck(checkId: string | null | undefined) {
    if (
      !checkId ||
      !activeScene?.checksClues.some((entry) => entry.id === checkId)
    ) {
      return
    }
    setLinkedCheckPreviewId(checkId)
    setActiveEditorTab('checks')
    setIsSceneEditorModalOpen(true)
    setIsSceneEditorActionsOpen(false)
  }
  function focusZoneLinkedCheck(zone: MapZone) {
    focusLinkedCheck(zone.linkedCheckId)
  }
  function focusZoneLinkedMonster(zone: MapZone) {
    if (!zone.linkedMonsterId) {
      return
    }
    selectMonsterForEditing(zone.linkedMonsterId)
    openSceneEditorSection('monsters')
  }
  function setStandby() {
    updateSession((currentSession) => ({
      ...currentSession,
      playerDisplay: {
        ...currentSession.playerDisplay,
        mode: 'standby',
        activeHandoutId: null,
        updatedAt: new Date().toISOString(),
      },
    }))
  }
  function openPlayerWindow() {
    const playerUrl = `${window.location.pathname}?window=player`
    const playerWindow = window.open(
      playerUrl,
      'adventure-player-display',
      playerWindowFeatures,
    )
    playerWindow?.focus()
    window.setTimeout(() => {
      void broadcastProjectStateToPlayer()
    }, 120)
  }
  function applyLibraryImageToMap(assetId: string) {
    if (!activeScene || !adventure) {
      return
    }
    const imageSrc = getAssetDataUrl(adventure.assetLibrary, assetId, null)
    if (!imageSrc) {
      return
    }
    const nextBaseLayer = createBaseMapLayer(activeScene, imageSrc)
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      map: {
        ...scene.map,
        imageAssetId: assetId,
        imageSrc,
      },
    }))
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      mapImageSrc: imageSrc,
      mapLayers: [nextBaseLayer, ...sceneState.mapLayers.slice(1)],
    }))
  }
  async function handleSplashImageUpload(file: File | null) {
    if (!file || !activeScene) {
      return
    }
    const asset = await addAssetToAdventure(file, 'image')
    if (!asset) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      splash: {
        ...scene.splash,
        imageAssetId: asset.id,
        imageSrc: asset.dataUrl,
      },
    }))
  }
  function applyLibraryImageToSplash(assetId: string) {
    if (!activeScene || !adventure) {
      return
    }
    const imageSrc = getAssetDataUrl(adventure.assetLibrary, assetId, null)
    if (!imageSrc) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      splash: {
        ...scene.splash,
        imageAssetId: assetId,
        imageSrc,
      },
    }))
  }
  function clearSplashImage() {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      splash: {
        ...scene.splash,
        imageAssetId: null,
        imageSrc: null,
      },
    }))
  }
  function addEmptyMapLayer() {
    if (!activeScene) {
      return
    }
    const layer: MapLayerInstance = {
      id: createEntityId('layer'),
      title: 'Новый слой',
      imageSrc: null,
      isActive: true,
      visibleToGm: true,
      visibleToPlayers: false,
      scale: 1,
      rotation: 0,
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      mapLayers: sceneState.mapLayers
        .map((currentLayer) => ({ ...currentLayer, isActive: false }))
        .concat(layer),
    }))
    setSelectedLayerId(layer.id)
  }
  function createSceneToken(
    name: string,
    kind: TokenKind,
    imageSrc: string,
    linkedMonsterId: string | null = null,
    hitPointsMax: number | null = null,
    hitPointsCurrent: number | null = hitPointsMax,
    initiative: number | null = null,
    groupLabel: string | null = null,
  ): TokenInstance {
    return {
      id: createEntityId('token'),
      name,
      kind,
      linkedMonsterId,
      linkedCharacterId: null,
      groupLabel,
      imageSrc,
      x: 50,
      y: 50,
      space: 'medium',
      rotation: 0,
      hiddenFromPlayers: false,
      hitPointsCurrent,
      hitPointsMax,
      hitPointsTemp: null,
      initiative,
      conditions: [],
      zIndex: 10,
    }
  }
  function pushTokensToScene(tokens: TokenInstance[], label: string) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      tokens: [...sceneState.tokens, ...tokens],
      activeInitiativeTokenId:
        sceneState.activeInitiativeTokenId ?? tokens[0]?.id ?? null,
    }), label)
    setSelectedTokenId(tokens[0]?.id ?? null)
  }
  function pushTokenToScene(token: TokenInstance) {
    pushTokensToScene([token], `Добавлена фишка: ${token.name}`)
  }
  function buildTokenCopies(
    tokenFactory: (index: number) => TokenInstance,
    count: number,
  ) {
    const safeCount = clampSpawnCount(count)
    return Array.from({ length: safeCount }, (_, index) => {
      const token = tokenFactory(index)
      const column = index % 4
      const row = Math.floor(index / 4)
      return {
        ...token,
        x: clampZoneCoordinate(50 + column * 4, token.x),
        y: clampZoneCoordinate(50 + row * 4, token.y),
        zIndex: token.zIndex + index,
      }
    })
  }
  function updateToken(
    tokenId: string,
    updater: (token: TokenInstance) => TokenInstance,
  ) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      tokens: sceneState.tokens.map((token) =>
        token.id === tokenId ? updater(token) : token,
      ),
    }))
  }
  async function handleTokenImageReplace(tokenId: string, file: File | null) {
    if (!file) {
      return
    }
    const imageSrc = await readFileAsDataUrl(file)
    updateToken(tokenId, (token) => ({
      ...token,
      imageSrc,
    }))
  }
  function createTokensFromMonster(monster: MonsterBlock, count = 1) {
    const imageSrc = monster.imageSrc || createFallbackMonsterImage(monster.name)
    const hitPointsMax = parseHitPointsValue(monster.hitPoints)
    const safeCount = clampSpawnCount(count)
    const tokens = buildTokenCopies(
      (index) =>
        createSceneToken(
          safeCount > 1 ? `${monster.name} ${index + 1}` : monster.name,
          'monster',
          imageSrc,
          monster.id,
          hitPointsMax,
          hitPointsMax,
          null,
          monster.name,
        ),
      safeCount,
    )
    pushTokensToScene(
      tokens,
      safeCount > 1
        ? `Добавлена группа монстров: ${monster.name}`
        : `Добавлена фишка монстра: ${monster.name}`,
    )
  }
  function focusTokenLinkedMonster(token: TokenInstance) {
    if (!token.linkedMonsterId) {
      return
    }
    selectMonsterForEditing(token.linkedMonsterId)
    openSceneEditorSection('monsters')
  }
  function focusTokenLinkedCharacter(characterId: string) {
    setSelectedCharacterId(characterId)
    setIsCharacterModalOpen(true)
  }
  function syncTokenStatsFromMonster(token: TokenInstance) {
    if (!token.linkedMonsterId) {
      return
    }
    const linkedMonster = sceneMonsters.find(
      (monster) => monster.id === token.linkedMonsterId,
    )
    if (!linkedMonster) {
      return
    }
    const hitPointsMax = parseHitPointsValue(linkedMonster.hitPoints)
    updateToken(token.id, (currentToken) => ({
      ...currentToken,
      name: linkedMonster.name,
      imageSrc: linkedMonster.imageSrc || currentToken.imageSrc,
      hitPointsMax,
      hitPointsCurrent: hitPointsMax,
      hitPointsTemp: null,
    }))
  }
  function setActiveInitiativeToken(tokenId: string | null) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      activeInitiativeTokenId: tokenId,
    }))
  }
  function cycleInitiativeTurn(direction: 'next' | 'previous') {
    if (!activeScene || initiativeTokens.length === 0) {
      return
    }
    const currentIndex = activeInitiativeToken
      ? initiativeTokens.findIndex((token) => token.id === activeInitiativeToken.id)
      : -1
    const fallbackIndex = direction === 'next' ? 0 : initiativeTokens.length - 1
    const nextIndex =
      currentIndex === -1
        ? fallbackIndex
        : (currentIndex +
          (direction === 'next' ? 1 : -1) +
          initiativeTokens.length) %
        initiativeTokens.length
    setActiveInitiativeToken(initiativeTokens[nextIndex]?.id ?? null)
  }
  function removeToken(tokenId: string) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      tokens: sceneState.tokens.filter((token) => token.id !== tokenId),
      activeInitiativeTokenId:
        sceneState.activeInitiativeTokenId === tokenId
          ? null
          : sceneState.activeInitiativeTokenId,
    }))
    if (selectedTokenId === tokenId) {
      setIsTokenModalOpen(false)
    }
    setSelectedTokenId((currentId) => (currentId === tokenId ? null : currentId))
  }
  function duplicateToken(token: TokenInstance) {
    const duplicate: TokenInstance = {
      ...token,
      id: createEntityId('token'),
      name: `${token.name} копия`,
      x: clampZoneCoordinate(token.x + 4, token.x),
      y: clampZoneCoordinate(token.y + 4, token.y),
      zIndex: token.zIndex + 1,
    }
    pushTokenToScene(duplicate)
  }
  function removeMapLayer(layerId: string) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => {
      const nextLayers = sceneState.mapLayers.filter((layer) => layer.id !== layerId)
      const safeLayers =
        nextLayers.length > 0 ? nextLayers : [createBaseMapLayer(activeScene, sceneState.mapImageSrc)]
      const nextBaseLayer = safeLayers[0]
      return {
        ...sceneState,
        mapImageSrc: nextBaseLayer.imageSrc,
        mapLayers: safeLayers,
      }
    })
    setSelectedLayerId((currentId) => {
      if (currentId !== layerId) {
        return currentId
      }
      return null
    })
  }
  function addTokenAt(clientX: number, clientY: number) {
    if (!activeScene || !mapFrameRef.current) {
      return
    }
    const { x, y } = resolveMapBoardPosition(
      mapFrameRef.current,
      clientX,
      clientY,
      activeMapViewport,
    )
    const token = {
      ...createSceneToken(
        'Новая фишка',
        'npc',
        createFallbackMonsterImage('Новая фишка'),
      ),
      x,
      y,
    }
    pushTokenToScene(token)
    setSelectedTokenId(token.id)
    setIsTokenModalOpen(true)
  }
  function addServiceMarkerAt(clientX: number, clientY: number) {
    if (!activeScene || !mapFrameRef.current) {
      return
    }
    const { x, y } = resolveMapBoardPosition(
      mapFrameRef.current,
      clientX,
      clientY,
      activeMapViewport,
    )
    const marker: ServiceMarker = {
      id: createEntityId('marker'),
      label: newServiceMarkerLabel.trim() || 'Служебная отметка',
      note: '',
      linkedHandoutId: null,
      linkedCheckId: null,
      x,
      y,
      zIndex: 100,
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      serviceMarkers: [...sceneState.serviceMarkers, marker],
    }), 'Добавлена служебная отметка')
    setSelectedServiceMarkerId(marker.id)
    setIsServiceMarkerModalOpen(true)
  }
  function removeServiceMarker(markerId: string) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      serviceMarkers: sceneState.serviceMarkers.filter((marker) => marker.id !== markerId),
    }))
    setSelectedServiceMarkerId((currentId) =>
      currentId === markerId ? null : currentId,
    )
    setIsServiceMarkerModalOpen(false)
  }
  function updateServiceMarker(
    markerId: string,
    updater: (marker: ServiceMarker) => ServiceMarker,
  ) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      serviceMarkers: sceneState.serviceMarkers.map((marker) =>
        marker.id === markerId ? updater(marker) : marker,
      ),
    }))
  }
  function moveServiceMarker(markerId: string, clientX: number, clientY: number) {
    const mapBoard = mapFrameRef.current
    if (!mapBoard || !activeScene) {
      return
    }
    const { x, y } = resolveMapBoardPosition(
      mapBoard,
      clientX,
      clientY,
      activeMapViewport,
    )
    updateServiceMarker(markerId, (marker) => ({
      ...marker,
      x,
      y,
    }))
  }
  function beginServiceMarkerDrag(
    markerId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (mapInteractionMode !== 'navigate' && mapInteractionMode !== 'marker') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setSelectedServiceMarkerId(markerId)
    setIsServiceMarkerDragging(true)
    serviceMarkerDragStartRef.current = { x: event.clientX, y: event.clientY }
    suppressServiceMarkerClickRef.current = false
    moveServiceMarker(markerId, event.clientX, event.clientY)
    const handleMove = (moveEvent: PointerEvent) => {
      if (serviceMarkerDragStartRef.current) {
        const deltaX = moveEvent.clientX - serviceMarkerDragStartRef.current.x
        const deltaY = moveEvent.clientY - serviceMarkerDragStartRef.current.y
        if (Math.hypot(deltaX, deltaY) > tokenDragThreshold) {
          suppressServiceMarkerClickRef.current = true
        }
      }
      moveServiceMarker(markerId, moveEvent.clientX, moveEvent.clientY)
    }
    const handleUp = (upEvent: PointerEvent) => {
      if (serviceMarkerDragStartRef.current) {
        const deltaX = upEvent.clientX - serviceMarkerDragStartRef.current.x
        const deltaY = upEvent.clientY - serviceMarkerDragStartRef.current.y
        if (Math.hypot(deltaX, deltaY) > tokenDragThreshold) {
          suppressServiceMarkerClickRef.current = true
        }
      }
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      setIsServiceMarkerDragging(false)
      serviceMarkerDragStartRef.current = null
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function applyFogCellByPointer(clientX: number, clientY: number, mode: 'fog-draw' | 'fog-erase') {
    if (!activeScene || !mapFrameRef.current) {
      return
    }
    const cellId = getFogCellId(
      mapFrameRef.current,
      clientX,
      clientY,
      activeMapViewport,
      activeMapGrid,
    )
    updateSceneRuntimeState(activeScene.id, (sceneState) => {
      const cells = new Set(sceneState.fogCells)
      if (mode === 'fog-draw') {
        cells.add(cellId)
      } else {
        cells.delete(cellId)
      }
      return {
        ...sceneState,
        fogCells: Array.from(cells),
      }
    })
  }
  function applyFogCells(
    cellIds: string[],
    mode: 'fog-draw' | 'fog-erase',
    label: string,
  ) {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => {
      const cells = new Set(sceneState.fogCells)
      for (const cellId of cellIds) {
        if (mode === 'fog-draw') {
          cells.add(cellId)
        } else {
          cells.delete(cellId)
        }
      }
      return {
        ...sceneState,
        fogCells: Array.from(cells),
      }
    }, label)
  }
  function applyFogToZone(zone: MapZone, mode: 'fog-draw' | 'fog-erase') {
    if (!activeScene) {
      return
    }
    updateSceneRuntimeState(activeScene.id, (sceneState) => {
      const nextHiddenZoneIds =
        mode === 'fog-draw'
          ? Array.from(new Set([...sceneState.hiddenZoneIds, zone.id]))
          : sceneState.hiddenZoneIds.filter((id) => id !== zone.id)
      return {
        ...sceneState,
        hiddenZoneIds: nextHiddenZoneIds,
      }
    }, mode === 'fog-draw' ? `Скрыта зона туманом: ${zone.title}` : `Открыта зона: ${zone.title}`)
    return
    applyFogCells(
      getFogCellIdsForZone(zone, activeMapGrid),
      mode,
      mode === 'fog-draw'
        ? `Скрыта зона туманом: ${zone.title}`
        : `Открыта зона: ${zone.title}`,
    )
  }
  function applyFogToVisibleZones(mode: 'fog-draw' | 'fog-erase') {
    if (!activeScene) {
      return
    }
    const visibleZones = activeScene.zones.filter((zone) => zone.visibleToPlayers)
    if (visibleZones.length === 0) {
      return
    }
    const cellIds = Array.from(
      new Set(visibleZones.flatMap((zone) => getFogCellIdsForZone(zone, activeMapGrid))),
    )
    applyFogCells(
      cellIds,
      mode,
      mode === 'fog-draw'
        ? 'Скрыты все видимые зоны'
        : 'Открыты все видимые зоны',
    )
  }
  void applyFogToVisibleZones
  function isPointInsideZone(x: number, y: number, zone: MapZone) {
    return (
      x >= zone.x &&
      x <= zone.x + zone.width &&
      y >= zone.y &&
      y <= zone.y + zone.height
    )
  }
  function beginFogAreaSelection(
    event: ReactPointerEvent<HTMLDivElement>,
    mode: 'fog-area-draw' | 'fog-area-erase',
  ) {
    if (!activeScene || !mapFrameRef.current) {
      return
    }
    event.preventDefault()
    const board = mapFrameRef.current
    const startPosition = getNormalizedMapBoardPosition(
      board,
      event.clientX,
      event.clientY,
      activeMapViewport,
    )
    const updateRect = (clientX: number, clientY: number) => {
      const nextPosition = getNormalizedMapBoardPosition(
        board,
        clientX,
        clientY,
        activeMapViewport,
      )
      const left = Math.min(startPosition.percentX, nextPosition.percentX)
      const top = Math.min(startPosition.percentY, nextPosition.percentY)
      const width = Math.abs(startPosition.percentX - nextPosition.percentX)
      const height = Math.abs(startPosition.percentY - nextPosition.percentY)
      setFogSelectionRect({ left, top, width, height })
      return {
        left,
        top,
        right: left + width,
        bottom: top + height,
      }
    }
    updateRect(event.clientX, event.clientY)
    const handleMove = (moveEvent: PointerEvent) => {
      updateRect(moveEvent.clientX, moveEvent.clientY)
    }
    const handleUp = (upEvent: PointerEvent) => {
      const bounds = updateRect(upEvent.clientX, upEvent.clientY)
      setFogSelectionRect(null)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      applyFogCells(
        getFogCellIdsForPercentBounds(
          bounds.left,
          bounds.top,
          bounds.right,
          bounds.bottom,
          activeMapGrid,
        ),
        mode === 'fog-area-draw' ? 'fog-draw' : 'fog-erase',
        mode === 'fog-area-draw'
          ? 'Скрыта выделенная область'
          : 'Открыта выделенная область',
      )
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function moveToken(tokenId: string, clientX: number, clientY: number) {
    const mapBoard = mapFrameRef.current
    if (!mapBoard || !activeScene) {
      return
    }
    const { x, y } = resolveMapBoardPosition(
      mapBoard,
      clientX,
      clientY,
      activeMapViewport,
    )
    const currentFogCells = activeSceneStateRef.current?.fogCells ?? []
    const currentHiddenZoneIds = activeSceneStateRef.current?.hiddenZoneIds ?? []
    const autoRevealZones = activeScene.zones.filter(
      (zone) =>
        zone.autoRevealOnEnter &&
        isPointInsideZone(x, y, zone) &&
        (currentHiddenZoneIds.includes(zone.id) ||
          getFogCellIdsForZone(zone, activeMapGrid).some((cellId) => currentFogCells.includes(cellId))),
    )
    const fogToReveal = new Set(autoRevealZones.flatMap((zone) => getFogCellIdsForZone(zone, activeMapGrid)))
    if (fogToReveal.size > 0 && activeSceneStateRef.current) {
      activeSceneStateRef.current = {
        ...activeSceneStateRef.current,
        fogCells: activeSceneStateRef.current.fogCells.filter(
          (cellId) => !fogToReveal.has(cellId),
        ),
        hiddenZoneIds:
          autoRevealZones.length > 0
            ? activeSceneStateRef.current.hiddenZoneIds.filter(
              (zoneId) => !autoRevealZones.some((zone) => zone.id === zoneId),
            )
            : activeSceneStateRef.current.hiddenZoneIds,
      }
    }
    updateSceneRuntimeState(
      activeScene.id,
      (sceneState) => {
        return {
          ...sceneState,
          tokens: sceneState.tokens.map((token) =>
            token.id === tokenId ? { ...token, x, y } : token,
          ),
          fogCells:
            fogToReveal.size > 0
              ? sceneState.fogCells.filter((cellId) => !fogToReveal.has(cellId))
              : sceneState.fogCells,
          hiddenZoneIds:
            autoRevealZones.length > 0
              ? sceneState.hiddenZoneIds.filter((zoneId) => !autoRevealZones.some((zone) => zone.id === zoneId))
              : sceneState.hiddenZoneIds,
        }
      },
      autoRevealZones.length > 0
        ? `Автооткрыта зона: ${autoRevealZones.map((zone) => zone.title).join(', ')}`
        : 'Перемещена фишка',
    )
  }
  function getTokenPointerAngle(tokenId: string, clientX: number, clientY: number) {
    const mapBoard = mapFrameRef.current
    const token = activeSceneStateRef.current?.tokens.find((entry) => entry.id === tokenId)
    if (!mapBoard || !token) {
      return null
    }
    const rect = mapBoard.getBoundingClientRect()
    const centerX =
      rect.left + activeMapViewport.offsetX + (rect.width * (token.x / 100) * activeMapViewport.scale)
    const centerY =
      rect.top + activeMapViewport.offsetY + (rect.height * (token.y / 100) * activeMapViewport.scale)
    return normalizeRotationDegrees(
      (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90,
    )
  }
  function isZoneHiddenByFog(zoneId: string, hiddenZoneIds: string[]) {
    return hiddenZoneIds.includes(zoneId)
  }
  function clearAllFog() {
    updateSceneRuntimeState(
      activeScene.id,
      (sceneState) => ({
        ...sceneState,
        fogCells: [],
        hiddenZoneIds: [],
      }),
      'Очищен весь туман войны',
    )
  }
  function clearTokenInteractionState() {
    if (tokenRotateHoldTimerRef.current) {
      clearTimeout(tokenRotateHoldTimerRef.current)
      tokenRotateHoldTimerRef.current = null
    }
    tokenDragStartRef.current = null
    tokenPointerPositionRef.current = null
    tokenInteractionModeRef.current = 'move'
    tokenRotationGestureRef.current = null
    setRotatingTokenId(null)
  }
  function beginTokenDrag(
    tokenId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (mapInteractionMode !== 'navigate') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    tokenDragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    tokenPointerPositionRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    tokenInteractionModeRef.current = 'move'
    tokenRotationGestureRef.current = null
    suppressTokenClickRef.current = false
    setRotatingTokenId(null)
    if (tokenRotateHoldTimerRef.current) {
      clearTimeout(tokenRotateHoldTimerRef.current)
    }
    tokenRotateHoldTimerRef.current = setTimeout(() => {
      const pointerPosition = tokenPointerPositionRef.current
      if (!pointerPosition) {
        return
      }
      const token = activeSceneStateRef.current?.tokens.find((entry) => entry.id === tokenId)
      const angle = getTokenPointerAngle(tokenId, pointerPosition.x, pointerPosition.y)
      if (!token || angle == null) {
        return
      }
      tokenInteractionModeRef.current = 'rotate'
      tokenRotationGestureRef.current = {
        tokenId,
        angleOffset: getTokenRotation(token) - angle,
      }
      suppressTokenClickRef.current = true
      setRotatingTokenId(tokenId)
    }, tokenRotateHoldDelay)
    const handleMove = (moveEvent: PointerEvent) => {
      tokenPointerPositionRef.current = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      }
      if (tokenDragStartRef.current) {
        const deltaX = moveEvent.clientX - tokenDragStartRef.current.x
        const deltaY = moveEvent.clientY - tokenDragStartRef.current.y
        const distance = Math.hypot(deltaX, deltaY)
        if (
          tokenInteractionModeRef.current === 'move' &&
          tokenRotateHoldTimerRef.current &&
          distance > tokenRotateHoldMoveTolerance
        ) {
          clearTimeout(tokenRotateHoldTimerRef.current)
          tokenRotateHoldTimerRef.current = null
        }
        if (distance > tokenDragThreshold) {
          suppressTokenClickRef.current = true
        }
      }
      if (tokenInteractionModeRef.current === 'rotate') {
        const rotationGesture = tokenRotationGestureRef.current
        const angle = getTokenPointerAngle(tokenId, moveEvent.clientX, moveEvent.clientY)
        if (!rotationGesture || angle == null) {
          return
        }
        updateToken(rotationGesture.tokenId, (token) => ({
          ...token,
          rotation: normalizeRotationDegrees(angle + rotationGesture.angleOffset),
        }))
        return
      }
      if (suppressTokenClickRef.current) {
        moveToken(tokenId, moveEvent.clientX, moveEvent.clientY)
      }
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      clearTokenInteractionState()
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function beginZoneSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeScene || !mapFrameRef.current) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const frame = mapFrameRef.current
    const startClientX = event.clientX
    const startClientY = event.clientY
    const startPosition = getNormalizedMapBoardPosition(
      frame,
      startClientX,
      startClientY,
      activeMapViewport,
    )
    const updateRect = (clientX: number, clientY: number) => {
      const nextPosition = getNormalizedMapBoardPosition(
        frame,
        clientX,
        clientY,
        activeMapViewport,
      )
      const left = Math.min(startPosition.percentX, nextPosition.percentX)
      const top = Math.min(startPosition.percentY, nextPosition.percentY)
      const width = Math.abs(startPosition.percentX - nextPosition.percentX)
      const height = Math.abs(startPosition.percentY - nextPosition.percentY)
      setZoneSelectionRect({ left, top, width, height })
      return { left, top, width, height }
    }
    updateRect(startClientX, startClientY)
    const handleMove = (moveEvent: PointerEvent) => {
      updateRect(moveEvent.clientX, moveEvent.clientY)
    }
    const handleUp = (upEvent: PointerEvent) => {
      const bounds = updateRect(upEvent.clientX, upEvent.clientY)
      setZoneSelectionRect(null)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      if (Math.hypot(upEvent.clientX - startClientX, upEvent.clientY - startClientY) <= tokenDragThreshold) {
        addZoneAt(upEvent.clientX, upEvent.clientY)
        return
      }
      addZoneFromSelection(bounds)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function handleMapBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeScene) {
      return
    }
    if (openCompactZoneToolsZoneId) {
      setOpenCompactZoneToolsZoneId(null)
    }
    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest(
        [
          'button',
          'input',
          'select',
          'textarea',
          '[role="button"]',
          '.service-marker',
          '.token',
          '.map-zone',
          '.map-menu-panel',
          '.map-utility-panel',
          '.map-corner-panel',
          '.map-title-badge',
          '.map-scene-editor-badge',
          '.map-initiative-tracker',
          '.modal-backdrop',
          '.modal-card',
          '.modal-dialog',
        ].join(', '),
      )
    ) {
      return
    }
    if (mapInteractionMode === 'navigate') {
      beginMapPan(event)
      return
    }
    if (mapInteractionMode === 'marker') {
      addServiceMarkerAt(event.clientX, event.clientY)
      return
    }
    if (mapInteractionMode === 'token') {
      addTokenAt(event.clientX, event.clientY)
      return
    }
    if (mapInteractionMode === 'zone') {
      beginZoneSelection(event)
      return
    }
    if (
      mapInteractionMode === 'fog-area-draw' ||
      mapInteractionMode === 'fog-area-erase'
    ) {
      beginFogAreaSelection(event, mapInteractionMode)
      return
    }
    event.preventDefault()
    applyFogCellByPointer(event.clientX, event.clientY, mapInteractionMode)
    const handleMove = (moveEvent: PointerEvent) => {
      applyFogCellByPointer(moveEvent.clientX, moveEvent.clientY, mapInteractionMode)
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }
  function handleSceneChange(sceneId: string) {
    setCollapsedMonsterIds([])
    setMapInteractionMode('navigate')
    setSelectedZoneId(null)
    stopMapPan()
    setSelectedServiceMarkerId(null)
    startTransition(() => {
      setActiveSceneId(sceneId)
    })
  }
  function handleAdventureFieldChange(field: 'title' | 'subtitle' | 'id', value: string) {
    if (field !== 'id') {
      updateAdventure((currentAdventure) => ({
        ...currentAdventure,
        [field]: value,
      }))
      return
    }
    if (!adventure || !activeAdventureId) {
      return
    }
    const nextId = createUniqueAdventureId(
      slugify(value, adventure.id),
      projectState.adventureOrder.filter((id) => id !== activeAdventureId),
    )
    if (nextId === activeAdventureId) {
      return
    }
    updateProjectState((currentState) => {
      const currentAdventure = currentState.adventures[activeAdventureId]
      const currentSession = currentState.sessions[activeAdventureId]
      if (!currentAdventure || !currentSession) {
        return currentState
      }
      const nextAdventures = { ...currentState.adventures }
      const nextSessions = { ...currentState.sessions }
      delete nextAdventures[activeAdventureId]
      delete nextSessions[activeAdventureId]
      nextAdventures[nextId] = {
        ...currentAdventure,
        id: nextId,
      }
      nextSessions[nextId] = currentSession
      return {
        ...currentState,
        activeAdventureId: nextId,
        adventureOrder: currentState.adventureOrder.map((id) =>
          id === activeAdventureId ? nextId : id,
        ),
        adventures: nextAdventures,
        sessions: nextSessions,
      }
    })
  }
  function switchAdventure(nextAdventureId: string) {
    updateProjectState((currentState) => ({
      ...currentState,
      activeAdventureId: nextAdventureId,
    }))
    setActiveSceneId('')
    setSelectedHandoutId(null)
    setSelectedMonsterId(null)
    setSelectedZoneId(null)
    setCollapsedMonsterIds([])
    setSelectedAudioId(null)
    stopAudioPlayback()
  }
  function addAdventure() {
    const nextAdventureId = createUniqueAdventureId(
      `adventure-${projectState.adventureOrder.length + 1}`,
      projectState.adventureOrder,
    )
    const nextAdventure = createEmptyAdventure(nextAdventureId)
    updateProjectState((currentState) => ({
      ...currentState,
      activeAdventureId: nextAdventure.id,
      adventureOrder: [...currentState.adventureOrder, nextAdventure.id],
      adventures: {
        ...currentState.adventures,
        [nextAdventure.id]: nextAdventure,
      },
      sessions: {
        ...currentState.sessions,
        [nextAdventure.id]: createInitialSessionState(nextAdventure),
      },
    }), 'Создано новое приключение')
    setActiveSceneId(nextAdventure.scenes[0]?.id ?? '')
    setSelectedHandoutId(null)
    setSelectedMonsterId(null)
    setSelectedZoneId(null)
    setCollapsedMonsterIds([])
    setSelectedAudioId(null)
    stopAudioPlayback()
  }
  function duplicateAdventure() {
    if (!adventure) {
      return
    }
    const nextAdventureId = createUniqueAdventureId(
      `${adventure.id}-copy`,
      projectState.adventureOrder,
    )
    const duplicatedAdventure = JSON.parse(JSON.stringify(adventure)) as Adventure
    const titledAdventure = {
      ...duplicatedAdventure,
      id: nextAdventureId,
      title: `${duplicatedAdventure.title} — копия`,
    }
    updateProjectState((currentState) => ({
      ...currentState,
      activeAdventureId: nextAdventureId,
      adventureOrder: [...currentState.adventureOrder, nextAdventureId],
      adventures: {
        ...currentState.adventures,
        [nextAdventureId]: titledAdventure,
      },
      sessions: {
        ...currentState.sessions,
        [nextAdventureId]: createInitialSessionState(titledAdventure),
      },
    }))
    setActiveSceneId(titledAdventure.scenes[0]?.id ?? '')
    setSelectedHandoutId(null)
    setSelectedMonsterId(null)
    setSelectedZoneId(null)
    setCollapsedMonsterIds([])
    setSelectedAudioId(null)
    stopAudioPlayback()
  }
  function removeAdventure(adventureId: string) {
    if (projectState.adventureOrder.length <= 1) {
      return
    }
    updateProjectState((currentState) => {
      const nextOrder = currentState.adventureOrder.filter((id) => id !== adventureId)
      const nextAdventures = { ...currentState.adventures }
      const nextSessions = { ...currentState.sessions }
      delete nextAdventures[adventureId]
      delete nextSessions[adventureId]
      return {
        ...currentState,
        activeAdventureId:
          currentState.activeAdventureId === adventureId
            ? (nextOrder[0] ?? null)
            : currentState.activeAdventureId,
        adventureOrder: nextOrder,
        adventures: nextAdventures,
        sessions: nextSessions,
      }
    })
    setActiveSceneId('')
    setSelectedHandoutId(null)
    setSelectedMonsterId(null)
    setSelectedZoneId(null)
    setCollapsedMonsterIds([])
    setSelectedAudioId(null)
    stopAudioPlayback()
  }
  function triggerAdventureImport() {
    setImportFeedback(null)
    if (importFileInputRef.current) {
      importFileInputRef.current.value = ''
      importFileInputRef.current.click()
    }
  }
  function triggerProjectImport() {
    setImportFeedback(null)
    if (projectImportFileInputRef.current) {
      projectImportFileInputRef.current.value = ''
      projectImportFileInputRef.current.click()
    }
  }
  function triggerCharacterImport() {
    setImportFeedback(null)
    setCharacterImportTargetId(null)
    if (characterImportFileInputRef.current) {
      characterImportFileInputRef.current.value = ''
      characterImportFileInputRef.current.click()
    }
  }
  function triggerCharacterUpdate(characterId: string) {
    setImportFeedback(null)
    setCharacterImportTargetId(characterId)
    if (characterImportFileInputRef.current) {
      characterImportFileInputRef.current.value = ''
      characterImportFileInputRef.current.click()
    }
  }
  async function handleCharacterImport(file: File | null) {
    if (!file || !adventure) {
      setCharacterImportTargetId(null)
      return
    }
    try {
      const targetCharacter =
        characterImportTargetId
          ? adventure.characters.find((character) => character.id === characterImportTargetId) ?? null
          : null
      const parsed = JSON.parse(await file.text()) as unknown
      const importedCharacter = createPlayerCharacterFromLssJson(parsed)
      const nextCharacterId =
        targetCharacter?.id ??
        createUniqueAdventureId(
          importedCharacter.id || importedCharacter.name,
          adventure.characters.map((character) => character.id),
        )
      let character: PlayerCharacter = {
        ...importedCharacter,
        id: nextCharacterId,
      }
      let imageImportWarning = ''
      if (character.avatarSrc && /^https?:\/\//i.test(character.avatarSrc)) {
        try {
          const imageAsset = await addUrlAssetToAdventure(
            character.avatarSrc,
            'image',
            character.name,
          )
          if (imageAsset) {
            character = {
              ...character,
              avatarAssetId: imageAsset.id,
              avatarSrc: imageAsset.dataUrl,
            }
          }
        } catch (error) {
          imageImportWarning =
            error instanceof Error
              ? ` Портрет остался внешней ссылкой: ${error.message}`
              : ' Портрет остался внешней ссылкой.'
        }
      }
      updateAdventure((currentAdventure) => ({
        ...currentAdventure,
        characters: targetCharacter
          ? (currentAdventure.characters ?? []).map((currentCharacter) =>
            currentCharacter.id === targetCharacter.id ? character : currentCharacter,
          )
          : [...(currentAdventure.characters ?? []), character],
      }), targetCharacter ? `Обновлен персонаж: ${character.name}` : `Импортирован персонаж: ${character.name}`)
      setSelectedCharacterId(character.id)
      setIsCharacterModalOpen(true)
      setImportFeedback({
        tone: imageImportWarning ? 'error' : 'success',
        text: targetCharacter
          ? `Персонаж "${character.name}" обновлен.${imageImportWarning}`
          : `Персонаж "${character.name}" импортирован.${imageImportWarning}`,
      })
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать персонажа. Проверь JSON-файл.',
      })
    } finally {
      setCharacterImportTargetId(null)
    }
  }
  function removeCharacter(characterId: string) {
    const characterName =
      adventure?.characters.find((character) => character.id === characterId)?.name ?? 'Персонаж'
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      characters: (currentAdventure.characters ?? []).filter(
        (character) => character.id !== characterId,
      ),
    }), `Удален персонаж: ${characterName}`)
    if (selectedCharacterId === characterId) {
      setSelectedCharacterId(null)
    }
    setIsCharacterModalOpen(false)
    setPendingCharacterDeleteId(null)
    setImportFeedback({
      tone: 'success',
      text: `Персонаж "${characterName}" удален.`,
    })
  }
  function commitImportedAdventure(rawAdventure: unknown) {
    try {
      const normalizedAdventure = normalizeImportedAdventure(rawAdventure)
      const nextAdventureId = createUniqueAdventureId(
        normalizedAdventure.id || normalizedAdventure.title,
        projectState.adventureOrder,
      )
      const importedAdventure =
        nextAdventureId === normalizedAdventure.id
          ? normalizedAdventure
          : { ...normalizedAdventure, id: nextAdventureId }
      updateProjectState((currentState) => ({
        ...currentState,
        activeAdventureId: importedAdventure.id,
        adventureOrder: [...currentState.adventureOrder, importedAdventure.id],
        adventures: {
          ...currentState.adventures,
          [importedAdventure.id]: importedAdventure,
        },
        sessions: {
          ...currentState.sessions,
          [importedAdventure.id]: createInitialSessionState(importedAdventure),
        },
      }))
      setActiveSceneId(importedAdventure.scenes[0]?.id ?? '')
      setSelectedHandoutId(null)
      setSelectedMonsterId(null)
      setSelectedZoneId(null)
      setCollapsedMonsterIds([])
      setSelectedAudioId(null)
      stopAudioPlayback()
      setImportFeedback({
        tone: 'success',
        text:
          importedAdventure.id === normalizedAdventure.id
            ? `Приключение "${importedAdventure.title}" импортировано.`
            : `Приключение "${importedAdventure.title}" импортировано как "${importedAdventure.id}", потому что исходный id уже был занят.`,
      })
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать приключение. Проверь структуру JSON и попробуй ещё раз.',
      })
    }
  }
  async function handleAdventureImport(file: File | null) {
    if (!file) {
      return
    }
    try {
      const rawText = await file.text()
      const parsed = JSON.parse(rawText) as unknown
      commitImportedAdventure(parsed)
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать приключение. Проверь JSON-файл и попробуй ещё раз.',
      })
    }
  }
  function commitImportedProject(rawProject: unknown) {
    try {
      const normalizedProject = normalizeImportedProject(rawProject)
      const mergedProject = mergeImportedProjectIntoCurrent(projectState, normalizedProject)
      const nextAdventureId =
        mergedProject.activeAdventureId ?? mergedProject.adventureOrder[0] ?? ''
      const nextAdventure = nextAdventureId
        ? mergedProject.adventures[nextAdventureId]
        : null
      commitProjectState(mergedProject, {
        label: 'Импортирован проект',
      })
      setActiveSceneId(nextAdventure?.scenes[0]?.id ?? '')
      setSelectedHandoutId(null)
      setSelectedMonsterId(null)
      setSelectedZoneId(null)
      setCollapsedMonsterIds([])
      setSelectedAudioId(null)
      stopAudioPlayback()
      setImportFeedback({
        tone: 'success',
        text: `Проект импортирован. Добавлено приключений: ${normalizedProject.adventureOrder.length}.`,
      })
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать проект. Проверь JSON-файл и попробуй ещё раз.',
      })
    }
  }
  function resetSelectionState(nextSceneId: string) {
    setActiveSceneId(nextSceneId)
    setSelectedHandoutId(null)
    setSelectedMonsterId(null)
    setSelectedZoneId(null)
    setCollapsedMonsterIds([])
    setSelectedAudioId(null)
    stopAudioPlayback()
  }
  function applyLoadedProjectState(
    nextProject: ProjectState,
    options: {
      feedbackText: string
      historyLabel: string
      skipFeedback?: boolean
    },
  ) {
    const normalizedProject = syncProjectState(nextProject)
    const nextAdventureId = normalizedProject.activeAdventureId ?? normalizedProject.adventureOrder[0] ?? ''
    const nextAdventure = nextAdventureId ? normalizedProject.adventures[nextAdventureId] : null
    commitProjectState(normalizedProject, { label: options.historyLabel })
    resetSelectionState(nextAdventure?.scenes[0]?.id ?? '')
    if (!options.skipFeedback) {
      setImportFeedback({
        tone: 'success',
        text: options.feedbackText,
      })
    }
  }
  function updateAdventureListTitle(adventureId: string, value: string) {
    updateProjectState((currentState) => {
      const currentAdventure = currentState.adventures[adventureId]
      if (!currentAdventure || currentAdventure.title === value) {
        return currentState
      }
      return {
        ...currentState,
        adventures: {
          ...currentState.adventures,
          [adventureId]: {
            ...currentAdventure,
            title: value,
          },
        },
      }
    }, 'Изменено название приключения')
  }
  function renameAdventureListId(adventureId: string, value: string) {
    updateProjectState((currentState) => {
      const currentAdventure = currentState.adventures[adventureId]
      const currentSession = currentState.sessions[adventureId]
      if (!currentAdventure || !currentSession) {
        return currentState
      }
      const nextId = createUniqueAdventureId(
        slugify(value, currentAdventure.id),
        currentState.adventureOrder.filter((id) => id !== adventureId),
      )
      if (nextId === adventureId) {
        return currentState
      }
      const nextAdventures = { ...currentState.adventures }
      const nextSessions = { ...currentState.sessions }
      delete nextAdventures[adventureId]
      delete nextSessions[adventureId]
      nextAdventures[nextId] = {
        ...currentAdventure,
        id: nextId,
      }
      nextSessions[nextId] = currentSession
      return {
        ...currentState,
        activeAdventureId:
          currentState.activeAdventureId === adventureId ? nextId : currentState.activeAdventureId,
        adventureOrder: currentState.adventureOrder.map((id) => (id === adventureId ? nextId : id)),
        adventures: nextAdventures,
        sessions: nextSessions,
      }
    }, 'Изменён id приключения')
  }
  function startAdventureCardEdit(adventureId: string, field: 'id' | 'title', value: string) {
    setEditingAdventureField({ adventureId, field })
    setEditingAdventureValue(value)
  }
  function stopAdventureCardEdit() {
    setEditingAdventureField(null)
    setEditingAdventureValue('')
  }
  function commitAdventureCardEdit() {
    if (!editingAdventureField) {
      return
    }
    const { adventureId, field } = editingAdventureField
    const nextValue = editingAdventureValue
    stopAdventureCardEdit()
    if (field === 'id') {
      renameAdventureListId(adventureId, nextValue)
      return
    }
    updateAdventureListTitle(adventureId, nextValue)
  }
  function handleAdventureCardInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      stopAdventureCardEdit()
    }
  }
  async function handleProjectImport(file: File | null) {
    if (!file) {
      return
    }
    try {
      const rawText = await file.text()
      const parsed = JSON.parse(rawText) as unknown
      commitImportedProject(parsed)
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать проект. Проверь JSON-файл и попробуй ещё раз.',
      })
    }
  }
  function addScene() {
    const nextSceneId = createEntityId('scene')
    const scene: AdventureScene = {
      id: nextSceneId,
      title: 'Новая сцена',
      location: 'Неизвестная локация',
      accent: 'gold',
      gmSummary: 'Опиши, для чего нужна эта сцена.',
      gmNotes: 'Здесь можно хранить мастерские заметки по сцене.',
      splash: {
        title: 'Новая сцена',
        subtitle: 'Неизвестная локация',
        body: 'Короткий анонс сцены для показа игрокам перед открытием карты.',
        imageAssetId: null,
        imageSrc: null,
      },
      map: {
        id: `${nextSceneId}-map`,
        title: 'Карта сцены',
        placeholder: 'Загрузи карту для этой сцены.',
      },
      zones: [],
      handouts: [],
      checksClues: [],
      monsterIds: [],
      monsterBlocks: [],
      recommendedAudio: [],
      objectives: ['Определи назначение этой сцены.'],
    }
    updateProjectState((currentState) => ({
      ...currentState,
      adventures: {
        ...currentState.adventures,
        [activeAdventureId!]: {
          ...currentState.adventures[activeAdventureId!],
          scenes: [...currentState.adventures[activeAdventureId!].scenes, scene],
        },
      },
      sessions: {
        ...currentState.sessions,
        [activeAdventureId!]: {
          ...currentState.sessions[activeAdventureId!],
          sceneStates: {
            ...currentState.sessions[activeAdventureId!].sceneStates,
            [scene.id]: {
              mapImageSrc: null,
              mapLayers: [createBaseMapLayer(scene, null)],
              tokens: [],
              serviceMarkers: [],
              fogCells: [],
              hiddenZoneIds: [],
              mapGrid: normalizeMapGrid(),
              mapGridVisible: true,
              mapViewport: {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
              },
            },
          },
        },
      },
    }), 'Добавлена сцена')
    setActiveSceneId(scene.id)
  }
  function removeScene(sceneId: string) {
    if (!adventure) {
      return
    }
    if (adventure.scenes.length <= 1) {
      return
    }
    updateProjectState((currentState) => {
      if (!activeAdventureId) {
        return currentState
      }
      const currentAdventure = currentState.adventures[activeAdventureId]
      const currentSession = currentState.sessions[activeAdventureId]
      if (!currentAdventure || !currentSession) {
        return currentState
      }
      const nextScenes = currentAdventure.scenes.filter(
        (scene) => scene.id !== sceneId,
      )
      const nextSceneStates = { ...currentSession.sceneStates }
      delete nextSceneStates[sceneId]
      return {
        ...currentState,
        adventures: {
          ...currentState.adventures,
          [activeAdventureId]: {
            ...currentAdventure,
            scenes: nextScenes,
          },
        },
        sessions: {
          ...currentState.sessions,
          [activeAdventureId]: {
            ...currentSession,
            sceneStates: nextSceneStates,
          },
        },
      }
    }, 'Удалена сцена')
    const fallbackSceneId =
      adventure.scenes.find((scene) => scene.id !== sceneId)?.id ?? ''
    setActiveSceneId(fallbackSceneId)
  }
  function addHandout() {
    if (!activeScene) {
      return
    }
    const handout: Handout = {
      id: createEntityId('handout'),
      title: 'Новая раздатка',
      caption: '',
      body: 'Опиши, что игроки могут прочитать или рассмотреть здесь.',
      imageSrc: null,
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      handouts: [...scene.handouts, handout],
    }), 'Добавлена раздатка')
    setSelectedHandoutId(handout.id)
  }
  function removeHandout(handoutId: string) {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      handouts: scene.handouts.filter((entry) => entry.id !== handoutId),
      zones: scene.zones.map((zone) =>
        zone.linkedHandoutId === handoutId
          ? { ...zone, linkedHandoutId: null }
          : zone,
      ),
    }), 'Удалена раздатка')
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      serviceMarkers: sceneState.serviceMarkers.map((marker) =>
        marker.linkedHandoutId === handoutId ? { ...marker, linkedHandoutId: null } : marker,
      ),
    }))
    if (sessionState?.playerDisplay.activeHandoutId === handoutId) {
      hidePlayerHandout()
    }
  }
  function updateHandout(
    handoutId: string,
    updater: (handout: Handout) => Handout,
  ) {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      handouts: scene.handouts.map((handout) =>
        handout.id === handoutId ? updater(handout) : handout,
      ),
    }))
  }
  function addCheckClueEntry() {
    if (!activeScene) {
      return
    }
    const nextEntry = createDefaultCheckClueEntry()
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      checksClues: [...scene.checksClues, nextEntry],
    }), 'Добавлена проверка')
  }
  function updateCheckClueEntry(
    entryId: string,
    updater: (entry: CheckClueEntry) => CheckClueEntry,
  ) {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      checksClues: scene.checksClues.map((entry) =>
        entry.id === entryId ? updater(entry) : entry,
      ),
    }))
  }
  function removeCheckClueEntry(entryId: string) {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      checksClues: scene.checksClues.filter((entry) => entry.id !== entryId),
      zones: scene.zones.map((zone) =>
        zone.linkedCheckId === entryId ? { ...zone, linkedCheckId: null } : zone,
      ),
    }), 'Удалена проверка')
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      serviceMarkers: sceneState.serviceMarkers.map((marker) =>
        marker.linkedCheckId === entryId ? { ...marker, linkedCheckId: null } : marker,
      ),
    }))
  }
  function renameSceneId(nextIdRaw: string) {
    if (!activeScene) {
      return
    }
    const nextId = slugify(nextIdRaw, activeScene.id)
    if (nextId === activeScene.id) {
      return
    }
    updateProjectState((currentState) => {
      if (!activeAdventureId) {
        return currentState
      }
      const currentAdventure = currentState.adventures[activeAdventureId]
      const currentSession = currentState.sessions[activeAdventureId]
      if (!currentAdventure || !currentSession) {
        return currentState
      }
      const nextScenes = currentAdventure.scenes.map((scene) =>
        scene.id === activeScene.id
          ? {
            ...scene,
            id: nextId,
            map: {
              ...scene.map,
              id:
                scene.map.id === `${activeScene.id}-map`
                  ? `${nextId}-map`
                  : scene.map.id,
            },
          }
          : scene,
      )
      const nextSceneStates = { ...currentSession.sceneStates }
      const movedSceneState =
        nextSceneStates[activeScene.id] ??
        currentSession.sceneStates[activeScene.id]
      delete nextSceneStates[activeScene.id]
      nextSceneStates[nextId] = movedSceneState
      return {
        ...currentState,
        adventures: {
          ...currentState.adventures,
          [activeAdventureId]: {
            ...currentAdventure,
            scenes: nextScenes,
          },
        },
        sessions: {
          ...currentState.sessions,
          [activeAdventureId]: {
            ...currentSession,
            playerDisplay: {
              ...currentSession.playerDisplay,
              sceneId:
                currentSession.playerDisplay.sceneId === activeScene.id
                  ? nextId
                  : currentSession.playerDisplay.sceneId,
            },
            sceneStates: nextSceneStates,
          },
        },
      }
    })
    setActiveSceneId(nextId)
  }
  function renameHandoutId(handoutId: string, nextIdRaw: string) {
    if (!activeScene) {
      return
    }
    const nextId = slugify(nextIdRaw, handoutId)
    if (nextId === handoutId) {
      return
    }
    updateProjectState((currentState) => {
      if (!activeAdventureId) {
        return currentState
      }
      const currentAdventure = currentState.adventures[activeAdventureId]
      const currentSession = currentState.sessions[activeAdventureId]
      if (!currentAdventure || !currentSession) {
        return currentState
      }
      return {
        ...currentState,
        adventures: {
          ...currentState.adventures,
          [activeAdventureId]: {
            ...currentAdventure,
            scenes: currentAdventure.scenes.map((scene) =>
              scene.id === activeScene.id
                ? {
                  ...scene,
                  handouts: scene.handouts.map((handout) =>
                    handout.id === handoutId ? { ...handout, id: nextId } : handout,
                  ),
                  zones: scene.zones.map((zone) =>
                    zone.linkedHandoutId === handoutId
                      ? { ...zone, linkedHandoutId: nextId }
                      : zone,
                  ),
                }
                : scene,
            ),
          },
        },
        sessions: {
          ...currentState.sessions,
          [activeAdventureId]: {
            ...currentSession,
            playerDisplay: {
              ...currentSession.playerDisplay,
              activeHandoutId:
                currentSession.playerDisplay.activeHandoutId === handoutId
                  ? nextId
                  : currentSession.playerDisplay.activeHandoutId,
            },
          },
        },
      }
    })
    setSelectedHandoutId(nextId)
  }
  async function handleHandoutImageUpload(
    handoutId: string,
    file: File | null,
  ) {
    if (!file) {
      return
    }
    const asset = await addAssetToAdventure(file, 'image')
    if (!asset) {
      return
    }
    updateHandout(handoutId, (handout) => ({
      ...handout,
      imageAssetId: asset.id,
      imageSrc: asset.dataUrl,
    }))
  }
  function applyLibraryImageToHandout(handoutId: string, assetId: string) {
    if (!adventure) {
      return
    }
    const imageSrc = getAssetDataUrl(adventure.assetLibrary, assetId, null)
    if (!imageSrc) {
      return
    }
    updateHandout(handoutId, (handout) => ({
      ...handout,
      imageAssetId: assetId,
      imageSrc,
    }))
  }
  function updateMonster(
    monsterId: string,
    updater: (monster: MonsterBlock) => MonsterBlock,
  ) {
    if (!adventure) {
      return
    }
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      monsterLibrary: currentAdventure.monsterLibrary.map((monster) =>
        monster.id === monsterId ? updater(monster) : monster,
      ),
    }))
  }
  function toggleMonsterCollapsed(monsterId: string) {
    setCollapsedMonsterIds((currentIds) =>
      currentIds.includes(monsterId)
        ? currentIds.filter((id) => id !== monsterId)
        : [...currentIds, monsterId],
    )
  }
  function getMonsterSpawnCount(monsterId: string) {
    return monsterSpawnCounts[monsterId] ?? newMonsterSpawnCount
  }
  function updateMonsterSpawnCount(monsterId: string, rawValue: string, fallback: number) {
    const nextCount = clampSpawnCount(Number(rawValue), fallback)
    setMonsterSpawnCounts((currentCounts) => ({
      ...currentCounts,
      [monsterId]: nextCount,
    }))
    if (monsterId === activeMonster?.id) {
      setNewMonsterSpawnCount(nextCount)
    }
  }
  function selectMonsterForEditing(monsterId: string) {
    setSelectedMonsterId(monsterId)
    setNewMonsterSpawnCount(getMonsterSpawnCount(monsterId))
    setCollapsedMonsterIds((currentIds) => {
      const nextIds = currentIds.filter((id) => id !== monsterId)
      if (
        resolvedSelectedMonsterId &&
        resolvedSelectedMonsterId !== monsterId &&
        !nextIds.includes(resolvedSelectedMonsterId)
      ) {
        nextIds.push(resolvedSelectedMonsterId)
      }
      return nextIds
    })
  }
  function addMonsterBlock() {
    if (!adventure || !activeScene) {
      return
    }
    const monsterBlock = createDefaultMonsterBlock()
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      monsterLibrary: [...currentAdventure.monsterLibrary, monsterBlock],
      scenes: currentAdventure.scenes.map((scene) =>
        scene.id === activeScene.id
          ? { ...scene, monsterIds: [...(scene.monsterIds ?? []), monsterBlock.id] }
          : scene,
      ),
    }), 'Добавлен монстр в приключение')
    setSelectedMonsterId(monsterBlock.id)
    setCollapsedMonsterIds((currentIds) =>
      currentIds.filter((id) => id !== monsterBlock.id),
    )
  }
  function cloneMonsterForLibrary(sourceMonster: MonsterBlock, monsterIds: string[]) {
    const imageRef = getMonsterImageRef(sourceMonster)
    return {
      ...sourceMonster,
      id: createUniqueCollectionId(sourceMonster.id || sourceMonster.name, monsterIds, 'monster'),
      imageAssetId: imageRef.kind === 'project-asset' ? imageRef.assetId : null,
      imageSrc: imageRef.kind === 'none' ? null : ('src' in imageRef ? imageRef.src : (sourceMonster.imageSrc ?? null)),
    }
  }
  function saveMonsterToLibrary(monster: MonsterBlock) {
    if (!adventure) {
      return
    }
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      monsterLibrary: currentAdventure.monsterLibrary.map((libraryMonster) =>
        libraryMonster.id === monster.id ? monster : libraryMonster,
      ),
    }), `Монстр сохранен в приключении: ${monster.name}`)
    setImportFeedback({
      tone: 'success',
      text: `Монстр "${monster.name}" сохранен в монстрах приключения.`,
    })
  }
  function removeMonsterFromLibrary(monsterId: string) {
    const monsterName =
      adventureMonsters.find((monster) => monster.id === monsterId)?.name ?? 'Монстр'
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      monsterLibrary: currentAdventure.monsterLibrary.filter((monster) => monster.id !== monsterId),
      scenes: currentAdventure.scenes.map((scene) => ({
        ...scene,
        monsterIds: (scene.monsterIds ?? []).filter((sceneMonsterId) => sceneMonsterId !== monsterId),
        zones: scene.zones.map((zone) =>
          zone.linkedMonsterId === monsterId ? { ...zone, linkedMonsterId: null } : zone,
        ),
      })),
    }), `Монстр удален из приключения: ${monsterName}`)
    updateSession((currentSession) => ({
      ...currentSession,
      sceneStates: Object.fromEntries(
        Object.entries(currentSession.sceneStates).map(([sceneId, sceneState]) => [
          sceneId,
          {
            ...sceneState,
            tokens: sceneState.tokens.map((token) =>
              token.linkedMonsterId === monsterId ? { ...token, linkedMonsterId: null } : token,
            ),
          },
        ]),
      ),
    }))
    setPendingMonsterLibraryDeleteId(null)
    setSelectedMonsterId((currentMonsterId) =>
      currentMonsterId === monsterId ? null : currentMonsterId,
    )
    setCollapsedMonsterIds((currentIds) =>
      currentIds.filter((id) => id !== monsterId),
    )
    setImportFeedback({
      tone: 'success',
      text: `Монстр "${monsterName}" удален из монстров приключения.`,
    })
  }
  function addMonsterIdToActiveScene(monsterId: string) {
    if (!activeScene || activeScene.monsterIds?.includes(monsterId)) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      monsterIds: [...(scene.monsterIds ?? []), monsterId],
    }), 'Монстр добавлен в сцену')
  }
  function addMonsterFromLibrary(sourceMonsterId: string) {
    if (!sourceMonsterId) {
      return
    }
    const sourceMonster = adventureMonsters.find((monster) => monster.id === sourceMonsterId)
    if (!sourceMonster) {
      return
    }
    addMonsterIdToActiveScene(sourceMonster.id)
    setSelectedMonsterId(sourceMonster.id)
    setCollapsedMonsterIds((currentIds) =>
      currentIds.filter((id) => id !== sourceMonster.id),
    )
    setIsMonsterLibraryDropdownOpen(false)
    setMonsterLibrarySearch('')
  }
  function addMonsterToAdventure(sourceMonster: MonsterBlock) {
    const existingMonster = adventureMonsters.find((monster) => monster.id === sourceMonster.id)
    if (existingMonster) {
      addMonsterIdToActiveScene(existingMonster.id)
      setSelectedMonsterId(existingMonster.id)
      setIsMonsterLibraryDropdownOpen(false)
      setMonsterLibrarySearch('')
      return existingMonster
    }
    const monsterBlock = cloneMonsterForLibrary(
      sourceMonster,
      adventureMonsters.map((monster) => monster.id),
    )
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      monsterLibrary: [...currentAdventure.monsterLibrary, monsterBlock],
      scenes: currentAdventure.scenes.map((scene) =>
        scene.id === activeScene?.id
          ? { ...scene, monsterIds: [...(scene.monsterIds ?? []), monsterBlock.id] }
          : scene,
      ),
    }), 'Добавлен монстр из бестиария')
    setSelectedMonsterId(monsterBlock.id)
    setCollapsedMonsterIds((currentIds) =>
      currentIds.filter((id) => id !== monsterBlock.id),
    )
    setIsMonsterLibraryDropdownOpen(false)
    setMonsterLibrarySearch('')
    return monsterBlock
  }
  function addMonsterFromBestiary(sourceMonster: MonsterBlock) {
    const monsterBlock = addMonsterToAdventure(sourceMonster)
    setImportFeedback({
      tone: 'success',
      text: `Монстр "${monsterBlock.name}" добавлен в приключение из бестиария.`,
    })
  }
  async function addMonsterSummaryFromBestiary(sourceMonster: MonsterSummary) {
    setImportFeedback(null)
    const existingMonster = adventureMonsters.find((monster) => monster.id === sourceMonster.id)
    if (existingMonster) {
      addMonsterFromLibrary(existingMonster.id)
      return
    }
    try {
      const monster = await loadBuiltInMonsterDetail(sourceMonster.id)
      if (!monster) {
        throw new Error(`Не удалось найти монстра "${sourceMonster.name}" в бестиарии.`)
      }
      addMonsterFromBestiary(monster)
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Не удалось добавить монстра из бестиария.',
      })
    }
  }
  function triggerMonsterImport() {
    setImportFeedback(null)
    if (monsterImportFileInputRef.current) {
      monsterImportFileInputRef.current.value = ''
      monsterImportFileInputRef.current.click()
    }
  }
  async function handleMonsterImport(file: File | null) {
    if (!file || !adventure) {
      return
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const monsterBlock = createMonsterBlockFromFoundryActor(
        parsed,
        adventureMonsters.map((monster) => monster.id),
      )
      let imageImportWarning = ''
      if (monsterBlock.imageSrc && /^https?:\/\//i.test(monsterBlock.imageSrc)) {
        try {
          const imageAsset = await addUrlAssetToAdventure(
            monsterBlock.imageSrc,
            'image',
            monsterBlock.name,
          )
          if (imageAsset) {
            monsterBlock.imageAssetId = imageAsset.id
            monsterBlock.imageSrc = imageAsset.dataUrl
          }
        } catch (error) {
          imageImportWarning =
            error instanceof Error
              ? ` Изображение осталось внешней ссылкой: ${error.message}`
              : ' Изображение осталось внешней ссылкой.'
        }
      }
      updateAdventure((currentAdventure) => ({
        ...currentAdventure,
        monsterLibrary: [...currentAdventure.monsterLibrary, monsterBlock],
        scenes: currentAdventure.scenes.map((scene) =>
          scene.id === activeScene.id
            ? { ...scene, monsterIds: [...(scene.monsterIds ?? []), monsterBlock.id] }
            : scene,
        ),
      }), `Импортирован монстр: ${monsterBlock.name}`)
      setSelectedMonsterId(monsterBlock.id)
      setCollapsedMonsterIds((currentIds) =>
        currentIds.filter((id) => id !== monsterBlock.id),
      )
      setImportFeedback({
        tone: imageImportWarning ? 'error' : 'success',
        text: `Монстр "${monsterBlock.name}" импортирован в приключение.${imageImportWarning}`,
      })
    } catch (error) {
      setImportFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Не удалось импортировать монстра. Проверь JSON-файл.',
      })
    }
  }
  function removeMonsterBlock(monsterId: string) {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => ({
      ...scene,
      monsterIds: (scene.monsterIds ?? []).filter((sceneMonsterId) => sceneMonsterId !== monsterId),
      zones: scene.zones.map((zone) =>
        zone.linkedMonsterId === monsterId ? { ...zone, linkedMonsterId: null } : zone,
      ),
    }), 'Монстр убран из сцены')
    updateSceneRuntimeState(activeScene.id, (sceneState) => ({
      ...sceneState,
      tokens: sceneState.tokens.map((token) =>
        token.linkedMonsterId === monsterId ? { ...token, linkedMonsterId: null } : token,
      ),
    }))
    setSelectedMonsterId((currentMonsterId) =>
      currentMonsterId === monsterId ? null : currentMonsterId,
    )
    setCollapsedMonsterIds((currentIds) =>
      currentIds.filter((id) => id !== monsterId),
    )
  }
  function renameMonsterId(monsterId: string, nextIdRaw: string) {
    if (!adventure) {
      return
    }
    const existingIds = adventureMonsters
      .filter((monster) => monster.id !== monsterId)
      .map((monster) => monster.id)
    const nextId = createUniqueCollectionId(nextIdRaw, existingIds, monsterId)
    if (nextId === monsterId) {
      return
    }
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      monsterLibrary: currentAdventure.monsterLibrary.map((monster) =>
        monster.id === monsterId ? { ...monster, id: nextId } : monster,
      ),
      scenes: currentAdventure.scenes.map((scene) => ({
        ...scene,
        monsterIds: (scene.monsterIds ?? []).map((sceneMonsterId) =>
          sceneMonsterId === monsterId ? nextId : sceneMonsterId,
        ),
        zones: scene.zones.map((zone) =>
          zone.linkedMonsterId === monsterId ? { ...zone, linkedMonsterId: nextId } : zone,
        ),
      })),
    }))
    updateSession((currentSession) => ({
      ...currentSession,
      sceneStates: Object.fromEntries(
        Object.entries(currentSession.sceneStates).map(([sceneId, sceneState]) => [
          sceneId,
          {
            ...sceneState,
            tokens: sceneState.tokens.map((token) =>
              token.linkedMonsterId === monsterId ? { ...token, linkedMonsterId: nextId } : token,
            ),
          },
        ]),
      ),
    }))
    setSelectedMonsterId(nextId)
    setCollapsedMonsterIds((currentIds) =>
      currentIds.map((id) => (id === monsterId ? nextId : id)),
    )
  }
  function updateMonsterAbility(
    monsterId: string,
    ability:
      | 'strength'
      | 'dexterity'
      | 'constitution'
      | 'intelligence'
      | 'wisdom'
      | 'charisma',
    value: string,
  ) {
    const parsedValue = Number(value)
    updateMonster(monsterId, (monster) => ({
      ...monster,
      [ability]: Number.isFinite(parsedValue) ? parsedValue : 0,
    }))
  }
  function updateMonsterFeatureList(
    monsterId: string,
    section:
      | 'traits'
      | 'actions'
      | 'bonusActions'
      | 'reactions'
      | 'legendaryActions',
    updater: (features: MonsterFeature[]) => MonsterFeature[],
  ) {
    updateMonster(monsterId, (monster) => ({
      ...monster,
      [section]: updater(monster[section]),
    }))
  }
  function addMonsterFeature(
    monsterId: string,
    section:
      | 'traits'
      | 'actions'
      | 'bonusActions'
      | 'reactions'
      | 'legendaryActions',
    title: string,
  ) {
    updateMonsterFeatureList(monsterId, section, (features) => [
      ...features,
      createDefaultMonsterFeature(title),
    ])
  }
  function updateMonsterFeature(
    monsterId: string,
    section:
      | 'traits'
      | 'actions'
      | 'bonusActions'
      | 'reactions'
      | 'legendaryActions',
    featureId: string,
    updater: (feature: MonsterFeature) => MonsterFeature,
  ) {
    updateMonsterFeatureList(monsterId, section, (features) =>
      features.map((feature) =>
        feature.id === featureId ? updater(feature) : feature,
      ),
    )
  }
  function removeMonsterFeature(
    monsterId: string,
    section:
      | 'traits'
      | 'actions'
      | 'bonusActions'
      | 'reactions'
      | 'legendaryActions',
    featureId: string,
  ) {
    updateMonsterFeatureList(monsterId, section, (features) =>
      features.filter((feature) => feature.id !== featureId),
    )
  }
  async function handleMonsterImageUpload(
    monsterId: string,
    file: File | null,
  ) {
    if (!file) {
      return
    }
    const asset = await addAssetToAdventure(file, 'image')
    if (!asset) {
      return
    }
    updateMonster(monsterId, (monster) => ({
      ...monster,
      imageAssetId: asset.id,
      imageSrc: asset.dataUrl,
    }))
  }
  function applyLibraryImageToMonster(monsterId: string, assetId: string) {
    if (!adventure) {
      return
    }
    const imageSrc = getAssetDataUrl(adventure.assetLibrary, assetId, null)
    if (!imageSrc) {
      return
    }
    updateMonster(monsterId, (monster) => ({
      ...monster,
      imageAssetId: assetId,
      imageSrc,
    }))
  }
  function renderMonsterFeatureSection(
    monster: MonsterBlock,
    section:
      | 'traits'
      | 'actions'
      | 'bonusActions'
      | 'reactions'
      | 'legendaryActions',
    heading: string,
    buttonLabel: string,
  ) {
    const features = monster[section]
    return (
      <div className="monster-section" key={section}>
        <div className="section-row">
          <span className="eyebrow">{heading}</span>
          <button
            aria-label={`Добавить ${buttonLabel}`}
            className="ghost-button compact-button token-modal-icon-button monster-section-add-button"
            data-tooltip={`Добавить ${buttonLabel}`}
            onClick={() => addMonsterFeature(monster.id, section, buttonLabel)}
            type="button"
          >
            <i aria-hidden="true" className="fa-solid fa-plus" />
          </button>
        </div>
        {features.length > 0 ? (
          <div className="monster-feature-list">
            {features.map((feature) => (
              <div className="monster-feature-card" key={feature.id}>
                <div className="section-row">
                  <strong>{feature.title}</strong>
                  <button
                    aria-label={`Удалить ${feature.title || buttonLabel}`}
                    className="ghost-button compact-button token-modal-icon-button monster-feature-delete-button"
                    data-tooltip="Удалить"
                    onClick={() => removeMonsterFeature(monster.id, section, feature.id)}
                    type="button"
                  >
                    <i aria-hidden="true" className="fa-solid fa-xmark" />
                  </button>
                </div>
                <label className="field">
                  <span>Название</span>
                  <input
                    onChange={(event) =>
                      updateMonsterFeature(monster.id, section, feature.id, (entry) => ({
                        ...entry,
                        title: event.target.value,
                      }))
                    }
                    value={feature.title}
                  />
                </label>
                <label className="field">
                  <span>Текст</span>
                  <textarea
                    onChange={(event) =>
                      updateMonsterFeature(monster.id, section, feature.id, (entry) => ({
                        ...entry,
                        body: event.target.value,
                      }))
                    }
                    rows={2}
                    value={feature.body}
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="editor-empty">В этом разделе пока нет записей.</p>
        )}
      </div>
    )
  }
  function updateAudioTrack(
    trackId: string,
    updater: (track: AudioTrack) => AudioTrack,
  ) {
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      audioLibrary: currentAdventure.audioLibrary.map((track) =>
        track.id === trackId ? updater(track) : track,
      ),
    }))
  }
  async function addAudioTrack(file: File | null) {
    if (!file) {
      return
    }
    const title = file.name.replace(/\.[^/.]+$/, '') || 'Новый аудиотрек'
    const asset = await addAssetToAdventure(file, 'audio', title)
    if (!asset) {
      return
    }
    const track: AudioTrack = {
      id: createEntityId('audio'),
      title,
      kind: 'music',
      assetId: asset.id,
      src: asset.dataUrl,
    }
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      audioLibrary: [...currentAdventure.audioLibrary, track],
    }))
    setSelectedAudioId(track.id)
  }
  function applyLibraryAudioToTrack(trackId: string, assetId: string) {
    if (!adventure) {
      return
    }
    const src = getAssetDataUrl(adventure.assetLibrary, assetId, null)
    if (!src) {
      return
    }
    updateAudioTrack(trackId, (track) => ({
      ...track,
      assetId,
      src,
    }))
  }
  async function handleLibraryAssetUpload(file: File | null) {
    if (!file) {
      return
    }
    await addAssetToAdventure(file, newAssetKind, newAssetTitle)
    setNewAssetTitle('')
  }
  function removeAudioTrack(trackId: string) {
    if (!adventure) {
      return
    }
    const trackToRemove = adventure.audioLibrary.find((track) => track.id === trackId)
    const currentAudio = audioRef.current
    if (currentAudio && currentAudio.src === trackToRemove?.src) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setIsAudioPlaying(false)
    }
    updateAdventure((currentAdventure) => ({
      ...currentAdventure,
      audioLibrary: currentAdventure.audioLibrary.filter((track) => track.id !== trackId),
      scenes: currentAdventure.scenes.map((scene) => ({
        ...scene,
        recommendedAudio: scene.recommendedAudio.filter((id) => id !== trackId),
      })),
    }))
    setSelectedAudioId((currentTrackId) => (currentTrackId === trackId ? null : currentTrackId))
  }
  function toggleSceneAudioRecommendation(trackId: string) {
    if (!activeScene) {
      return
    }
    updateScene(activeScene.id, (scene) => {
      const included = scene.recommendedAudio.includes(trackId)
      return {
        ...scene,
        recommendedAudio: included
          ? scene.recommendedAudio.filter((id) => id !== trackId)
          : [...scene.recommendedAudio, trackId],
      }
    })
  }
  async function playAudioTrack(trackId: string) {
    if (!adventure) {
      return
    }
    const track = adventure.audioLibrary.find((entry) => entry.id === trackId)
    const linkedAsset = track?.assetId
      ? adventure.assetLibrary.find((asset) => asset.id === track.assetId) ?? null
      : null
    const rawSrc = track
      ? getAssetDataUrl(adventure.assetLibrary, track.assetId, track.src)
      : null
    const resolvedSrc = rawSrc ? normalizeAudioDataUrl(rawSrc, linkedAsset) : null
    const audio = audioRef.current
    if (!resolvedSrc || !audio) {
      return
    }
    audio.pause()
    audio.src = resolvedSrc
    audio.volume = audioVolume / 100
    audio.loop = audioLoop
    audio.load()
    try {
      await audio.play()
      setSelectedAudioId(trackId)
      setIsAudioPlaying(true)
    } catch (error) {
      console.error('Не удалось воспроизвести аудио', error)
      setIsAudioPlaying(false)
    }
  }
  function pauseAudioPlayback() {
    audioRef.current?.pause()
    setIsAudioPlaying(false)
  }
  function stopAudioPlayback() {
    if (!audioRef.current) {
      return
    }
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsAudioPlaying(false)
  }
  void [triggerJsonDownload, setNewAssetKind, handleSceneChange, handleAdventureFieldChange, duplicateAdventure, removeAdventure, addScene, handleLibraryAssetUpload]
  if (!adventure || !sessionState || !activeScene || !activeSceneState) {
    return null
  }
  return (
    <main className="app-shell gm-shell gm-shell-editor">
      <div
        aria-hidden={!isSceneMenuOpen}
        className={`scene-drawer-root ${isSceneMenuOpen ? 'is-open' : ''}`}
      >
        <button
          aria-label="Закрыть меню приключения"
          className="scene-drawer-backdrop"
          onClick={() => setIsSceneMenuOpen(false)}
          tabIndex={isSceneMenuOpen ? 0 : -1}
          type="button"
        />
        <aside className="panel scene-panel scene-drawer-panel" id="scene-navigation-menu">
          <div className="panel-header scene-panel-header">
            <div className="scene-panel-header-main">
              <div className="scene-panel-header-copy">
                <h1>{adventure.title}</h1>
              </div>
              <div className="scene-panel-header-actions">
                <button
                  aria-controls="scene-navigation-menu"
                  aria-expanded={isSceneMenuOpen}
                  aria-label="Закрыть меню"
                  className="scene-menu-close-button scene-menu-icon-button"
                  data-tooltip="Закрыть меню"
                  data-tooltip-placement="left"
                  onClick={() => setIsSceneMenuOpen(false)}
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>
          </div>
          <div className="scene-drawer-scroll">
            <div className="editor-stack scene-menu-stack">
              <div className="editor-card scene-menu-card scene-menu-project-card">
                <div className="section-row scene-menu-section-row">
                  <div className="scene-menu-section-copy">
                    <div className="scene-menu-heading-row">
                      <span className="eyebrow">Проект</span>
                      <div
                        ref={projectActionsRef}
                        className={`scene-menu-action-disclosure ${isProjectActionsOpen ? 'is-open' : ''}`}
                      >
                        <button
                          aria-expanded={isProjectActionsOpen}
                          aria-haspopup="menu"
                          aria-label={isProjectActionsOpen ? 'Скрыть действия проекта' : 'Показать действия проекта'}
                          className="scene-menu-header-icon-button scene-menu-icon-button scene-menu-project-toggle-button"
                          data-tooltip={isProjectActionsOpen ? 'Скрыть действия проекта' : 'Показать действия проекта'}
                          onClick={() => setIsProjectActionsOpen((currentValue) => !currentValue)}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-gear" />
                        </button>
                        <div className="scene-menu-action-flyout" role="menu" aria-label="Действия проекта">
                          <button
                            aria-label="Открыть папку проекта"
                            className="scene-menu-action-button scene-menu-icon-button"
                            data-tooltip="Открыть папку проекта"
                            disabled={!isProjectFoldersSupported}
                            onClick={() => {
                              setIsProjectActionsOpen(false)
                              void handleOpenProjectFolder()
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-folder-open" />
                          </button>
                          <button
                            aria-label={projectDirectoryHandle ? 'Сохранить в папку' : 'Сохранить проект в папку'}
                            className="scene-menu-action-button scene-menu-icon-button"
                            data-tooltip={projectDirectoryHandle ? 'Сохранить в папку' : 'Сохранить проект в папку'}
                            disabled={!isProjectFoldersSupported}
                            onClick={() => {
                              setIsProjectActionsOpen(false)
                              void handleSaveProjectFolder()
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-floppy-disk" />
                          </button>
                          <button
                            aria-label="Экспортировать проект"
                            className="scene-menu-action-button scene-menu-icon-button"
                            data-tooltip="Экспортировать проект"
                            onClick={() => {
                              setIsProjectActionsOpen(false)
                              triggerProjectDownload(projectState)
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-file-export" />
                          </button>
                          <button
                            aria-label="Импортировать проект"
                            className="scene-menu-action-button scene-menu-icon-button"
                            data-tooltip="Импортировать проект"
                            onClick={() => {
                              setIsProjectActionsOpen(false)
                              triggerProjectImport()
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-file-import" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="scene-menu-section-text">
                      Импорт, экспорт и быстрые действия с общей библиотекой приключений.
                    </p>
                    <p
                      className={`scene-menu-project-status is-${projectPersistenceStatus}`}
                    >
                      {projectPersistenceMessage}
                    </p>
                  </div>
                </div>
                <input
                  ref={projectImportFileInputRef}
                  accept=".json,application/json"
                  className="visually-hidden"
                  onChange={(event) =>
                    void handleProjectImport(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                <input
                  ref={importFileInputRef}
                  accept=".json,application/json"
                  className="visually-hidden"
                  onChange={(event) =>
                    void handleAdventureImport(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                <input
                  ref={characterImportFileInputRef}
                  accept=".json,application/json"
                  className="visually-hidden"
                  onChange={(event) =>
                    void handleCharacterImport(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                {importFeedback ? (
                  <p className={`feedback-message feedback-${importFeedback.tone}`}>
                    {importFeedback.text}
                  </p>
                ) : null}
              </div>
              <div className="editor-card scene-menu-card">
                <div className="section-row scene-menu-section-row">
                  <div className="scene-menu-section-copy">
                    <div className="scene-menu-heading-row">
                      <span className="eyebrow">Библиотека заклинаний</span>
                      <div className="scene-menu-block-actions">
                        <button
                          aria-label="Открыть библиотеку заклинаний"
                          className="scene-menu-header-icon-button scene-menu-icon-button"
                          data-tooltip="Открыть библиотеку"
                          onClick={() => setIsSpellLibraryModalOpen(true)}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-book-open" />
                        </button>
                      </div>
                    </div>
                    <p className="scene-menu-section-text">
                      Встроенный гримуар приложения: {builtInSpellLibrary?.length ?? 'загрузка по запросу'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="editor-card scene-menu-card">
                <div className="section-row scene-menu-section-row">
                  <div className="scene-menu-section-copy">
                    <div className="scene-menu-heading-row">
                      <span className="eyebrow">Бестиарий</span>
                      <div className="scene-menu-block-actions">
                        <button
                          aria-label="Открыть бестиарий"
                          className="scene-menu-header-icon-button scene-menu-icon-button"
                          data-tooltip="Открыть бестиарий"
                          onClick={() => setIsBestiaryModalOpen(true)}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-dragon" />
                        </button>
                      </div>
                    </div>
                    <p className="scene-menu-section-text">
                      Общий бестиарий приложения: {builtInBestiary?.length ?? 'загрузка по запросу'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="editor-card scene-menu-card">
                <button
                  className="control-group-toggle scene-menu-spoiler-toggle"
                  onClick={() => setIsRecoveryPointsCollapsed((current) => !current)}
                  type="button"
                  aria-expanded={!isRecoveryPointsCollapsed}
                >
                  <div className="control-group-header">
                    <div className="scene-menu-section-copy">
                      <div className="scene-menu-heading-row">
                        <span className="eyebrow">Точки восстановления</span>
                        <strong className="scene-menu-section-count">{projectSnapshots.length}</strong>
                      </div>
                      <p className="scene-menu-section-text">
                        Отдельные сохранённые состояния проекта, к которым можно вернуться вручную.
                      </p>
                    </div>
                    <span className={`control-group-chevron ${isRecoveryPointsCollapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
                      <i className="fa-solid fa-chevron-down" />
                    </span>
                  </div>
                </button>
                {!isRecoveryPointsCollapsed ? (
                  <div className="scene-list scene-menu-list scene-menu-collapsible-list">
                    {recentProjectSnapshots.map((snapshot) => (
                      <button
                        key={snapshot.id}
                        className="scene-card scene-menu-entry"
                        onClick={() => restoreProjectSnapshot(snapshot.id)}
                        type="button"
                      >
                        <span className="scene-card-location">
                          {new Date(snapshot.timestamp).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <strong>{snapshot.label}</strong>
                        <span className="scene-card-summary">
                          Нажми, чтобы восстановить это состояние проекта.
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="editor-card scene-menu-card">
                <div className="section-row scene-menu-section-row">
                  <div className="scene-menu-section-copy">
                    <div className="scene-menu-heading-row">
                      <span className="eyebrow">Приключения</span>
                      <div className="scene-menu-block-actions">
                        <button
                          aria-label="Импортировать приключение"
                          className="scene-menu-header-icon-button scene-menu-icon-button"
                          data-tooltip="Импортировать приключение"
                          onClick={triggerAdventureImport}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-scroll" />
                        </button>
                        <button
                          aria-label="Добавить приключение"
                          className="scene-menu-header-icon-button scene-menu-icon-button"
                          data-tooltip="Добавить приключение"
                          onClick={addAdventure}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-plus" />
                        </button>
                      </div>
                    </div>
                    <p className="scene-menu-section-text">
                      Переключай активное приключение и держи библиотеку проекта под рукой.
                    </p>
                  </div>
                </div>
                <div className="adventure-list scene-menu-list">
                  {projectState.adventureOrder.map((adventureId) => {
                    const listedAdventure = projectState.adventures[adventureId]
                    if (!listedAdventure) {
                      return null
                    }
                    const isEditingAdventureId =
                      editingAdventureField?.adventureId === adventureId &&
                      editingAdventureField.field === 'id'
                    const isEditingAdventureTitle =
                      editingAdventureField?.adventureId === adventureId &&
                      editingAdventureField.field === 'title'
                    return (
                      <div
                        key={adventureId}
                        className={`adventure-card scene-menu-entry ${adventureId === activeAdventureId ? 'active' : ''}`}
                        onClick={() => {
                          switchAdventure(adventureId)
                          setIsSceneMenuOpen(false)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            switchAdventure(adventureId)
                            setIsSceneMenuOpen(false)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {isEditingAdventureId ? (
                          <input
                            autoFocus
                            className="scene-menu-inline-input scene-menu-inline-input-id"
                            onBlur={commitAdventureCardEdit}
                            onChange={(event) => setEditingAdventureValue(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={handleAdventureCardInputKeyDown}
                            value={editingAdventureValue}
                          />
                        ) : (
                          <button
                            className="scene-menu-inline-edit-trigger scene-card-location"
                            onClick={(event) => {
                              event.stopPropagation()
                              startAdventureCardEdit(adventureId, 'id', listedAdventure.id)
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                            type="button"
                          >
                            {listedAdventure.id}
                          </button>
                        )}
                        {isEditingAdventureTitle ? (
                          <input
                            autoFocus
                            className="scene-menu-inline-input scene-menu-inline-input-title"
                            onBlur={commitAdventureCardEdit}
                            onChange={(event) => setEditingAdventureValue(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={handleAdventureCardInputKeyDown}
                            value={editingAdventureValue}
                          />
                        ) : (
                          <button
                            className="scene-menu-inline-edit-trigger scene-menu-entry-title"
                            onClick={(event) => {
                              event.stopPropagation()
                              startAdventureCardEdit(adventureId, 'title', listedAdventure.title)
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                            type="button"
                          >
                            <strong>{listedAdventure.title}</strong>
                          </button>
                        )}
                        <span className="scene-card-summary">{listedAdventure.scenes.length} сцен</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="editor-card scene-menu-card">
                <div className="section-row scene-menu-section-row">
                  <div className="scene-menu-section-copy">
                    <div className="scene-menu-heading-row">
                      <span className="eyebrow">Персонажи</span>
                      <div className="scene-menu-block-actions">
                        <button
                          aria-label="Импортировать персонажа LSS"
                          className="scene-menu-header-icon-button scene-menu-icon-button"
                          data-tooltip="Импортировать персонажа LSS"
                          onClick={triggerCharacterImport}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-user-plus" />
                        </button>
                      </div>
                    </div>
                    <p className="scene-menu-section-text">
                      Общие карточки игроков для всего приключения, отдельно от сцен.
                    </p>
                  </div>
                </div>
                <div className="scene-list scene-menu-list character-menu-list">
                  {adventure.characters.length > 0 ? (
                    adventure.characters.map((character) => (
                      <div
                        className="scene-card scene-menu-entry character-menu-card"
                        key={character.id}
                      >
                        <button
                          className="character-menu-card-open"
                          onClick={() => {
                            setSelectedCharacterId(character.id)
                            setIsCharacterModalOpen(true)
                          }}
                          type="button"
                        >
                          {character.avatarSrc ? (
                            <img alt="" src={character.avatarSrc} />
                          ) : (
                            <span className="character-menu-avatar-placeholder">
                              {character.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="character-menu-card-copy">
                            <strong>{character.name}</strong>
                          </span>
                        </button>
                        <span className="character-menu-card-actions">
                          <button
                            aria-label={`Обновить персонажа ${character.name}`}
                            className="ghost-button compact-button token-modal-icon-button"
                            data-tooltip="Обновить из JSON"
                            onClick={() => triggerCharacterUpdate(character.id)}
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-rotate" />
                          </button>
                          <button
                            aria-label={`Удалить персонажа ${character.name}`}
                            className="ghost-button compact-button token-modal-icon-button"
                            data-tooltip="Удалить персонажа"
                            onClick={() => setPendingCharacterDeleteId(character.id)}
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-trash" />
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="editor-empty">Импортируй JSON персонажа из Long Story Short.</p>
                  )}
                </div>
              </div>
              {adventure ? (
                <div className="info-card scene-menu-card">
                  <div className="section-row scene-menu-section-row">
                    <div className="scene-menu-section-copy">
                      <div className="scene-menu-heading-row">
                        <span className="eyebrow">Сцены</span>
                        <div className="scene-menu-block-actions">
                          <button
                            aria-label="Добавить сцену"
                            className="scene-menu-header-icon-button scene-menu-icon-button"
                            data-tooltip="Добавить сцену"
                            onClick={addScene}
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-plus" />
                          </button>
                        </div>
                      </div>
                      <p className="scene-menu-section-text">
                        <span>Активное приключение:</span>
                        <strong className="scene-menu-section-title">{adventure.title}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="scene-list scene-menu-list">
                    {adventure.scenes.map((scene, index) => (
                      <button
                        key={scene.id}
                        className={`scene-card scene-menu-entry ${scene.id === activeScene?.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveSceneId(scene.id)
                          setActiveEditorTab('scene')
                          setIsSceneMenuOpen(false)
                        }}
                        type="button"
                      >
                        <span className="scene-card-location">
                          {index + 1}. {scene.location}
                        </span>
                        <strong>{scene.title}</strong>
                        <span className="scene-card-summary">{scene.gmSummary || scene.map.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="info-card scene-menu-card">
                  <span className="eyebrow">Сцены</span>
                  <p className="scene-menu-section-text">
                    Сначала выбери или создай приключение, а затем добавляй сцены.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <section className="control-panel">
        <div
          ref={mapBoardRef}
          className={`map-board accent-${activeScene.accent} ${gmVisibleLayers.length > 0 ? 'with-image' : ''} interaction-${mapInteractionMode} ${isMapPanning ? 'is-panning' : ''} ${isServiceMarkerDragging ? 'is-service-marker-dragging' : ''} ${rotatingTokenId ? 'is-token-rotating' : ''}`}
          onPointerDown={handleMapBoardPointerDown}
        >
          <div
            className="map-menu-panel"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              aria-controls="scene-navigation-menu"
              aria-expanded={isSceneMenuOpen}
              aria-label={isSceneMenuOpen ? 'Скрыть меню приключения' : 'Открыть меню приключения'}
              data-tooltip="Меню приключения"
              className="scene-menu-toggle-overlay"
              onClick={() => setIsSceneMenuOpen((currentValue) => !currentValue)}
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-bars" />
            </button>
          </div>
          <div
            ref={mapFrameRef}
            className="map-frame"
            style={activeMapFrameStyle}
          >
            <div
              ref={mapTransformLayerRef}
              className="map-transform-layer"
              style={{
                transform: `translate(${activeMapViewport.offsetX}px, ${activeMapViewport.offsetY}px) scale(${activeMapViewport.scale})`,
              }}
            >
            <div className="map-layer-stack">
              {gmVisibleLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="map-layer"
                  style={{
                    backgroundImage: createCssUrl(layer.imageSrc),
                    transform: `scale(${layer.scale}) rotate(${layer.rotation}deg)`,
                  }}
                />
              ))}
            </div>
            {isMapGridVisible ? (
              <div
                className="map-grid-overlay"
                style={{
                  backgroundSize: mapGridCellSize
                    ? `${mapGridCellSize}px ${mapGridCellSize}px`
                    : `${100 / activeMapGrid.columns}% ${100 / activeMapGrid.rows}%`,
                }}
              />
            ) : null}
            {activeScene.zones.map((zone) => {
              const isActiveZone = zone.id === activeZone?.id
              const zoneLinkedHandout = zone.linkedHandoutId
                ? activeScene.handouts.find((handout) => handout.id === zone.linkedHandoutId) ?? null
                : null
              const zoneLinkedCheck = zone.linkedCheckId
                ? activeScene.checksClues.find((entry) => entry.id === zone.linkedCheckId) ?? null
                : null
              const zoneLinkedMonster = zone.linkedMonsterId
                ? sceneMonsters.find((monster) => monster.id === zone.linkedMonsterId) ?? null
                : null
              const zoneHasFog = isZoneHiddenByFog(zone.id, activeSceneState.hiddenZoneIds)
              const zoneActionItems = [
                {
                  id: 'handout-open',
                  icon: 'fa-note-sticky',
                  title: 'Открыть раздатку',
                  disabled: !zoneLinkedHandout,
                  onClick: () => focusZoneLinkedHandout(zone),
                },
                {
                  id: 'handout-show',
                  icon: 'fa-share-from-square',
                  title: 'Показать раздатку игрокам',
                  disabled: !zoneLinkedHandout,
                  onClick: () => showZoneLinkedHandoutToPlayers(zone),
                  tone: 'primary' as const,
                },
                {
                  id: 'check-open',
                  icon: 'fa-dice-d20',
                  title: 'Открыть проверку',
                  disabled: !zoneLinkedCheck,
                  onClick: () => focusZoneLinkedCheck(zone),
                },
                {
                  id: 'monster-open',
                  icon: 'fa-dragon',
                  title: 'Открыть монстра',
                  disabled: !zoneLinkedMonster,
                  onClick: () => focusZoneLinkedMonster(zone),
                },
              ]
              const useCompactZoneTools =
                zoneActionItems.length > 0 &&
                (zone.width < Math.max(18, zoneActionItems.length * 5.4) || zone.height < 11)
              return (
                <div
                  key={zone.id}
                  className={`map-zone ${isActiveZone ? 'active' : ''} ${zone.visibleToPlayers ? 'player-visible' : ''} has-visibility-badge`}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (suppressZoneClickRef.current) {
                      suppressZoneClickRef.current = false
                      return
                    }
                    setOpenCompactZoneToolsZoneId(null)
                    setSelectedZoneId(zone.id)
                    setIsZoneModalOpen(true)
                    setActiveEditorTab('scene')
                  }}
                  onPointerDown={(event) => handleZonePointerDown(zone.id, event)}
                  onPointerLeave={() =>
                    setHoveredZoneResizeHandle((current) => (current?.zoneId === zone.id ? null : current))
                  }
                  onPointerMove={(event) => {
                    const handle = getZoneResizeHandle(event.currentTarget, event.clientX, event.clientY)
                    setHoveredZoneResizeHandle((current) =>
                      current?.zoneId === zone.id && current.handle === handle
                        ? current
                        : { zoneId: zone.id, handle },
                    )
                  }}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                    cursor: getZoneResizeCursor(
                      hoveredZoneResizeHandle?.zoneId === zone.id ? hoveredZoneResizeHandle.handle : null,
                    ),
                  }}
                  title={zone.note || zone.title}
                  role="button"
                  tabIndex={0}
                >
                  <span>{zone.title}</span>
                  <span
                    aria-label={zoneHasFog ? 'Зона скрыта туманом' : 'Зона открыта игрокам'}
                    className={`token-visibility-badge zone-visibility-badge ${zoneHasFog ? 'is-hidden' : 'is-visible'
                      }`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenCompactZoneToolsZoneId(null)
                      applyFogToZone(zone, zoneHasFog ? 'fog-erase' : 'fog-draw')
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    role="button"
                    tabIndex={0}
                    title={zoneHasFog ? 'Открыть зону' : 'Скрыть зону'}
                  >
                    <i
                      aria-hidden="true"
                      className={`fa-solid ${zoneHasFog ? 'fa-eye-slash' : 'fa-eye'}`}
                    />
                  </span>
                  {zoneActionItems.length > 0 ? (
                    useCompactZoneTools ? (
                      <div
                        className={`map-zone-tools map-zone-tools-compact ${openCompactZoneToolsZoneId === zone.id ? 'is-open' : ''
                          }`}
                      >
                        <button
                          aria-label="Инструменты зоны"
                          className="map-zone-action-button"
                          aria-expanded={openCompactZoneToolsZoneId === zone.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenCompactZoneToolsZoneId((current) =>
                              current === zone.id ? null : zone.id,
                            )
                          }}
                          onPointerDown={(event) => {
                            event.stopPropagation()
                          }}
                          title="Инструменты зоны"
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-screwdriver-wrench" />
                        </button>
                        <div className="map-zone-tools-flyout">
                          {zoneActionItems.map((action) => (
                            <button
                              key={action.id}
                              aria-label={action.title}
                              className={`map-zone-action-button ${action.tone === 'primary' ? 'is-primary' : ''}`}
                              disabled={action.disabled}
                              onClick={(event) => {
                                event.stopPropagation()
                                setOpenCompactZoneToolsZoneId(null)
                                action.onClick()
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation()
                              }}
                              title={action.title}
                              type="button"
                            >
                              <i aria-hidden="true" className={`fa-solid ${action.icon}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="map-zone-tools">
                        {zoneActionItems.map((action) => (
                          <button
                            key={action.id}
                            aria-label={action.title}
                            className={`map-zone-action-button ${action.tone === 'primary' ? 'is-primary' : ''}`}
                            disabled={action.disabled}
                            onClick={(event) => {
                              event.stopPropagation()
                              setOpenCompactZoneToolsZoneId(null)
                              action.onClick()
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation()
                            }}
                            title={action.title}
                            type="button"
                          >
                            <i aria-hidden="true" className={`fa-solid ${action.icon}`} />
                          </button>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              )
            })}
            <div className="fog-layer fog-layer-gm">
              {hiddenFogZones.map((zone) => (
                <div
                  key={zone.id}
                  className="fog-zone"
                  style={getZoneFogStyle(zone)}
                />
              ))}
              {effectiveFogCells.map((cellId) => (
                <div
                  key={cellId}
                  className="fog-cell"
                  style={getFogCellStyle(cellId, activeMapGrid)}
                />
              ))}
            </div>
            {fogSelectionRect ? (
              <div
                className="fog-selection-rect"
                style={{
                  left: `${fogSelectionRect.left}%`,
                  top: `${fogSelectionRect.top}%`,
                  width: `${fogSelectionRect.width}%`,
                  height: `${fogSelectionRect.height}%`,
                }}
              />
            ) : null}
            {zoneSelectionRect ? (
              <div
                className="zone-selection-rect"
                style={{
                  left: `${zoneSelectionRect.left}%`,
                  top: `${zoneSelectionRect.top}%`,
                  width: `${zoneSelectionRect.width}%`,
                  height: `${zoneSelectionRect.height}%`,
                }}
              />
            ) : null}
            {orderedTokens.map((token) => (
              <button
                key={token.id}
                data-tooltip-disabled="true"
                className={`token token-${token.kind} ${token.hiddenFromPlayers ? 'is-hidden' : ''} ${token.id === activeToken?.id ? 'active' : ''} ${token.id === activeInitiativeToken?.id ? 'active-turn' : ''} ${token.id === rotatingTokenId ? 'is-rotation-active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  if (suppressTokenClickRef.current) {
                    suppressTokenClickRef.current = false
                    return
                  }
                  setSelectedTokenId(token.id)
                  setIsTokenModalOpen(true)
                  setActiveInitiativeToken(token.id)
                }}
                onPointerDown={(event) => beginTokenDrag(token.id, event)}
                style={{
                  left: `${token.x}%`,
                  top: `${token.y}%`,
                  width: mapGridCellSize
                    ? `${tokenSpaceFootprints[token.space] * mapGridCellSize}px`
                    : `${(tokenSpaceFootprints[token.space] / activeMapGrid.columns) * 100}%`,
                  height: mapGridCellSize
                    ? `${tokenSpaceFootprints[token.space] * mapGridCellSize}px`
                    : `${(tokenSpaceFootprints[token.space] / activeMapGrid.rows) * 100}%`,
                  backgroundImage: `url(${token.imageSrc})`,
                  transform: `translate(-50%, -50%) rotate(${getTokenRotation(token)}deg)`,
                  zIndex: token.id === activeInitiativeToken?.id ? token.zIndex + 1000 : token.zIndex,
                }}
              >
                <span
                  aria-label={
                    token.hiddenFromPlayers
                      ? 'Фишка скрыта от игроков'
                      : 'Фишка видима игрокам'
                  }
                  className={`token-visibility-badge ${token.hiddenFromPlayers ? 'is-hidden' : 'is-visible'
                    }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    suppressTokenClickRef.current = false
                    updateToken(token.id, (currentToken) => ({
                      ...currentToken,
                      hiddenFromPlayers: !currentToken.hiddenFromPlayers,
                    }))
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <i
                    aria-hidden="true"
                    className={`fa-solid ${token.hiddenFromPlayers ? 'fa-eye-slash' : 'fa-eye'
                      }`}
                  />
                </span>
                <span className="token-label">{token.name}</span>
              </button>
            ))}
            {orderedServiceMarkers.map((marker) => {
              const markerLinkedHandout = marker.linkedHandoutId
                ? activeScene.handouts.find((handout) => handout.id === marker.linkedHandoutId) ?? null
                : null
              const markerLinkedCheck = marker.linkedCheckId
                ? activeScene.checksClues.find((entry) => entry.id === marker.linkedCheckId) ?? null
                : null
              return (
                <div
                  key={marker.id}
                  className={`service-marker ${marker.id === activeServiceMarker?.id ? 'active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (suppressServiceMarkerClickRef.current) {
                      suppressServiceMarkerClickRef.current = false
                      return
                    }
                    setSelectedServiceMarkerId(marker.id)
                    setIsServiceMarkerModalOpen(true)
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    beginServiceMarkerDrag(marker.id, event)
                  }}
                  style={{ left: `${marker.x}%`, top: `${marker.y}%`, zIndex: marker.zIndex }}
                  data-tooltip={isServiceMarkerDragging ? undefined : marker.note || marker.label}
                  aria-label={marker.note ? `${marker.label}: ${marker.note}` : marker.label}
                  role="button"
                  tabIndex={0}
                >
                  <span className="service-marker-icon" aria-hidden="true">?</span>
                  <div
                    className="service-marker-tools"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      aria-label="Открыть раздатку"
                      className={`service-marker-action-button ${markerLinkedHandout ? 'is-active' : 'is-disabled'}`}
                      disabled={!markerLinkedHandout}
                      onClick={() => focusLinkedHandout(marker.linkedHandoutId)}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-note-sticky" />
                    </button>
                    <button
                      aria-label="Показать раздатку игрокам"
                      className={`service-marker-action-button is-primary ${markerLinkedHandout ? 'is-active' : 'is-disabled'}`}
                      disabled={!markerLinkedHandout}
                      onClick={() => showLinkedHandoutToPlayers(marker.linkedHandoutId)}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-share-from-square" />
                    </button>
                    <button
                      aria-label="Открыть проверку"
                      className={`service-marker-action-button ${markerLinkedCheck ? 'is-active' : 'is-disabled'}`}
                      disabled={!markerLinkedCheck}
                      onClick={() => focusLinkedCheck(marker.linkedCheckId)}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-dice-d20" />
                    </button>
                  </div>
                </div>
              )
            })}
            </div>
          </div>
          {visiblePlayerHandout ? (
            <div
              className="handout-modal-backdrop gm-handout-modal"
              onClick={(event) => {
                event.stopPropagation()
                hidePlayerHandout()
              }}
              onPointerDown={(event) => event.stopPropagation()}
              role="presentation"
            >
              <article
                className={`handout-modal-card ${visiblePlayerHandout.imageSrc ? 'with-art' : 'text-only'}`}
                onClick={(event) => event.stopPropagation()}
              >
                {visiblePlayerHandout.title ? <h2>{visiblePlayerHandout.title}</h2> : null}
                {visiblePlayerHandout.imageSrc ? (
                  <figure className="handout-modal-figure">
                    <img
                      alt={visiblePlayerHandout.title}
                      className="handout-modal-image"
                      src={visiblePlayerHandout.imageSrc}
                    />
                  </figure>
                ) : null}
                {visiblePlayerHandout.body ? <p>{visiblePlayerHandout.body}</p> : null}
              </article>
            </div>
          ) : null}
          <MapUtilityPanel
            activeMapScale={activeMapViewport.scale}
            hasFog={activeSceneState.fogCells.length > 0 || activeSceneState.hiddenZoneIds.length > 0}
            isGmNotesVisible={isGmNotesVisible}
            isInitiativeTrackerVisible={isInitiativeTrackerVisible}
            mapInteractionMode={mapInteractionMode}
            mapScaleStep={mapScaleStep}
            onClearAllFog={clearAllFog}
            onResetMapViewport={resetMapViewport}
            onSetMapInteractionMode={setMapInteractionMode}
            onToggleGmNotes={() => setIsGmNotesVisible((currentValue) => !currentValue)}
            onToggleInitiativeTracker={() => setIsInitiativeTrackerVisible((currentValue) => !currentValue)}
            onZoomMap={zoomMap}
          />
          <GmNotesPanel
            isVisible={isGmNotesVisible}
            onClose={() => setIsGmNotesVisible(false)}
            scene={activeScene}
          />
          <MapCornerPanel
            isMapGridVisible={isMapGridVisible}
            onOpenGridSettings={() => setIsMapGridModalOpen(true)}
            onOpenLayerSettings={() => setIsMapLayersModalOpen(true)}
            onToggleMapGridVisibility={toggleMapGridVisibility}
            onUpdateMapLayer={updateActiveSceneMapLayer}
            quickMapLayer={quickMapLayer ?? null}
          />
          <MapTitleBadge
            audioLabel={activeAudioTrack ? `${isAudioPlaying ? "Играет" : "Пауза"}: ${activeAudioTrack.title}` : "Аудио не выбрано"}
            canRedo={redoStack.length > 0}
            canShowQuickHandout={Boolean(quickSceneHandout)}
            canUndo={undoStack.length > 0}
            isPlayerShowingActiveMap={isPlayerShowingActiveMap}
            isPlayerShowingActiveSplash={isPlayerShowingActiveSplash}
            isPlayerShowingQuickHandout={isPlayerShowingQuickHandout}
            mapTitle={activeScene.map.title}
            materialLabel={
              sessionState?.playerDisplay.mode === "splash"
                ? currentPlayerSplash?.title ?? "Splash не настроен"
                : currentPlayerHandout?.title ?? "Раздатка не выбрана"
            }
            onOpenMapParams={() => setIsMapParamsModalOpen(true)}
            onOpenPlayerWindow={openPlayerWindow}
            onPushMapToPlayer={() => pushMapToPlayer(activeScene)}
            onPushQuickHandout={() => pushQuickSceneHandout(activeScene)}
            onPushSplashToPlayer={() => pushSplashToPlayer(activeScene)}
            onRedo={redoLastChange}
            onSetStandby={setStandby}
            onUndo={undoLastChange}
            playerModeLabel={effectivePlayerModeLabel}
            playerSceneLabel={currentPlayerScene ? `${currentPlayerScene.title} (${currentPlayerScene.location})` : "Сцена не выбрана"}
          />
          <SceneEditorActions
            activeEditorTab={activeEditorTab}
            containerRef={sceneEditorActionsRef}
            isModalOpen={isSceneEditorModalOpen}
            isOpen={isSceneEditorActionsOpen}
            onOpenSection={openSceneEditorSection}
            onToggle={() => setIsSceneEditorActionsOpen((currentValue) => !currentValue)}
            sceneTitle={activeScene.title}
          />
          <InitiativeTracker
            focusToken={initiativeTrackerFocusToken}
            hiddenTokenCount={hiddenInitiativeTrackerTokenCount}
            isVisible={isInitiativeTrackerVisible}
            onCycleTurn={cycleInitiativeTurn}
            onOpenToken={(tokenId) => {
              setSelectedTokenId(tokenId)
              setActiveInitiativeToken(tokenId)
              setIsTokenModalOpen(true)
            }}
            tokens={initiativeTrackerVisibleTokens}
          />
        </div>
        <section className="control-group control-group-live">
          <button
            className="control-group-toggle"
            onClick={() => setIsLiveToolsCollapsed((current) => !current)}
            type="button"
            aria-expanded={!isLiveToolsCollapsed}
          >
            <div className="control-group-header">
              <div className="control-group-copy">
                <span className="eyebrow">Живые инструменты сцены</span>
                <p className="editor-hint">
                  Отслеживай бой, работай с фишками и держи под рукой служебные отметки.
                </p>
              </div>
              <span className={`control-group-chevron ${isLiveToolsCollapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
                ?
              </span>
            </div>
          </button>
          {!isLiveToolsCollapsed ? (
            <div className="gm-grid">
              <article className="info-card service-marker-list-card">
                <span className="eyebrow">Инициатива</span>
                {initiativeTokens.length > 0 ? (
                  <div className="editor-stack">
                    <ul className="initiative-list">
                      {initiativeTokens.map((token) => (
                        <li
                          className={`initiative-row ${token.id === activeInitiativeToken?.id ? 'active' : ''}`}
                          key={token.id}
                        >
                          <button
                            className="initiative-trigger"
                            onClick={() => {
                              setSelectedTokenId(token.id)
                              setActiveInitiativeToken(token.id)
                            }}
                            type="button"
                          >
                            <strong>{token.name}</strong>
                          </button>
                          <span className="initiative-meta">
                            Иниц. {token.initiative ?? '—'} • ХП {formatTokenHitPoints(token)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="editor-empty">
                    У фишек пока нет инициативы. Задай её в свойствах токенов, и трекер соберётся автоматически.
                  </p>
                )}
              </article>
              <article className="info-card">
                <span className="eyebrow">Цели сцены</span>
                <ul className="flat-list">
                  {activeScene.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </article>
              <article className="info-card">
                <span className="eyebrow">Выбранная фишка</span>
                {activeToken ? (
                  <div className="editor-stack">
                    <label className="field">
                      <span>Имя</span>
                      <input
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            name: event.target.value,
                          }))
                        }
                        value={activeToken.name}
                      />
                    </label>
                    <label className="field">
                      <span>Тип</span>
                      <StyledSelect
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            kind: event.target.value as TokenKind,
                            linkedMonsterId:
                              event.target.value === 'monster' ? token.linkedMonsterId : null,
                            linkedCharacterId:
                              event.target.value === 'player' ? token.linkedCharacterId : null,
                          }))
                        }
                        value={activeToken.kind}
                      >
                        <option value="player">Игрок</option>
                        <option value="monster">Монстр</option>
                        <option value="npc">NPC</option>
                      </StyledSelect>
                    </label>
                    <label className="field">
                      <span>Группа</span>
                      <input
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            groupLabel: event.target.value || null,
                          }))
                        }
                        placeholder="Например, Гули подвала"
                        value={activeToken.groupLabel ?? ''}
                      />
                    </label>
                    <label className="field">
                      <span>Пространство</span>
                      <StyledSelect
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            space: event.target.value as TokenSpace,
                          }))
                        }
                        value={activeToken.space}
                      >
                        {tokenSpaceValues.map((space) => (
                          <option key={space} value={space}>
                            {tokenSpaceLabels[space]}
                          </option>
                        ))}
                      </StyledSelect>
                    </label>
                    <label className="field">
                      <span>Порядок слоя</span>
                      <input
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            zIndex: Number(event.target.value),
                          }))
                        }
                        type="number"
                        value={activeToken.zIndex}
                      />
                    </label>
                    <label className="checkbox-field">
                      <input
                        checked={activeToken.hiddenFromPlayers}
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            hiddenFromPlayers: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>Скрыть токен от игроков</span>
                    </label>
                    <label className="field">
                      <span>Связанный монстр</span>
                      <StyledSelect
                        onChange={(event) =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            kind: event.target.value ? 'monster' : token.kind,
                            linkedMonsterId: event.target.value || null,
                            linkedCharacterId: null,
                          }))
                        }
                        value={activeToken.linkedMonsterId ?? ''}
                      >
                        <option value="">не привяза</option>
                        {sceneMonsters.map((monster) => (
                          <option key={monster.id} value={monster.id}>
                            {monster.name}
                          </option>
                        ))}
                      </StyledSelect>
                    </label>
                    {activeTokenLinkedMonster ? (
                      <p className="editor-hint">
                        Связанный монстр: <strong>{activeTokenLinkedMonster.name}</strong>
                      </p>
                    ) : null}
                    <div className="zone-grid">
                      <label className="field">
                        <span>Текущее ХП</span>
                        <input
                          onChange={(event) =>
                            updateToken(activeToken.id, (token) => ({
                              ...token,
                              hitPointsCurrent: event.target.value ? Number(event.target.value) : null,
                            }))
                          }
                          type="number"
                          value={activeToken.hitPointsCurrent ?? ''}
                        />
                      </label>
                      <label className="field">
                        <span>Макс. ХП</span>
                        <input
                          onChange={(event) =>
                            updateToken(activeToken.id, (token) => ({
                              ...token,
                              hitPointsMax: event.target.value ? Number(event.target.value) : null,
                            }))
                          }
                          type="number"
                          value={activeToken.hitPointsMax ?? ''}
                        />
                      </label>
                      <label className="field">
                        <span>Инициатива</span>
                        <input
                          onChange={(event) =>
                            updateToken(activeToken.id, (token) => ({
                              ...token,
                              initiative: event.target.value ? Number(event.target.value) : null,
                            }))
                          }
                          type="number"
                          value={activeToken.initiative ?? ''}
                        />
                      </label>
                    </div>
                    <div className="layer-controls">
                      <button
                        className="ghost-button compact-button"
                        onClick={() =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            zIndex: token.zIndex - 1,
                          }))
                        }
                        type="button"
                      >
                        Ниже
                      </button>
                      <button
                        className="ghost-button compact-button"
                        onClick={() =>
                          updateToken(activeToken.id, (token) => ({
                            ...token,
                            zIndex: token.zIndex + 1,
                          }))
                        }
                        type="button"
                      >
                        Выше
                      </button>
                    </div>
                    <div className="action-row zone-action-row">
                      <button
                        className="ghost-button compact-button"
                        onClick={() => duplicateToken(activeToken)}
                        type="button"
                      >
                        Копировать токен
                      </button>
                      <button
                        className="ghost-button compact-button"
                        disabled={!activeTokenLinkedMonster}
                        onClick={() => syncTokenStatsFromMonster(activeToken)}
                        type="button"
                      >
                        Синхронизировать с монстром
                      </button>
                      <button
                        className="ghost-button compact-button"
                        disabled={!activeTokenLinkedMonster}
                        onClick={() => focusTokenLinkedMonster(activeToken)}
                        type="button"
                      >
                        Открыть монстра
                      </button>
                    </div>
                    <button
                      className="inline-link"
                      onClick={() => removeToken(activeToken.id)}
                    >
                      удалить фишку
                    </button>
                  </div>
                ) : (
                  <p className="editor-empty">
                    Выбери фишку на карте или в списке, чтобы изменить её свойства.
                  </p>
                )}
              </article>
              <article className="info-card">
                <span className="eyebrow">Служебные отметки</span>
                <ul className="flat-list">
                  {activeSceneState.serviceMarkers.length > 0 ? (
                    activeSceneState.serviceMarkers.map((marker) => (
                      <li key={marker.id}>
                        <button
                          className="inline-link"
                          onClick={() => setSelectedServiceMarkerId(marker.id)}
                          type="button"
                        >
                          {marker.label}
                        </button>
                        <span>{marker.note || 'Без заметки'}</span>
                        <button
                          className="inline-link"
                          onClick={() => removeServiceMarker(marker.id)}
                          type="button"
                        >
                          удалить
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>Для этой сцены пока нет служебных отметок.</li>
                  )}
                </ul>
              </article>
            </div>
          ) : null}
        </section>
      </section>
      {isSceneEditorModalOpen ? (
        <>
          <div
            className="modal-backdrop scene-editor-modal-backdrop"
            onClick={() => setIsSceneEditorModalOpen(false)}
            role="presentation"
          />
          <aside
            aria-label="Редактор сцены"
            aria-modal
            className={`panel status-panel editor-panel scene-editor-panel scene-editor-panel-${activeEditorTab} is-modal-open ${linkedCheckPreviewEntry ? 'is-linked-check-preview' : ''
              }`}
            role="dialog"
          >
            <div className="panel-header scene-editor-panel-header">
              <div className="scene-editor-panel-header-copy">
                <span className="eyebrow">
                  {linkedCheckPreviewEntry ? 'Связанная проверка' : 'Редактор сцены'}
                </span>
                {!linkedCheckPreviewEntry ? (
                  <div className="scene-editor-panel-title-row">
                    <h2>
                      {activeEditorTab === 'scene'
                        ? activeScene.title
                        : activeEditorTab === 'splash'
                          ? 'Splash-экран сцены'
                          : activeEditorTab === 'checks'
                            ? 'Проверки и улики'
                            : editorTabLabels[activeEditorTab]}
                    </h2>
                    {activeEditorTab === 'scene' ? (
                      <button
                        aria-label="Удалить сцену"
                        className="ghost-button compact-button token-modal-icon-button scene-editor-delete-button"
                        data-tooltip="Удалить сцену"
                        onClick={() => removeScene(activeScene.id)}
                        type="button"
                      >
                        <i aria-hidden="true" className="fa-solid fa-trash" />
                      </button>
                    ) : null}
                    {activeEditorTab === 'handouts' ? (
                      <button
                        aria-label="Добавить раздатку"
                        className="ghost-button compact-button token-modal-icon-button"
                        data-tooltip="Добавить раздатку"
                        onClick={addHandout}
                        type="button"
                      >
                        <i aria-hidden="true" className="fa-solid fa-plus" />
                      </button>
                    ) : null}          {activeEditorTab === 'monsters' ? (
                      <span className="scene-editor-panel-title-actions">
                        <button
                          aria-label="Добавить монстра"
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Добавить монстра"
                          onClick={addMonsterBlock}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-plus" />
                        </button>
                        <button
                          aria-label="Импортировать монстра"
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Импортировать монстра"
                          onClick={triggerMonsterImport}
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-file-import" />
                        </button>
                      </span>
                    ) : null}
                    {activeEditorTab === 'audio' ? (
                      <span className="scene-editor-panel-title-actions">
                        <strong className="scene-editor-panel-title-meta">
                          {activeScene.recommendedAudio.length} треков в сцене
                        </strong>
                        <label
                          aria-label="Загрузить аудио"
                          className="ghost-button compact-button token-modal-icon-button scene-editor-title-add-button"
                          data-tooltip="Загрузить аудио"
                          title="Загрузить аудио"
                        >
                          <i aria-hidden="true" className="fa-solid fa-plus" />
                          <input
                            accept="audio/*"
                            className="visually-hidden"
                            onChange={(event) => {
                              void addAudioTrack(event.target.files?.[0] ?? null)
                              event.target.value = ''
                            }}
                            type="file"
                          />
                        </label>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                aria-label="Закрыть редактор сцены"
                className="ghost-button compact-button token-modal-icon-button"
                onClick={() => setIsSceneEditorModalOpen(false)}
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="editor-stack">
              <div className="tab-row" role="tablist" aria-label="Вкладки редактора">
                {(Object.entries(editorTabLabels) as Array<[EditorTab, string]>).map(([tabId, label]) => (
                  <button
                    key={tabId}
                    aria-selected={activeEditorTab === tabId}
                    className={`tab-button ${activeEditorTab === tabId ? 'active' : ''}`}
                    onClick={() => {
                      setLinkedCheckPreviewId(null)
                      setActiveEditorTab(tabId)
                    }}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {activeEditorTab === 'scene' || activeEditorTab === 'splash' ? (
                <>
                  <div className="scene-editor-fields-card">
                    <div className="section-row">
                      <span className="eyebrow">Поля сцены</span>
                    </div>
                    <label className="field">
                      <span>ID сцены</span>
                      <input
                        onChange={(event) => renameSceneId(event.target.value)}
                        value={activeScene.id}
                      />
                    </label>
                    <label className="field">
                      <span>Название</span>
                      <input
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            title: event.target.value,
                          }))
                        }
                        value={activeScene.title}
                      />
                    </label>
                    <label className="field">
                      <span>Локация</span>
                      <input
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            location: event.target.value,
                          }))
                        }
                        value={activeScene.location}
                      />
                    </label>
                    <label className="field">
                      <span>Акцент</span>
                      <StyledSelect
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            accent: event.target.value as SceneAccent,
                          }))
                        }
                        value={activeScene.accent}
                      >
                        {sceneAccentValues.map((accent) => (
                          <option
                            key={accent}
                            value={accent}
                          >
                            {sceneAccentLabels[accent]}
                          </option>
                        ))}
                      </StyledSelect>
                    </label>
                    <label className="field">
                      <span>Кратко для мастера</span>
                      <textarea
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            gmSummary: event.target.value,
                          }))
                        }
                        rows={3}
                        value={activeScene.gmSummary}
                      />
                    </label>
                    <label className="field">
                      <span>Заметки мастера</span>
                      <textarea
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            gmNotes: event.target.value,
                          }))
                        }
                        rows={5}
                        value={activeScene.gmNotes}
                      />
                    </label>
                    <label className="field">
                      <span>Цели, по одной на строку</span>
                      <textarea
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            objectives: splitLines(event.target.value),
                          }))
                        }
                        rows={4}
                        value={activeScene.objectives.join('\n')}
                      />
                    </label>
                  </div>
                  <div className="editor-card scene-editor-splash-card">
                    <div className="scene-editor-splash-preview">
                      {resolvedSceneSplashImage ? (
                        <img
                          alt="Splash preview"
                          src={resolvedSceneSplashImage}
                        />
                      ) : (
                        <span>Изображение не выбрано</span>
                      )}
                    </div>
                    <label className="field image-library-select-field">
                      <span>Изображение из библиотеки</span>
                      <StyledSelect
                        className="image-library-select"
                        onChange={(event) => {
                          if (event.target.value) {
                            applyLibraryImageToSplash(event.target.value)
                            return
                          }
                          clearSplashImage()
                        }}
                        value={activeScene.splash.imageAssetId ?? ''}
                      >
                        <option value="">не выбрано</option>
                        {imageAssets.map((asset) => (
                          <option
                            data-preview-src={asset.dataUrl}
                            data-preview-title={asset.title}
                            key={asset.id}
                            value={asset.id}
                          >
                            <span className="image-select-option">
                              <span className="image-select-option-title">{asset.title}</span>
                            </span>
                          </option>
                        ))}
                      </StyledSelect>
                      {imageAssets.length === 0 ? (
                        <p className="editor-empty">В библиотеке приключения пока нет изображений.</p>
                      ) : null}
                    </label>
                    <label className="field file-field">
                      <span>Загрузить изображение splash</span>
                      <span className="file-upload-row">
                        <span className="file-upload-control">
                          <span className="file-upload-button" aria-hidden="true">
                            <i className="fa-solid fa-plus" />
                          </span>
                          <span className="file-upload-name">
                            {getAssetFileLabel(imageAssets, activeScene.splash.imageAssetId, activeScene.splash.imageSrc)}
                          </span>
                        </span>
                        {resolvedSceneSplashImage ? (
                          <button
                            aria-label="Убрать изображение splash"
                            className="ghost-button compact-button token-modal-icon-button"
                            onClick={clearSplashImage}
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-trash" />
                          </button>
                        ) : null}
                      </span>
                      <input
                        accept="image/*"
                        className="visually-hidden"
                        onChange={(event) => {
                          void handleSplashImageUpload(event.target.files?.[0] ?? null)
                          event.target.value = ''
                        }}
                        type="file"
                      />
                    </label>
                    {resolvedSceneSplashImage ? (
                      <p className="editor-hint">Это изображение будет показано игрокам на весь экран.</p>
                    ) : (
                      <p className="editor-hint">Выбери или загрузи изображение для splash-экрана.</p>
                    )}
                  </div>
                  <div className="editor-card scene-editor-map-card" hidden style={{ display: 'none' }}>
                    <span className="eyebrow">Параметры карты</span>
                    <label className="field">
                      <span>ID карты</span>
                      <input
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            map: {
                              ...scene.map,
                              id: slugify(event.target.value, `${scene.id}-map`),
                            },
                          }))
                        }
                        value={activeScene.map.id}
                      />
                    </label>
                    <label className="field">
                      <span>Название карты</span>
                      <input
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            map: {
                              ...scene.map,
                              title: event.target.value,
                            },
                          }))
                        }
                        value={activeScene.map.title}
                      />
                    </label>
                    <label className="field">
                      <span>Источник из библиотеки</span>
                      <StyledSelect
                        onChange={(event) => {
                          if (event.target.value) {
                            applyLibraryImageToMap(event.target.value)
                          }
                        }}
                        value={activeScene.map.imageAssetId ?? ''}
                      >
                        <option value="">не выбран</option>
                        {imageAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.title}
                          </option>
                        ))}
                      </StyledSelect>
                    </label>
                    <label className="field">
                      <span>Текст заглушки</span>
                      <textarea
                        onChange={(event) =>
                          updateScene(activeScene.id, (scene) => ({
                            ...scene,
                            map: {
                              ...scene.map,
                              placeholder: event.target.value,
                            },
                          }))
                        }
                        rows={4}
                        value={activeScene.map.placeholder}
                      />
                    </label>
                    {resolvedSceneMapImage ? (
                      <p className="editor-hint">Карта сцены уже связана с библиотекой и может переиспользоваться в других сценах.</p>
                    ) : null}
                  </div>
                </>
              ) : null}
              {activeEditorTab === 'checks' ? (
                <ChecksEditorPanel
                  abilityOptions={checkAbilityOptions}
                  difficultyOptions={checkDifficultyOptions}
                  entries={activeScene.checksClues}
                  linkedPreviewEntry={linkedCheckPreviewEntry}
                  onAddEntry={addCheckClueEntry}
                  onRemoveEntry={removeCheckClueEntry}
                  onUpdateEntry={updateCheckClueEntry}
                />
              ) : null}
              {activeEditorTab === 'handouts' ? (
                <HandoutsEditorPanel
                  activeHandout={activeHandout}
                  handouts={activeScene.handouts}
                  imageAssets={imageAssets}
                  selectedHandoutId={selectedHandoutId}
                  onAddHandout={addHandout}
                  onApplyLibraryImageToHandout={applyLibraryImageToHandout}
                  onRemoveHandout={removeHandout}
                  onRenameHandoutId={renameHandoutId}
                  onSelectHandout={setSelectedHandoutId}
                  onUpdateHandout={updateHandout}
                  onUploadHandoutImage={handleHandoutImageUpload}
                />
              ) : null}
              {activeEditorTab === 'monsters' ? (
                <div className="editor-card">
                  <input
                    ref={monsterImportFileInputRef}
                    accept=".json,application/json"
                    className="visually-hidden"
                    onChange={(event) => {
                      void handleMonsterImport(event.target.files?.[0] ?? null)
                    }}
                    type="file"
                  />
                  <div className="section-row scene-editor-card-title-row">
                    <span className="eyebrow">Монстры и NPC</span>
                    <button
                      aria-label="Добавить монстра"
                      className="ghost-button compact-button token-modal-icon-button"
                      data-tooltip="Добавить монстра"
                      onClick={addMonsterBlock}
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-plus" />
                    </button>
                    <button
                      aria-label="Импортировать монстра"
                      className="ghost-button compact-button token-modal-icon-button"
                      data-tooltip="Импортировать монстра"
                      onClick={triggerMonsterImport}
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-file-import" />
                    </button>
                    <button
                      aria-label="Открыть бестиарий"
                      className="ghost-button compact-button token-modal-icon-button"
                      data-tooltip="Открыть бестиарий"
                      onClick={() => setIsBestiaryModalOpen(true)}
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-dragon" />
                    </button>
                  </div>
                  <div className="field monster-library-picker">
                    <span>Библиотека монстров</span>
                    <div className={`monster-library-dropdown ${isMonsterLibraryDropdownOpen ? 'is-open' : ''}`}>
                      <button
                        aria-expanded={isMonsterLibraryDropdownOpen}
                        aria-haspopup="listbox"
                        className="monster-library-trigger"
                        onClick={() => setIsMonsterLibraryDropdownOpen((isOpen) => !isOpen)}
                        type="button"
                      >
                        <span>
                          Выбрать монстра из библиотеки
                        </span>
                        <i aria-hidden="true" className="fa-solid fa-chevron-down" />
                      </button>
                      {isMonsterLibraryDropdownOpen ? (
                        <div className="monster-library-menu" role="listbox">
                          <label className="monster-library-search">
                            <i aria-hidden="true" className="fa-solid fa-magnifying-glass" />
                            <input
                              autoFocus
                              onChange={(event) => setMonsterLibrarySearch(event.target.value)}
                              placeholder="Поиск монстра"
                              value={monsterLibrarySearch}
                            />
                          </label>
                          <div className="monster-library-options">
                            <div className="monster-library-section-heading" role="presentation">
                              <span>Монстры приключения</span>
                            </div>
                            {adventureMonsters
                              .filter((monster) => {
                                const searchValue = monsterLibrarySearch.trim().toLocaleLowerCase('ru-RU')
                                if (!searchValue) {
                                  return true
                                }
                                return [monster.name, monster.subtitle, monster.source, monster.creatureType]
                                  .filter(Boolean)
                                  .some((value) => value.toLocaleLowerCase('ru-RU').includes(searchValue))
                              })
                              .map((monster) => {
                                const isMonsterInScene = activeSceneMonsterIds.has(monster.id)
                                return (
                                  <div className="monster-library-option-row" key={monster.id}>
                                    <button
                                      className="monster-library-option"
                                      onClick={() => addMonsterFromLibrary(monster.id)}
                                      role="option"
                                      type="button"
                                    >
                                      <span className="monster-library-option-name">{monster.name}</span>
                                      <span className="monster-library-option-meta">
                                        {[monster.subtitle || monster.source || 'Без описания', isMonsterInScene ? 'в сцене' : 'в приключении']
                                          .filter(Boolean)
                                          .join(' • ')}
                                      </span>
                                    </button>
                                    <button
                                      aria-label={
                                        isMonsterInScene
                                          ? `Убрать ${monster.name} из сцены`
                                          : `Удалить ${monster.name} из монстров приключения`
                                      }
                                      className="ghost-button compact-button token-modal-icon-button monster-library-delete-button"
                                      data-tooltip={isMonsterInScene ? 'Убрать из сцены' : 'Удалить из приключения'}
                                      onClick={() =>
                                        isMonsterInScene
                                          ? removeMonsterBlock(monster.id)
                                          : setPendingMonsterLibraryDeleteId(monster.id)
                                      }
                                      type="button"
                                    >
                                      <i
                                        aria-hidden="true"
                                        className={`fa-solid ${isMonsterInScene ? 'fa-link-slash' : 'fa-trash'}`}
                                      />
                                    </button>
                                  </div>
                                )
                              })}
                            {adventureMonsters.length === 0 ? (
                              <p className="editor-empty">В приключении пока нет монстров.</p>
                            ) : null}
                            {adventureMonsters.length > 0 &&
                              adventureMonsters.every((monster) => {
                                const searchValue = monsterLibrarySearch.trim().toLocaleLowerCase('ru-RU')
                                return (
                                  searchValue &&
                                  ![monster.name, monster.subtitle, monster.source, monster.creatureType]
                                    .filter(Boolean)
                                    .some((value) => value.toLocaleLowerCase('ru-RU').includes(searchValue))
                                )
                              }) ? (
                              <p className="editor-empty">В монстрах приключения нет совпадений.</p>
                            ) : null}
                            <div className="monster-library-section-heading" role="presentation">
                              <span>Бестиарий</span>
                            </div>
                            {builtInBestiary ? (
                              builtInBestiary
                                .filter((monster) => {
                                  if (adventureMonsters.some((adventureMonster) => adventureMonster.id === monster.id)) {
                                    return false
                                  }
                                  const searchValue = monsterLibrarySearch.trim().toLocaleLowerCase('ru-RU')
                                  if (!searchValue) {
                                    return true
                                  }
                                  return [monster.name, monster.subtitle, monster.source, monster.creatureType]
                                    .filter(Boolean)
                                    .some((value) => value.toLocaleLowerCase('ru-RU').includes(searchValue))
                                })
                                .slice(0, 80)
                                .map((monster) => (
                                  <div className="monster-library-option-row" key={`bestiary-${monster.id}`}>
                                    <button
                                      className="monster-library-option"
                                      onClick={() => void addMonsterSummaryFromBestiary(monster)}
                                      role="option"
                                      type="button"
                                    >
                                      <span className="monster-library-option-name">{monster.name}</span>
                                      <span className="monster-library-option-meta">
                                        {[monster.subtitle, monster.source, monster.challenge].filter(Boolean).join(' • ') || 'Бестиарий'}
                                      </span>
                                    </button>
                                  </div>
                                ))
                            ) : (
                              <p className="editor-empty">Загружаю бестиарий...</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="monster-list-spoiler">
                    <button
                      aria-expanded={!isMonsterListCollapsed}
                      className="monster-list-toggle"
                      onClick={() => setIsMonsterListCollapsed((isCollapsed) => !isCollapsed)}
                      type="button"
                    >
                      <span className="eyebrow">Список монстров</span>
                      <span className="monster-list-count">{sceneMonsters.length}</span>
                      <i
                        aria-hidden="true"
                        className={`fa-solid ${isMonsterListCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}
                      />
                    </button>
                    {!isMonsterListCollapsed ? (
                      <div className="monster-list">
                        {sceneMonsters.map((monster) => (
                          <div className={`monster-card ${monster.id === activeMonster?.id ? 'active' : ''}`} key={monster.id}>
                            <div className="monster-card-art" style={monster.imageSrc ? { backgroundImage: `url(${monster.imageSrc})` } : undefined}>{!monster.imageSrc ? <span>{monster.name.charAt(0).toUpperCase()}</span> : null}</div>
                            <button className="monster-card-trigger" onClick={() => selectMonsterForEditing(monster.id)} type="button">
                              <strong>{monster.name}</strong>
                              <span>{monster.subtitle}</span>
                              <span className="scene-card-summary">КД {monster.armorClass} • ХП {monster.hitPoints} • CR {monster.challenge || '?'}</span>
                            </button>
                            <div className="monster-card-actions">
                              <label className="monster-count-field monster-card-count-field"><span>Количество</span><input min="1" onChange={(event) => updateMonsterSpawnCount(monster.id, event.target.value, getMonsterSpawnCount(monster.id))} type="number" value={getMonsterSpawnCount(monster.id)} /></label>
                              <button
                                aria-label={getMonsterSpawnCount(monster.id) > 1 ? 'Создать группу врагов' : 'Создать токен из монстра'}
                                className="primary-button compact-button token-modal-icon-button monster-toolbar-button monster-token-button"
                                data-tooltip={getMonsterSpawnCount(monster.id) > 1 ? 'Создать группу врагов' : 'Создать токен'}
                                onClick={() => createTokensFromMonster(monster, getMonsterSpawnCount(monster.id))}
                                type="button"
                              >
                                <i aria-hidden="true" className="fa-solid fa-chess-pawn" />
                              </button>
                              <button
                                aria-label="Сохранить монстра в библиотеку приключения"
                                className="ghost-button compact-button token-modal-icon-button monster-toolbar-button monster-library-save-button"
                                data-tooltip="Сохранить в библиотеку приключения"
                                onClick={() => saveMonsterToLibrary(monster)}
                                type="button"
                              >
                                <i aria-hidden="true" className="fa-solid fa-bookmark" />
                              </button>
                              <button
                                aria-label="Убрать монстра из сцены"
                                className="ghost-button compact-button token-modal-icon-button scene-editor-delete-button monster-toolbar-button"
                                data-tooltip="Убрать из сцены"
                                onClick={() => removeMonsterBlock(monster.id)}
                                type="button"
                              >
                                <i aria-hidden="true" className="fa-solid fa-trash" />
                              </button>
                              <button
                                aria-expanded={!collapsedMonsterIds.includes(monster.id)}
                                aria-label={collapsedMonsterIds.includes(monster.id) ? 'Развернуть блок монстра' : 'Свернуть блок монстра'}
                                className="ghost-button compact-button token-modal-icon-button monster-card-collapse-button"
                                data-tooltip={collapsedMonsterIds.includes(monster.id) ? 'Развернуть' : 'Свернуть'}
                                onClick={() => toggleMonsterCollapsed(monster.id)}
                                type="button"
                              >
                                <i
                                  aria-hidden="true"
                                  className={`fa-solid ${collapsedMonsterIds.includes(monster.id) ? 'fa-chevron-down' : 'fa-chevron-up'}`}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {activeMonster ? (
                    <div className="monster-editor">
                      <div className="section-row monster-editor-toolbar">
                        <span className="eyebrow">Выбранный монстр</span>
                        <div className="action-row library-actions">
                          <label className="monster-count-field"><span>Количество</span><input min="1" onChange={(event) => updateMonsterSpawnCount(activeMonster.id, event.target.value, newMonsterSpawnCount)} type="number" value={newMonsterSpawnCount} /></label>
                          <button
                            aria-label={newMonsterSpawnCount > 1 ? 'Создать группу врагов' : 'Создать токен из монстра'}
                            className="primary-button compact-button token-modal-icon-button monster-toolbar-button monster-token-button"
                            data-tooltip={newMonsterSpawnCount > 1 ? 'Создать группу врагов' : 'Создать токен'}
                            onClick={() => createTokensFromMonster(activeMonster, newMonsterSpawnCount)}
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-chess-pawn" />
                          </button>
                          <button
                            aria-label="Убрать монстра из сцены"
                            className="ghost-button compact-button token-modal-icon-button scene-editor-delete-button monster-toolbar-button"
                            data-tooltip="Убрать из сцены"
                            onClick={() => removeMonsterBlock(activeMonster.id)}
                            type="button"
                          >
                            <i aria-hidden="true" className="fa-solid fa-trash" />
                          </button>
                          <button
                            aria-expanded={!isActiveMonsterCollapsed}
                            aria-label={isActiveMonsterCollapsed ? 'Развернуть блок' : 'Свернуть блок'}
                            className="ghost-button compact-button token-modal-icon-button monster-toolbar-button"
                            data-tooltip={isActiveMonsterCollapsed ? 'Развернуть блок' : 'Свернуть блок'}
                            onClick={() => toggleMonsterCollapsed(activeMonster.id)}
                            type="button"
                          >
                            <i aria-hidden="true" className={`fa-solid ${isActiveMonsterCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
                          </button>
                        </div>
                      </div>
                      {isActiveMonsterCollapsed ? (
                        <div className="monster-collapsed-card">
                          <strong>{activeMonster.name}</strong>
                          <span className="scene-card-summary">
                            КД {activeMonster.armorClass} • ХП {activeMonster.hitPoints} • CR {activeMonster.challenge || '?'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="monster-image-row">
                            <label className="monster-image-upload">
                              <span
                                className="monster-image-preview"
                                style={activeMonster.imageSrc ? { backgroundImage: `url(${activeMonster.imageSrc})` } : undefined}
                              >
                                {!activeMonster.imageSrc ? (
                                  <span className="monster-image-placeholder">
                                    {activeMonster.name.charAt(0).toUpperCase()}
                                  </span>
                                ) : null}
                                <span className="monster-image-upload-overlay">
                                  <i aria-hidden="true" className="fa-solid fa-upload" />
                                </span>
                              </span>
                              <input
                                accept="image/*"
                                className="visually-hidden"
                                onChange={(event) => {
                                  void handleMonsterImageUpload(activeMonster.id, event.target.files?.[0] ?? null)
                                  event.target.value = ''
                                }}
                                type="file"
                              />
                            </label>
                            <label className="field monster-image-library-field"><span>Картинка из библиотеки</span><StyledSelect onChange={(event) => { if (event.target.value) { applyLibraryImageToMonster(activeMonster.id, event.target.value) } }} value={activeMonster.imageAssetId ?? ""}><option value="">Не выбрано</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</StyledSelect></label>
                          </div>
                          <div className="monster-metadata-grid monster-id-name-grid">
                            <label className="field"><span>ID монстра</span><input onChange={(event) => renameMonsterId(activeMonster.id, event.target.value)} value={activeMonster.id} /></label>
                            <label className="field"><span>Имя</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, name: event.target.value }))} value={activeMonster.name} /></label>
                          </div>
                          <label className="field"><span>Краткое описание</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, subtitle: event.target.value }))} value={activeMonster.subtitle} /></label>
                          <div className="monster-metadata-grid monster-identity-grid">
                            <label className="field"><span>Источник</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, source: event.target.value }))} value={activeMonster.source} /></label>
                            <label className="field"><span>Размер</span><StyledSelect onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, size: event.target.value }))} value={activeMonster.size}><option value="">Не выбрано</option>{activeMonster.size && !monsterSizeOptions.includes(activeMonster.size as typeof monsterSizeOptions[number]) ? <option value={activeMonster.size}>{activeMonster.size}</option> : null}{monsterSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</StyledSelect></label>
                            <label className="field"><span>Тип</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, creatureType: event.target.value }))} value={activeMonster.creatureType} /></label>
                            <label className="field"><span>Мировоззрение</span><StyledSelect onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, alignment: event.target.value }))} value={activeMonster.alignment}><option value="">Не выбрано</option>{activeMonster.alignment && !monsterAlignmentOptions.includes(activeMonster.alignment as typeof monsterAlignmentOptions[number]) ? <option value={activeMonster.alignment}>{activeMonster.alignment}</option> : null}{monsterAlignmentOptions.filter(Boolean).map((alignment) => <option key={alignment} value={alignment}>{alignment}</option>)}</StyledSelect></label>
                            <label className="field"><span>БМ</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, proficiencyBonus: event.target.value }))} value={activeMonster.proficiencyBonus ?? ""} /></label>
                          </div>
                          <div className="monster-topline-grid">
                            <label className="field"><span>Класс доспеха</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, armorClass: event.target.value }))} value={activeMonster.armorClass} /></label>
                            <label className="field"><span>Хиты</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, hitPoints: event.target.value }))} value={activeMonster.hitPoints} /></label>
                            <label className="field"><span>Формула хитов</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, hitPointsFormula: event.target.value }))} value={activeMonster.hitPointsFormula} /></label>
                            <label className="field"><span>Скорость</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, speed: event.target.value }))} value={activeMonster.speed} /></label>
                            <label className="field"><span>Опасность</span><StyledSelect onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, challenge: event.target.value }))} value={activeMonster.challenge}><option value="">Не выбрано</option>{activeMonster.challenge && !monsterChallengeOptions.includes(activeMonster.challenge as typeof monsterChallengeOptions[number]) ? <option value={activeMonster.challenge}>{activeMonster.challenge}</option> : null}{monsterChallengeOptions.map((challenge) => <option key={challenge} value={challenge}>{challenge}</option>)}</StyledSelect></label>
                          </div>
                          <div className="monster-abilities-grid">
                            <label className="field"><span>СИЛ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'strength', event.target.value)} value={activeMonster.strength} /></label>
                            <label className="field"><span>ЛОВ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'dexterity', event.target.value)} value={activeMonster.dexterity} /></label>
                            <label className="field"><span>ТЕЛ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'constitution', event.target.value)} value={activeMonster.constitution} /></label>
                            <label className="field"><span>ИНТ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'intelligence', event.target.value)} value={activeMonster.intelligence} /></label>
                            <label className="field"><span>МДР</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'wisdom', event.target.value)} value={activeMonster.wisdom} /></label>
                            <label className="field"><span>ХАР</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'charisma', event.target.value)} value={activeMonster.charisma} /></label>
                          </div>
                          <label className="field"><span>Спасброски</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, savingThrows: event.target.value }))} value={activeMonster.savingThrows} /></label>
                          <label className="field"><span>Навыки</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, skills: event.target.value }))} value={activeMonster.skills} /></label>
                          <div className="monster-metadata-grid">
                            <label className="field"><span>Уязвимости к урону</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, damageVulnerabilities: event.target.value }))} value={activeMonster.damageVulnerabilities} /></label>
                            <label className="field"><span>Сопротивления урону</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, damageResistances: event.target.value }))} value={activeMonster.damageResistances} /></label>
                            <label className="field"><span>Иммунитеты к урону</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, damageImmunities: event.target.value }))} value={activeMonster.damageImmunities} /></label>
                            <label className="field"><span>Иммунитеты к состояниям</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, conditionImmunities: event.target.value }))} value={activeMonster.conditionImmunities} /></label>
                          </div>
                          <label className="field"><span>Чувства</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, senses: event.target.value }))} value={activeMonster.senses} /></label>
                          <label className="field"><span>Языки</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, languages: event.target.value }))} value={activeMonster.languages} /></label>
                          {renderMonsterFeatureSection(activeMonster, "traits", "Черты", "черту")}
                          {renderMonsterFeatureSection(activeMonster, "actions", "Действия", "действие")}
                          {renderMonsterFeatureSection(activeMonster, "bonusActions", "Бонусные действия", "бонусное действие")}
                          {renderMonsterFeatureSection(activeMonster, "reactions", "Реакции", "реакцию")}
                          {renderMonsterFeatureSection(activeMonster, "legendaryActions", "Легендарные действия", "легендарное действие")}
                          <label className="field"><span>Заметки мастера</span><textarea onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, notes: event.target.value }))} rows={4} value={activeMonster.notes} /></label>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="editor-empty monster-editor-empty">Монстр пока не выбран. Нажми на карточку, чтобы открыть его блок.</p>
                  )}
                </div>
              ) : null}
              {pendingMonsterLibraryDeleteId
                ? (() => {
                  const monsterToDelete = adventureMonsters.find(
                    (monster) => monster.id === pendingMonsterLibraryDeleteId,
                  )
                  if (!monsterToDelete) {
                    return null
                  }
                  return (
                    <div
                      className="modal-backdrop monster-library-confirm-backdrop"
                      onClick={() => setPendingMonsterLibraryDeleteId(null)}
                      role="presentation"
                    >
                      <div
                        aria-label="Подтверждение удаления монстра из библиотеки"
                        aria-modal="true"
                        className="modal-dialog monster-library-confirm-modal"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                      >
                        <div className="modal-header">
                          <div className="control-group-copy">
                            <span className="eyebrow">Библиотека монстров</span>
                            <p className="editor-hint">
                              Удалить монстра <strong>{monsterToDelete.name}</strong> из библиотеки?
                            </p>
                          </div>
                        </div>
                        <div className="action-row monster-library-confirm-actions">
                          <button
                            className="ghost-button compact-button"
                            onClick={() => setPendingMonsterLibraryDeleteId(null)}
                            type="button"
                          >
                            Нет
                          </button>
                          <button
                            className="primary-button compact-button"
                            onClick={() => removeMonsterFromLibrary(monsterToDelete.id)}
                            type="button"
                          >
                            Да, удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()
                : null}
              {activeEditorTab === 'audio' ? (
                <AudioEditorPanel
                  activeTrack={activeAudioTrack}
                  audioAssets={audioAssets}
                  audioLoop={audioLoop}
                  audioTracks={adventure.audioLibrary}
                  audioVolume={audioVolume}
                  recommendedAudioIds={activeScene.recommendedAudio}
                  onApplyLibraryAudioToTrack={applyLibraryAudioToTrack}
                  onPauseAudioPlayback={pauseAudioPlayback}
                  onPlayAudioTrack={playAudioTrack}
                  onRemoveAudioTrack={removeAudioTrack}
                  onSelectAudioTrack={setSelectedAudioId}
                  onSetAudioLoop={setAudioLoop}
                  onSetAudioVolume={setAudioVolume}
                  onStopAudioPlayback={stopAudioPlayback}
                  onToggleSceneAudioRecommendation={toggleSceneAudioRecommendation}
                  onUpdateAudioTrack={updateAudioTrack}
                />
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
      {isProjectReconnectModalOpen && (projectDirectoryHandle || rememberedProjectDirectoryName) ? (
        <ProjectReconnectModal
          directoryHandle={projectDirectoryHandle}
          isPending={isProjectReconnectPending}
          rememberedDirectoryName={rememberedProjectDirectoryName}
          onClose={() => setIsProjectReconnectModalOpen(false)}
          onOpenProjectFolder={() => handleOpenProjectFolder(true)}
          onReconnectRememberedDirectory={handleReconnectRememberedProjectDirectory}
        />
      ) : null}
      {isMapParamsModalOpen && activeScene ? (
        <MapParamsModal
          hasResolvedSceneMapImage={Boolean(resolvedSceneMapImage)}
          imageAssets={imageAssets}
          scene={activeScene}
          onApplyLibraryImage={applyLibraryImageToMap}
          onChangeMapId={(value) =>
            updateScene(activeScene.id, (scene) => ({
              ...scene,
              map: {
                ...scene.map,
                id: slugify(value, `${scene.id}-map`),
              },
            }))
          }
          onChangeMapPlaceholder={(value) =>
            updateScene(activeScene.id, (scene) => ({
              ...scene,
              map: {
                ...scene.map,
                placeholder: value,
              },
            }))
          }
          onChangeMapTitle={(value) =>
            updateScene(activeScene.id, (scene) => ({
              ...scene,
              map: {
                ...scene.map,
                title: value,
              },
            }))
          }
          onClose={() => setIsMapParamsModalOpen(false)}
        />
      ) : null}
      {isMapGridModalOpen && activeSceneState ? (
        <MapGridModal
          mapGrid={activeMapGrid}
          onClose={() => setIsMapGridModalOpen(false)}
          onUpdateMapGrid={updateMapGrid}
        />
      ) : null}
      {isMapLayersModalOpen && activeSceneState ? (
        <MapLayersModal
          activeLayer={activeLayer ?? null}
          baseLayerId={activeSceneState.mapLayers[0]?.id ?? null}
          layerImageInputRef={layerImageInputRef}
          layers={activeSceneState.mapLayers}
          onAddLayer={addEmptyMapLayer}
          onClose={() => setIsMapLayersModalOpen(false)}
          onRemoveLayer={removeMapLayer}
          onReplaceLayerImage={handleLayerImageReplace}
          onSetActiveLayer={setActiveSceneMapLayer}
          onUpdateLayer={updateActiveSceneMapLayer}
        />
      ) : null}
      {isZoneModalOpen && activeZone && activeScene ? (
        <ZoneModal
          activeScene={activeScene}
          monsters={sceneMonsters}
          zone={activeZone}
          onClose={() => setIsZoneModalOpen(false)}
          onRemoveZone={removeZone}
          onUpdateZone={updateZone}
        />
      ) : null}
      {isTokenModalOpen && activeToken ? (
        <TokenModal
          activeScene={activeScene}
          characters={adventure.characters}
          linkedCharacter={activeTokenLinkedCharacter}
          linkedMonster={activeTokenLinkedMonster}
          monsters={sceneMonsters}
          token={activeToken}
          onClose={() => setIsTokenModalOpen(false)}
          onFocusLinkedCharacter={focusTokenLinkedCharacter}
          onFocusLinkedMonster={focusTokenLinkedMonster}
          onRemoveToken={removeToken}
          onReplaceTokenImage={handleTokenImageReplace}
          onUpdateToken={updateToken}
        />
      ) : null}
      {isServiceMarkerModalOpen && activeServiceMarker && activeScene ? (
        <ServiceMarkerModal
          activeScene={activeScene}
          marker={activeServiceMarker}
          onClose={() => setIsServiceMarkerModalOpen(false)}
          onRemoveMarker={removeServiceMarker}
          onUpdateMarker={updateServiceMarker}
        />
      ) : null}
      {pendingCharacterDeleteId
        ? (() => {
          const characterToDelete = adventure.characters.find(
            (character) => character.id === pendingCharacterDeleteId,
          )
          if (!characterToDelete) {
            return null
          }
          return (
            <div
              className="modal-backdrop monster-library-confirm-backdrop"
              onClick={() => setPendingCharacterDeleteId(null)}
              role="presentation"
            >
              <div
                aria-label="Подтверждение удаления персонажа"
                aria-modal="true"
                className="modal-dialog monster-library-confirm-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="modal-header">
                  <div className="control-group-copy">
                    <span className="eyebrow">Персонажи</span>
                    <p className="editor-hint">
                      Удалить персонажа <strong>{characterToDelete.name}</strong> из приключения?
                    </p>
                  </div>
                </div>
                <div className="action-row monster-library-confirm-actions">
                  <button
                    className="ghost-button compact-button"
                    onClick={() => setPendingCharacterDeleteId(null)}
                    type="button"
                  >
                    Нет
                  </button>
                  <button
                    className="primary-button compact-button"
                    onClick={() => removeCharacter(characterToDelete.id)}
                    type="button"
                  >
                    Да, удалить
                  </button>
                </div>
              </div>
            </div>
          )
        })()
        : null}
      {isCharacterModalOpen && activeCharacter ? (
        <Suspense fallback={<LibraryLoadingModal error={null} label="Карточка персонажа" onClose={() => setIsCharacterModalOpen(false)} />}>
          {builtInSpellLibrary ? (
            <CharacterModal
              character={activeCharacter}
              onClose={() => setIsCharacterModalOpen(false)}
              spellLibrary={builtInSpellLibrary}
            />
          ) : (
            <LibraryLoadingModal
              error={spellLibraryLoadError}
              label="Библиотека заклинаний"
              onClose={() => setIsCharacterModalOpen(false)}
            />
          )}
        </Suspense>
      ) : null}
      {isSpellLibraryModalOpen ? (
        <Suspense fallback={<LibraryLoadingModal error={null} label="Библиотека заклинаний" onClose={() => setIsSpellLibraryModalOpen(false)} />}>
          {builtInSpellLibrary ? (
            <SpellLibraryModal
              onClose={() => setIsSpellLibraryModalOpen(false)}
              spells={builtInSpellLibrary}
            />
          ) : (
            <LibraryLoadingModal
              error={spellLibraryLoadError}
              label="Библиотека заклинаний"
              onClose={() => setIsSpellLibraryModalOpen(false)}
            />
          )}
        </Suspense>
      ) : null}
      {isBestiaryModalOpen ? (
        <Suspense fallback={<LibraryLoadingModal error={null} label="Бестиарий" onClose={() => setIsBestiaryModalOpen(false)} />}>
          {builtInBestiary ? (
            <BestiaryModal
              loadMonsterDetail={loadBuiltInMonsterDetail}
              monsters={builtInBestiary}
              onAddMonsterToScene={adventure ? addMonsterFromBestiary : undefined}
              onClose={() => setIsBestiaryModalOpen(false)}
            />
          ) : (
            <LibraryLoadingModal
              error={bestiaryLoadError}
              label="Бестиарий"
              onClose={() => setIsBestiaryModalOpen(false)}
            />
          )}
        </Suspense>
      ) : null}
    </main>
  )
}
