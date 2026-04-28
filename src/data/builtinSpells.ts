import builtinSpellData from './spells/builtinSpells.json'
import customSpellData from './spells/customSpells.json'

const spellLibraryData: unknown = [
  ...builtinSpellData,
  customSpellData,
]

export default spellLibraryData
