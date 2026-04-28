import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'

const apiBase = 'https://5e14.ttg.club/api/v1'
const publicImageDirectory = new URL('../public/bestiary/images/', import.meta.url)
const detailCacheDirectory = new URL('../data/bestiary-detail-cache/', import.meta.url)
const imageFailureCachePath = new URL('../data/bestiary-image-failures.json', import.meta.url)
const outputPath = new URL('../src/data/bestiary/builtinBestiary.json', import.meta.url)
const args = new Set(process.argv.slice(2))
const imageLimitArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--image-limit='))
const shouldUseCacheOnly = args.has('--from-cache')
const shouldDownloadImages = args.has('--download-images')
const imageDownloadLimit = imageLimitArg
  ? Number.parseInt(imageLimitArg.split('=')[1] ?? '', 10)
  : Number.POSITIVE_INFINITY
let downloadedImageCount = 0
let failedImageUrls = new Set()

const requestBody = {
  page: 0,
  size: 160,
  search: { value: '', exact: false },
  order: [
    { field: 'exp', direction: 'asc' },
    { field: 'name', direction: 'asc' },
  ],
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function postJson(url, body = {}, attempt = 1) {
  let response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (attempt <= 8) {
      const delay = Math.min(45000, 1600 * attempt ** 2)

      console.warn(`Network error for ${url}; retry ${attempt} in ${delay}ms`)
      await sleep(delay)
      return postJson(url, body, attempt + 1)
    }

    throw error
  }

  if (!response.ok) {
    if ((response.status === 429 || response.status >= 500) && attempt <= 8) {
      const delay = Math.min(45000, 1600 * attempt ** 2)

      console.warn(`${response.status} for ${url}; retry ${attempt} in ${delay}ms`)
      await sleep(delay)
      return postJson(url, body, attempt + 1)
    }

    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }

  try {
    return await response.json()
  } catch (error) {
    if (attempt <= 8) {
      const delay = Math.min(45000, 1600 * attempt ** 2)

      console.warn(`Invalid or interrupted JSON for ${url}; retry ${attempt} in ${delay}ms`)
      await sleep(delay)
      return postJson(url, body, attempt + 1)
    }

    throw error
  }
}

async function fetchMonsterList() {
  const monsters = []
  let page = 0

  while (true) {
    const pageItems = await postJson(`${apiBase}/bestiary`, { ...requestBody, page })

    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break
    }

    monsters.push(...pageItems)
    console.log(`Fetched list page ${page + 1}: ${pageItems.length}`)

    if (pageItems.length < requestBody.size) {
      break
    }

    page += 1
  }

  return monsters
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

async function readCachedDetail(slug) {
  try {
    return JSON.parse(await readFile(new URL(`${slug}.json`, detailCacheDirectory), 'utf8'))
  } catch {
    return null
  }
}

async function writeCachedDetail(slug, detail) {
  await writeFile(new URL(`${slug}.json`, detailCacheDirectory), `${JSON.stringify(detail)}\n`, 'utf8')
}

async function readImageFailureCache() {
  try {
    const failures = JSON.parse(await readFile(imageFailureCachePath, 'utf8'))

    return new Set(Array.isArray(failures) ? failures.filter((url) => typeof url === 'string') : [])
  } catch {
    return new Set()
  }
}

async function writeImageFailureCache() {
  await writeFile(
    imageFailureCachePath,
    `${JSON.stringify(Array.from(failedImageUrls).sort(), null, 2)}\n`,
    'utf8',
  )
}

async function readAllCachedDetails() {
  const files = (await readdir(detailCacheDirectory)).filter((file) => file.endsWith('.json'))

  return Promise.all(
    files.map(async (file) => JSON.parse(await readFile(new URL(file, detailCacheDirectory), 'utf8'))),
  )
}

function slugFromUrl(url) {
  return String(url ?? '').split('/').filter(Boolean).at(-1) ?? ''
}

function makeName(monster) {
  const rus = monster?.name?.rus?.trim() ?? ''
  const eng = monster?.name?.eng?.trim() ?? ''

  return eng && rus ? `${rus} [${eng}]` : rus || eng
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
}

function htmlToText(value = '') {
  if (!/[<&]/.test(String(value))) {
    return String(value).trim()
  }

  const text = String(value)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\s*\/h[1-6]\s*>/gi, '\n\n')
    .replace(/<\s*h[1-6][^>]*>/gi, '**')
    .replace(/<\s*(strong|b)[^>]*>/gi, '**')
    .replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    .replace(/<dice-roller[^>]*formula="([^"]+)"[^>]*>(.*?)<\/dice-roller>/gi, '$2')
    .replace(/<dice-roller[^>]*formula="([^"]+)"[^>]*\/>/gi, '$1')
    .replace(/<[^>]+>/g, '')

  return decodeHtmlEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeDice(value) {
  return String(value ?? '').replace(/[кК]/g, 'd').trim()
}

function formatSignedValue(value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return String(value ?? '')
  }

  return numberValue >= 0 ? `+${numberValue}` : String(numberValue)
}

