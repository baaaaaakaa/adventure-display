import type {
  PlayerCharacter,
  PlayerCharacterAttack,
  PlayerCharacterSkill,
  PlayerCharacterSpell,
  PlayerCharacterStat,
} from '../types/adventure'

const statOrder = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const statLabels: Record<(typeof statOrder)[number], string> = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
}

const passiveSkillIds = ['perception', 'insight', 'investigation']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function createCharacterId(name: string) {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'character'

  return `character-${slug}-${Date.now().toString(36)}`
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : {}
}

function readValue(value: unknown) {
  if (isRecord(value) && 'value' in value) {
    return value.value
  }

  return value
}

function readString(value: unknown) {
  const nextValue = readValue(value)

  if (typeof nextValue === 'string') {
    return nextValue
  }

  if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
    return String(nextValue)
  }

  return ''
}

function readNumber(value: unknown) {
  const nextValue = readValue(value)

  if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
    return nextValue
  }

  if (typeof nextValue === 'string' && nextValue.trim()) {
    const parsed = Number(nextValue)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatModifier(value: number) {
  return value >= 0 ? `+${value}` : String(value)
}

function getAbilityModifier(score: number) {
  return Math.floor((score - 10) / 2)
}

function getProficiencyValue(value: unknown) {
  const rawValue = readValue(value)

  if (rawValue === true) {
    return 1
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue
  }

  return 0
}

function flattenProseMirrorNode(node: unknown): string {
  if (!isRecord(node)) {
    return ''
  }

  if (typeof node.text === 'string') {
    return node.text
  }

  const content = Array.isArray(node.content) ? node.content : []
  const childText = content.map(flattenProseMirrorNode).join('')

  if (node.type === 'paragraph') {
    return `${childText}\n`
  }

  if (node.type === 'hardBreak') {
    return '\n'
  }

  return childText
}

function readRichText(value: unknown) {
  const valueRecord = readRecord(readValue(value))
  const data = readRecord(valueRecord.data)
  const text = flattenProseMirrorNode(data)

  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function readTextSections(rawCharacter: Record<string, unknown>) {
  const rawText = readRecord(rawCharacter.text)
  const sections: Record<string, string> = {}

  for (const [key, value] of Object.entries(rawText)) {
    sections[key] = readRichText(value)
  }

  const rawNotes = rawCharacter.notes ?? rawCharacter.notesList ?? rawCharacter.journal
  const noteValues = readNoteValues(rawNotes)

  noteValues.forEach((note, index) => {
    sections[index === 0 ? 'notes' : `notes${index + 1}`] = note
  })

  return sections
}

function readRichTextParagraphs(value: unknown) {
  return readRichText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function readNoteValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readRichText(entry) || readString(entry))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  if (isRecord(value)) {
    return Object.values(value)
      .map((entry) => readRichText(entry) || readString(entry))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  const text = readString(value).trim()

  return text ? [text] : []
}

function readFieldGroup(rawCharacter: Record<string, unknown>, key: string) {
  const rawGroup = readRecord(rawCharacter[key])
  const group: Record<string, string> = {}

  for (const [entryKey, value] of Object.entries(rawGroup)) {
    group[entryKey] = readString(value)
  }

  return group
}

function readStats(rawCharacter: Record<string, unknown>, proficiencyBonus: number) {
  const rawStats = readRecord(rawCharacter.stats)
  const rawSaves = readRecord(rawCharacter.saves)
  const statsById = new Map<string, PlayerCharacterStat>()

  statOrder.forEach((statId) => {
    const rawStat = readRecord(rawStats[statId])
    const score = readNumber(rawStat.score) ?? 10
    const modifier = getAbilityModifier(score)
    const rawSave = readRecord(rawSaves[statId])
    const isSaveProficient = Boolean(readValue(rawSave.isProf))
    const save = modifier + (isSaveProficient ? proficiencyBonus : 0)
    const stat: PlayerCharacterStat = {
      id: statId,
      label: readString(rawStat.label) || statLabels[statId],
      score,
      modifier,
      check: modifier,
      save,
      isSaveProficient,
    }

    statsById.set(statId, stat)
  })

  return statsById
}

function readSkills(
  rawCharacter: Record<string, unknown>,
  statsById: Map<string, PlayerCharacterStat>,
  proficiencyBonus: number,
) {
  const rawSkills = readRecord(rawCharacter.skills)

  return Object.entries(rawSkills)
    .map(([skillId, value]) => {
      const rawSkill = readRecord(value)
      const baseStat = readString(rawSkill.baseStat)
      const baseModifier = statsById.get(baseStat)?.modifier ?? 0
      const proficiencyValue = getProficiencyValue(rawSkill.isProf)
      const modifier = baseModifier + proficiencyBonus * proficiencyValue
      const skill: PlayerCharacterSkill = {
        id: skillId,
        label: readString(rawSkill.label) || skillId,
        baseStat,
        modifier,
        isProficient: proficiencyValue > 0,
      }

      return skill
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'ru'))
}

function readAttacks(
  rawCharacter: Record<string, unknown>,
  statsById: Map<string, PlayerCharacterStat>,
  proficiencyBonus: number,
) {
  const rawWeapons = Array.isArray(rawCharacter.weaponsList) ? rawCharacter.weaponsList : []
  const attackBase = Math.max(
    statsById.get('str')?.modifier ?? 0,
    statsById.get('dex')?.modifier ?? 0,
  )

  return rawWeapons.map((weapon, index) => {
    const rawWeapon = readRecord(weapon)
    const isProficient = Boolean(readValue(rawWeapon.isProf))
    const bonus = attackBase + (isProficient ? proficiencyBonus : 0)
    const attack: PlayerCharacterAttack = {
      id: readString(rawWeapon.id) || `attack-${index + 1}`,
      name: readString(rawWeapon.name) || 'Атака',
      bonus: formatModifier(bonus),
      damage: readString(rawWeapon.dmg),
      isProficient,
    }

    return attack
  })
}

function readCoins(rawCharacter: Record<string, unknown>) {
  const rawCoins = readRecord(rawCharacter.coins)
  const coins: Record<string, number> = {}

  for (const [coinKey, value] of Object.entries(rawCoins)) {
    coins[coinKey] = readNumber(value) ?? 0
  }

  return coins
}

function uniqueTextEntries(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const text = value.trim()
    const key = text.toLocaleLowerCase('ru-RU')

    if (!text || seen.has(key)) {
      return
    }

    seen.add(key)
    result.push(text)
  })

  return result
}

