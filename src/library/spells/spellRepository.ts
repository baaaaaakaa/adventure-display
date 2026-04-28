import type { SpellBlock } from '../../types/adventure'
import { normalizeSpellLibrary } from '../../lib/spellLibraryImport'
import builtinSpellLibraryUrl from '../../data/spells/builtinSpells.json?url'
import customSpellLibraryUrl from '../../data/spells/customSpells.json?url'

let builtInSpellLibraryPromise: Promise<SpellBlock[]> | null = null

async function readJsonAsset(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}: ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

export function loadBuiltInSpellLibrary() {
  builtInSpellLibraryPromise ??= Promise.all([
    readJsonAsset(builtinSpellLibraryUrl),
    readJsonAsset(customSpellLibraryUrl),
  ]).then(([builtinSpellData, customSpellData]) =>
    normalizeSpellLibrary([
      ...(Array.isArray(builtinSpellData) ? builtinSpellData : []),
      customSpellData,
    ]),
  )

  return builtInSpellLibraryPromise
}
