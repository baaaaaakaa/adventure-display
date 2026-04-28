import type { SpellBlock } from '../types/adventure'

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readValue(value: unknown): unknown {
  if (isRecord(value) && 'value' in value) {
    return value.value
  }

  return value
}

function readString(value: unknown, fallback = '') {
  const nextValue = readValue(value)

  if (typeof nextValue === 'string') {
    return nextValue.trim()
  }

  if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
    return String(nextValue)
  }

  return fallback
}

function readBoolean(value: unknown) {
  const nextValue = readValue(value)

  if (typeof nextValue === 'boolean') {
    return nextValue
  }

  if (typeof nextValue === 'string') {
    return ['true', 'yes', '1', 'да'].includes(nextValue.toLocaleLowerCase('ru-RU'))
  }

  return false
}

function readNumber(value: unknown, fallback = 0) {
  const nextValue = readValue(value)

  if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
    return Math.max(0, Math.min(9, Math.round(nextValue)))
  }

  const parsed = Number.parseInt(readString(nextValue), 10)

  return Number.isFinite(parsed) ? Math.max(0, Math.min(9, parsed)) : fallback
}

function readArray(value: unknown) {
  const nextValue = readValue(value)

  if (!Array.isArray(nextValue)) {
    return []
  }

  return nextValue.map((item) => readString(item)).filter(Boolean)
}

function readFirstString(record: RawRecord, keys: string[]) {
  for (const key of keys) {
    const readableValue = readString(record[key])

    if (readableValue) {
      return readableValue
    }
  }

  return ''
}

function readNestedRecord(record: RawRecord, key: string) {
  const value = readValue(record[key])

  return isRecord(value) ? value : {}
}

