import { defaultMapGrid, tokenSpaceValues } from '../types/adventure'
import type {
  Adventure,
  AdventureScene,
  MapGridSettings,
  MapLayerInstance,
  MapViewport,
  MonsterBlock,
  PlayerCharacter,
  ProjectState,
  SceneRuntimeState,
  ServiceMarker,
  SessionState,
  TokenInstance,
} from '../types/adventure'

export const playerDisplayChannelName = 'adventure-display-player'
const projectStateStorageKey = 'adventure-display:project-state'

function looksLikeBrokenEncoding(value: string) {
  return /[ÐÑÕÏÃ]|ñë|Р.|С.|[\u0080-\u009f]/.test(value)
}

function encodeWindows1251Bytes(value: string) {
  const bytes: number[] = []

  for (const char of value) {
    const code = char.charCodeAt(0)

    if (code <= 0x7f) {
      bytes.push(code)
      continue
    }

    if (code >= 0x0410 && code <= 0x044f) {
      bytes.push(code - 0x0350)
      continue
    }

    if (code === 0x0401) {
      bytes.push(0xa8)
      continue
    }

    if (code === 0x0451) {
      bytes.push(0xb8)
      continue
    }

    if (code === 0x2014) {
      bytes.push(0x97)
      continue
    }

    if (code === 0x2116) {
      bytes.push(0xb9)
      continue
    }

    return null
  }

  return Uint8Array.from(bytes)
}

function tryDecodeByteString(value: string, encoding: string) {
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    return value
  }
}

function tryRepairClassicMojibake(value: string) {
  const bytes = encodeWindows1251Bytes(value)

  if (!bytes) {
    return value
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return value
  }
}

