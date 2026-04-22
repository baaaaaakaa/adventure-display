import {







  startTransition,







  useEffect,







  useRef,







  useState,







  type PointerEvent as ReactPointerEvent,







} from 'react'







import { sampleAdventure } from '../../data/sampleAdventure'







import {







  createInitialProjectState,







  createInitialSessionState,







  getActiveAdventureBundle,







  loadProjectState,







  playerDisplayChannelName,







  saveProjectState,







  syncProjectState,







} from '../../lib/playerDisplay'







import { sceneAccentLabels, sceneAccentValues } from '../../types/adventure'







import type {







  Adventure,







  AdventureScene,







  AssetKind,







  AssetRecord,







  AudioTrack,







  AudioTrackKind,







  Handout,







  CheckClueEntry,







  MapLayerInstance,







  MapZone,







  MapViewport,







  MonsterBlock,







  MonsterFeature,







  ProjectState,







  SceneAccent,







  SceneSplash,







  SceneRuntimeState,







  SessionState,







  ServiceMarker,







  TokenInstance,







  TokenKind,







} from '../../types/adventure'















const playerWindowFeatures = [







  'popup=yes',







  'width=1500',







  'height=920',







  'left=80',







  'top=60',







].join(',')















type EditorTab = 'scene' | 'handouts' | 'checks' | 'monsters' | 'audio'







type MapInteractionMode =







  | 'navigate'







  | 'marker'







  | 'token'







  | 'zone'







  | 'fog-draw'







  | 'fog-erase'







  | 'fog-area-draw'







  | 'fog-area-erase'







type ProjectSnapshotEntry = {







  id: string







  label: string







  timestamp: string







  state: ProjectState







}







type FogSelectionRect = {







  left: number







  top: number







  width: number







  height: number







}















const fogGridColumns = 24







const fogGridRows = 16







const minMapScale = 0.5







const maxMapScale = 2.5







const mapScaleStep = 0.25







const projectHistoryLimit = 40







const projectSnapshotLimit = 18















const editorTabLabels: Record<EditorTab, string> = {







  scene: 'Сцена',







  handouts: 'Раздатки',







  checks: 'Проверки',







  monsters: 'Монстры',







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







) {







  const { normalizedX, normalizedY } = getNormalizedMapBoardPosition(







    board,







    clientX,







    clientY,







    viewport,







  )







  const column = Math.floor(normalizedX * fogGridColumns)







  const row = Math.floor(normalizedY * fogGridRows)















  return `${column}:${row}`







}















function getFogCellIdsForPercentBounds(







  leftPercent: number,







  topPercent: number,







  rightPercent: number,







  bottomPercent: number,







) {







  const minX = Math.max(0, Math.min(leftPercent, rightPercent))







  const maxX = Math.min(100, Math.max(leftPercent, rightPercent))







  const minY = Math.max(0, Math.min(topPercent, bottomPercent))







  const maxY = Math.min(100, Math.max(topPercent, bottomPercent))







  const startColumn = Math.max(0, Math.floor((minX / 100) * fogGridColumns))







  const endColumn = Math.min(







    fogGridColumns - 1,







    Math.floor((Math.max(minX, maxX - 0.0001) / 100) * fogGridColumns),







  )







  const startRow = Math.max(0, Math.floor((minY / 100) * fogGridRows))







  const endRow = Math.min(







    fogGridRows - 1,







    Math.floor((Math.max(minY, maxY - 0.0001) / 100) * fogGridRows),







  )







  const cellIds: string[] = []















  for (let row = startRow; row <= endRow; row += 1) {







    for (let column = startColumn; column <= endColumn; column += 1) {







      cellIds.push(`${column}:${row}`)







    }







  }















  return cellIds







}















function getFogCellIdsForZone(zone: MapZone) {







  return getFogCellIdsForPercentBounds(







    zone.x - zone.width / 2,







    zone.y - zone.height / 2,







    zone.x + zone.width / 2,







    zone.y + zone.height / 2,







  )







}















function getFogCellStyle(cellId: string) {







  const [columnRaw, rowRaw] = cellId.split(':')







  const column = Number(columnRaw)







  const row = Number(rowRaw)















  return {







    left: `${(column / fogGridColumns) * 100}%`,







    top: `${(row / fogGridRows) * 100}%`,







    width: `${100 / fogGridColumns}%`,







    height: `${100 / fogGridRows}%`,







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







  }







}