function decodeHtmlEntities(value: string) {
  if (typeof document !== 'undefined') {
    const element = document.createElement('textarea')
    element.innerHTML = value
    return element.value
  }

  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function normalizeHtmlText(value: string) {
  if (!/[<&]/.test(value)) {
    return value.trim()
  }

  const text = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*p[^>]*>/gi, '')
    .replace(/<\s*(strong|b)[^>]*>/gi, '**')
    .replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    .replace(/<[^>]+>/g, '')

  return decodeHtmlEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function flattenRichText(value: unknown): string {
  const nextValue = readValue(value)

  if (typeof nextValue === 'string') {
    return normalizeHtmlText(nextValue)
  }

  if (Array.isArray(nextValue)) {
    return nextValue.map(flattenRichText).filter(Boolean).join('\n')
  }

  if (!isRecord(nextValue)) {
    return ''
  }

  if (typeof nextValue.text === 'string') {
    return nextValue.text
  }

  const data = isRecord(nextValue.data) ? nextValue.data : undefined

  return flattenRichText(data?.content ?? nextValue.content)
}

function normalizeSource(source: unknown) {
  const nextSource = readValue(source)

  if (typeof nextSource === 'string') {
    return nextSource.trim()
  }

  if (isRecord(nextSource)) {
    return [
      readFirstString(nextSource, ['book', 'name', 'title', 'source']),
      readString(nextSource.rules),
    ].filter(Boolean).join(' ')
  }

  return ''
}

function normalizeComponents(value: unknown, materialsValue: unknown = '') {
  const parts = readArray(value)

  if (parts.length > 0) {
    return parts.join(', ')
  }

  if (isRecord(readValue(value))) {
    const components = readValue(value) as RawRecord
    const enabled = [
      readBoolean(components.v ?? components.vocal) ? 'В' : '',
      readBoolean(components.s ?? components.somatic) ? 'С' : '',
      readBoolean(components.m ?? components.material) ? 'М' : '',
    ].filter(Boolean)
    const material = readString(
      materialsValue || components.materials || components.materialValue,
    )

    return [enabled.join(''), material].filter(Boolean).join(', ')
  }

  return readString(value)
}

function createFallbackId(name: string, level: number) {
  const slug =
    name
      .toLocaleLowerCase('ru-RU')
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'spell'

  return `spell-${level}-${slug}`
}

function formatActivation(value: unknown) {
  const activation = isRecord(readValue(value)) ? readValue(value) as RawRecord : null

  if (!activation) {
    return readString(value)
  }

  const cost = readNumber(activation.cost, 1)
  const type = readString(activation.type)
  const labels: Record<string, string> = {
    action: 'действие',
    bonus: 'бонусное действие',
    reaction: 'реакция',
    minute: 'минута',
    hour: 'час',
    day: 'день',
    legendary: 'легендарное действие',
  }
  const label = labels[type] ?? type

  if (!label) {
    return ''
  }

  return cost > 1 ? `${cost} ${label}` : label
}

function formatRange(value: unknown) {
  const range = isRecord(readValue(value)) ? readValue(value) as RawRecord : null

  if (!range) {
    return readString(value)
  }

  const units = readString(range.units)
  const amount = readString(range.value)
  const labels: Record<string, string> = {
    self: 'на себя',
    touch: 'касание',
    ft: 'футов',
    mi: 'миль',
    spec: 'особая',
    any: 'любая',
  }

  if (units === 'self' || units === 'touch' || units === 'spec' || units === 'any') {
    return labels[units] ?? units
  }

  return [amount, labels[units] ?? units].filter(Boolean).join(' ')
}

function formatDuration(value: unknown) {
  const duration = isRecord(readValue(value)) ? readValue(value) as RawRecord : null

  if (!duration) {
    return readString(value)
  }

  const units = readString(duration.units)
  const amount = readString(duration.value)
  const labels: Record<string, string> = {
    inst: 'мгновенно',
    round: 'раунд',
    minute: 'минута',
    hour: 'час',
    day: 'день',
    month: 'месяц',
    year: 'год',
    perm: 'постоянно',
    spec: 'особая',
  }

  if (units === 'inst' || units === 'perm' || units === 'spec') {
    return labels[units] ?? units
  }

  return [amount, labels[units] ?? units].filter(Boolean).join(' ')
}

function formatDamage(value: unknown) {
  const damage = isRecord(readValue(value)) ? readValue(value) as RawRecord : null

  if (!damage) {
    return readString(value)
  }

  const parts = Array.isArray(damage.parts) ? damage.parts : []
  const formulas = parts
    .map((part) => {
      if (Array.isArray(part)) {
        return readString(part[0])
      }

      return readString(part)
    })
    .filter(Boolean)

  return formulas.join(' + ')
}

function formatSave(value: unknown) {
  const save = isRecord(readValue(value)) ? readValue(value) as RawRecord : null

  if (!save) {
    return readString(value)
  }

  return readFirstString(save, ['ability', 'dc', 'scaling'])
}

function formatAttack(actionType: string, rawValue: unknown) {
  const explicitValue = readString(rawValue)

  if (explicitValue) {
    return explicitValue
  }

  const labels: Record<string, string> = {
    msak: 'атака заклинанием',
    rsak: 'атака заклинанием',
    mwak: 'атака оружием',
    rwak: 'атака оружием',
  }

  return labels[actionType] ?? ''
}

function normalizeSpell(rawSpell: unknown, fallbackLevel = 0): SpellBlock | null {
  if (!isRecord(rawSpell)) {
    return null
  }

  const system = readNestedRecord(rawSpell, 'system')
  const details = readNestedRecord(system, 'details')
  const components = readNestedRecord(system, 'components')
  const materials = readNestedRecord(system, 'materials')
  const actionType = readString(system.actionType ?? rawSpell.actionType)
  const level = readNumber(rawSpell.level ?? system.level, fallbackLevel)
  const name =
    readFirstString(rawSpell, ['name', 'title']) ||
    readFirstString(system, ['name', 'title'])

  if (!name) {
    return null
  }

  const source = normalizeSource(system.source ?? rawSpell.source) || 'SRD'
  const isRitual = readBoolean(
    system.ritual ?? components.ritual ?? rawSpell.isRitual ?? rawSpell.ritual,
  )
  const requiresConcentration = readBoolean(
    system.concentration ??
      components.concentration ??
      rawSpell.requiresConcentration ??
      rawSpell.concentration,
  )
  const tags = new Set([
    ...readArray(rawSpell.tags),
    ...readArray(system.tags),
    requiresConcentration ? 'К' : '',
    isRitual ? 'Р' : '',
  ].filter(Boolean))

  return {
    id: readFirstString(rawSpell, ['id', '_id', 'slug']) || createFallbackId(name, level),
    name,
    level,
    school: readFirstString(system, ['school']) || readFirstString(rawSpell, ['school']),
    source,
    castingTime:
      formatActivation(system.activation) ||
      readFirstString(system, ['time', 'castingTime']) ||
      readFirstString(rawSpell, ['castingTime', 'time']),
    range:
      formatRange(system.range) ||
      readFirstString(system, ['distance', 'range']) ||
      readFirstString(rawSpell, ['range', 'distance']),
    components: normalizeComponents(
      system.components ?? rawSpell.components,
      materials.value ?? rawSpell.materials,
    ),
    duration:
      formatDuration(system.duration) ||
      readFirstString(system, ['duration']) ||
      readFirstString(rawSpell, ['duration']),
    attackBonus:
      formatAttack(actionType, details.attack ?? system.attack ?? rawSpell.attackBonus) ||
      readFirstString(details, ['attack', 'attackBonus']) ||
      readFirstString(system, ['attack', 'attackBonus']) ||
      readFirstString(rawSpell, ['attackBonus', 'attack']),
    save:
      formatSave(system.save ?? rawSpell.save) ||
      readFirstString(details, ['save', 'savingThrow']) ||
      readFirstString(system, ['save', 'savingThrow']) ||
      readFirstString(rawSpell, ['save', 'savingThrow']),
    damage:
      formatDamage(system.damage ?? rawSpell.damage) ||
      readFirstString(details, ['damage', 'formula']) ||
      readFirstString(system, ['damage', 'formula']) ||
      readFirstString(rawSpell, ['damage', 'formula']),
    classes: readArray(system.classes ?? rawSpell.classes),
    tags: Array.from(tags),
    description:
      flattenRichText(rawSpell.description) ||
      flattenRichText(rawSpell.body) ||
      flattenRichText(rawSpell.text) ||
      flattenRichText(system.description),
    isRitual,
    requiresConcentration,
    createdByUser: readBoolean(rawSpell.createdByUser ?? rawSpell.isCustom ?? rawSpell.custom),
  }
}

function collectRawSpells(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return []
  }

  if (Array.isArray(value.spells)) {
    return value.spells
  }

  if (Array.isArray(value.items)) {
    return value.items
  }

  if (Array.isArray(value.data)) {
    return value.data
  }

  return []
}

export function normalizeSpellLibrary(value: unknown): SpellBlock[] {
  const rawSpells = collectRawSpells(value)
  const spells = rawSpells.flatMap((entry, index) => {
    if (Array.isArray(entry)) {
      return entry
        .map((spell) => normalizeSpell(spell, index))
        .filter((spell): spell is SpellBlock => Boolean(spell))
    }

    if (isRecord(entry) && Array.isArray(entry.spells)) {
      const level = readNumber(entry.level, index)

      return entry.spells
        .map((spell) => normalizeSpell(spell, level))
        .filter((spell): spell is SpellBlock => Boolean(spell))
    }

    return [normalizeSpell(entry, 0)].filter((spell): spell is SpellBlock => Boolean(spell))
  })

  const seen = new Set<string>()

  return spells
    .filter((spell) => {
      const key = spell.id || `${spell.level}:${spell.name}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'ru-RU'))
}