function readNamedListEntry(value: unknown): string {
  const nextValue = readValue(value)

  if (nextValue !== value) {
    return readNamedListEntry(nextValue)
  }

  if (Array.isArray(nextValue)) {
    return readNamedList(nextValue)
  }

  if (!isRecord(nextValue)) {
    return readString(nextValue)
  }

  const richText = readRichText(nextValue)

  if (richText) {
    return richText
  }

  const namedValue =
    readString(nextValue.name) ||
    readString(nextValue.label) ||
    readString(nextValue.title) ||
    readString(nextValue.text)

  if (namedValue) {
    return namedValue
  }

  return readNamedList(nextValue)
}

function readNamedList(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueTextEntries(value.map(readNamedListEntry)).join(', ')
  }

  if (isRecord(value)) {
    const directText = readString(value) || readRichText(value)

    if (directText) {
      return directText
    }

    return uniqueTextEntries(Object.values(value).map(readNamedListEntry)).join(', ')
  }

  return readString(value)
}

function normalizeSectionKey(key: string) {
  return key.toLocaleLowerCase('ru-RU').replace(/[^a-zа-яё0-9]/giu, '')
}

function readTextSectionByKeys(textSections: Record<string, string>, keys: string[]) {
  const normalizedKeys = keys.map(normalizeSectionKey)
  const entries = Object.entries(textSections)

  for (const key of keys) {
    const value = textSections[key]

    if (value) {
      return value
    }
  }

  for (const [key, value] of entries) {
    const normalizedKey = normalizeSectionKey(key)

    if (value && normalizedKeys.includes(normalizedKey)) {
      return value
    }
  }

  return ''
}

