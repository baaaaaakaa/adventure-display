import { writeFile } from 'node:fs/promises'

const apiBase = 'https://5e14.ttg.club/api/v1'
const outputPath = new URL('../src/data/spells/builtinSpells.json', import.meta.url)

const requestBody = {
  page: 0,
  size: 160,
  search: { value: '', exact: false },
  order: [
    { field: 'level', direction: 'asc' },
    { field: 'name', direction: 'asc' },
  ],
}

const schoolMap = {
  'вызов': 'con',
  'воплощение': 'evo',
  'иллюзия': 'ill',
  'некромантия': 'nec',
  'ограждение': 'abj',
  'очарование': 'enc',
  'преобразование': 'trs',
  'прорицание': 'div',
}

const classMap = {
  'Бард': 'bard',
  'Волшебник': 'wizard',
  'Друид': 'druid',
  'Жрец': 'cleric',
  'Изобретатель': 'artificer',
  'Колдун': 'warlock',
  'Паладин': 'paladin',
  'Следопыт': 'ranger',
  'Чародей': 'sorcerer',
}

async function fetchSpellList() {
  const spells = []
  let page = 0

  while (true) {
    const pageItems = await postJson(`${apiBase}/spells`, { ...requestBody, page })

    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break
    }

    spells.push(...pageItems)
    console.log(`Fetched list page ${page + 1}: ${pageItems.length}`)

    if (pageItems.length < requestBody.size) {
      break
    }

    page += 1
  }

  return spells
}

const saveMap = {
  'Силы': 'Сила',
  'Ловкости': 'Ловкость',
  'Телосложения': 'Телосложение',
  'Интеллекта': 'Интеллект',
  'Мудрости': 'Мудрость',
  'Харизмы': 'Харизма',
}

const damageTypePatterns = [
  ['Кислота', /кислот/iu],
  ['Дробящий', /дробящ/iu],
  ['Холод', /холод/iu],
  ['Огонь', /огн|огон|плам/iu],
  ['Силовой', /силов/iu],
  ['Молния', /молни|электр/iu],
  ['Некротический', /некрот/iu],
  ['Колющий', /колющ/iu],
  ['Яд', /яд|ядом|яда/iu],
  ['Психический', /психичес/iu],
  ['Излучение', /излучен/iu],
  ['Рубящий', /рубящ/iu],
  ['Звук', /звуков|звуком|громов/iu],
]

function slugFromUrl(url) {
  return String(url ?? '').split('/').filter(Boolean).at(-1) ?? ''
}

function makeName(spell) {
  const rus = spell?.name?.rus?.trim() ?? ''
  const eng = spell?.name?.eng?.trim() ?? ''

  return eng && rus ? `${rus} [${eng}]` : rus || eng
}

function makeComponents(components = {}) {
  const codes = [
    components.v ? 'В' : '',
    components.s ? 'С' : '',
    components.m ? 'М' : '',
  ].filter(Boolean).join('')

  return [codes, typeof components.m === 'string' ? components.m.trim() : ''].filter(Boolean).join(', ')
}

function normalizeDice(formula) {
  return String(formula ?? '')
    .replace(/[кК]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlToSearchText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
}

function firstDice(description = '') {
  const formulaMatch = description.match(/<dice-roller[^>]*formula="([^"]+)"/i)

  if (formulaMatch?.[1]) {
    return normalizeDice(formulaMatch[1])
  }

  const textMatch = description.match(/\b\d+\s*[кКd]\s*\d+(?:\s*[+−-]\s*\d+)?\b/u)

  return textMatch ? normalizeDice(textMatch[0]) : ''
}

function inferSave(description = '') {
  const text = htmlToSearchText(description)
  const match = text.match(/спасброс[а-яё]*\s+(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)/iu)

  return match?.[1] ? saveMap[match[1]] ?? match[1] : ''
}

function inferAttack(description = '') {
  return /атак[ауи]\s+заклинанием/iu.test(htmlToSearchText(description)) ? 'атака заклинанием' : ''
}

function inferDamageTypes(description = '') {
  const text = htmlToSearchText(description)

  return damageTypePatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label)
}

function normalizeClasses(classes = []) {
  return classes
    .map((entry) => entry?.name)
    .filter(Boolean)
    .map((name) => classMap[name] ?? String(name).toLocaleLowerCase('ru-RU'))
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function postJson(url, body = {}, attempt = 1) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    if ((response.status === 429 || response.status >= 500) && attempt <= 6) {
      const delay = Math.min(25000, 1200 * attempt ** 2)

      console.warn(`${response.status} for ${url}; retry ${attempt} in ${delay}ms`)
      await sleep(delay)
      return postJson(url, body, attempt + 1)
    }

    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }

  return response.json()
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runWorker))

  return results
}

function toSpellBlock(spell) {
  const slug = slugFromUrl(spell.url)
  const description = String(spell.description ?? '')

  return {
    id: slug || String(spell.id),
    name: makeName(spell),
    level: Number(spell.level) || 0,
    school: schoolMap[String(spell.school ?? '').toLocaleLowerCase('ru-RU')] ?? String(spell.school ?? ''),
    source: spell.source?.shortName ?? 'TTG',
    castingTime: String(spell.time ?? ''),
    range: String(spell.range ?? ''),
    components: makeComponents(spell.components),
    duration: String(spell.duration ?? ''),
    attackBonus: inferAttack(description),
    save: inferSave(description),
    damage: firstDice(description),
    classes: normalizeClasses(spell.classes),
    tags: inferDamageTypes(description),
    description,
    isRitual: Boolean(spell.ritual),
    requiresConcentration: Boolean(spell.concentration) || /концентрация/i.test(String(spell.duration ?? '')),
    createdByUser: false,
  }
}

const list = await fetchSpellList()
const detailedSpells = await mapWithConcurrency(list, 3, async (spell, index) => {
  const slug = slugFromUrl(spell.url)

  if (!slug) {
    return spell
  }

  const detail = await postJson(`${apiBase}/spells/${slug}`)

  if ((index + 1) % 50 === 0 || index === list.length - 1) {
    console.log(`Fetched ${index + 1}/${list.length}`)
  }

  return detail
})

const spellBlocks = detailedSpells
  .map(toSpellBlock)
  .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'ru-RU'))

await writeFile(outputPath, `${JSON.stringify(spellBlocks, null, 2)}\n`, 'utf8')

console.log(`Wrote ${spellBlocks.length} spells to ${outputPath.pathname}`)
