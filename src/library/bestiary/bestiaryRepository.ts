import type { MonsterBlock } from '../../types/adventure'
import { normalizeBestiary } from '../../lib/bestiaryImport'
import builtInBestiaryUrl from '../../data/bestiary/builtinBestiary.json?url'

export type MonsterSummary = Pick<
  MonsterBlock,
  | 'id'
  | 'name'
  | 'subtitle'
  | 'source'
  | 'size'
  | 'creatureType'
  | 'challenge'
  | 'armorClass'
  | 'hitPoints'
  | 'speed'
  | 'imageAssetId'
  | 'imageSrc'
>

let rawBuiltInBestiaryPromise: Promise<unknown[]> | null = null
let builtInBestiarySummaryPromise: Promise<MonsterSummary[]> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function collectRawMonsters(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (isRecord(value) && Array.isArray(value.monsters)) {
    return value.monsters
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items
  }

  return []
}

function toMonsterSummary(rawMonster: unknown): MonsterSummary | null {
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
    challenge: readString(rawMonster.challenge),
    armorClass: readString(rawMonster.armorClass),
    hitPoints: readString(rawMonster.hitPoints),
    speed: readString(rawMonster.speed),
    imageAssetId: null,
    imageSrc: readString(rawMonster.imageSrc) || null,
  }
}

async function readJsonAsset(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}: ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

export function loadBuiltInBestiary() {
  return loadRawBuiltInBestiary().then(normalizeBestiary)
}

function loadRawBuiltInBestiary() {
  rawBuiltInBestiaryPromise ??= readJsonAsset(builtInBestiaryUrl).then(collectRawMonsters)

  return rawBuiltInBestiaryPromise
}

export function loadBuiltInBestiarySummaries() {
  builtInBestiarySummaryPromise ??= loadRawBuiltInBestiary().then((rawMonsters) => {
    const seen = new Set<string>()
    const summaries: MonsterSummary[] = []

    rawMonsters.forEach((rawMonster) => {
      const summary = toMonsterSummary(rawMonster)

      if (!summary || seen.has(summary.id)) {
        return
      }

      seen.add(summary.id)
      summaries.push(summary)
    })

    return summaries
  })

  return builtInBestiarySummaryPromise
}

export function loadBuiltInMonsterDetail(monsterId: string) {
  return loadRawBuiltInBestiary().then((rawMonsters) => {
    const rawMonster = rawMonsters.find((monster) => isRecord(monster) && readString(monster.id) === monsterId)

    return normalizeBestiary(rawMonster ? [rawMonster] : [])[0] ?? null
  })
}