function readOtherProficienciesAndLanguages(
  rawCharacter: Record<string, unknown>,
  textSections: Record<string, string>,
) {
  const textCandidates = [
    readTextSectionByKeys(textSections, [
      'otherProficienciesAndLanguages',
      'other-proficiencies-and-languages',
      'proficienciesAndLanguages',
      'proficiencies-languages',
      'otherProficiencies',
      'other-proficiencies',
      'proficiencies',
      'prof',
      'profs',
      'прочие владения и языки',
      'владения',
    ]),
  ]
  const candidates = [
    [
      'Языки',
      rawCharacter.languages ||
        readTextSectionByKeys(textSections, ['languages', 'language', 'langs', 'языки']),
    ],
    ['Владения', rawCharacter.proficiencies],
    [
      'Доспехи',
      rawCharacter.armors ??
        rawCharacter.armorProficiencies ??
        readTextSectionByKeys(textSections, ['armors', 'armor', 'armorProficiencies', 'доспехи']),
    ],
    [
      'Оружие',
      rawCharacter.weaponProficiencies ||
        readTextSectionByKeys(textSections, ['weapons', 'weapon', 'weaponProficiencies', 'оружие']),
    ],
    [
      'Инструменты',
      rawCharacter.toolProficiencies ||
        readTextSectionByKeys(textSections, ['tools', 'tool', 'toolProficiencies', 'инструменты']),
    ],
  ] as const

  const labeledEntries = candidates
    .map(([label, value]) => {
      const text = readNamedList(value)

      return text ? `${label}: ${text}` : ''
    })
    .filter(Boolean) as string[]

  return uniqueTextEntries([...textCandidates, ...labeledEntries])
    .join('\n')
}

function readAttacksAndSpellsText(
  attacks: PlayerCharacterAttack[],
  knownSpells: string[],
) {
  const attackText = attacks
    .map((attack) =>
      [attack.name, attack.bonus ? `атака ${attack.bonus}` : '', attack.damage]
        .filter(Boolean)
        .join(', '),
    )
    .join('\n')
  const spellText = knownSpells.join('\n')

  return [attackText, spellText].filter(Boolean).join('\n\n')
}

function readSpellSlots(rawCharacter: Record<string, unknown>) {
  const rawSpells = readRecord(rawCharacter.spells)

  return Array.from({ length: 9 }, (_, index) => {
    const level = index + 1
    const rawLevel = readRecord(rawSpells[String(level)] ?? rawSpells[`slots-${level}`])

    return {
      level,
      total: readNumber(rawLevel.total),
      used: readNumber(rawLevel.used ?? rawLevel.current),
    }
  })
}

function readSpellEntries(rawCharacter: Record<string, unknown>) {
  const rawText = readRecord(rawCharacter.text)
  const spells: PlayerCharacterSpell[] = []

  for (let level = 0; level <= 9; level += 1) {
    const section = rawText[`spells-level-${level}`]

    if (!section) {
      continue
    }

    const lines = readRichTextParagraphs(section)

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]

      if (!line || /^Подготовлено может быть/i.test(line) || !isLikelySpellName(line)) {
        continue
      }

      const nextLine = lines[index + 1] ?? ''
      const hasSummary =
        nextLine &&
        !/^Подготовлено может быть/i.test(nextLine) &&
        !isLikelySpellName(nextLine)

      spells.push({
        id: `spell-${level}-${spells.length + 1}`,
        level,
        name: line.replace(/\s+/g, ' ').trim(),
        summary: hasSummary ? nextLine : '',
        prepared: /\*/.test(line),
      })

      if (hasSummary) {
        index += 1
      }
    }
  }

  return spells
}

function isLikelySpellName(value: string) {
  return !/[,.;:]/.test(value) && !/^\d/.test(value) && !/^Вы\s/i.test(value)
}

function getSpellcastingAbilityModifier(
  spellsInfo: Record<string, unknown>,
  statsById: Map<string, PlayerCharacterStat>,
) {
  const base = readRecord(spellsInfo.base)
  const code = readString(base.code) || readString(base.value)

  return statsById.get(code)?.modifier ?? 0
}

