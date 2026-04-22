export const sceneAccentValues = [
  'amber',
  'crimson',
  'ember',
  'gold',
  'olive',
  'rose',
  'slate',
  'teal',
  'violet',
] as const

export type SceneAccent = (typeof sceneAccentValues)[number]

export const sceneAccentLabels: Record<SceneAccent, string> = {
  amber: 'янтарный',
  crimson: 'алый',
  ember: 'угольный',
  gold: 'золотой',
  olive: 'оливковый',
  rose: 'розовый',
  slate: 'сланцевый',
  teal: 'бирюзовый',
  violet: 'фиолетовый',
}

export type PlayerViewMode = 'map' | 'handout' | 'standby' | 'splash'

export type TokenKind = 'player' | 'monster' | 'npc'
export type AudioTrackKind = 'music' | 'ambience' | 'sfx'
export type AssetKind = 'image' | 'audio'

export interface AssetRecord {
  id: string
  title: string
  kind: AssetKind
  mimeType: string
  originalName: string
  dataUrl: string
}

export interface Handout {
  id: string
  title: string
  caption: string
  body: string
  imageAssetId?: string | null
  imageSrc?: string | null
}

export interface SceneMap {
  id: string
  title: string
  placeholder: string
  imageAssetId?: string | null
  imageSrc?: string | null
}

export interface SceneSplash {
  title: string
  subtitle: string
  body: string
  imageAssetId?: string | null
  imageSrc?: string | null
}

export interface AudioTrack {
  id: string
  title: string
  kind: AudioTrackKind
  assetId?: string | null
  src: string
}

export interface MonsterFeature {
  id: string
  title: string
  body: string
}

export interface MonsterBlock {
  id: string
  name: string
  subtitle: string
  imageAssetId?: string | null
  imageSrc?: string | null
  armorClass: string
  hitPoints: string
  speed: string
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  savingThrows: string
  skills: string
  senses: string
  languages: string
  challenge: string
  traits: MonsterFeature[]
  actions: MonsterFeature[]
  bonusActions: MonsterFeature[]
  reactions: MonsterFeature[]
  legendaryActions: MonsterFeature[]
  notes: string
}

export interface CheckClueEntry {
  id: string
  ability: string
  difficulty: string
  outcome: string
}

export interface MapZone {
  id: string
  title: string
  note: string
  focusNote: string
  linkedHandoutId?: string | null
  linkedCheckId?: string | null
  linkedMonsterId?: string | null
  x: number
  y: number
  width: number
  height: number
  visibleToPlayers: boolean
  autoRevealOnEnter: boolean
}

export interface AdventureScene {
  id: string
  title: string
  location: string
  accent: SceneAccent
  gmSummary: string
  gmNotes: string
  splash: SceneSplash
  map: SceneMap
  zones: MapZone[]
  handouts: Handout[]
  checksClues: CheckClueEntry[]
  monsterBlocks: MonsterBlock[]
  recommendedAudio: string[]
  objectives: string[]
}

export interface Adventure {
  id: string
  title: string
  subtitle: string
  assetLibrary: AssetRecord[]
  audioLibrary: AudioTrack[]
  scenes: AdventureScene[]
}

export interface TokenInstance {
  id: string
  name: string
  kind: TokenKind
  linkedMonsterId?: string | null
  groupLabel?: string | null
  imageSrc: string
  x: number
  y: number
  size: number
  rotation: number
  hiddenFromPlayers: boolean
  hitPointsCurrent?: number | null
  hitPointsMax?: number | null
  initiative?: number | null
  zIndex: number
}

export interface MapLayerInstance {
  id: string
  title: string
  imageSrc: string | null
  visibleToGm: boolean
  visibleToPlayers: boolean
}

export interface ServiceMarker {
  id: string
  label: string
  note: string
  x: number
  y: number
  zIndex: number
}

export interface MapViewport {
  scale: number
  offsetX: number
  offsetY: number
}

export interface SceneRuntimeState {
  mapImageSrc: string | null
  mapLayers: MapLayerInstance[]
  tokens: TokenInstance[]
  activeInitiativeTokenId?: string | null
  serviceMarkers: ServiceMarker[]
  fogCells: string[]
  mapViewport: MapViewport
}

export interface PlayerDisplayState {
  sceneId: string | null
  mode: PlayerViewMode
  activeHandoutId: string | null
  updatedAt: string
}

export interface SessionState {
  playerDisplay: PlayerDisplayState
  sceneStates: Record<string, SceneRuntimeState>
}

export interface AdventureLibraryState {
  activeAdventureId: string | null
  adventureOrder: string[]
  adventures: Record<string, Adventure>
  sessions: Record<string, SessionState>
}

export type ProjectState = AdventureLibraryState