function clampMapScale(value: number) {







  return Math.min(maxMapScale, Math.max(minMapScale, value))







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















function parseHitPointsValue(value: string) {







  const match = value.match(/\d+/)















  if (!match) {







    return null







  }















  const parsed = Number(match[0])







  return Number.isFinite(parsed) ? parsed : null







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















const bundledDeathHouseImportPath = '/adventures/dom-smerti-import-working.json'















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















function projectStatesEqual(left: ProjectState, right: ProjectState) {







  return JSON.stringify(left) === JSON.stringify(right)







}















function cloneProjectState(state: ProjectState): ProjectState {







  return JSON.parse(JSON.stringify(state)) as ProjectState







}















function createProjectSnapshot(







  state: ProjectState,







  label: string,







): ProjectSnapshotEntry {







  return {







    id: createEntityId('snapshot'),







    label,







    timestamp: new Date().toISOString(),







    state: cloneProjectState(state),







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















function createProjectExportPackage(project: ProjectState) {







  return {







    kind: 'adventure-display-project',







    version: 1,







    exportedAt: new Date().toISOString(),







    project,







  }







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







            `У ассета "${titleValue}" некорректный С‚ип "${kindValue}".`,







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







          throw new Error(`Аудио‚ре #${index + 1} должен быть объектом.`)







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







            caption: readRequiredString(







              handoutEntry,







              'caption',







              `Подпись раздатки "${handoutTitle}"`,







            ),







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







              `РС‚Р•Р– для с‚роки проверки/улики "${ability}"`,







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







            `РРя монстра #${monsterIndex + 1} в сцене "${titleValue}"`,







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







            subtitle: readRequiredString(







              monsterEntry,







              'subtitle',







              `Подзаголовок монстра "${monsterName}"`,







            ),







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















  return syncProjectState({







    activeAdventureId: nextActiveAdventureId,







    adventureOrder: nextAdventureOrder,







    adventures: nextAdventures,







    sessions: nextSessions,







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







  'Рн‚еллек‚',







  'Мудрость',







  'Харизма',







  'Атлетика',







  'Акробатика',







  'Ловкость рук',







  'Скрытность',







  'Магия',







  'Рс‚ория',







  'Анализ',







  'Природа',







  'Религия',







  'Уход за живо‚н‹ми',







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







  'Спасбросок Рн‚еллек‚а',







  'Спасбросок Мудрости',







  'Спасбросок Харизмы',







  'Рнс‚румен‚С‹ вора',







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















const tokenKindLabels: Record<TokenKind, string> = {







  player: 'Ргрок',







  monster: 'Монстр',







  npc: 'NPC',







}















const audioKindLabels: Record<AudioTrackKind, string> = {







  music: 'Музыка',







  ambience: 'Атмосфера',







  sfx: 'Эффект',







}















function createDefaultMonsterBlock(): MonsterBlock {







  return {







    id: createEntityId('monster'),







    name: 'Новый монстр',







    subtitle: 'Краткое описание, тип и мировоззрение',







    imageSrc: null,







    armorClass: '10',







    hitPoints: '11 (2d8 + 2)',







    speed: '30 фт.',







    strength: 10,







    dexterity: 10,







    constitution: 10,







    intelligence: 10,







    wisdom: 10,







    charisma: 10,







    savingThrows: '',







    skills: '',







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















function createFallbackMonsterImage(name: string) {







  const label = (name.trim()[0] ?? 'М').toUpperCase()







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







  const [projectState, setProjectState] = useState<ProjectState>(() =>







    loadProjectState(createInitialProjectState(sampleAdventure)),







  )







  const [projectSnapshots, setProjectSnapshots] = useState<ProjectSnapshotEntry[]>(() => {







    const initialState = loadProjectState(createInitialProjectState(sampleAdventure))







    return [createProjectSnapshot(initialState, 'Старт проекта')]







  })







  const [undoStack, setUndoStack] = useState<ProjectState[]>([])







  const [redoStack, setRedoStack] = useState<ProjectState[]>([])







  const [activeSceneId, setActiveSceneId] = useState(







    () => sampleAdventure.scenes[0]?.id ?? '',







  )







  const [selectedHandoutId, setSelectedHandoutId] = useState<string | null>(null)







  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null)







  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null)







  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)







  const [selectedServiceMarkerId, setSelectedServiceMarkerId] = useState<string | null>(null)







  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)







  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)







  const [collapsedMonsterIds, setCollapsedMonsterIds] = useState<string[]>([])

  const [isLiveToolsCollapsed, setIsLiveToolsCollapsed] = useState(false)







  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)







  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('scene')







  const [mapInteractionMode, setMapInteractionMode] =







    useState<MapInteractionMode>('navigate')







  const [newLayerTitle, setNewLayerTitle] = useState('')
  const [isServiceMarkerModalOpen, setIsServiceMarkerModalOpen] = useState(false)
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)







  const [newServiceMarkerLabel] = useState('Служебная метка')







  const [newServiceMarkerNote, setNewServiceMarkerNote] = useState('')







  const [newTokenName, setNewTokenName] = useState('')







  const [newTokenKind, setNewTokenKind] = useState<TokenKind>('monster')







  const [newTokenCount, setNewTokenCount] = useState(1)







  const [newTokenFile, setNewTokenFile] = useState<File | null>(null)







  const [newMonsterSpawnCount, setNewMonsterSpawnCount] = useState(1)







  const [newAssetKind, setNewAssetKind] = useState<AssetKind>('image')







  const [newAssetTitle, setNewAssetTitle] = useState('')







  const [newAudioTitle, setNewAudioTitle] = useState('')







  const [newAudioKind, setNewAudioKind] = useState<AudioTrackKind>('music')







  const [audioVolume, setAudioVolume] = useState(70)







  const [audioLoop, setAudioLoop] = useState(false)







  const [isAudioPlaying, setIsAudioPlaying] = useState(false)







  const [isMapPanning, setIsMapPanning] = useState(false)







  const [fogSelectionRect, setFogSelectionRect] = useState<FogSelectionRect | null>(null)







  const [importFeedback, setImportFeedback] = useState<{







    tone: 'success' | 'error'







    text: string







  } | null>(null)







  const mapBoardRef = useRef<HTMLDivElement | null>(null)







  const audioRef = useRef<HTMLAudioElement | null>(null)







  const importFileInputRef = useRef<HTMLInputElement | null>(null)







  const projectImportFileInputRef = useRef<HTMLInputElement | null>(null)







  const channelRef = useBroadcastChannel()







  const projectStateRef = useRef(projectState)







  const activeSceneStateRef = useRef<SceneRuntimeState | null>(null)















  const activeBundle = getActiveAdventureBundle(projectState)







  const activeAdventureId = activeBundle?.adventureId ?? null







  const adventure = activeBundle?.adventure ?? null







  const sessionState = activeBundle?.session ?? null







  const resolvedActiveSceneId =







    adventure?.scenes.some((scene) => scene.id === activeSceneId)







      ? activeSceneId







      : (adventure?.scenes[0]?.id ?? '')















  useEffect(() => {







    projectStateRef.current = projectState







  }, [projectState])















  useEffect(() => {







    saveProjectState(projectState)







    channelRef.current?.postMessage(projectState)







  }, [channelRef, projectState])















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







  const resolvedSelectedHandoutId = activeScene?.handouts.some(







    (handout) => handout.id === selectedHandoutId,







  )







    ? selectedHandoutId







    : (activeScene?.handouts[0]?.id ?? null)







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







  const resolvedSelectedCheckId = activeScene?.checksClues.some(







    (entry) => entry.id === selectedCheckId,







  )







    ? selectedCheckId







    : (activeScene?.checksClues[0]?.id ?? null)







  const activeCheckClue =







    activeScene?.checksClues.find((entry) => entry.id === resolvedSelectedCheckId) ?? null







  const resolvedSelectedMonsterId = activeScene?.monsterBlocks.some(







    (monster) => monster.id === selectedMonsterId,







  )







    ? selectedMonsterId







    : (activeScene?.monsterBlocks[0]?.id ?? null)







  const activeMonster =







    activeScene?.monsterBlocks.find(







      (monster) => monster.id === resolvedSelectedMonsterId,







    ) ?? null







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







  const currentPlayerSplash = currentPlayerScene?.splash ?? null







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







    activeToken?.linkedMonsterId && activeScene







      ? activeScene.monsterBlocks.find((monster) => monster.id === activeToken.linkedMonsterId) ?? null







      : null







  const activeLayer =







    activeSceneState?.mapLayers.find((layer) => layer.id === selectedLayerId) ??







    activeSceneState?.mapLayers[0] ??







    null







  const activeServiceMarker =







    activeSceneState?.serviceMarkers.find(







      (marker) => marker.id === selectedServiceMarkerId,







    ) ?? null







  const activeZone =







    activeScene?.zones.find((zone) => zone.id === selectedZoneId) ??







    activeScene?.zones[0] ??







    null







  const activeZoneLinkedHandout =







    activeZone?.linkedHandoutId && activeScene







      ? activeScene.handouts.find((handout) => handout.id === activeZone.linkedHandoutId) ?? null







      : null







  const activeZoneLinkedCheck =







    activeZone?.linkedCheckId && activeScene







      ? activeScene.checksClues.find((entry) => entry.id === activeZone.linkedCheckId) ?? null







      : null







  const activeZoneLinkedMonster =







    activeZone?.linkedMonsterId && activeScene







      ? activeScene.monsterBlocks.find((monster) => monster.id === activeZone.linkedMonsterId) ?? null







      : null







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







  const gmVisibleLayers =







    activeSceneState?.mapLayers.filter(







      (layer) => layer.visibleToGm && layer.imageSrc,







    ) ?? []







  const recentProjectSnapshots = [...projectSnapshots].reverse().slice(0, 6)







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















    setSelectedTokenId((currentId) => {







      if (currentId && activeSceneState.tokens.some((token) => token.id === currentId)) {







        return currentId







      }















      return activeSceneState.tokens[0]?.id ?? null







    })















    setSelectedLayerId((currentId) => {







      if (currentId && activeSceneState.mapLayers.some((layer) => layer.id === currentId)) {







        return currentId







      }















      return activeSceneState.mapLayers[0]?.id ?? null







    })















    setSelectedServiceMarkerId((currentId) => {







      if (







        currentId &&







        activeSceneState.serviceMarkers.some((marker) => marker.id === currentId)







      ) {







        return currentId







      }















      return activeSceneState.serviceMarkers[0]?.id ?? null







    })







  }, [activeSceneState])















  useEffect(() => {







    if (!activeScene) {







      return







    }















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







      setFogSelectionRect(null)







    }







  }, [fogSelectionRect, mapInteractionMode])















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







  }, [redoStack.length, undoStack.length])















  function commitProjectState(







    nextStateOrUpdater: ProjectState | ((currentState: ProjectState) => ProjectState),







    options?: {







      label?: string







      recordHistory?: boolean







      resetRedo?: boolean







    },







  ) {







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







          createProjectSnapshot(nextState, options?.label ?? 'Изменение проекта'),







        ])







      }















      if (options?.resetRedo ?? true) {







        setRedoStack([])







      }















      return nextState







    })







  }















  function updateProjectState(







    updater: (currentState: ProjectState) => ProjectState,







    label = 'Изменение проекта',







  ) {







    commitProjectState(updater, { label })







  }















  function undoLastChange() {







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







  }















  function redoLastChange() {







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







  }















  function restoreProjectSnapshot(snapshotId: string) {







    const targetSnapshot = projectSnapshots.find((snapshot) => snapshot.id === snapshotId)















    if (!targetSnapshot) {







      return







    }















    commitProjectState(cloneProjectState(targetSnapshot.state), {







      label: `Восстановлен снимок: ${targetSnapshot.label}`,







    })







  }















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







    if (!file || !adventure) {







      return null







    }















    const asset = await createAssetRecordFromFile(file, kind, title)















    updateAdventure((currentAdventure) => ({







      ...currentAdventure,







      assetLibrary: [...currentAdventure.assetLibrary, asset],







    }), `Добавлен ассет: ${asset.title}`)















    return asset







  }















  function updateSession(







    updater: (session: SessionState) => SessionState,







    label = 'Рзмене сос‚ояние сессии',







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







    label = 'Рзмене сос‚ояние сцены',







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















  function updateMapViewport(







    updater: (viewport: MapViewport) => MapViewport,







  ) {







    if (!activeScene) {







      return







    }















    updateSceneRuntimeState(activeScene.id, (sceneState) => ({







      ...sceneState,







      mapViewport: updater(sceneState.mapViewport),







    }))







  }















  function zoomMap(delta: number) {







    updateMapViewport((viewport) => ({







      ...viewport,







      scale: clampMapScale(Number((viewport.scale + delta).toFixed(2))),







    }))







  }















  function resetMapViewport() {







    updateMapViewport(() => ({







      scale: 1,







      offsetX: 0,







      offsetY: 0,







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







    label = 'Рзменена сцена',







  ) {







    updateAdventure((currentAdventure) => ({







      ...currentAdventure,







      scenes: currentAdventure.scenes.map((scene) =>







        scene.id === sceneId ? updater(scene) : scene,







      ),







    }), label)







  }















  function createDefaultZone(x: number, y: number): MapZone {







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







      width: 18,







      height: 14,







      visibleToPlayers: false,







      autoRevealOnEnter: false,







    }







  }















  function addZoneAt(clientX: number, clientY: number) {







    if (!activeScene || !mapBoardRef.current) {







      return







    }















    const { x, y } = resolveMapBoardPosition(







      mapBoardRef.current,







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















  function updateZone(zoneId: string, updater: (zone: MapZone) => MapZone) {







    if (!activeScene) {







      return







    }















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      zones: scene.zones.map((zone) => (zone.id === zoneId ? updater(zone) : zone)),







    }))







  }















  function removeZone(zoneId: string) {







    if (!activeScene) {







      return







    }















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      zones: scene.zones.filter((zone) => zone.id !== zoneId),







    }))







    setSelectedZoneId((currentId) => (currentId === zoneId ? null : currentId))







  }















  function moveZone(zoneId: string, clientX: number, clientY: number) {







    const mapBoard = mapBoardRef.current















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







      x,







      y,







    }))







  }















  function beginZoneDrag(







    zoneId: string,







    event: ReactPointerEvent<HTMLButtonElement>,







  ) {







    if (mapInteractionMode !== 'navigate') {







      return







    }















    event.preventDefault()







    event.stopPropagation()







    setSelectedZoneId(zoneId)







    moveZone(zoneId, event.clientX, event.clientY)















    const handleMove = (moveEvent: PointerEvent) => {







      moveZone(zoneId, moveEvent.clientX, moveEvent.clientY)







    }















    const handleUp = () => {







      window.removeEventListener('pointermove', handleMove)







      window.removeEventListener('pointerup', handleUp)







    }















    window.addEventListener('pointermove', handleMove)







    window.addEventListener('pointerup', handleUp)







  }















  function pushMapToPlayer(scene: AdventureScene) {







    updateSession((currentSession) => ({







      ...currentSession,







      playerDisplay: {







        ...currentSession.playerDisplay,







        sceneId: scene.id,







        mode: 'map',







        activeHandoutId: null,







        updatedAt: new Date().toISOString(),







      },







    }), `Ргрока показана карта: ${scene.title}`)







  }















  function pushSplashToPlayer(scene: AdventureScene) {







    updateSession((currentSession) => ({







      ...currentSession,







      playerDisplay: {







        ...currentSession.playerDisplay,







        sceneId: scene.id,







        mode: 'splash',







        activeHandoutId: null,







        updatedAt: new Date().toISOString(),







      },







    }), `Ргрока показан splash: ${scene.title}`)







  }















  function pushHandoutToPlayer(scene: AdventureScene, handout: Handout) {







    updateSession((currentSession) => ({







      ...currentSession,







      playerDisplay: {







        ...currentSession.playerDisplay,







        sceneId: scene.id,







        mode: 'handout',







        activeHandoutId: handout.id,







        updatedAt: new Date().toISOString(),







      },







    }), `Ргрока показана раздатка: ${handout.title}`)







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















    setSelectedHandoutId(handout.id)







    pushHandoutToPlayer(scene, handout)







  }















  function focusZoneLinkedHandout(zone: MapZone) {







    if (!zone.linkedHandoutId) {







      return







    }















    setSelectedHandoutId(zone.linkedHandoutId)







    setActiveEditorTab('handouts')







  }















  function showZoneLinkedHandoutToPlayers(zone: MapZone) {







    if (!activeScene || !zone.linkedHandoutId) {







      return







    }















    const linkedHandout = activeScene.handouts.find(







      (handout) => handout.id === zone.linkedHandoutId,







    )















    if (!linkedHandout) {







      return







    }















    setSelectedHandoutId(linkedHandout.id)







    pushHandoutToPlayer(activeScene, linkedHandout)







  }















  function focusZoneLinkedCheck(zone: MapZone) {







    if (!zone.linkedCheckId) {







      return







    }















    setSelectedCheckId(zone.linkedCheckId)







    setActiveEditorTab('checks')







  }















  function focusZoneLinkedMonster(zone: MapZone) {







    if (!zone.linkedMonsterId) {







      return







    }















    setSelectedMonsterId(zone.linkedMonsterId)







    setActiveEditorTab('monsters')







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







  }















  async function handleMapUpload(file: File | null) {







    if (!file || !activeScene) {







      return







    }















    const asset = await addAssetToAdventure(file, 'image', activeScene.map.title)















    if (!asset) {







      return







    }















    const imageSrc = asset.dataUrl







    const nextBaseLayer = createBaseMapLayer(activeScene, imageSrc)















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      map: {







        ...scene.map,







        imageAssetId: asset.id,







        imageSrc,







      },







    }))















    updateSceneRuntimeState(activeScene.id, (sceneState) => ({







      ...sceneState,







      mapImageSrc: imageSrc,







      mapLayers: [nextBaseLayer, ...sceneState.mapLayers.slice(1)],







    }))







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















    const asset = await addAssetToAdventure(file, 'image', activeScene.splash.title)















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















  async function handleAdditionalLayerUpload(file: File | null) {







    if (!file || !activeScene) {







      return







    }















    const asset = await addAssetToAdventure(







      file,







      'image',







      newLayerTitle.trim() || file.name.replace(/\.[^.]+$/, '') || 'Слой',







    )















    if (!asset) {







      return







    }















    const imageSrc = asset.dataUrl







    const fallbackTitle = file.name.replace(/\.[^.]+$/, '') || 'Слой'







    const title = newLayerTitle.trim() || fallbackTitle







    const layer: MapLayerInstance = {







      id: createEntityId('layer'),







      title,







      imageSrc,







      visibleToGm: true,







      visibleToPlayers: false,







    }















    updateSceneRuntimeState(activeScene.id, (sceneState) => ({







      ...sceneState,







      mapLayers: [...sceneState.mapLayers, layer],







    }))















    setNewLayerTitle('')







    setSelectedLayerId(layer.id)







  }















  async function handleCreateToken() {







    if (!activeScene || !newTokenName.trim() || !newTokenFile) {







      return







    }















    const imageSrc = await readFileAsDataUrl(newTokenFile)







    const baseName = newTokenName.trim()







    const count = clampSpawnCount(newTokenCount)







    const tokens = buildTokenCopies(







      (index) =>







        createSceneToken(







          count > 1 ? `${baseName} ${index + 1}` : baseName,







          newTokenKind,







          imageSrc,







          null,







          null,







          null,







          null,







          count > 1 ? baseName : null,







        ),







      count,







    )















    pushTokensToScene(







      tokens,







      count > 1 ? `Добавлена группа фишек: ${baseName}` : `Добавлена фишка: ${baseName}`,







    )















    setNewTokenName('')







    setNewTokenKind('monster')







    setNewTokenCount(1)







    setNewTokenFile(null)







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







      groupLabel,







      imageSrc,







      x: 50,







      y: 50,







      size: kind === 'monster' ? 72 : 64,







      rotation: 0,







      hiddenFromPlayers: false,







      hitPointsCurrent,







      hitPointsMax,







      initiative,







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







    pushTokensToScene([token], `Добавлена С„РёС€ка: ${token.name}`)







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







        : `Добавлена С„РёС€ка монстра: ${monster.name}`,







    )







  }















  function focusTokenLinkedMonster(token: TokenInstance) {







    if (!token.linkedMonsterId) {







      return







    }















    setSelectedMonsterId(token.linkedMonsterId)







    setActiveEditorTab('monsters')







  }















  function syncTokenStatsFromMonster(token: TokenInstance) {







    if (!token.linkedMonsterId || !activeScene) {







      return







    }















    const linkedMonster = activeScene.monsterBlocks.find(







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
    if (!activeScene || !mapBoardRef.current) {
      return
    }

    const { x, y } = resolveMapBoardPosition(
      mapBoardRef.current,
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







    if (!activeScene || !mapBoardRef.current) {







      return







    }















    const { x, y } = resolveMapBoardPosition(







      mapBoardRef.current,







      clientX,







      clientY,







      activeMapViewport,







    )







    const marker: ServiceMarker = {







      id: createEntityId('marker'),







      label: newServiceMarkerLabel.trim() || 'Служебная отметка',







      note: newServiceMarkerNote.trim(),







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







    const mapBoard = mapBoardRef.current















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







    event: ReactPointerEvent<HTMLButtonElement>,







  ) {







    if (mapInteractionMode !== 'navigate') {







      return







    }















    event.preventDefault()







    event.stopPropagation()







    setSelectedServiceMarkerId(markerId)







    moveServiceMarker(markerId, event.clientX, event.clientY)















    const handleMove = (moveEvent: PointerEvent) => {







      moveServiceMarker(markerId, moveEvent.clientX, moveEvent.clientY)







    }















    const handleUp = () => {







      window.removeEventListener('pointermove', handleMove)







      window.removeEventListener('pointerup', handleUp)







    }















    window.addEventListener('pointermove', handleMove)







    window.addEventListener('pointerup', handleUp)







  }















  function applyFogCellByPointer(clientX: number, clientY: number, mode: 'fog-draw' | 'fog-erase') {







    if (!activeScene || !mapBoardRef.current) {







      return







    }















    const cellId = getFogCellId(







      mapBoardRef.current,







      clientX,







      clientY,







      activeMapViewport,







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







    applyFogCells(







      getFogCellIdsForZone(zone),







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







      new Set(visibleZones.flatMap((zone) => getFogCellIdsForZone(zone))),







    )















    applyFogCells(







      cellIds,







      mode,







      mode === 'fog-draw'







        ? 'Скрыты все видимые зоны'







        : 'Открыты все видимые зоны',







    )







  }















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







    if (!activeScene || !mapBoardRef.current) {







      return







    }















    event.preventDefault()















    const board = mapBoardRef.current







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







    const mapBoard = mapBoardRef.current















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







    const autoRevealZones = activeScene.zones.filter(







      (zone) =>







        zone.autoRevealOnEnter &&







        isPointInsideZone(x, y, zone) &&







        getFogCellIdsForZone(zone).some((cellId) => currentFogCells.includes(cellId)),







    )







    const fogToReveal = new Set(autoRevealZones.flatMap((zone) => getFogCellIdsForZone(zone)))















    if (fogToReveal.size > 0 && activeSceneStateRef.current) {







      activeSceneStateRef.current = {







        ...activeSceneStateRef.current,







        fogCells: activeSceneStateRef.current.fogCells.filter(







          (cellId) => !fogToReveal.has(cellId),







        ),







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







        }







      },







      autoRevealZones.length > 0







        ? `Автооткрыта зона: ${autoRevealZones.map((zone) => zone.title).join(', ')}`







        : 'Перемещена С„РёС€ка',







    )







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







    moveToken(tokenId, event.clientX, event.clientY)















    const handleMove = (moveEvent: PointerEvent) => {







      moveToken(tokenId, moveEvent.clientX, moveEvent.clientY)







    }















    const handleUp = () => {







      window.removeEventListener('pointermove', handleMove)







      window.removeEventListener('pointerup', handleUp)







    }















    window.addEventListener('pointermove', handleMove)







    window.addEventListener('pointerup', handleUp)







  }















  function beginMapPan(event: ReactPointerEvent<HTMLDivElement>) {







    if (!activeScene) {







      return







    }















    event.preventDefault()







    setIsMapPanning(true)















    const startX = event.clientX







    const startY = event.clientY







    const startViewport = activeMapViewport















    const handleMove = (moveEvent: PointerEvent) => {







      updateMapViewport(() => ({







        ...startViewport,







        offsetX: startViewport.offsetX + (moveEvent.clientX - startX),







        offsetY: startViewport.offsetY + (moveEvent.clientY - startY),







      }))







    }















    const handleUp = () => {







      setIsMapPanning(false)







      window.removeEventListener('pointermove', handleMove)







      window.removeEventListener('pointerup', handleUp)







    }















    window.addEventListener('pointermove', handleMove)







    window.addEventListener('pointerup', handleUp)







  }















  function handleMapBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {







    if (!activeScene) {







      return







    }















    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest('.service-marker, .token, .map-overlay-button, .map-title-badge, .modal-backdrop, .modal-card')
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







      addZoneAt(event.clientX, event.clientY)







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







    setIsMapPanning(false)







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







    setSelectedCheckId(null)







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







    setSelectedCheckId(null)







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







    setSelectedCheckId(null)







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







    setSelectedCheckId(null)







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







      setSelectedCheckId(null)







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















    const rawText = await file.text()







    const parsed = JSON.parse(rawText) as unknown







    commitImportedAdventure(parsed)







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







        label: 'Рмпор‚ирова проект',







      })







      setActiveSceneId(nextAdventure?.scenes[0]?.id ?? '')







      setSelectedHandoutId(null)







      setSelectedCheckId(null)







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







            : 'Не удалось импор‚ирова‚ь проект. Проверь JSON-файл Рё попробуй ещё раз.',







      })







    }







  }















  async function handleProjectImport(file: File | null) {







    if (!file) {







      return







    }















    const rawText = await file.text()







    const parsed = JSON.parse(rawText) as unknown







    commitImportedProject(parsed)







  }















  async function handleBundledAdventureImport() {







    setImportFeedback(null)















    try {







      const response = await fetch(bundledDeathHouseImportPath)















      if (!response.ok) {







        throw new Error('Не удалось загрузить встроенный импорт приключения.')







      }















      const parsed = (await response.json()) as unknown







      commitImportedAdventure(parsed)







    } catch (error) {







      setImportFeedback({







        tone: 'error',







        text:







          error instanceof Error







            ? error.message







            : 'Не удалось загрузить встроенное приключение.',







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







      caption: 'Р аздатка',







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















    if (sessionState?.playerDisplay.activeHandoutId === handoutId) {







      setStandby()







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















    setSelectedCheckId(nextEntry.id)







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















    setSelectedCheckId((currentEntryId) =>







      currentEntryId === entryId ? null : currentEntryId,







    )







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







    if (!activeScene) {







      return







    }















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      monsterBlocks: scene.monsterBlocks.map((monster) =>







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















  function addMonsterBlock() {







    if (!activeScene) {







      return







    }















    const monsterBlock = createDefaultMonsterBlock()















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      monsterBlocks: [...scene.monsterBlocks, monsterBlock],







    }), 'Добавлен блок монстра')















    setSelectedMonsterId(monsterBlock.id)







    setCollapsedMonsterIds((currentIds) =>







      currentIds.filter((id) => id !== monsterBlock.id),







    )







  }















  function removeMonsterBlock(monsterId: string) {







    if (!activeScene) {







      return







    }















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      monsterBlocks: scene.monsterBlocks.filter((monster) => monster.id !== monsterId),







      zones: scene.zones.map((zone) =>







        zone.linkedMonsterId === monsterId







          ? { ...zone, linkedMonsterId: null }







          : zone,







      ),







    }), 'Удален блок монстра')







    updateSceneRuntimeState(activeScene.id, (sceneState) => ({







      ...sceneState,







      tokens: sceneState.tokens.map((token) =>







        token.linkedMonsterId === monsterId







          ? { ...token, linkedMonsterId: null }







          : token,







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







    if (!activeScene) {







      return







    }















    const existingIds = activeScene.monsterBlocks







      .filter((monster) => monster.id !== monsterId)







      .map((monster) => monster.id)







    const nextId = createUniqueCollectionId(nextIdRaw, existingIds, monsterId)















    if (nextId === monsterId) {







      return







    }















    updateScene(activeScene.id, (scene) => ({







      ...scene,







      monsterBlocks: scene.monsterBlocks.map((monster) =>







        monster.id === monsterId ? { ...monster, id: nextId } : monster,







      ),







      zones: scene.zones.map((zone) =>







        zone.linkedMonsterId === monsterId







          ? { ...zone, linkedMonsterId: nextId }







          : zone,







      ),







    }))







    updateSceneRuntimeState(activeScene.id, (sceneState) => ({







      ...sceneState,







      tokens: sceneState.tokens.map((token) =>







        token.linkedMonsterId === monsterId







          ? { ...token, linkedMonsterId: nextId }







          : token,







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







            className="ghost-button compact-button"







            onClick={() => addMonsterFeature(monster.id, section, buttonLabel)}







            type="button"







          >







            Добавить {buttonLabel}







          </button>







        </div>















        {features.length > 0 ? (







          <div className="monster-feature-list">







            {features.map((feature) => (







              <div className="monster-feature-card" key={feature.id}>







                <div className="section-row">







                  <strong>{feature.title}</strong>







                  <button







                    className="inline-link"







                    onClick={() => removeMonsterFeature(monster.id, section, feature.id)}







                    type="button"







                  >







                    удалить







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







                    rows={3}







                    value={feature.body}







                  />







                </label>







              </div>







            ))}







          </div>







        ) : (







          <p className="editor-empty">Р’ этом разделе пока нет записе№.</p>







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















    const title = newAudioTitle.trim() || file.name.replace(/\.[^/.]+$/, '')







    const asset = await addAssetToAdventure(file, 'audio', title)















    if (!asset) {







      return







    }















    const track: AudioTrack = {







      id: createEntityId('audio'),







      title,







      kind: newAudioKind,







      assetId: asset.id,







      src: asset.dataUrl,







    }















    updateAdventure((currentAdventure) => ({







      ...currentAdventure,







      audioLibrary: [...currentAdventure.audioLibrary, track],







    }))















    setSelectedAudioId(track.id)







    setNewAudioTitle('')







    setNewAudioKind('music')







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







    const resolvedSrc = track







      ? getAssetDataUrl(adventure.assetLibrary, track.assetId, track.src)







      : null















    if (!resolvedSrc || !audioRef.current) {







      return







    }















    if (audioRef.current.src !== resolvedSrc) {







      audioRef.current.src = resolvedSrc







    }















    try {







      await audioRef.current.play()







      setSelectedAudioId(trackId)







      setIsAudioPlaying(true)







    } catch {







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







      <aside className="panel scene-panel">







        <div className="panel-header">







          <span className="eyebrow">Приключение</span>







          <h1>{adventure.title}</h1>







          <p>{adventure.subtitle}</p>







        </div>















        <div className="editor-stack">







          <div className="editor-card">







            <div className="section-row">







              <span className="eyebrow">Библиотека приключений</span>







              <div className="action-row library-actions">







                <button







                  className="ghost-button compact-button"







                  onClick={() => triggerProjectDownload(projectState)}







                  type="button"







                >







                  Экспортировать проект







                </button>







                <button className="ghost-button compact-button" onClick={triggerProjectImport} type="button">







                  Импортировать проект







                </button>







                <button className="ghost-button compact-button" onClick={triggerAdventureImport} type="button">







                  Импортировать приключение







                </button>







                <button className="ghost-button compact-button" onClick={() => void handleBundledAdventureImport()} type="button">







                  Загрузить Дом смерти







                </button>







                <button className="ghost-button compact-button" onClick={addAdventure} type="button">







                  Новое приключение







                </button>







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















            {importFeedback ? (







              <p className={`feedback-message feedback-${importFeedback.tone}`}>







                {importFeedback.text}







              </p>







            ) : null}















            <div className="adventure-list">
              {projectState.adventureOrder.map((adventureId) => {
                const listedAdventure = projectState.adventures[adventureId]

                if (!listedAdventure) {
                  return null
                }

                return (
                  <button
                    key={adventureId}
                    className={`adventure-card ${adventureId === activeAdventureId ? 'active' : ''}`}
                    onClick={() => switchAdventure(adventureId)}
                    type="button"
                  >
                    <span className="scene-card-location">{listedAdventure.id}</span>
                    <strong>{listedAdventure.title}</strong>
                    <span className="scene-card-summary">{listedAdventure.scenes.length} сцен</span>
                  </button>
                )
              })}
            </div>

            {adventure ? (
              <div className="info-card">
                <div className="section-row">
                  <span className="eyebrow">Сцены</span>
                  <button className="ghost-button compact-button" onClick={addScene} type="button">
                    Р”обави‚ь сцену
                  </button>
                </div>
                <div className="scene-list">
                  {adventure.scenes.map((scene, index) => (
                    <button
                      key={scene.id}
                      className={`scene-card ${scene.id === activeScene?.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveSceneId(scene.id)
                        setActiveEditorTab('scene')
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
            ) : null}
          </div>







        </div>







      </aside>















<section className="panel control-panel">







        <section className="map-board-shell">
          <div className="control-toolbar" role="toolbar" aria-label="Быстрые де№с‚вия сцены">
            <button
              className="toolbar-button toolbar-button-primary"
              onClick={() => pushSplashToPlayer(activeScene)}
              type="button"
              title="Показать splash-экран"
              aria-label="Показать splash-экран"
            >
              <span aria-hidden="true">✦</span>
            </button>
            <button
              className="toolbar-button toolbar-button-primary"
              onClick={() => pushMapToPlayer(activeScene)}
              type="button"
              title="Показать карту игрокам"
              aria-label="Показать карту игрокам"
            >
              <span aria-hidden="true">⌖</span>
            </button>
            <button
              className="toolbar-button toolbar-button-primary"
              disabled={!getQuickSceneHandout(activeScene)}
              onClick={() => pushQuickSceneHandout(activeScene)}
              type="button"
              title="Показать связанную раздатку"
              aria-label="Показать связанную раздатку"
            >
              <i className="fa-solid fa-note-sticky" aria-hidden="true" />
            </button>
            <button
              className="toolbar-button"
              onClick={openPlayerWindow}
              type="button"
              title="Открыть окно игроков"
              aria-label="Открыть окно игроков"
            >
              <i className="fa-solid fa-up-right-from-square" aria-hidden="true" />
            </button>
            <button
              className="toolbar-button"
              onClick={setStandby}
              type="button"
              title="Пауза"
              aria-label="Пауза"
            >
              <span aria-hidden="true">⏸</span>
            </button>
            <button
              className="toolbar-button"
              disabled={undoStack.length === 0}
              onClick={undoLastChange}
              type="button"
              title="Отменить"
              aria-label="Отменить"
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true" />
            </button>
            <button
              className="toolbar-button"
              disabled={redoStack.length === 0}
              onClick={redoLastChange}
              type="button"
              title="Вернуть"
              aria-label="Вернуть"
            >
              <i className="fa-solid fa-rotate-right" aria-hidden="true" />
            </button>
          </div>
          <section className="map-board-section">
          <div







            ref={mapBoardRef}







            className={`map-board accent-${activeScene.accent} ${gmVisibleLayers.length > 0 ? 'with-image' : ''} interaction-${mapInteractionMode} ${isMapPanning ? 'is-panning' : ''}`}







            onPointerDown={handleMapBoardPointerDown}







          >







            <div







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







                    style={{ backgroundImage: layer.imageSrc ? `url(${layer.imageSrc})` : undefined }}







                  />







                ))}







              </div>















              <div className="map-grid-overlay" />















              {activeScene.zones.map((zone) => (







                <button







                  key={zone.id}







                  className={`map-zone ${zone.id === activeZone?.id ? 'active' : ''} ${zone.visibleToPlayers ? 'player-visible' : ''}`}







                  onClick={(event) => {







                    event.stopPropagation()







                    setSelectedZoneId(zone.id)







                    setActiveEditorTab('scene')







                  }}







                  onPointerDown={(event) => beginZoneDrag(zone.id, event)}







                  style={{







                    left: `${zone.x}%`,







                    top: `${zone.y}%`,







                    width: `${zone.width}%`,







                    height: `${zone.height}%`,







                  }}







                  title={zone.note || zone.title}







                  type="button"







                >







                  <span>{zone.title}</span>







                </button>







              ))}















              <div className="fog-layer fog-layer-gm">







                {activeSceneState.fogCells.map((cellId) => (







                  <div







                    key={cellId}







                    className="fog-cell"







                    style={getFogCellStyle(cellId)}







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















              {orderedTokens.map((token) => (







                <button







                  key={token.id}







                  className={`token token-${token.kind} ${token.hiddenFromPlayers ? 'is-hidden' : ''} ${token.id === activeToken?.id ? 'active' : ''} ${token.id === activeInitiativeToken?.id ? 'active-turn' : ''}`}







                  onClick={(event) => {







                    event.stopPropagation()







                    setSelectedTokenId(token.id)
                    setIsTokenModalOpen(true)







                    setActiveInitiativeToken(token.id)







                    if (token.linkedMonsterId) {







                      setSelectedMonsterId(token.linkedMonsterId)







                      setActiveEditorTab('monsters')







                    }







                  }}







                  onPointerDown={(event) => beginTokenDrag(token.id, event)}







                  style={{







                    left: `${token.x}%`,







                    top: `${token.y}%`,







                    width: `${token.size}px`,







                    height: `${token.size}px`,







                    backgroundImage: `url(${token.imageSrc})`,







                    transform: `translate(-50%, -50%) rotate(${token.rotation}deg)`,







                    zIndex: token.zIndex,







                  }}







                  title={token.name}







                  type="button"







                >







                  <span>{token.name}</span>







                </button>







              ))}















              {orderedServiceMarkers.map((marker) => (







                <button







                  key={marker.id}







                  className={`service-marker ${marker.id === activeServiceMarker?.id ? 'active' : ''}`}







                  onClick={(event) => {







                    event.stopPropagation()







                    setSelectedServiceMarkerId(marker.id)
                    setIsServiceMarkerModalOpen(true)







                  }}







                  onPointerDown={(event) => {
                    event.stopPropagation()
                    beginServiceMarkerDrag(marker.id, event)
                  }}







                  style={{ left: `${marker.x}%`, top: `${marker.y}%`, zIndex: marker.zIndex }}







                  data-tooltip={marker.note || marker.label}
                  aria-label={marker.note ? `${marker.label}: ${marker.note}` : marker.label}







                  type="button"







                >







                  <span className="service-marker-icon" aria-hidden="true">✦</span>







                </button>







              ))}

              </div>

            <div
              className="map-utility-panel"
              aria-label={'Служебные слои'}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="map-overlay-group">
                <button className="map-overlay-button" onClick={() => zoomMap(-mapScaleStep)} type="button" data-tooltip={'Умень€РёС‚ь масштаб'} aria-label={'Умень€РёС‚ь масштаб'}>
                  <span aria-hidden="true">{'в€’'}</span>
                </button>
                <button className="map-overlay-button" onClick={resetMapViewport} type="button" data-tooltip={`${'Сбросить вид'} (${Math.round(activeMapViewport.scale * 100)}%)`} aria-label={'Сбросить вид'}>
                  <span aria-hidden="true">{'◎'}</span>
                </button>
                <button className="map-overlay-button" onClick={() => zoomMap(mapScaleStep)} type="button" data-tooltip={'Увели‡РёС‚ь масштаб'} aria-label={'Увели‡РёС‚ь масштаб'}>
                  <span aria-hidden="true">+</span>
                </button>
              </div>
              <div className="map-overlay-group">
                <button className={`map-overlay-button ${mapInteractionMode === 'navigate' ? 'active' : ''}`} onClick={() => setMapInteractionMode('navigate')} type="button" data-tooltip={'Навигация'} aria-label={'Навигация'}>
                  <span aria-hidden="true">{'✥'}</span>
                </button>
                <button className={`map-overlay-button ${mapInteractionMode === 'marker' ? 'active' : ''}`} onClick={() => setMapInteractionMode('marker')} type="button" data-tooltip={'Ставить метки'} aria-label={'Ставить метки'}>
                  <span aria-hidden="true">{'⌖'}</span>
                </button>
                <button className={`map-overlay-button ${mapInteractionMode === 'token' ? 'active' : ''}`} onClick={() => setMapInteractionMode('token')} type="button" data-tooltip={'Ставить фишки'} aria-label={'Ставить фишки'}>
                  <span aria-hidden="true">{'?'}</span>
                </button>
                <button className={`map-overlay-button ${mapInteractionMode === 'zone' ? 'active' : ''}`} onClick={() => setMapInteractionMode('zone')} type="button" data-tooltip={'Ставить зоны'} aria-label={'Ставить зоны'}>
                  <span aria-hidden="true">{'▭'}</span>
                </button>
              </div>
              <div className="map-overlay-group">
                <button className={`map-overlay-button ${mapInteractionMode === 'fog-draw' ? 'active' : ''}`} onClick={() => setMapInteractionMode('fog-draw')} type="button" data-tooltip={'Рисовать туман'} aria-label={'Рисовать туман'}>
                  <span aria-hidden="true">{'◼'}</span>
                </button>
                <button className={`map-overlay-button ${mapInteractionMode === 'fog-erase' ? 'active' : ''}`} onClick={() => setMapInteractionMode('fog-erase')} type="button" data-tooltip={'Стирать туман'} aria-label={'Стирать туман'}>
                  <span aria-hidden="true">{'◻'}</span>
                </button>
                <button className={`map-overlay-button ${mapInteractionMode === 'fog-area-erase' ? 'active' : ''}`} onClick={() => setMapInteractionMode('fog-area-erase')} type="button" data-tooltip={'Открыть область'} aria-label={'Открыть область'}>
                  <span aria-hidden="true">{'⬒'}</span>
                </button>
                <button className={`map-overlay-button ${mapInteractionMode === 'fog-area-draw' ? 'active' : ''}`} onClick={() => setMapInteractionMode('fog-area-draw')} type="button" data-tooltip={'Скрыть область'} aria-label={'Скрыть область'}>
                  <span aria-hidden="true">{'⬓'}</span>
                </button>
              </div>
              <div className="map-overlay-group">
                <button className="map-overlay-button" disabled={!activeScene?.zones.some((zone) => zone.visibleToPlayers)} onClick={() => applyFogToVisibleZones('fog-erase')} type="button" data-tooltip={'Открыть видимые зоны'} aria-label={'Открыть видимые зоны'}>
                  <i className="fa-solid fa-eye" aria-hidden="true" />
                </button>
                <button className="map-overlay-button" disabled={!activeScene?.zones.some((zone) => zone.visibleToPlayers)} onClick={() => applyFogToVisibleZones('fog-draw')} type="button" data-tooltip={'Скрыть видимые зоны'} aria-label={'Скрыть видимые зоны'}>
                  <i className="fa-solid fa-eye-slash" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="map-title-badge" aria-hidden="true">
              {activeScene.map.title}
            </div>







          </div>
          </section>
        </section>

        <div className="control-content-section">
          <section className="control-group control-group-prep">
            <div className="control-group-header">
              <div className="control-group-copy">
                <span className="eyebrow">Карта Рё подготовка</span>
                <p className="editor-hint">
                  Управляй слоями, масштабом, туманом войны Рё базов‹ми объек‚ами сцены.
                </p>
              </div>
            </div>
        <div className="utility-grid">







            <label className="upload-card">







              <span className="eyebrow">Загрузка карты</span>







              <strong>Р—амени‚ь изображение карты сцены</strong>







              <input







                accept="image/*"







                onChange={(event) =>







                  void handleMapUpload(event.target.files?.[0] ?? null)







                }







                type="file"







              />







            </label>















            <div className="info-card map-utility-legacy-card">







              <span className="eyebrow">Слои карты</span>







              <label className="field">







                <span>Название нового слоя</span>







                <input







                  onChange={(event) => setNewLayerTitle(event.target.value)}







                  placeholder="Например, ловушки или подземный уровень"







                  value={newLayerTitle}







                />







              </label>







              <label className="field">







                <span>Файл слоя</span>







                <input







                  accept="image/*"







                  onChange={(event) =>







                    void handleAdditionalLayerUpload(event.target.files?.[0] ?? null)







                  }







                  type="file"







                />







              </label>







              <div className="layer-list">







                {activeSceneState.mapLayers.map((layer, index) => (







                  <div







                    className={`layer-row ${layer.id === activeLayer?.id ? 'active' : ''}`}







                    key={layer.id}







                    onClick={() => setSelectedLayerId(layer.id)}







                  >







                    <div>







                      <strong>{layer.title}</strong>







                      <span className="scene-card-summary">







                        {index === 0 ? 'Базовый слой' : 'Дополнительный слой'}







                      </span>







                    </div>







                    <div className="layer-controls">







                      <button







                        className={`ghost-button compact-button ${layer.visibleToGm ? 'is-active' : ''}`}







                        onClick={() =>







                          updateActiveSceneMapLayer(layer.id, (currentLayer) => ({







                            ...currentLayer,







                            visibleToGm: !currentLayer.visibleToGm,







                          }))







                        }







                        type="button"







                      >







                        Мастер







                      </button>







                      <button







                        className={`ghost-button compact-button ${layer.visibleToPlayers ? 'is-active' : ''}`}







                        onClick={() =>







                          updateActiveSceneMapLayer(layer.id, (currentLayer) => ({







                            ...currentLayer,







                            visibleToPlayers: !currentLayer.visibleToPlayers,







                          }))







                        }







                        type="button"







                      >







                        Ргроки






                      </button>







                      {index > 0 ? (







                        <button







                          className="inline-link"







                          onClick={() => removeMapLayer(layer.id)}







                          type="button"







                        >







                          удалить







                        </button>







                      ) : null}







                    </div>







                  </div>







                ))}







              </div>







              {activeLayer ? (







                <div className="editor-card">







                  <div className="section-row">







                    <span className="eyebrow">Выбранный слой</span>







                    {activeLayer.id !== activeSceneState.mapLayers[0]?.id ? (







                      <button







                        className="inline-link"







                        onClick={() => removeMapLayer(activeLayer.id)}







                        type="button"







                      >







                        удали‚ь слой







                      </button>







                    ) : null}







                  </div>







                  <label className="field">







                    <span>Название слоя</span>







                    <input







                      onChange={(event) =>







                        updateActiveSceneMapLayer(activeLayer.id, (layer) => ({







                          ...layer,







                          title: event.target.value,







                        }))







                      }







                      value={activeLayer.title}







                    />







                  </label>







                  <label className="field">







                    <span>Рзображение слоя</span>






                    <input







                      accept="image/*"







                      onChange={(event) =>







                        void handleLayerImageReplace(







                          activeLayer.id,







                          event.target.files?.[0] ?? null,







                        )







                      }







                      type="file"







                    />







                  </label>







                  <div className="layer-controls">







                    <button







                      className={`ghost-button compact-button ${activeLayer.visibleToGm ? 'is-active' : ''}`}







                      onClick={() =>







                        updateActiveSceneMapLayer(activeLayer.id, (layer) => ({







                          ...layer,







                          visibleToGm: !layer.visibleToGm,







                        }))







                      }







                      type="button"







                    >







                      Р’идно мастеру







                    </button>







                    <button







                      className={`ghost-button compact-button ${activeLayer.visibleToPlayers ? 'is-active' : ''}`}







                      onClick={() =>







                        updateActiveSceneMapLayer(activeLayer.id, (layer) => ({







                          ...layer,







                          visibleToPlayers: !layer.visibleToPlayers,







                        }))







                      }







                      type="button"







                    >







                      Видно игрокам







                    </button>







                  </div>







                </div>







              ) : null}







            </div>















            <div className="info-card">







              <span className="eyebrow">Служебные слои</span>







              <div className="map-viewport-toolbar">







                <button







                  className="ghost-button compact-button"







                  onClick={() => zoomMap(-mapScaleStep)}







                  type="button"







                >







                  - Масштаб







                </button>







                <button







                  className="ghost-button compact-button"







                  onClick={resetMapViewport}







                  type="button"







                >







                  {Math.round(activeMapViewport.scale * 100)}% · Сбросить







                </button>







                <button







                  className="ghost-button compact-button"







                  onClick={() => zoomMap(mapScaleStep)}







                  type="button"







                >







                  + Масштаб







                </button>







              </div>







              <div className="map-tool-grid">







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'navigate' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('navigate')}







                  type="button"







                >







                  Навигация







                </button>







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'marker' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('marker')}







                  type="button"







                >







                  Ставить метки







                </button>







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'zone' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('zone')}







                  type="button"







                >







                  С‚ави‚ь зоны







                </button>







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'fog-draw' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('fog-draw')}







                  type="button"







                >







                  Рисова‚ь туман







                </button>







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'fog-erase' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('fog-erase')}







                  type="button"







                >







                  С‚ира‚ь туман







                </button>







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'fog-area-erase' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('fog-area-erase')}







                  type="button"







                >







                  Открыть область







                </button>







                <button







                  className={`ghost-button compact-button ${mapInteractionMode === 'fog-area-draw' ? 'is-active' : ''}`}







                  onClick={() => setMapInteractionMode('fog-area-draw')}







                  type="button"







                >







                  Скрыть область







                </button>







                <button







                  className="ghost-button compact-button"







                  disabled={!activeScene?.zones.some((zone) => zone.visibleToPlayers)}







                  onClick={() => applyFogToVisibleZones('fog-erase')}







                  type="button"







                >







                  Открыть видим‹е зоны







                </button>







                <button







                  className="ghost-button compact-button"







                  disabled={!activeScene?.zones.some((zone) => zone.visibleToPlayers)}







                  onClick={() => applyFogToVisibleZones('fog-draw')}







                  type="button"







                >







                  Скрыть видим‹е зоны







                </button>







              </div>







              <label className="field service-marker-launcher">







                <span>Подпись служебной о‚ме‚ки</span>







                <input







                  disabled={!activeServiceMarker}
                  onClick={() => setIsServiceMarkerModalOpen(true)}







                  readOnly
                  value={activeServiceMarker ? 'Редактировать выбранную отметку' : 'Поставь отметку на карте'}







                />







              </label>







              <label className="field service-marker-legacy-field">







                <span>Заметка мастера</span>







                <textarea







                  onChange={(event) => setNewServiceMarkerNote(event.target.value)}







                  rows={3}







                  value={newServiceMarkerNote}







                />







              </label>







              {activeServiceMarker ? (







                <div className="editor-card service-marker-legacy-card">







                  <div className="section-row">







                    <span className="eyebrow">Выбранная отметка</span>







                    <button







                      className="inline-link"







                      onClick={() => removeServiceMarker(activeServiceMarker.id)}







                      type="button"







                    >







                      удали‚ь отметку







                    </button>







                  </div>







                  <label className="field">







                    <span>Подпись</span>







                    <input







                      onChange={(event) =>







                        updateServiceMarker(activeServiceMarker.id, (marker) => ({







                          ...marker,







                          label: event.target.value,







                        }))







                      }







                      value={activeServiceMarker.label}







                    />







                  </label>







                  <label className="field">







                    <span>Заметка</span>







                    <textarea







                      onChange={(event) =>







                        updateServiceMarker(activeServiceMarker.id, (marker) => ({







                          ...marker,







                          note: event.target.value,







                        }))







                      }







                      rows={3}







                      value={activeServiceMarker.note}







                    />







                  </label>







                  <label className="field">







                    <span>Порядок слоя</span>







                    <input







                      onChange={(event) =>







                        updateServiceMarker(activeServiceMarker.id, (marker) => ({







                          ...marker,







                          zIndex: Number(event.target.value),







                        }))







                      }







                      type="number"







                      value={activeServiceMarker.zIndex}







                    />







                  </label>







                  <div className="layer-controls">







                    <button







                      className="ghost-button compact-button"







                      onClick={() =>







                        updateServiceMarker(activeServiceMarker.id, (marker) => ({







                          ...marker,







                          zIndex: marker.zIndex - 1,







                        }))







                      }







                      type="button"







                    >







                      Ниже







                    </button>







                    <button







                      className="ghost-button compact-button"







                      onClick={() =>







                        updateServiceMarker(activeServiceMarker.id, (marker) => ({







                          ...marker,







                          zIndex: marker.zIndex + 1,







                        }))







                      }







                      type="button"







                    >







                      Выше







                    </button>







                  </div>







                </div>







              ) : null}







              <button







                className="ghost-button compact-button"







                onClick={() =>







                  updateSceneRuntimeState(activeScene.id, (sceneState) => ({







                    ...sceneState,







                    fogCells: [],







                  }), 'Очищен весь туман войны')







                }







                type="button"







              >







                Очистить весь туман







              </button>







            </div>















            <div className="token-creator">







              <span className="eyebrow">Создание фишки</span>







              <input







                onChange={(event) => setNewTokenName(event.target.value)}







                placeholder="Рмя С„РёС€ки"






                value={newTokenName}







              />







              <select







                onChange={(event) => setNewTokenKind(event.target.value as TokenKind)}







                value={newTokenKind}







              >







                <option value="player">Ргрок</option>







                <option value="monster">Монстр</option>







                <option value="npc">NPC</option>







              </select>







              <input







                min="1"







                onChange={(event) =>







                  setNewTokenCount(clampSpawnCount(Number(event.target.value), newTokenCount))







                }







                placeholder="Количество"







                type="number"







                value={newTokenCount}







              />







              <input







                accept="image/*"







                onChange={(event) => setNewTokenFile(event.target.files?.[0] ?? null)}







                type="file"







              />







              <button







                className="primary-button"







                onClick={() => void handleCreateToken()}







                type="button"







              >







                {newTokenCount > 1 ? 'Создать группу фишек' : 'Создать фишку'}







              </button>







            </div>







          </div>
          </section>















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
                  ▾
                </span>
              </div>
            </button>
          {!isLiveToolsCollapsed ? (
          <div className="gm-grid">







          <article className="info-card service-marker-list-card">







            <span className="eyebrow">Инициатива</span>







            {initiativeTokens.length > 0 ? (







              <div className="editor-stack">







                <div className="action-row zone-action-row">







                  <button







                    className="ghost-button compact-button"







                    onClick={() => cycleInitiativeTurn('previous')}







                    type="button"







                  >







                    Назад







                  </button>







                  <button







                    className="ghost-button compact-button"







                    onClick={() => cycleInitiativeTurn('next')}







                    type="button"







                  >







                    Следующий







                  </button>







                </div>







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







                        <span>{tokenKindLabels[token.kind]}</span>







                      </button>







                      <span className="initiative-meta">







                        Иниц. {token.initiative ?? '—'} • ХП {token.hitPointsCurrent ?? '—'}/







                        {token.hitPointsMax ?? '—'}







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







            <span className="eyebrow">Список фишек</span>







            <ul className="flat-list">







              {activeSceneState.tokens.length > 0 ? (







                activeSceneState.tokens.map((token) => (







                  <li key={token.id}>







                    <button







                      className="inline-link"







                      onClick={() => {







                        setSelectedTokenId(token.id)







                        setActiveInitiativeToken(token.id)







                      }}







                      type="button"







                    >







                      {token.name}







                    </button>







                    <span>{tokenKindLabels[token.kind]}</span>







                    <span>{token.groupLabel ? `Группа: ${token.groupLabel}` : 'Без группы'}</span>







                    <span>







                      ХП {token.hitPointsCurrent ?? '—'}/{token.hitPointsMax ?? '—'} • Инициатива{' '}







                      {token.initiative ?? '—'}







                    </span>







                    <span>{token.hiddenFromPlayers ? 'Скрыт от игроков' : 'Виден игрокам'}</span>







                    <button







                      className="inline-link"







                      onClick={() => removeToken(token.id)}







                      type="button"







                    >







                      удалить







                    </button>







                  </li>







                ))







              ) : (







                <li>Для этой сцены пока нет С„РёС€е.</li>







              )}







            </ul>







          </article>















          <article className="info-card">







            <span className="eyebrow">Выбранная С„РёС€ка</span>







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







                  <select







                    onChange={(event) =>







                      updateToken(activeToken.id, (token) => ({







                        ...token,







                        kind: event.target.value as TokenKind,







                        linkedMonsterId:







                          event.target.value === 'monster' ? token.linkedMonsterId : null,







                      }))







                    }







                    value={activeToken.kind}







                  >







                    <option value="player">Ргрок</option>







                    <option value="monster">Монстр</option>







                    <option value="npc">NPC</option>







                  </select>







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







                <label className="field range-field">







                  <span>Размер: {activeToken.size}px</span>







                  <input







                    max="144"







                    min="40"







                    onChange={(event) =>







                      updateToken(activeToken.id, (token) => ({







                        ...token,







                        size: Number(event.target.value),







                      }))







                    }







                    type="range"







                    value={activeToken.size}







                  />







                </label>







                <label className="field range-field">







                  <span>Поворот: {activeToken.rotation}В°</span>







                  <input







                    max="360"







                    min="0"







                    onChange={(event) =>







                      updateToken(activeToken.id, (token) => ({







                        ...token,







                        rotation: Number(event.target.value),







                      }))







                    }







                    type="range"







                    value={activeToken.rotation}







                  />







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







                  <select







                    onChange={(event) =>







                      updateToken(activeToken.id, (token) => ({







                        ...token,







                        kind: event.target.value ? 'monster' : token.kind,







                        linkedMonsterId: event.target.value || null,







                      }))







                    }







                    value={activeToken.linkedMonsterId ?? ''}







                  >







                    <option value="">не привяза</option>







                    {activeScene.monsterBlocks.map((monster) => (







                      <option key={monster.id} value={monster.id}>







                        {monster.name}







                      </option>







                    ))}







                  </select>







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







                    Копирова‚ь токен







                  </button>







                  <button







                    className="ghost-button compact-button"







                    disabled={!activeTokenLinkedMonster}







                    onClick={() => syncTokenStatsFromMonster(activeToken)}







                    type="button"







                  >







                    Син…ронизирова‚ь с монстром







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







                  type="button"







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







            <span className="eyebrow">Служебные о‚ме‚ки</span>







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







                    <span>{marker.note || 'Без заме‚ки'}</span>







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
        </div>






      </section>















      <aside className="panel status-panel editor-panel">







        <div className="panel-header">







          <span className="eyebrow">Редактор сцены</span>







          <h2>{activeScene.title}</h2>







          <p>Редактируй поля, карты, раздатки и боевой контент для текущей сцены.</p>







        </div>















        <div className="editor-stack">







          <div className="tab-row" role="tablist" aria-label="Вкладки редактора">







            {(Object.entries(editorTabLabels) as Array<[EditorTab, string]>).map(([tabId, label]) => (







              <button







                key={tabId}







                aria-selected={activeEditorTab === tabId}







                className={`tab-button ${activeEditorTab === tabId ? 'active' : ''}`}







                onClick={() => setActiveEditorTab(tabId)}







                role="tab"







                type="button"







              >







                {label}







              </button>







            ))}







          </div>















{activeEditorTab === 'scene' ? (







          <>







          <div className="editor-card">







            <div className="section-row">







              <span className="eyebrow">Поля сцены</span>







              <button







                className="inline-link"







                onClick={() => removeScene(activeScene.id)}







                type="button"







              >







                удали‚ь сцену







              </button>







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







              <select







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







              </select>







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







              <span>Р—аме‚ки мастера</span>







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















          <div className="editor-card">







            <div className="section-row">







              <span className="eyebrow">Splash-экран сцены</span>







              <button







                className="ghost-button compact-button"







                onClick={() => pushSplashToPlayer(activeScene)}







                type="button"







              >







                Показать игрока







              </button>







            </div>







            <label className="field">







              <span>Заголовок splash</span>







              <input







                onChange={(event) =>







                  updateScene(activeScene.id, (scene) => ({







                    ...scene,







                    splash: {







                      ...scene.splash,







                      title: event.target.value,







                    },







                  }))







                }







                value={activeScene.splash.title}







              />







            </label>







            <label className="field">







              <span>Подзаголовок</span>







              <input







                onChange={(event) =>







                  updateScene(activeScene.id, (scene) => ({







                    ...scene,







                    splash: {







                      ...scene.splash,







                      subtitle: event.target.value,







                    },







                  }))







                }







                value={activeScene.splash.subtitle}







              />







            </label>







            <label className="field">







              <span>Текст splash</span>







              <textarea







                onChange={(event) =>







                  updateScene(activeScene.id, (scene) => ({







                    ...scene,







                    splash: {







                      ...scene.splash,







                      body: event.target.value,







                    },







                  }))







                }







                rows={4}







                value={activeScene.splash.body}







              />







            </label>







            <label className="field">







              <span>Рзображение из библио‚еки</span>







              <select







                onChange={(event) => {







                  if (event.target.value) {







                    applyLibraryImageToSplash(event.target.value)







                  }







                }}







                value={activeScene.splash.imageAssetId ?? ''}







              >







                <option value="">не выбрано</option>







                {imageAssets.map((asset) => (







                  <option key={asset.id} value={asset.id}>







                    {asset.title}







                  </option>







                ))}







              </select>







            </label>







            <label className="field file-field">







              <span>Загрузить изображение splash</span>







              <input







                accept="image/*"







                onChange={(event) => {







                  void handleSplashImageUpload(event.target.files?.[0] ?? null)







                  event.target.value = ''







                }}







                type="file"







              />







            </label>







            {resolvedSceneSplashImage ? (







              <p className="editor-hint">Для сцены уже выбрано splash-изображение, его можно показать игрокам перед открытием карты.</p>







            ) : (







              <p className="editor-hint">Р•сли изображение не загружено, splash-экран покажет текст Рё атмосферную подложку.</p>







            )}







          </div>







          <div className="editor-card">







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







              <span>Рс‚о‡ник из библио‚еки</span>






              <select







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







              </select>







            </label>







            <label className="field">







              <span>Текст заглу€ки</span>







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







              <p className="editor-hint">Карта сцены уже связана с библио‚еко№ Рё может переиспользова‚ься в други… сценах.</p>







            ) : null}







          </div>















          <div className="editor-card">







            <div className="section-row">







              <span className="eyebrow">Комнаты Рё зоны</span>







              <strong>{activeScene.zones.length} областей</strong>







            </div>







            <p className="editor-hint">







              Р’ режиме <strong>С‚ави‚ь зоны</strong> кликни по карте, чтобы создать новую область.







            </p>







            <div className="zone-list">







              {activeScene.zones.length > 0 ? (







                activeScene.zones.map((zone) => (







                  <button







                    key={zone.id}







                    className={`zone-card ${zone.id === activeZone?.id ? 'active' : ''}`}







                    onClick={() => setSelectedZoneId(zone.id)}







                    type="button"







                  >







                    <strong>{zone.title}</strong>







                    {zone.linkedHandoutId ? (







                      <span className="scene-card-summary">есть связанная раздатка</span>







                    ) : null}







                    <span className="scene-card-summary">







                      {zone.visibleToPlayers ? 'видно игрокам' : 'только мастер'}







                    </span>







                  </button>







                ))







              ) : (







                <p className="editor-empty">Пока нет ни одной зоны. Создай её кликом по карте.</p>







              )}







            </div>















            {activeZone ? (







              <div className="editor-card">







                <div className="section-row">







                  <span className="eyebrow">Выбранная зона</span>







                  <button







                    className="inline-link"







                    onClick={() => removeZone(activeZone.id)}







                    type="button"







                  >







                    удали‚ь зону







                  </button>







                </div>







                <label className="field">







                  <span>Название зоны</span>







                  <input







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        title: event.target.value,







                      }))







                    }







                    value={activeZone.title}







                  />







                </label>







                <label className="field">







                  <span>Заметка мастера</span>







                  <textarea







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        note: event.target.value,







                      }))







                    }







                    rows={3}







                    value={activeZone.note}







                  />







                </label>







                <label className="field">







                  <span>Фокус-заметка зоны</span>






                  <textarea







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        focusNote: event.target.value,







                      }))







                    }







                    placeholder="Короткая памятка мастеру: что происходит в зоне и на чём держать фокус."






                    rows={4}







                    value={activeZone.focusNote}







                  />







                </label>







                <label className="field">







                  <span>Связанная раздатка</span>







                  <select







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        linkedHandoutId: event.target.value || null,







                      }))







                    }







                    value={activeZone.linkedHandoutId ?? ''}







                  >







                    <option value="">не привязана</option>







                    {activeScene.handouts.map((handout) => (







                      <option key={handout.id} value={handout.id}>







                        {handout.title}







                      </option>







                    ))}







                  </select>







                </label>







                <label className="field">







                  <span>Связанная проверка или улика</span>







                  <select







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        linkedCheckId: event.target.value || null,







                      }))







                    }







                    value={activeZone.linkedCheckId ?? ''}







                  >







                    <option value="">не привязана</option>







                    {activeScene.checksClues.map((entry) => (







                      <option key={entry.id} value={entry.id}>







                        {entry.ability || 'Без названия'} • {entry.difficulty || 'без сложнос‚Рё'}







                      </option>







                    ))}







                  </select>







                </label>







                <label className="field">







                  <span>Связанный монстр</span>







                  <select







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        linkedMonsterId: event.target.value || null,







                      }))







                    }







                    value={activeZone.linkedMonsterId ?? ''}







                  >







                    <option value="">не привяза</option>







                    {activeScene.monsterBlocks.map((monster) => (







                      <option key={monster.id} value={monster.id}>







                        {monster.name}







                      </option>







                    ))}







                  </select>







                </label>







                <div className="action-row zone-action-row">







                  <button







                    className="ghost-button compact-button"







                    onClick={() => applyFogToZone(activeZone, 'fog-erase')}







                    type="button"







                  >







                    Открыть зону







                  </button>







                  <button







                    className="ghost-button compact-button"







                    onClick={() => applyFogToZone(activeZone, 'fog-draw')}







                    type="button"







                  >







                    Скрыть зону







                  </button>







                </div>







                <div className="action-row zone-action-row">







                  <button







                    className="ghost-button compact-button"







                    disabled={!activeZoneLinkedHandout}







                    onClick={() => focusZoneLinkedHandout(activeZone)}







                    type="button"







                  >







                    Открыть раздатку







                  </button>







                  <button







                    className="primary-button compact-button"







                    disabled={!activeZoneLinkedHandout}







                    onClick={() => showZoneLinkedHandoutToPlayers(activeZone)}







                    type="button"







                  >







                    Показать раздатку игрока







                  </button>







                </div>







                <div className="action-row zone-action-row">







                  <button







                    className="ghost-button compact-button"







                    disabled={!activeZoneLinkedCheck}







                    onClick={() => focusZoneLinkedCheck(activeZone)}







                    type="button"







                  >







                    Открыть проверку







                  </button>







                  <button







                    className="ghost-button compact-button"







                    disabled={!activeZoneLinkedMonster}







                    onClick={() => focusZoneLinkedMonster(activeZone)}







                    type="button"







                  >







                    Открыть монстра







                  </button>







                </div>







                {activeZoneLinkedHandout ? (







                  <p className="editor-hint">







                    Р Р‹Р Р†я Р’·Р Р’°Р Р…Р Р…Р я С‚Р Р’°Р Р’·Р ТР Р’С‚С™Р С”Р В°: <strong>{activeZoneLinkedHandout.title}</strong>







                  </p>







                ) : null}







                {activeZoneLinkedCheck ? (







                  <p className="editor-hint">







                    Связанная проверка: <strong>{activeZoneLinkedCheck.ability || 'Без названия'}</strong>







                  </p>







                ) : null}







                {activeZoneLinkedMonster ? (







                  <p className="editor-hint">







                    Связанный монстр: <strong>{activeZoneLinkedMonster.name}</strong>







                  </p>







                ) : null}







                {activeZone.focusNote ? (







                  <p className="editor-hint">







                    <strong>Фокус:</strong> {activeZone.focusNote}







                  </p>







                ) : null}







                <div className="zone-grid">







                  <label className="field">







                    <span>Позиция X (%)</span>







                    <input







                      onChange={(event) =>







                        updateZone(activeZone.id, (zone) => ({







                          ...zone,







                          x: clampZoneCoordinate(Number(event.target.value), zone.x),







                        }))







                      }







                      type="number"







                      value={activeZone.x}







                    />







                  </label>







                  <label className="field">







                    <span>Позиция Y (%)</span>







                    <input







                      onChange={(event) =>







                        updateZone(activeZone.id, (zone) => ({







                          ...zone,







                          y: clampZoneCoordinate(Number(event.target.value), zone.y),







                        }))







                      }







                      type="number"







                      value={activeZone.y}







                    />







                  </label>







                  <label className="field">







                    <span>Ширина (%)</span>







                    <input







                      onChange={(event) =>







                        updateZone(activeZone.id, (zone) => ({







                          ...zone,







                          width: clampZoneSize(Number(event.target.value), zone.width),







                        }))







                      }







                      type="number"







                      value={activeZone.width}







                    />







                  </label>







                  <label className="field">







                    <span>Высота (%)</span>







                    <input







                      onChange={(event) =>







                        updateZone(activeZone.id, (zone) => ({







                          ...zone,







                          height: clampZoneSize(Number(event.target.value), zone.height),







                        }))







                      }







                      type="number"







                      value={activeZone.height}







                    />







                  </label>







                </div>







                <label className="checkbox-field">







                  <input







                    checked={activeZone.visibleToPlayers}







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        visibleToPlayers: event.target.checked,







                      }))







                    }







                    type="checkbox"







                  />







                  <span>Показывать контур Рё подпись игрока</span>







                </label>







                <label className="checkbox-field">







                  <input







                    checked={activeZone.autoRevealOnEnter}







                    onChange={(event) =>







                      updateZone(activeZone.id, (zone) => ({







                        ...zone,







                        autoRevealOnEnter: event.target.checked,







                      }))







                    }







                    type="checkbox"







                  />







                  <span>Автооткрывать туман при входе С„РёС€ки в зону</span>







                </label>







              </div>







            ) : null}







          </div>







          </>







          ) : null}















{activeEditorTab === 'checks' ? (







          <div className="editor-card">







            <div className="section-row">







              <span className="eyebrow">Проверки и улики</span>







              <button







                className="ghost-button compact-button"







                onClick={addCheckClueEntry}







                type="button"







              >







                Р”обави‚ь строку







              </button>







            </div>















            {activeCheckClue ? (







              <p className="editor-hint">







                Выбрана строка: <strong>{activeCheckClue.ability || 'Без названия'}</strong>







              </p>







            ) : null}







            {activeScene.checksClues.length > 0 ? (







              <div className="checks-table">







                <div className="checks-row checks-row-header">







                  <span>Характеристика</span>







                  <span>Сложность</span>







                  <span>РС‚ог</span>







                  <span></span>







                </div>















                {activeScene.checksClues.map((entry) => (







                  <div







                    className={`checks-row ${entry.id === activeCheckClue?.id ? 'active' : ''}`}







                    key={entry.id}







                    onFocusCapture={() => setSelectedCheckId(entry.id)}







                  >







                    <div className="checks-ability-cell">







                      <select







                        onChange={(event) =>







                          updateCheckClueEntry(entry.id, (currentEntry) => ({







                            ...currentEntry,







                            ability: event.target.value,







                          }))







                        }







                        value={







                          checkAbilityOptions.includes(







                            entry.ability as (typeof checkAbilityOptions)[number],







                          )







                            ? entry.ability







                            : ''







                        }







                      >







                        <option value="">Свой вариан‚</option>







                        {checkAbilityOptions.map((option) => (







                          <option key={option} value={option}>







                            {option}







                          </option>







                        ))}







                      </select>







                      <input







                        onChange={(event) =>







                          updateCheckClueEntry(entry.id, (currentEntry) => ({







                            ...currentEntry,







                            ability: event.target.value,







                          }))







                        }







                        placeholder="Например, Внимательность"







                        value={entry.ability}







                      />







                    </div>







                    <div className="checks-difficulty-cell">







                      <select







                        onChange={(event) =>







                          updateCheckClueEntry(entry.id, (currentEntry) => ({







                            ...currentEntry,







                            difficulty: event.target.value,







                          }))







                        }







                        value={







                          checkDifficultyOptions.includes(







                            entry.difficulty as (typeof checkDifficultyOptions)[number],







                          )







                            ? entry.difficulty







                            : ''







                        }







                      >







                        <option value="">Свой вариан‚</option>







                        {checkDifficultyOptions.map((option) => (







                          <option key={option} value={option}>







                            {option}







                          </option>







                        ))}







                      </select>







                      <input







                        onChange={(event) =>







                          updateCheckClueEntry(entry.id, (currentEntry) => ({







                            ...currentEntry,







                            difficulty: event.target.value,







                          }))







                        }







                        placeholder="Например, DC 14"







                        value={entry.difficulty}







                      />







                    </div>







                    <textarea







                      onChange={(event) =>







                        updateCheckClueEntry(entry.id, (currentEntry) => ({







                          ...currentEntry,







                          outcome: event.target.value,







                        }))







                      }







                      rows={2}







                      value={entry.outcome}







                    />







                    <button







                      className="inline-link"







                      onClick={() => removeCheckClueEntry(entry.id)}







                      type="button"







                    >







                      удалить







                    </button>







                  </div>







                ))}







              </div>







            ) : (







              <p className="editor-empty">







                Пока нет проверок Рё порогов улик. Добавь строку, чтобы за„иксирова‚ь о‚кр‹С‚ия для мастера.







              </p>







            )}







          </div>







          ) : null}























          {activeEditorTab === 'handouts' ? (







            <div className="editor-card">







              <div className="section-row">







                <span className="eyebrow">Раздатки</span>







                <button className="ghost-button compact-button" onClick={addHandout} type="button">







                  Р”обави‚ь раздатку







                </button>







              </div>















              <div className="handout-list">







                {activeScene.handouts.map((handout) => (







                  <button







                    key={handout.id}







                    className={`handout-card ${handout.id === activeHandout?.id ? 'active' : ''}`}







                    onClick={() => setSelectedHandoutId(handout.id)}







                    type="button"







                  >







                    <strong>{handout.title}</strong>







                    <span>{handout.caption}</span>







                  </button>







                ))}







              </div>















              {activeHandout ? (







                <div className="handout-editor">







                  <div className="section-row">







                    <span className="eyebrow">Выбранная раздатка</span>







                    <button className="inline-link" onClick={() => removeHandout(activeHandout.id)} type="button">







                      Удали‚ь раздатку







                    </button>







                  </div>







                  <label className="field"><span>ID раздатки</span><input onChange={(event) => renameHandoutId(activeHandout.id, event.target.value)} value={activeHandout.id} /></label>







                  <label className="field"><span>Название</span><input onChange={(event) => updateHandout(activeHandout.id, (handout) => ({ ...handout, title: event.target.value }))} value={activeHandout.title} /></label>







                  <label className="field"><span>Подпись</span><input onChange={(event) => updateHandout(activeHandout.id, (handout) => ({ ...handout, caption: event.target.value }))} value={activeHandout.caption} /></label>







                  <label className="field"><span>Изображение из библиотеки</span><select onChange={(event) => { if (event.target.value) { applyLibraryImageToHandout(activeHandout.id, event.target.value) } }} value={activeHandout.imageAssetId ?? ""}><option value="">Не выбрано</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>







                  <label className="field"><span>Текст</span><textarea onChange={(event) => updateHandout(activeHandout.id, (handout) => ({ ...handout, body: event.target.value }))} rows={5} value={activeHandout.body} /></label>







                  <label className="field"><span>Загрузить изображение</span><input accept="image/*" onChange={(event) => void handleHandoutImageUpload(activeHandout.id, event.target.files?.[0] ?? null)} type="file" /></label>







                  <div className="action-row"><button className="primary-button compact-button" onClick={() => pushHandoutToPlayer(activeScene, activeHandout)} type="button">Показать раздатку игрока</button></div>







                </div>







              ) : (







                <p className="editor-empty">Раздатка пока не выбрана. Нажми на карточку, чтобы начать редактирование.</p>







              )}







            </div>







          ) : null}















          {activeEditorTab === 'monsters' ? (







            <div className="editor-card">







              <div className="section-row">







                <span className="eyebrow">Монстры</span>







                <button className="ghost-button compact-button" onClick={addMonsterBlock} type="button">Р”обави‚ь монстра</button>







              </div>







              <div className="monster-list">







                {activeScene.monsterBlocks.map((monster) => (







                  <div className={`monster-card ${monster.id === activeMonster?.id ? 'active' : ''}`} key={monster.id}>







                    <div className="monster-card-art" style={monster.imageSrc ? { backgroundImage: `url(${monster.imageSrc})` } : undefined}>{!monster.imageSrc ? <span>{monster.name.charAt(0).toUpperCase()}</span> : null}</div>







                    <button className="monster-card-trigger" onClick={() => setSelectedMonsterId(monster.id)} type="button">







                      <strong>{monster.name}</strong>







                      <span>{monster.subtitle}</span>







                      <span className="scene-card-summary">КБ {monster.armorClass} • ХП {monster.hitPoints} • CR {monster.challenge || '?'}</span>







                    </button>







                    <button className="ghost-button compact-button" onClick={() => toggleMonsterCollapsed(monster.id)} type="button">{collapsedMonsterIds.includes(monster.id) ? "Развернуть" : "Свернуть"}</button>







                  </div>







                ))}







              </div>







              {activeMonster ? (







                <div className="monster-editor">







                  <div className="section-row">







                    <span className="eyebrow">Выбранный монстр</span>







                    <div className="action-row library-actions">







                      <label className="field compact-inline-field"><span>Количество</span><input min="1" onChange={(event) => setNewMonsterSpawnCount(clampSpawnCount(Number(event.target.value), newMonsterSpawnCount))} type="number" value={newMonsterSpawnCount} /></label>







                      <button className="primary-button compact-button" onClick={() => createTokensFromMonster(activeMonster, newMonsterSpawnCount)} type="button">{newMonsterSpawnCount > 1 ? "Создать группу врагов" : "Создать токен из монстра"}</button>







                      <button className="ghost-button compact-button" onClick={() => toggleMonsterCollapsed(activeMonster.id)} type="button">{isActiveMonsterCollapsed ? "Развернуть блок" : "Свернуть блок"}</button>







                      <button className="inline-link" onClick={() => removeMonsterBlock(activeMonster.id)} type="button">Удали‚ь монстра</button>







                    </div>







                  </div>







                  <label className="field"><span>ID монстра</span><input onChange={(event) => renameMonsterId(activeMonster.id, event.target.value)} value={activeMonster.id} /></label>







                  <label className="field"><span>Рмя</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, name: event.target.value }))} value={activeMonster.name} /></label>







                  <label className="field"><span>Подзаголовок</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, subtitle: event.target.value }))} value={activeMonster.subtitle} /></label>







                  <label className="field"><span>Загрузить изображение</span><input accept="image/*" onChange={(event) => void handleMonsterImageUpload(activeMonster.id, event.target.files?.[0] ?? null)} type="file" /></label>







                  <label className="field"><span>Картинка из библиотеки</span><select onChange={(event) => { if (event.target.value) { applyLibraryImageToMonster(activeMonster.id, event.target.value) } }} value={activeMonster.imageAssetId ?? ""}><option value="">Не выбрано</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>







                  <div className="monster-topline-grid">







                    <label className="field"><span>Класс брони</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, armorClass: event.target.value }))} value={activeMonster.armorClass} /></label>







                    <label className="field"><span>Хиты</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, hitPoints: event.target.value }))} value={activeMonster.hitPoints} /></label>







                    <label className="field"><span>Скорость</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, speed: event.target.value }))} value={activeMonster.speed} /></label>







                    <label className="field"><span>Опасность</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, challenge: event.target.value }))} value={activeMonster.challenge} /></label>







                  </div>







                  <div className="monster-abilities-grid">







                    <label className="field"><span>СР›</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'strength', event.target.value)} value={activeMonster.strength} /></label>







                    <label className="field"><span>ЛОВ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'dexterity', event.target.value)} value={activeMonster.dexterity} /></label>







                    <label className="field"><span>ТЕЛ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'constitution', event.target.value)} value={activeMonster.constitution} /></label>







                    <label className="field"><span>РНТ</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'intelligence', event.target.value)} value={activeMonster.intelligence} /></label>







                    <label className="field"><span>МДР</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'wisdom', event.target.value)} value={activeMonster.wisdom} /></label>







                    <label className="field"><span>ХАР</span><input type="number" onChange={(event) => updateMonsterAbility(activeMonster.id, 'charisma', event.target.value)} value={activeMonster.charisma} /></label>







                  </div>







                  <label className="field"><span>Спасброски</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, savingThrows: event.target.value }))} value={activeMonster.savingThrows} /></label>







                  <label className="field"><span>Навыки</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, skills: event.target.value }))} value={activeMonster.skills} /></label>







                  <label className="field"><span>Чувства</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, senses: event.target.value }))} value={activeMonster.senses} /></label>







                  <label className="field"><span>Языки</span><input onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, languages: event.target.value }))} value={activeMonster.languages} /></label>







                  {renderMonsterFeatureSection(activeMonster, "traits", "Черты", "черту")}







                  {renderMonsterFeatureSection(activeMonster, "actions", "Действия", "действие")}







                  {renderMonsterFeatureSection(activeMonster, "bonusActions", "Бонусные действия", "бонусное действие")}







                  {renderMonsterFeatureSection(activeMonster, "reactions", "Реакции", "реакцию")}







                  {renderMonsterFeatureSection(activeMonster, "legendaryActions", "Легендарные действия", "легендарное действие")}







                  <label className="field"><span>Р—аме‚ки мастера</span><textarea onChange={(event) => updateMonster(activeMonster.id, (monster) => ({ ...monster, notes: event.target.value }))} rows={4} value={activeMonster.notes} /></label>







                </div>







              ) : (







                <p className="editor-empty">Монстр пока не выбран. Нажми на карточку, чтобы открыть его блок.</p>







              )}







            </div>







          ) : null}















          {activeEditorTab === 'audio' ? (







            <div className="editor-card">







              <div className="section-row"><span className="eyebrow">Аудио</span><strong>{activeScene.recommendedAudio.length} треков в сцене</strong></div>







              <div className="audio-upload-grid">







                <label className="field"><span>Название трека</span><input onChange={(event) => setNewAudioTitle(event.target.value)} placeholder="Р’веди название, затем в‹бери файл" value={newAudioTitle} /></label>







                <label className="field"><span>Тип трека</span><select onChange={(event) => setNewAudioKind(event.target.value as AudioTrackKind)} value={newAudioKind}><option value="music">Музыка</option><option value="ambience">Атмосфера</option><option value="sfx">Эффект</option></select></label>







                <label className="field"><span>Загрузить</span><input accept="audio/*" onChange={(event) => void addAudioTrack(event.target.files?.[0] ?? null)} type="file" /></label>







              </div>







              {activeAudioTrack ? (







                <div className="audio-player-card">







                  <div className="section-row"><div><span className="eyebrow">Выбранный трек</span><h3>{activeAudioTrack.title}</h3></div><span className={`audio-kind audio-kind-${activeAudioTrack.kind}`}>{audioKindLabels[activeAudioTrack.kind]}</span></div>







                  <div className="audio-controls"><button className="primary-button compact-button" onClick={() => void playAudioTrack(activeAudioTrack.id)} type="button">Р’оспроизвес‚Рё</button><button className="ghost-button compact-button" onClick={pauseAudioPlayback} type="button">Пауза</button><button className="ghost-button compact-button" onClick={stopAudioPlayback} type="button">Стоп</button></div>







                  <div className="audio-settings-grid"><label className="field range-field"><span>Громкость: {audioVolume}%</span><input max="100" min="0" onChange={(event) => setAudioVolume(Number(event.target.value))} type="range" value={audioVolume} /></label><label className="checkbox-field"><input checked={audioLoop} onChange={(event) => setAudioLoop(event.target.checked)} type="checkbox" /><span>Р—а†икли‚ь С‚еку‰РёР№ трек</span></label></div>







                  <label className="field"><span>Файл из библиотеки</span><select onChange={(event) => { if (event.target.value) { applyLibraryAudioToTrack(activeAudioTrack.id, event.target.value) } }} value={activeAudioTrack.assetId ?? ""}><option value="">Не выбрано</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>







                  <label className="field"><span>Название трека</span><input onChange={(event) => updateAudioTrack(activeAudioTrack.id, (track) => ({ ...track, title: event.target.value }))} value={activeAudioTrack.title} /></label>







                  <label className="field"><span>Тип трека</span><select onChange={(event) => updateAudioTrack(activeAudioTrack.id, (track) => ({ ...track, kind: event.target.value as AudioTrackKind }))} value={activeAudioTrack.kind}><option value="music">Музыка</option><option value="ambience">Атмосфера</option><option value="sfx">Эффект</option></select></label>







                  <div className="section-row"><button className="ghost-button compact-button" onClick={() => toggleSceneAudioRecommendation(activeAudioTrack.id)} type="button">{activeScene.recommendedAudio.includes(activeAudioTrack.id) ? "Убрать из сцены" : "Добавить в сцену"}</button><button className="inline-link" onClick={() => removeAudioTrack(activeAudioTrack.id)} type="button">Удалить трек</button></div>







                  {!activeAudioTrack.src ? <p className="editor-empty">У этого трека пока нет подключенного файла, выбери его в библиотеке или загрузи заново.</p> : null}







                </div>







              ) : (







                <p className="editor-empty">Трек пока не выбран. Выбери карточку, чтобы открыть нас‚ро№ки звука.</p>







              )}







              <div className="audio-list">{adventure.audioLibrary.map((track) => { const isRecommended = activeScene.recommendedAudio.includes(track.id); const isSelected = track.id === activeAudioTrack?.id; return (<button key={track.id} className={`audio-card ${isSelected ? "active" : ""}`} onClick={() => setSelectedAudioId(track.id)} type="button"><div className="audio-card-header"><strong>{track.title}</strong><span className={`audio-kind audio-kind-${track.kind}`}>{audioKindLabels[track.kind]}</span></div><span className="audio-meta">{isRecommended ? "Рекомендован для этой сцены" : "Только в библиотеке"}</span><span className="audio-meta">{track.src ? (isAudioPlaying && isSelected ? "Сейчас играет" : "Готов к воспроизведению") : "Файл не найден"}</span></button>) })}</div>







            </div>







          ) : null}















          <div className="status-card">







            <span className="status-label">Экран игроков</span>







            <strong>{effectivePlayerModeLabel}</strong>







            <p>{currentPlayerScene ? `${currentPlayerScene.title} (${currentPlayerScene.location})` : "Сцена не выбрана"}</p>







            <strong>{sessionState?.playerDisplay.mode === "splash" ? currentPlayerSplash?.title ?? "Splash-экран не настроен" : currentPlayerHandout?.title ?? "Раздатка не выбрана"}</strong>







            <p>{activeAudioTrack ? `${isAudioPlaying ? "Играет" : "Пауза"}: ${activeAudioTrack.title}` : "Аудио не выбрано"}</p>







          </div>















          <div className="status-card">







            <span className="status-label">Снапшоты проекта</span>







            <strong>{projectSnapshots.length} снимков</strong>







            <p>Недавние со…ранения сос‚ояния, к которым можно быстро вернуться.</p>







            <div className="scene-list">{recentProjectSnapshots.map((snapshot) => (<button key={snapshot.id} className="scene-card" onClick={() => restoreProjectSnapshot(snapshot.id)} type="button"><span className="scene-card-location">{new Date(snapshot.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span><strong>{snapshot.label}</strong><span className="scene-card-summary">Нажми, чтобы восс‚анови‚ь это сос‚ояние проекта.</span></button>))}</div>







          </div>







        </div>







      </aside>








      {isTokenModalOpen && activeToken ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsTokenModalOpen(false)}
          role="presentation"
        >
          <div
            className="modal-dialog token-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Редактор фишки"
          >
            <div className="modal-header">
              <div className="control-group-copy">
                <span className="eyebrow">Фишка</span>
                <p className="editor-hint">
                  Меняй вид, тип и параметры фишки прямо перед показом игрокам.
                </p>
              </div>
              <button
                aria-label="Закрыть"
                className="ghost-button compact-button token-modal-icon-button"
                onClick={() => setIsTokenModalOpen(false)}
                title="Закрыть"
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-xmark" />
              </button>
            </div>

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
                <select
                  onChange={(event) =>
                    updateToken(activeToken.id, (token) => ({
                      ...token,
                      kind: event.target.value as TokenKind,
                      linkedMonsterId:
                        event.target.value === 'monster' ? token.linkedMonsterId : null,
                    }))
                  }
                  value={activeToken.kind}
                >
                  <option value="player">Игрок</option>
                  <option value="monster">Монстр</option>
                  <option value="npc">NPC</option>
                </select>
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
                  placeholder="Например, волки теней"
                  value={activeToken.groupLabel ?? ''}
                />
              </label>

              <label className="field range-field">
                <span>Размер: {activeToken.size}px</span>
                <input
                  max="144"
                  min="40"
                  onChange={(event) =>
                    updateToken(activeToken.id, (token) => ({
                      ...token,
                      size: Number(event.target.value),
                    }))
                  }
                  type="range"
                  value={activeToken.size}
                />
              </label>

              <label className="field range-field">
                <span>Поворот: {activeToken.rotation}°</span>
                <input
                  max="360"
                  min="0"
                  onChange={(event) =>
                    updateToken(activeToken.id, (token) => ({
                      ...token,
                      rotation: Number(event.target.value),
                    }))
                  }
                  type="range"
                  value={activeToken.rotation}
                />
              </label>

              <div className="zone-grid">
                <label className="field">
                  <span>Текущие ХП</span>
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
                <label className="field token-layer-field">
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
                <button
                  aria-label="Ниже"
                  className="ghost-button compact-button token-modal-icon-button"
                  onClick={() =>
                    updateToken(activeToken.id, (token) => ({
                      ...token,
                      zIndex: token.zIndex - 1,
                    }))
                  }
                  title="Ниже"
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-arrow-down" />
                </button>
                <button
                  aria-label="Выше"
                  className="ghost-button compact-button token-modal-icon-button"
                  onClick={() =>
                    updateToken(activeToken.id, (token) => ({
                      ...token,
                      zIndex: token.zIndex + 1,
                    }))
                  }
                  title="Выше"
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-arrow-up" />
                </button>
                <button
                  aria-label={
                    activeToken.hiddenFromPlayers
                      ? 'Фишка скрыта от игроков'
                      : 'Фишка видима игрокам'
                  }
                  className="ghost-button compact-button token-modal-icon-button token-visibility-toggle"
                  onClick={() =>
                    updateToken(activeToken.id, (token) => ({
                      ...token,
                      hiddenFromPlayers: !token.hiddenFromPlayers,
                    }))
                  }
                  title={
                    activeToken.hiddenFromPlayers
                      ? 'Фишка скрыта от игроков'
                      : 'Фишка видима игрокам'
                  }
                  type="button"
                >
                  <i
                    aria-hidden="true"
                    className={`fa-solid ${
                      activeToken.hiddenFromPlayers ? 'fa-eye-slash' : 'fa-eye'
                    }`}
                  />
                </button>
              </div>

              {activeScene ? (
                <label className="field">
                  <span>Связанный монстр</span>
                  <select
                    onChange={(event) =>
                      updateToken(activeToken.id, (token) => ({
                        ...token,
                        kind: event.target.value ? 'monster' : token.kind,
                        linkedMonsterId: event.target.value || null,
                      }))
                    }
                    value={activeToken.linkedMonsterId ?? ''}
                  >
                    <option value="">не привязан</option>
                    {activeScene.monsterBlocks.map((monster) => (
                      <option key={monster.id} value={monster.id}>
                        {monster.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {activeTokenLinkedMonster ? (
                <p className="editor-hint">
                  Связанный монстр: <strong>{activeTokenLinkedMonster.name}</strong>
                </p>
              ) : null}

              <div className="action-row zone-action-row">
                <button
                  aria-label="Дублировать"
                  className="ghost-button compact-button token-modal-icon-button"
                  onClick={() => duplicateToken(activeToken)}
                  title="Дублировать"
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-copy" />
                </button>
                <button
                  aria-label="Синхронизировать с монстром"
                  className="ghost-button compact-button token-modal-icon-button"
                  disabled={!activeTokenLinkedMonster}
                  onClick={() => syncTokenStatsFromMonster(activeToken)}
                  title="Синхронизировать с монстром"
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-link" />
                </button>
                <button
                  aria-label="Открыть монстра"
                  className="ghost-button compact-button token-modal-icon-button"
                  disabled={!activeTokenLinkedMonster}
                  onClick={() => focusTokenLinkedMonster(activeToken)}
                  title="Открыть монстра"
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-address-card fa-vcard" />
                </button>
                <button
                  aria-label="Удалить фишку"
                  className="ghost-button compact-button token-modal-icon-button"
                  onClick={() => removeToken(activeToken.id)}
                  title="Удалить фишку"
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-trash" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isServiceMarkerModalOpen && activeServiceMarker ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsServiceMarkerModalOpen(false)}
          role="presentation"
        >
          <div
            className="modal-dialog marker-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Редактор служебной отметки"
          >
            <div className="modal-header">
              <div className="control-group-copy">
                <span className="eyebrow">Служебная отметка</span>
                <p className="editor-hint">
                  Рзмени подпись, заметку Рё порядок слоя для о‚ме‚ки на карте.
                </p>
              </div>
              <button
                className="ghost-button compact-button"
                onClick={() => setIsServiceMarkerModalOpen(false)}
                type="button"
              >
                Закрыть
              </button>
            </div>

            <div className="editor-stack">
              <label className="field">
                <span>Подпись</span>
                <input
                  onChange={(event) =>
                    updateServiceMarker(activeServiceMarker.id, (marker) => ({
                      ...marker,
                      label: event.target.value,
                    }))
                  }
                  value={activeServiceMarker.label}
                />
              </label>

              <label className="field">
                <span>Заметка</span>
                <textarea
                  onChange={(event) =>
                    updateServiceMarker(activeServiceMarker.id, (marker) => ({
                      ...marker,
                      note: event.target.value,
                    }))
                  }
                  rows={4}
                  value={activeServiceMarker.note}
                />
              </label>

              <label className="field">
                <span>Порядок слоя</span>
                <input
                  onChange={(event) =>
                    updateServiceMarker(activeServiceMarker.id, (marker) => ({
                      ...marker,
                      zIndex: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={activeServiceMarker.zIndex}
                />
              </label>

              <div className="layer-controls">
                <button
                  className="ghost-button compact-button"
                  onClick={() =>
                    updateServiceMarker(activeServiceMarker.id, (marker) => ({
                      ...marker,
                      zIndex: marker.zIndex - 1,
                    }))
                  }
                  type="button"
                >
                  Ниже
                </button>
                <button
                  className="ghost-button compact-button"
                  onClick={() =>
                    updateServiceMarker(activeServiceMarker.id, (marker) => ({
                      ...marker,
                      zIndex: marker.zIndex + 1,
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
                  onClick={() => removeServiceMarker(activeServiceMarker.id)}
                  type="button"
                >
                  Удали‚ь отметку
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>







  )







}