function readSpellSaveDc(
  spellsInfo: Record<string, unknown>,
  statsById: Map<string, PlayerCharacterStat>,
  proficiencyBonus: number,
) {
  const importedValue = readString(spellsInfo.save)

  if (importedValue) {
    return importedValue
  }

  return String(8 + proficiencyBonus + getSpellcastingAbilityModifier(spellsInfo, statsById))
}

function readSpellAttackBonus(
  spellsInfo: Record<string, unknown>,
  statsById: Map<string, PlayerCharacterStat>,
  proficiencyBonus: number,
) {
  const rawMod = readRecord(spellsInfo.mod)
  const importedValue = readString(rawMod)
  const customModifier = readNumber(rawMod.customModifier)
  const modifier = customModifier ?? proficiencyBonus + getSpellcastingAbilityModifier(spellsInfo, statsById)

  return importedValue || formatModifier(modifier)
}

export function createPlayerCharacterFromLssJson(rawJson: unknown): PlayerCharacter {
  if (!isRecord(rawJson)) {
    throw new Error('JSON персонажа должен содержать объект Long Story Short.')
  }

  const rawCharacter =
    rawJson.jsonType === 'character' && typeof rawJson.data === 'string'
      ? JSON.parse(rawJson.data) as unknown
      : rawJson

  if (!isRecord(rawCharacter) || rawCharacter.jsonType !== 'character') {
    throw new Error('Файл должен быть экспортом персонажа Long Story Short.')
  }

  const info = readRecord(rawCharacter.info)
  const subInfo = readFieldGroup(rawCharacter, 'subInfo')
  const spellsInfo = readRecord(rawCharacter.spellsInfo)
  const vitality = readRecord(rawCharacter.vitality)
  const proficiencyBonus = readNumber(rawCharacter.proficiency) ?? 2
  const statsById = readStats(rawCharacter, proficiencyBonus)
  const skills = readSkills(rawCharacter, statsById, proficiencyBonus)
  const name = readString(rawCharacter.name) || 'Персонаж'
  const avatar = readRecord(rawCharacter.avatar)
  const attacks = readAttacks(rawCharacter, statsById, proficiencyBonus)
  const text = readTextSections(rawCharacter)
  const spells = readSpellEntries(rawCharacter)
  const knownSpells = spells.map((spell) => spell.name)

  return {
    id: createCharacterId(name),
    name,
    playerName: readString(info.playerName),
    race: readString(info.race),
    className: readString(info.charClass),
    subclass: readString(info.charSubclass),
    level: readNumber(info.level),
    background: readString(info.background),
    alignment: readString(info.alignment),
    experience: readString(info.experience),
    avatarSrc: readString(avatar.webp) || readString(avatar.jpeg) || null,
    avatarAssetId: null,
    armorClass: readNumber(vitality.ac),
    speed: readNumber(vitality.speed),
    initiative: readNumber(vitality.initiative),
    proficiencyBonus,
    hpCurrent: readNumber(vitality['hp-current']),
    hpMax: readNumber(vitality['hp-max']),
    hpTemp: readNumber(vitality['hp-temp']),
    hitDie: readString(vitality['hit-die']),
    hitDiceCurrent: readNumber(vitality['hp-dice-current']),
    stats: [...statsById.values()],
    skills,
    passiveSenses: skills.filter((skill) => passiveSkillIds.includes(skill.id)),
    attacks,
    subInfo,
    text,
    attacksAndSpellsText: readAttacksAndSpellsText(attacks, knownSpells),
    attackFeaturesText: [text.traits, text.features].filter(Boolean).join('\n\n'),
    otherProficienciesAndLanguages: readOtherProficienciesAndLanguages(rawCharacter, text),
    coins: readCoins(rawCharacter),
    conditions: Array.isArray(rawCharacter.conditions)
      ? rawCharacter.conditions.map(String)
      : [],
    spellcasting: {
      ability: readString(spellsInfo.base),
      saveDc: readSpellSaveDc(spellsInfo, statsById, proficiencyBonus),
      attackBonus: readSpellAttackBonus(spellsInfo, statsById, proficiencyBonus),
      mode: '',
      revision: '2014',
      slots: readSpellSlots(rawCharacter),
      knownSpells,
      spells,
    },
    source: 'Long Story Short',
    importedAt: new Date().toISOString(),
  }
}
