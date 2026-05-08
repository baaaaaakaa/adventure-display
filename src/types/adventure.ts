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
export const tokenSpaceValues = ['small', 'medium', 'large', 'huge'] as const
export type TokenSpace = (typeof tokenSpaceValues)[number]
export const tokenSpaceLabels: Record<TokenSpace, string> = {
  small: 'Маленький (1x1)',
  medium: 'Средний (1x1)',
  large: 'Большой (2x2)',
  huge: 'Огромный (3x3)',
}
export const tokenSpaceFootprints: Record<TokenSpace, number> = {
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
}
export const defaultMapGrid = {
  columns: 24,
  rows: 16,
} as const
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

export interface PlayerCharacterStat {
  id: string
  label: string
  score: number
  modifier: number
  check: number
  save: number
  isSaveProficient: boolean
}

export interface PlayerCharacterSkill {
  id: string
  label: string
  baseStat: string
  modifier: number
  isProficient: boolean
}

export interface PlayerCharacterAttack {
  id: string
  name: string
  bonus: string
  damage: string
  isProficient: boolean
}

export interface PlayerCharacterSpellSlots {
  level: number
  total: number | null
  used: number | null
}

export interface PlayerCharacterSpell {
  id: string
  level: number
  name: string
  summary: string
  prepared: boolean
}

export interface PlayerCharacterSpellcasting {
  ability: string
  saveDc: string
  attackBonus: string
  mode: string
  revision: string
  slots: PlayerCharacterSpellSlots[]
  knownSpells: string[]
  spells: PlayerCharacterSpell[]
}

export interface PlayerCharacter {
  id: string
  name: string
  playerName: string
  race: string
  className: string
  subclass: string
  level: number | null
  background: string
  alignment: string
  experience: string
  avatarSrc?: string | null
  avatarAssetId?: string | null
  armorClass: number | null
  speed: number | null
  initiative: number | null
  proficiencyBonus: number
  hpCurrent: number | null
  hpMax: number | null
  hpTemp: number | null
  hitDie: string
  hitDiceCurrent: number | null
  stats: PlayerCharacterStat[]
  skills: PlayerCharacterSkill[]
  passiveSenses: PlayerCharacterSkill[]
  attacks: PlayerCharacterAttack[]
  subInfo: Record<string, string>
  text: Record<string, string>
  attacksAndSpellsText: string
  attackFeaturesText: string
  otherProficienciesAndLanguages: string
  coins: Record<string, number>
  conditions: string[]
  spellcasting: PlayerCharacterSpellcasting
  source: string
  importedAt: string
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
  source: string
  size: string
  creatureType: string
  alignment: string
  proficiencyBonus: string
  imageAssetId?: string | null
  imageSrc?: string | null
  armorClass: string
  hitPoints: string
  hitPointsFormula: string
  speed: string
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  savingThrows: string
  skills: string
  damageVulnerabilities: string
  damageResistances: string
  damageImmunities: string
  conditionImmunities: string
  senses: string
  languages: string
  challenge: string
  traits: MonsterFeature[]
  actions: MonsterFeature[]
  bonusActions: MonsterFeature[]
  reactions: MonsterFeature[]
  legendaryActions: MonsterFeature[]
  infoSections?: MonsterFeature[]
  notes: string
}

export interface SpellBlock {
  id: string
  name: string
  level: number
  school: string
  source: string
  castingTime: string
  range: string
  components: string
  duration: string
  attackBonus: string
  save: string
  damage: string
  classes: string[]
  tags: string[]
  description: string
  isRitual: boolean
  requiresConcentration: boolean
  createdByUser: boolean
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
  monsterIds: string[]
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
  characters: PlayerCharacter[]
  playerTokens: TokenInstance[]
  monsterLibrary: MonsterBlock[]
  scenes: AdventureScene[]
}

export interface TokenInstance {
  id: string
  name: string
  kind: TokenKind
  linkedMonsterId?: string | null
  linkedCharacterId?: string | null
  groupLabel?: string | null
  imageSrc: string
  x: number
  y: number
  space: TokenSpace
  rotation: number
  hiddenFromPlayers: boolean
  hitPointsCurrent?: number | null
  hitPointsMax?: number | null
  hitPointsTemp?: number | null
  initiative?: number | null
  conditions?: string[]
  zIndex: number
}

export interface MapLayerInstance {
  id: string
  title: string
  imageSrc: string | null
  isActive: boolean
  visibleToGm: boolean
  visibleToPlayers: boolean
  scale: number
  rotation: number
}

export interface ServiceMarker {
  id: string
  label: string
  note: string
  linkedHandoutId?: string | null
  linkedCheckId?: string | null
  x: number
  y: number
  zIndex: number
}

export interface MapViewport {
  scale: number
  offsetX: number
  offsetY: number
}

export interface MapGridSettings {
  columns: number
  rows: number
}

export interface SceneRuntimeState {
  mapImageSrc: string | null
  mapLayers: MapLayerInstance[]
  tokens: TokenInstance[]
  activeInitiativeTokenId?: string | null
  serviceMarkers: ServiceMarker[]
  fogCells: string[]
  hiddenZoneIds: string[]
  mapGrid: MapGridSettings
  mapGridVisible: boolean
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
  monsterLibrary: MonsterBlock[]
}

export type ProjectState = AdventureLibraryState