function formatList(items) {
  return Array.isArray(items) ? items.map(String).filter(Boolean).join(', ') : ''
}

function formatNamedValues(items) {
  return Array.isArray(items)
    ? items
        .map((item) => {
          const name = item?.shortName || item?.name
          const value = item?.value

          return name ? `${name} ${formatSignedValue(value)}` : ''
        })
        .filter(Boolean)
        .join(', ')
    : ''
}

function formatSpeed(speed = []) {
  if (!Array.isArray(speed)) {
    return ''
  }

  return speed
    .map((entry) => {
      const value = entry?.value

      if (!value) {
        return ''
      }

      return entry?.name ? `${entry.name} ${value} фт.` : `${value} фт.`
    })
    .filter(Boolean)
    .join(', ')
}

function formatSenses(senses) {
  const parts = []

  if (Array.isArray(senses?.senses)) {
    parts.push(
      ...senses.senses
        .map((sense) => {
          if (!sense?.name) {
            return ''
          }

          return sense.value ? `${sense.name} ${sense.value} фт.` : String(sense.name)
        })
        .filter(Boolean),
    )
  }

  if (senses?.passivePerception) {
    parts.push(`пассивная внимательность ${senses.passivePerception}`)
  }

  return parts.join(', ')
}

function formatCreatureType(type) {
  const name = String(type?.name ?? '')
  const tags = Array.isArray(type?.tags) ? type.tags.join(', ') : ''

  return [name, tags ? `(${tags})` : ''].filter(Boolean).join(' ')
}

function formatChallenge(monster) {
  const challenge = String(monster.challengeRating ?? '').trim()
  const experience = monster.experience

  if (!challenge) {
    return ''
  }

  return typeof experience === 'number' ? `${challenge} (${experience} опыта)` : challenge
}

function toMonsterFeature(entry, index, prefix) {
  return {
    id: `${prefix}-${index + 1}`,
    title: String(entry?.name ?? '').trim(),
    body: htmlToText(entry?.value),
  }
}

function toFeatureList(value, prefix) {
  return Array.isArray(value)
    ? value.map((entry, index) => toMonsterFeature(entry, index, prefix)).filter((feature) => feature.title || feature.body)
    : []
}

function toNotes(monster) {
  const sections = [
    monster.lair?.description ? `**Логово**\n${htmlToText(monster.lair.description)}` : '',
    monster.lair?.action ? `**Действия логова**\n${htmlToText(monster.lair.action)}` : '',
    monster.lair?.effect ? `**Эффекты региона**\n${htmlToText(monster.lair.effect)}` : '',
  ].filter(Boolean)

  return sections.join('\n\n')
}

function toInfoSections(monster, slug) {
  const sections = []
  const description = htmlToText(monster.description)

  if (description) {
    sections.push({
      id: `${slug}-description`,
      title: 'Описание',
      body: description,
    })
  }

  if (Array.isArray(monster.tags)) {
    sections.push(
      ...monster.tags
        .map((tag, index) => ({
          id: `${slug}-tag-${index + 1}`,
          title: String(tag?.name ?? '').trim(),
          body: htmlToText(tag?.description),
        }))
        .filter((section) => section.title && section.body),
    )
  }

  return sections
}

function safeImageExtension(url, contentType) {
  const pathname = new URL(url).pathname
  const fromPath = extname(pathname).toLowerCase()

  if (fromPath) {
    return fromPath
  }

  if (contentType?.includes('png')) {
    return '.png'
  }

  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
    return '.jpg'
  }

  if (contentType?.includes('gif')) {
    return '.gif'
  }

  return '.webp'
}

async function downloadImage(url, slug, index, attempt = 1) {
  let response

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    if (attempt <= 2) {
      const delay = Math.min(30000, 1200 * attempt ** 2)

      console.warn(`Network error for image ${url}; retry ${attempt} in ${delay}ms`)
      await sleep(delay)
      return downloadImage(url, slug, index, attempt + 1)
    }

    throw error
  }

  if (!response.ok) {
    if ((response.status === 429 || response.status >= 500) && attempt <= 2) {
      const delay = Math.min(25000, 1200 * attempt ** 2)

      console.warn(`${response.status} for image ${url}; retry ${attempt} in ${delay}ms`)
      await sleep(delay)
      return downloadImage(url, slug, index, attempt + 1)
    }

    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const extension = safeImageExtension(url, contentType)
  const fileName = `${slug}-${index + 1}${extension}`
  const fileUrl = new URL(fileName, publicImageDirectory)
  const bytes = Buffer.from(await response.arrayBuffer())

  await writeFile(fileUrl, bytes)

  return `/bestiary/images/${fileName}`
}

