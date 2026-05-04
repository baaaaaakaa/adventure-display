import type { MonsterBlock, MonsterFeature } from '../types/adventure'
import { resolvePublicAssetSrc } from './publicAssets'

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return fallback
}

function readNumber(value: unknown, fallback = 10) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number.parseInt(readString(value), 10)

  return Number.isFinite(parsed) ? parsed : fallback
}

function readFeatureList(value: unknown): MonsterFeature[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((feature, index) => ({
      id: readString(feature.id) || `feature-${index + 1}`,
      title: readString(feature.title ?? feature.name),
      body: readString(feature.body ?? feature.value),
    }))
    .filter((feature) => feature.title || feature.body)
}

function normalizeMonster(rawMonster: unknown): MonsterBlock | null {
  if (!isRecord(rawMonster)) {
    return null
  }

  const id = readString(rawMonster.id)
  const name = readString(rawMonster.name)

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    subtitle: readString(rawMonster.subtitle),
    source: readString(rawMonster.source),
    size: readString(rawMonster.size),
    creatureType: readString(rawMonster.creatureType),
    alignment: readString(rawMonster.alignment),
    proficiencyBonus: readString(rawMonster.proficiencyBonus),
    imageAssetId: null,
    imageSrc: resolvePublicAssetSrc(readString(rawMonster.imageSrc)) || null,
    armorClass: readString(rawMonster.armorClass),
    hitPoints: readString(rawMonster.hitPoints),
    hitPointsFormula: readString(rawMonster.hitPointsFormula),
    speed: readString(rawMonster.speed),
    strength: readNumber(rawMonster.strength),
    dexterity: readNumber(rawMonster.dexterity),
    constitution: readNumber(rawMonster.constitution),
    intelligence: readNumber(rawMonster.intelligence),
    wisdom: readNumber(rawMonster.wisdom),
    charisma: readNumber(rawMonster.charisma),
    savingThrows: readString(rawMonster.savingThrows),
    skills: readString(rawMonster.skills),
    damageVulnerabilities: readString(rawMonster.damageVulnerabilities),
    damageResistances: readString(rawMonster.damageResistances),
    damageImmunities: readString(rawMonster.damageImmunities),
    conditionImmunities: readString(rawMonster.conditionImmunities),
    senses: readString(rawMonster.senses),
    languages: readString(rawMonster.languages),
    challenge: readString(rawMonster.challenge),
    traits: readFeatureList(rawMonster.traits),
    actions: readFeatureList(rawMonster.actions),
    bonusActions: readFeatureList(rawMonster.bonusActions),
    reactions: readFeatureList(rawMonster.reactions),
    legendaryActions: readFeatureList(rawMonster.legendaryActions),
    infoSections: readFeatureList(rawMonster.infoSections),
    notes: readString(rawMonster.notes),
  }
}

function collectRawMonsters(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return []
  }

  if (Array.isArray(value.monsters)) {
    return value.monsters
  }

  if (Array.isArray(value.items)) {
    return value.items
  }

  if (Array.isArray(value.data)) {
    return value.data
  }

  return []
}

function getChallengeSortValue(challenge: string) {
  const normalized = challenge.split(' ')[0]?.trim() ?? ''
  const aliases: Record<string, number> = {
    '-': -1,
    '--': -1,
    '—': -1,
    '1/8': 0.125,
    '1/4': 0.25,
    '1/2': 0.5,
  }

  const numericValue = Number(normalized)

  return aliases[normalized] ?? (Number.isFinite(numericValue) ? numericValue : 0)
}

export function normalizeBestiary(value: unknown): MonsterBlock[] {
  const seen = new Set<string>()

  return collectRawMonsters(value)
    .map(normalizeMonster)
    .filter((monster): monster is MonsterBlock => Boolean(monster))
    .filter((monster) => {
      if (seen.has(monster.id)) {
        return false
      }

      seen.add(monster.id)
      return true
    })
    .sort((left, right) => {
      const challengeDiff = getChallengeSortValue(left.challenge) - getChallengeSortValue(right.challenge)

      return challengeDiff || left.name.localeCompare(right.name, 'ru-RU')
    })
}
