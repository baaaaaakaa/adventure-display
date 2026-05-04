import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

async function checkSchemaAccentEnum() {
  const typesSource = await readFile('src/types/adventure.ts', 'utf8')
  const schema = await readJson('docs/adventure.schema.json')
  const match = typesSource.match(/sceneAccentValues\s*=\s*\[([\s\S]*?)\]\s+as const/)

  assert.ok(match, 'sceneAccentValues should be present in src/types/adventure.ts')

  const typeValues = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]).sort()
  const schemaValues = [...schema.$defs.scene.properties.accent.enum].sort()

  assert.deepEqual(schemaValues, typeValues)
}

async function checkPlayerFogTexturePath() {
  const playerWindowSource = await readFile('src/windows/player/PlayerWindow.tsx', 'utf8')

  assert.equal(playerWindowSource.includes('href="/fog-pattern.png"'), false)
  assert.ok(playerWindowSource.includes("resolvePublicAssetSrc('/fog-pattern.png')"))
}

async function checkBestiarySummaryAsset() {
  const [summaryStats, fullStats, summaries] = await Promise.all([
    stat('src/data/bestiary/builtinBestiarySummaries.json'),
    stat('src/data/bestiary/builtinBestiary.json'),
    readJson('src/data/bestiary/builtinBestiarySummaries.json'),
  ])

  assert.ok(Array.isArray(summaries))
  assert.ok(summaries.length > 0)
  assert.ok(summaryStats.size < fullStats.size / 10)
}

await checkSchemaAccentEnum()
await checkPlayerFogTexturePath()
await checkBestiarySummaryAsset()

console.log('Adventure contract checks passed.')