async function downloadMonsterImages(monster, slug) {
  const images = Array.isArray(monster.images) ? monster.images.filter(Boolean) : []

  if (images.length === 0) {
    return []
  }

  const localImages = []

  for (let index = 0; index < images.length; index += 1) {
    const existingImage = await findExistingLocalImage(slug, index)

    if (existingImage) {
      localImages.push(existingImage)
      continue
    }

    if (!shouldDownloadImages) {
      continue
    }

    if (failedImageUrls.has(images[index])) {
      continue
    }

    if (downloadedImageCount >= imageDownloadLimit) {
      continue
    }

    try {
      localImages.push(await downloadImage(images[index], slug, index))
      downloadedImageCount += 1
    } catch (error) {
      failedImageUrls.add(images[index])
      console.warn(`Image skipped for ${slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return localImages
}

async function findExistingLocalImage(slug, index) {
  const baseName = `${slug}-${index + 1}`
  const extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif']

  for (const extension of extensions) {
    const fileName = `${baseName}${extension}`

    try {
      await access(new URL(fileName, publicImageDirectory))
      return `/bestiary/images/${fileName}`
    } catch {
      // Try next extension.
    }
  }

  return null
}

async function toMonsterBlock(monster) {
  const slug = slugFromUrl(monster.url) || String(monster.id)
  const localImages = await downloadMonsterImages(monster, slug)
  const ability = monster.ability ?? {}
  const hitPointsFormula = normalizeDice(monster.hits?.formula)
  const hitPointsAverage = monster.hits?.average

  return {
    id: slug,
    name: makeName(monster),
    subtitle: [monster.size?.rus, formatCreatureType(monster.type), monster.alignment].filter(Boolean).join(', '),
    source: monster.source?.shortName ?? 'TTG',
    size: monster.size?.rus ?? '',
    creatureType: formatCreatureType(monster.type),
    alignment: monster.alignment ?? '',
    proficiencyBonus: formatSignedValue(monster.proficiencyBonus),
    imageAssetId: null,
    imageSrc: localImages[0] ?? null,
    armorClass: String(monster.armorClass ?? ''),
    hitPoints: hitPointsFormula && hitPointsAverage ? `${hitPointsAverage} (${hitPointsFormula})` : String(hitPointsAverage ?? ''),
    hitPointsFormula,
    speed: formatSpeed(monster.speed),
    strength: Number(ability.str) || 10,
    dexterity: Number(ability.dex) || 10,
    constitution: Number(ability.con) || 10,
    intelligence: Number(ability.int) || 10,
    wisdom: Number(ability.wiz ?? ability.wis) || 10,
    charisma: Number(ability.cha) || 10,
    savingThrows: formatNamedValues(monster.savingThrows),
    skills: formatNamedValues(monster.skills),
    damageVulnerabilities: formatList(monster.damageVulnerabilities),
    damageResistances: formatList(monster.damageResistances),
    damageImmunities: formatList(monster.damageImmunities),
    conditionImmunities: formatList(monster.conditionImmunities),
    senses: formatSenses(monster.senses),
    languages: formatList(monster.languages),
    challenge: formatChallenge(monster),
    traits: toFeatureList(monster.feats, `${slug}-trait`),
    actions: toFeatureList(monster.actions, `${slug}-action`),
    bonusActions: toFeatureList(monster.bonusActions, `${slug}-bonus`),
    reactions: toFeatureList(monster.reactions, `${slug}-reaction`),
    legendaryActions: toFeatureList(monster.legendary?.list, `${slug}-legendary`),
    infoSections: toInfoSections(monster, slug),
    notes: toNotes(monster),
  }
}

await mkdir(publicImageDirectory, { recursive: true })
await mkdir(detailCacheDirectory, { recursive: true })
failedImageUrls = await readImageFailureCache()

const list = shouldUseCacheOnly ? [] : await fetchMonsterList()
const detailedMonsters = shouldUseCacheOnly
  ? await readAllCachedDetails()
  : await mapWithConcurrency(list, 1, async (monster, index) => {
      const slug = slugFromUrl(monster.url)

      if (!slug) {
        return monster
      }

      const cachedDetail = await readCachedDetail(slug)

      if (cachedDetail) {
        if ((index + 1) % 50 === 0 || index === list.length - 1) {
          console.log(`Loaded ${index + 1}/${list.length}`)
        }

        return cachedDetail
      }

      const detail = await postJson(`${apiBase}/bestiary/${slug}`)
      await writeCachedDetail(slug, detail)

      if ((index + 1) % 50 === 0 || index === list.length - 1) {
        console.log(`Fetched ${index + 1}/${list.length}`)
      }

      return detail
    })

const monsterBlocks = await mapWithConcurrency(detailedMonsters, 3, async (monster, index) => {
  const block = await toMonsterBlock(monster)

  if ((index + 1) % 50 === 0 || index === detailedMonsters.length - 1) {
    console.log(`Prepared ${index + 1}/${detailedMonsters.length}`)
  }

  return block
})

monsterBlocks.sort((left, right) => {
  const leftExp = Number(left.challenge.match(/\((\d+)/)?.[1] ?? 0)
  const rightExp = Number(right.challenge.match(/\((\d+)/)?.[1] ?? 0)

  return leftExp - rightExp || left.name.localeCompare(right.name, 'ru-RU')
})

await writeFile(outputPath, `${JSON.stringify(monsterBlocks, null, 2)}\n`, 'utf8')
await writeImageFailureCache()

console.log(`Wrote ${monsterBlocks.length} monsters to ${outputPath.pathname}`)