function scoreDecodedCandidate(value: string) {
  const cyrillicChars = (value.match(/[\u0400-\u04FF]/g) ?? []).length
  const latinChars = (value.match(/[A-Za-z]/g) ?? []).length
  const digitsAndSpaces = (value.match(/[\d\s.,:;!?()"'`-]/g) ?? []).length
  const controlChars = [...value].filter((char) => {
    const code = char.charCodeAt(0)
    return (code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)
  }).length
  const mojibakeMarkers =
    (value.match(/[ÐÑÕÏÃ]/g) ?? []).length +
    (value.match(/Р./g) ?? []).length +
    (value.match(/С./g) ?? []).length

  return cyrillicChars * 4 + digitsAndSpaces - latinChars - controlChars * 8 - mojibakeMarkers * 6
}

function generateRepairCandidates(value: string) {
  return [
    value,
    tryDecodeByteString(value, 'utf-8'),
    tryDecodeByteString(value, 'windows-1251'),
    tryRepairClassicMojibake(value),
    tryDecodeByteString(tryRepairClassicMojibake(value), 'utf-8'),
    tryRepairClassicMojibake(tryDecodeByteString(value, 'windows-1251')),
    tryDecodeByteString(tryDecodeByteString(value, 'windows-1251'), 'utf-8'),
  ]
}

function isClearlyBrokenText(value: string) {
  if (!value.trim()) {
    return false
  }

  const hasBrokenMarkers = /[ÐÑÕÏÃ]|ñë|Р.|С.|[\u0080-\u009f]/.test(value)
  const controlChars = [...value].filter((char) => {
    const code = char.charCodeAt(0)
    return (code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)
  }).length
  const cyrillicChars = (value.match(/[\u0400-\u04FF]/g) ?? []).length
  const latinChars = (value.match(/[A-Za-z]/g) ?? []).length

  return hasBrokenMarkers || controlChars > 0 || (cyrillicChars === 0 && latinChars > 2)
}

function repairMojibakeString(value: string) {
  const trimmed = value.trim()

  if (
    !trimmed ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    !looksLikeBrokenEncoding(trimmed)
  ) {
    return trimmed
  }

  const seen = new Set<string>()
  let frontier = [trimmed]
  const candidates: string[] = [trimmed]

  for (let depth = 0; depth < 3; depth += 1) {
    const nextFrontier: string[] = []

    for (const candidate of frontier) {
      for (const generated of generateRepairCandidates(candidate)) {
        if (!seen.has(generated)) {
          seen.add(generated)
          candidates.push(generated)
          nextFrontier.push(generated)
        }
      }
    }

    frontier = nextFrontier
  }

  return candidates.reduce((best, candidate) =>
    scoreDecodedCandidate(candidate) > scoreDecodedCandidate(best) ? candidate : best,
  )
}

function pickReadableString(primary: string, fallback: string) {
  const repairedPrimary = repairMojibakeString(primary)
  const repairedFallback = repairMojibakeString(fallback)

  if (!repairedPrimary.trim()) {
    return repairedFallback
  }

  if (isClearlyBrokenText(repairedPrimary) && !isClearlyBrokenText(repairedFallback)) {
    return repairedFallback
  }

  return scoreDecodedCandidate(repairedFallback) > scoreDecodedCandidate(repairedPrimary) + 3
    ? repairedFallback
    : repairedPrimary
}

function repairStringFields<T>(value: T): T {
  if (typeof value === 'string') {
    return repairMojibakeString(value) as T
  }

  if (Array.isArray(value)) {
    return value.map((entry) => repairStringFields(entry)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairStringFields(entry)]),
    ) as T
  }

  return value
}

function normalizeMonsterBlock(monster: MonsterBlock): MonsterBlock {
  return {
    ...monster,
    imageAssetId: monster.imageAssetId ?? null,
    imageSrc: monster.imageSrc ?? null,
  }
}

function collectAdventureMonsterLibrary(adventure: Adventure): MonsterBlock[] {
  const explicitLibrary = (adventure as Adventure & { monsterLibrary?: MonsterBlock[] }).monsterLibrary

  if (
    Array.isArray(explicitLibrary) &&
    (explicitLibrary.length > 0 || (adventure.scenes ?? []).every((scene) => (scene.monsterBlocks ?? []).length === 0))
  ) {
    return explicitLibrary.map(normalizeMonsterBlock)
  }

  const seen = new Set<string>()
  const monsters: MonsterBlock[] = []

  for (const scene of adventure.scenes ?? []) {
    for (const monster of scene.monsterBlocks ?? []) {
      if (seen.has(monster.id)) {
        continue
      }

      seen.add(monster.id)
      monsters.push(normalizeMonsterBlock(monster))
    }
  }

  return monsters
}

function normalizeAdventure(adventure: Adventure): Adventure {
  const repairedAdventure = repairStringFields(adventure)
  const monsterLibrary = collectAdventureMonsterLibrary(repairedAdventure)
  const adventureMonsterIds = new Set(monsterLibrary.map((monster) => monster.id))
  const characters = (repairedAdventure.characters ?? []).map((character) => ({
    ...character,
    avatarAssetId: character.avatarAssetId ?? null,
    avatarSrc: character.avatarSrc ?? null,
    source: character.source ?? '',
    importedAt: character.importedAt ?? new Date().toISOString(),
    attacksAndSpellsText: character.attacksAndSpellsText ?? '',
    attackFeaturesText: character.attackFeaturesText ?? '',
    otherProficienciesAndLanguages: character.otherProficienciesAndLanguages ?? '',
    spellcasting: {
      ...character.spellcasting,
      slots: character.spellcasting?.slots ?? [],
      knownSpells: character.spellcasting?.knownSpells ?? [],
      spells: character.spellcasting?.spells ?? [],
    },
  }))
  const playerTokens = normalizeAdventurePlayerTokens(
    characters,
    Array.isArray((repairedAdventure as Adventure & { playerTokens?: TokenInstance[] }).playerTokens)
      ? (repairedAdventure as Adventure & { playerTokens?: TokenInstance[] }).playerTokens
      : [],
  )

  return {
    ...repairedAdventure,
    assetLibrary: repairedAdventure.assetLibrary ?? [],
    audioLibrary: (repairedAdventure.audioLibrary ?? []).map((track) => ({
      ...track,
      assetId: track.assetId ?? null,
      src: track.src ?? '',
    })),
    characters,
    playerTokens,
    scenes: (repairedAdventure.scenes ?? []).map((scene) => {
      const rawMonsterIds = Array.isArray((scene as AdventureScene & { monsterIds?: string[] }).monsterIds)
        ? (scene as AdventureScene & { monsterIds?: string[] }).monsterIds
        : (scene.monsterBlocks ?? []).map((monster) => monster.id)
      const monsterIds = Array.from(new Set(rawMonsterIds)).filter((monsterId) => adventureMonsterIds.has(monsterId))
      const sceneMonsterIds = new Set(monsterIds)

      return {
        ...scene,
        splash: {
          title: pickReadableString(scene.splash?.title ?? '', scene.title),
          subtitle: pickReadableString(scene.splash?.subtitle ?? '', scene.location),
          body: pickReadableString(scene.splash?.body ?? '', scene.gmSummary ?? ''),
          imageAssetId: scene.splash?.imageAssetId ?? null,
          imageSrc: scene.splash?.imageSrc ?? null,
        },
        zones: (scene.zones ?? []).map((zone) => ({
          ...zone,
          focusNote: zone.focusNote ?? '',
          linkedHandoutId:
            scene.handouts?.some((handout) => handout.id === zone.linkedHandoutId)
              ? zone.linkedHandoutId
              : null,
          linkedCheckId:
            scene.checksClues?.some((entry) => entry.id === zone.linkedCheckId)
              ? zone.linkedCheckId
              : null,
          linkedMonsterId:
            sceneMonsterIds.has(zone.linkedMonsterId ?? '')
              ? zone.linkedMonsterId
              : null,
          autoRevealOnEnter: zone.autoRevealOnEnter ?? false,
        })),
        map: {
          ...scene.map,
          imageAssetId: scene.map.imageAssetId ?? null,
          imageSrc: scene.map.imageSrc ?? null,
        },
        handouts: (scene.handouts ?? []).map((handout) => ({
          ...handout,
          imageAssetId: handout.imageAssetId ?? null,
          imageSrc: handout.imageSrc ?? null,
        })),
        monsterIds,
        monsterBlocks: (scene.monsterBlocks ?? []).map((monster) => ({
          ...normalizeMonsterBlock(monster),
        })),
      }
    }),
    monsterLibrary,
  }
}

function createDefaultMapViewport(): MapViewport {
  return {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
}

function normalizeMapGrid(value?: Partial<MapGridSettings> | null): MapGridSettings {
  const columns =
    typeof value?.columns === 'number'
      ? Math.max(1, Math.round(value.columns))
      : defaultMapGrid.columns
  const rows =
    typeof value?.rows === 'number'
      ? Math.max(1, Math.round(value.rows))
      : defaultMapGrid.rows

  return { columns, rows }
}

function createBaseMapLayer(scene: AdventureScene): MapLayerInstance {
  return {
    id: `${scene.id}-base-layer`,
    title: scene.map.title || 'Базовая карта',
    imageSrc: scene.map.imageSrc ?? null,
    isActive: true,
    visibleToGm: true,
    visibleToPlayers: true,
    scale: 1,
    rotation: 0,
  }
}

function createInitialSceneRuntimeState(scene: AdventureScene): SceneRuntimeState {
  return {
    mapImageSrc: scene.map.imageSrc ?? null,
    mapLayers: [createBaseMapLayer(scene)],
    tokens: [],
    activeInitiativeTokenId: null,
    serviceMarkers: [],
    fogCells: [],
    hiddenZoneIds: [],
    mapGrid: normalizeMapGrid(),
    mapGridVisible: true,
    mapViewport: createDefaultMapViewport(),
  }
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

function normalizeTokenSpace(token: Partial<TokenInstance> & { size?: number }) {
  if (typeof token.space === 'string' && tokenSpaceValues.includes(token.space as typeof tokenSpaceValues[number])) {
    return token.space
  }

  if (typeof token.size === 'number') {
    if (token.size >= 104) {
      return 'huge'
    }

    if (token.size >= 80) {
      return 'large'
    }
  }

  return 'medium'
}

function createFallbackCharacterImage(name: string) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="64" fill="#2f271f"/>
      <circle cx="64" cy="46" r="24" fill="#d9c7a8"/>
      <path d="M24 112c7-27 23-42 40-42s33 15 40 42" fill="#8f6a44"/>
      <text x="64" y="73" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#241b14">${initial}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function normalizeTokenNumbers(token: Partial<TokenInstance>, index: number) {
  return {
    x: typeof token.x === 'number' && Number.isFinite(token.x) ? token.x : 50,
    y: typeof token.y === 'number' && Number.isFinite(token.y) ? token.y : 50,
    rotation: typeof token.rotation === 'number' && Number.isFinite(token.rotation) ? token.rotation : 0,
    hitPointsCurrent:
      typeof token.hitPointsCurrent === 'number' ? token.hitPointsCurrent : null,
    hitPointsMax: typeof token.hitPointsMax === 'number' ? token.hitPointsMax : null,
    hitPointsTemp: typeof token.hitPointsTemp === 'number' ? token.hitPointsTemp : null,
    initiative: typeof token.initiative === 'number' ? token.initiative : null,
    zIndex: typeof token.zIndex === 'number' && Number.isFinite(token.zIndex) ? token.zIndex : 10 + index,
  }
}

export function createPlayerTokenForCharacter(
  character: PlayerCharacter,
  index = 0,
  existingToken?: Partial<TokenInstance> | null,
): TokenInstance {
  const numbers = normalizeTokenNumbers(existingToken ?? {}, index)
  const hitPointsMax = numbers.hitPointsMax ?? character.hpMax
  const hitPointsCurrent =
    numbers.hitPointsCurrent ?? character.hpCurrent ?? hitPointsMax

  return {
    id: existingToken?.id || `player-token-${character.id}`,
    name: character.name || existingToken?.name || 'Персонаж',
    kind: 'player',
    linkedMonsterId: null,
    linkedCharacterId: character.id,
    groupLabel: null,
    imageSrc:
      character.avatarSrc ||
      existingToken?.imageSrc ||
      createFallbackCharacterImage(character.name),
    x: numbers.x,
    y: numbers.y,
    space: normalizeTokenSpace(existingToken ?? {}),
    rotation: numbers.rotation,
    hiddenFromPlayers: existingToken?.hiddenFromPlayers ?? false,
    hitPointsCurrent,
    hitPointsMax,
    hitPointsTemp: numbers.hitPointsTemp,
    initiative: numbers.initiative ?? character.initiative,
    conditions: existingToken?.conditions ?? character.conditions ?? [],
    zIndex: numbers.zIndex,
  }
}

function normalizeAdventurePlayerTokens(
  characters: PlayerCharacter[],
  candidateTokens: Partial<TokenInstance>[],
) {
  return characters.map((character, index) => {
    const existingToken =
      candidateTokens.find((token) => token.linkedCharacterId === character.id) ??
      candidateTokens.find((token) => token.id === `player-token-${character.id}`) ??
      null

    return createPlayerTokenForCharacter(character, index, existingToken)
  })
}

function isSceneBoundToken(token: TokenInstance) {
  return token.kind !== 'player' && !token.linkedCharacterId
}

function collectScenePlayerTokens(session?: SessionState | null) {
  if (!session) {
    return []
  }

  return Object.values(session.sceneStates ?? {}).flatMap((sceneState) =>
    (sceneState.tokens ?? []).filter((token) => !isSceneBoundToken(token)),
  )
}

function syncSceneRuntimeStateWithScene(
  scene: AdventureScene,
  currentSceneState?: SceneRuntimeState,
  monsterLibrary: MonsterBlock[] = [],
): SceneRuntimeState {
  const nextState = repairStringFields(
    currentSceneState ?? createInitialSceneRuntimeState(scene),
  )
  const safeLayers =
    nextState.mapLayers && nextState.mapLayers.length > 0
      ? nextState.mapLayers
      : [createBaseMapLayer(scene)]

  const [firstLayer, ...otherLayers] = safeLayers
  const baseLayer: MapLayerInstance = {
    ...(firstLayer ?? createBaseMapLayer(scene)),
    title: scene.map.title || firstLayer?.title || 'Базовая карта',
    imageSrc:
      nextState.mapImageSrc ??
      firstLayer?.imageSrc ??
      scene.map.imageSrc ??
      null,
    visibleToGm: firstLayer?.visibleToGm ?? true,
    visibleToPlayers: firstLayer?.visibleToPlayers ?? true,
    isActive: firstLayer?.isActive ?? true,
    scale:
      typeof firstLayer?.scale === 'number' && Number.isFinite(firstLayer.scale)
        ? Math.max(0.1, firstLayer.scale)
        : 1,
    rotation:
      typeof firstLayer?.rotation === 'number' && Number.isFinite(firstLayer.rotation)
        ? firstLayer.rotation
        : 0,
  }

  const normalizedOtherLayers = otherLayers.map((layer) => ({
    ...layer,
    isActive: layer?.isActive ?? false,
    scale:
      typeof layer?.scale === 'number' && Number.isFinite(layer.scale)
        ? Math.max(0.1, layer.scale)
        : 1,
    rotation:
      typeof layer?.rotation === 'number' && Number.isFinite(layer.rotation)
        ? layer.rotation
        : 0,
  }))

  const normalizedLayers = [baseLayer, ...normalizedOtherLayers]
  const activeLayerIndex = normalizedLayers.findIndex((layer) => layer.isActive)
  const normalizedActiveLayers = normalizedLayers.map((layer, index) => ({
    ...layer,
    isActive: activeLayerIndex >= 0 ? index === activeLayerIndex : index === 0,
  }))

  const normalizedTokens: TokenInstance[] = (nextState.tokens ?? [])
    .filter(isSceneBoundToken)
    .map(
    (token, index) => ({
      ...token,
      linkedMonsterId:
        monsterLibrary.some((monster) => monster.id === token.linkedMonsterId)
          ? token.linkedMonsterId
          : null,
      linkedCharacterId: token.linkedCharacterId ?? null,
      groupLabel: token.groupLabel ?? null,
      space: normalizeTokenSpace(token),
      rotation: typeof token.rotation === 'number' ? token.rotation : 0,
      hiddenFromPlayers: token.hiddenFromPlayers ?? false,
      hitPointsCurrent:
        typeof token.hitPointsCurrent === 'number' ? token.hitPointsCurrent : null,
      hitPointsMax: typeof token.hitPointsMax === 'number' ? token.hitPointsMax : null,
      hitPointsTemp: typeof token.hitPointsTemp === 'number' ? token.hitPointsTemp : null,
      initiative: typeof token.initiative === 'number' ? token.initiative : null,
      conditions: token.conditions ?? [],
      zIndex: token.zIndex ?? 10 + index,
    }),
  )
  const normalizedServiceMarkers: ServiceMarker[] = (
    nextState.serviceMarkers ?? []
  ).map((marker, index) => ({
    ...marker,
    linkedHandoutId:
      scene.handouts?.some((handout) => handout.id === marker.linkedHandoutId)
        ? marker.linkedHandoutId
        : null,
    linkedCheckId:
      scene.checksClues?.some((entry) => entry.id === marker.linkedCheckId)
        ? marker.linkedCheckId
        : null,
    zIndex: marker.zIndex ?? 100 + index,
  }))
  const initiativeTokens = sortTokensByInitiative(normalizedTokens)
  const activeInitiativeTokenId =
    nextState.activeInitiativeTokenId &&
    normalizedTokens.some((token) => token.id === nextState.activeInitiativeTokenId)
      ? nextState.activeInitiativeTokenId
      : (initiativeTokens[0]?.id ?? null)

  return {
    mapImageSrc: baseLayer.imageSrc,
    mapLayers: normalizedActiveLayers,
    tokens: normalizedTokens,
    activeInitiativeTokenId,
    serviceMarkers: normalizedServiceMarkers,
    fogCells: nextState.fogCells ?? [],
    hiddenZoneIds: (nextState.hiddenZoneIds ?? []).filter((zoneId) => scene.zones.some((zone) => zone.id === zoneId)),
    mapGrid: normalizeMapGrid(nextState.mapGrid),
    mapGridVisible: nextState.mapGridVisible ?? true,
    mapViewport: {
      ...createDefaultMapViewport(),
      ...(nextState.mapViewport ?? {}),
    },
  }
}

export function createInitialSessionState(adventure: Adventure): SessionState {
  const safeAdventure = normalizeAdventure(adventure)
  const firstScene = safeAdventure.scenes[0]

  return {
    playerDisplay: {
      sceneId: firstScene?.id ?? null,
      mode: 'standby',
      activeHandoutId: null,
      updatedAt: new Date().toISOString(),
    },
    sceneStates: Object.fromEntries(
      safeAdventure.scenes.map((scene) => [
        scene.id,
        createInitialSceneRuntimeState(scene),
      ]),
    ),
  }
}

export function createInitialProjectState(adventure: Adventure): ProjectState {
  const safeAdventure = normalizeAdventure(adventure)

  return {
    activeAdventureId: safeAdventure.id,
    adventureOrder: [safeAdventure.id],
    adventures: {
      [safeAdventure.id]: safeAdventure,
    },
    sessions: {
      [safeAdventure.id]: createInitialSessionState(safeAdventure),
    },
    monsterLibrary: [],
  }
}

export function syncSessionStateWithAdventure(
  adventure: Adventure,
  currentSession: SessionState,
): SessionState {
  const monsterLibrary = adventure.monsterLibrary ?? []
  const existingIds = new Set(adventure.scenes.map((scene) => scene.id))
  const firstSceneId = adventure.scenes[0]?.id ?? null

  const nextSceneStates = Object.fromEntries(
    adventure.scenes.map((scene) => {
      const sceneMonsterIds = new Set(scene.monsterIds ?? [])
      const sceneMonsters = monsterLibrary.filter((monster) => sceneMonsterIds.has(monster.id))

      return [
        scene.id,
        syncSceneRuntimeStateWithScene(scene, currentSession.sceneStates[scene.id], sceneMonsters),
      ]
    }),
  )

  const nextSceneId = currentSession.playerDisplay.sceneId
  const safeSceneId = nextSceneId && existingIds.has(nextSceneId) ? nextSceneId : firstSceneId

  let safeHandoutId = currentSession.playerDisplay.activeHandoutId
  const safeMode = currentSession.playerDisplay.mode === 'handout' ? 'map' : currentSession.playerDisplay.mode

  if ((safeMode === 'map' || currentSession.playerDisplay.mode === 'handout') && safeSceneId) {
    const scene = adventure.scenes.find((entry) => entry.id === safeSceneId)
    const handoutExists = scene?.handouts.some(
      (entry) => entry.id === safeHandoutId,
    )

    if (!handoutExists) {
      safeHandoutId = null
    }
  } else {
    safeHandoutId = null
  }

  return {
    playerDisplay: {
      ...currentSession.playerDisplay,
      sceneId: safeSceneId,
      mode: safeMode,
      activeHandoutId: safeHandoutId,
      updatedAt: new Date().toISOString(),
    },
    sceneStates: nextSceneStates,
  }
}

function syncAdventurePlayerTokens(
  adventure: Adventure,
  currentSession?: SessionState | null,
): Adventure {
  const scenePlayerTokens = collectScenePlayerTokens(currentSession)
  const playerTokens = normalizeAdventurePlayerTokens(
    adventure.characters,
    [...scenePlayerTokens, ...(adventure.playerTokens ?? [])],
  )

  return {
    ...adventure,
    playerTokens,
  }
}

function isLegacyProjectState(
  value: unknown,
): value is { adventure: Adventure; session: SessionState } {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'adventure' in value && 'session' in value
}

export function syncProjectState(currentState: ProjectState): ProjectState {
  const safeOrder = currentState.adventureOrder.filter(
    (adventureId) => currentState.adventures[adventureId],
  )
  const missingIds = Object.keys(currentState.adventures).filter(
    (adventureId) => !safeOrder.includes(adventureId),
  )
  const adventureOrder = [...safeOrder, ...missingIds]
  const fallbackAdventureId = adventureOrder[0] ?? null
  const activeAdventureId =
    currentState.activeAdventureId && currentState.adventures[currentState.activeAdventureId]
      ? currentState.activeAdventureId
      : fallbackAdventureId

  const normalizedEntries = adventureOrder.map((adventureId) => {
    const normalizedAdventure = normalizeAdventure(currentState.adventures[adventureId])
    const currentSession =
      currentState.sessions[adventureId] ?? createInitialSessionState(normalizedAdventure)
    const adventure = syncAdventurePlayerTokens(normalizedAdventure, currentSession)
    const session = syncSessionStateWithAdventure(adventure, currentSession)

    return [adventureId, adventure, session] as const
  })
  const sessions = Object.fromEntries(
    normalizedEntries.map(([adventureId, , session]) => [adventureId, session]),
  )

  return {
    activeAdventureId,
    adventureOrder,
    adventures: Object.fromEntries(
      normalizedEntries.map(([adventureId, adventure]) => [adventureId, adventure]),
    ),
    sessions,
    monsterLibrary: Array.isArray(currentState.monsterLibrary)
      ? currentState.monsterLibrary.map((monster) => ({
          ...monster,
          imageAssetId: monster.imageAssetId ?? null,
          imageSrc: monster.imageSrc ?? null,
        }))
      : [],
  }
}

export function getActiveAdventureBundle(state: ProjectState) {
  const adventureId = state.activeAdventureId

  if (!adventureId) {
    return null
  }

  const adventure = state.adventures[adventureId]
  const session = state.sessions[adventureId]

  if (!adventure || !session) {
    return null
  }

  return {
    adventureId,
    adventure,
    session,
  }
}

export function loadProjectState(fallback: ProjectState): ProjectState {
  const raw = window.localStorage.getItem(projectStateStorageKey)

  if (!raw) {
    return syncProjectState(fallback)
  }

  try {
    const parsed = JSON.parse(raw) as ProjectState | { adventure: Adventure; session: SessionState }

    if (isLegacyProjectState(parsed)) {
      return syncProjectState({
        activeAdventureId: parsed.adventure.id,
        adventureOrder: [parsed.adventure.id],
        adventures: {
          [parsed.adventure.id]: parsed.adventure,
        },
        sessions: {
          [parsed.adventure.id]: parsed.session,
        },
        monsterLibrary: [],
      })
    }

    return syncProjectState(parsed as ProjectState)
  } catch {
    return syncProjectState(fallback)
  }
}

export function saveProjectState(state: ProjectState) {
  try {
    window.localStorage.setItem(projectStateStorageKey, JSON.stringify(state))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error(
        'Недостаточно места в хранилище браузера. Уменьши размер загружаемых изображений или замени слишком большие карты.',
      )
    }

    throw error
  }
}
