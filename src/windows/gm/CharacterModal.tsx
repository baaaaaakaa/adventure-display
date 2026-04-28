import { useMemo, useState } from 'react'
import type { PlayerCharacter, PlayerCharacterSkill, SpellBlock } from '../../types/adventure'
import { SpellDetailCard } from './SpellDetailCard'
import styles from './CharacterModal.module.css'

type CharacterTab = 'attacks' | 'features' | 'equipment' | 'personality' | 'goals' | 'notes' | 'spells'

type CharacterModalProps = {
  character: PlayerCharacter
  onClose: () => void
  spellLibrary: SpellBlock[]
}

const tabs: Array<{ id: CharacterTab; label: string }> = [
  { id: 'attacks', label: 'Атаки' },
  { id: 'features', label: 'Способности' },
  { id: 'equipment', label: 'Снаряжение' },
  { id: 'personality', label: 'Личность' },
  { id: 'goals', label: 'Цели' },
  { id: 'notes', label: 'Заметки' },
  { id: 'spells', label: 'Заклинания' },
]

const coinLabels: Record<string, string> = {
  pp: 'пм',
  gp: 'зм',
  ep: 'эм',
  sp: 'см',
  cp: 'мм',
}

function formatSigned(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '0'
  }

  return value >= 0 ? `+${value}` : String(value)
}

function formatNumber(value: number | null | undefined, fallback = '-') {
  return typeof value === 'number' ? String(value) : fallback
}

function formatSubtitle(character: PlayerCharacter) {
  return [character.race, character.className].filter(Boolean).join(' — ')
}

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function normalizeSpellName(value: string) {
  return value
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ru-RU')
}

function getSpellNameKeys(spellName: string) {
  const keys = new Set<string>()
  const normalizedFullName = normalizeSpellName(spellName)
  const bracketMatch = spellName.match(/\[([^\]]+)\]/)
  const russianName = spellName.replace(/\[[^\]]+\]/g, '').trim()

  if (normalizedFullName) {
    keys.add(normalizedFullName)
  }

  if (russianName) {
    keys.add(normalizeSpellName(russianName))
  }

  if (bracketMatch?.[1]) {
    keys.add(normalizeSpellName(bracketMatch[1]))
  }

  return keys
}

function createSpellLookup(spellLibrary: SpellBlock[]) {
  const lookup = new Map<string, SpellBlock>()

  spellLibrary.forEach((spell) => {
    getSpellNameKeys(spell.name).forEach((key) => {
      if (!lookup.has(key)) {
        lookup.set(key, spell)
      }
    })
  })

  return lookup
}

function findLibrarySpell(spellName: string, spellLookup: Map<string, SpellBlock>) {
  for (const key of getSpellNameKeys(spellName)) {
    const spell = spellLookup.get(key)

    if (spell) {
      return spell
    }
  }

  return null
}

function TextBox({ label, value, large = false }: { label: string; value?: string; large?: boolean }) {
  return (
    <section className={`${styles.textBox} ${large ? styles.largeTextBox : ''}`}>
      <h3>{label}</h3>
      <div className={styles.textBoxContent}>{isFilled(value) ? value : '\u00a0'}</div>
    </section>
  )
}

function HeaderStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className={styles.topStat}>
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  )
}

function SmallField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className={styles.smallField}>
      <strong>{value ?? '\u00a0'}</strong>
      <span>{label}</span>
    </div>
  )
}

function SkillRow({ skill }: { skill: PlayerCharacterSkill }) {
  return (
    <div className={styles.skillRow}>
      <span className={skill.isProficient ? styles.profDot : styles.emptyDot} />
      <strong>{skill.label}</strong>
      <em>{formatSigned(skill.modifier)}</em>
    </div>
  )
}

function CharacterSidebar({ character }: { character: PlayerCharacter }) {
  const skillGroups = character.stats.map((stat) => ({
    stat,
    skills: character.skills.filter((skill) => skill.baseStat === stat.id),
  }))
  const otherProficienciesAndLanguages =
    character.otherProficienciesAndLanguages ||
    character.text.prof ||
    character.text.profs ||
    character.text.proficiencies ||
    character.text.otherProficienciesAndLanguages ||
    character.text['other-proficiencies-and-languages']
  const leftStatGroups = skillGroups.filter(({ stat }) =>
    ['str', 'con', 'int', 'cha'].includes(stat.id),
  )
  const rightStatGroups = skillGroups.filter(({ stat }) =>
    ['dex', 'wis'].includes(stat.id),
  )

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarColumn}>
        {leftStatGroups.map(({ stat, skills }) => (
          <StatBlock key={stat.id} skills={skills} stat={stat} />
        ))}
      </div>

      <div className={styles.sidebarColumn}>
        {rightStatGroups.map(({ stat, skills }) => (
          <StatBlock key={stat.id} skills={skills} stat={stat} />
        ))}

        <section className={styles.passiveBlock}>
          <h3>Пассивные чувства</h3>
          {character.passiveSenses.map((skill) => (
            <div className={styles.passiveRow} key={skill.id}>
              <strong>{10 + skill.modifier}</strong>
              <span>{skill.label}</span>
            </div>
          ))}
        </section>

        <TextBox
          label="Прочие владения и языки"
          value={otherProficienciesAndLanguages}
        />
      </div>
    </aside>
  )
}

function StatBlock({
  stat,
  skills,
}: {
  stat: PlayerCharacter['stats'][number]
  skills: PlayerCharacterSkill[]
}) {
  return (
    <section className={styles.statBlock}>
      <div className={styles.statTitle}>
        <h3>{stat.label}</h3>
        <span>{stat.score}</span>
      </div>
      <div className={styles.statChecks}>
        <div className={styles.statCheck}>
          <span>Проверка</span>
          <strong>{formatSigned(stat.check)}</strong>
        </div>
        <div className={styles.statCheck}>
          <span className={styles.saveCheckLabel}>
            {stat.isSaveProficient ? (
              <span
                aria-label="Владение спасброском"
                className={styles.profDot}
                title="Владение спасброском"
              />
            ) : null}
            Спасбросок
          </span>
          <strong>{formatSigned(stat.save)}</strong>
        </div>
      </div>
      <div className={styles.skillList}>
        {skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>
    </section>
  )
}

function CharacterHeader({ character }: { character: PlayerCharacter }) {
  const coins = Object.entries(character.coins)
    .filter(([coinKey, value]) => coinKey !== 'total' && value > 0)
    .map(([coinKey, value]) => `${value} ${coinLabels[coinKey] ?? coinKey}`)
    .join(', ')

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        {character.avatarSrc ? (
          <img alt={character.name} src={character.avatarSrc} />
        ) : (
          <div className={styles.avatarPlaceholder}>{character.name.charAt(0).toUpperCase()}</div>
        )}
        <div>
          <h2>{character.name}</h2>
          <p>{formatSubtitle(character)}</p>
          <span>{character.level ? `${character.level} уровень` : 'уровень не указан'}</span>
        </div>
      </div>

      <div className={styles.topStats}>
        <HeaderStat label="КД" value={character.armorClass} />
        <HeaderStat label="Скорость" value={character.speed ? `${character.speed}` : '-'} />
        <HeaderStat label="Бонус мастерства" value={formatSigned(character.proficiencyBonus)} />
        <HeaderStat label="Хиты" value={`${formatNumber(character.hpCurrent)} / ${formatNumber(character.hpMax)}`} />
        <HeaderStat label="Деньги" value={coins || '-'} />
      </div>
    </header>
  )
}

function AttacksTab({ character }: { character: PlayerCharacter }) {
  const attacksAndSpellsText =
    character.attacksAndSpellsText ||
    character.attacks
      .map((attack) =>
        [attack.name, attack.bonus ? `атака ${attack.bonus}` : '', attack.damage]
          .filter(Boolean)
          .join(', '),
      )
      .join('\n')
  const attackFeaturesText =
    character.attackFeaturesText ||
    [character.text.traits, character.text.features].filter(Boolean).join('\n\n')

  return (
    <div className={styles.tabPanel}>
      <div className={styles.attackHeader}>
        <span>Название</span>
        <span>Бонус</span>
        <span>Урон / вид</span>
      </div>
      {character.attacks.length > 0 ? (
        character.attacks.map((attack) => (
          <div className={styles.attackRow} key={attack.id}>
            <strong>{attack.name}</strong>
            <em>{attack.bonus}</em>
            <span>{attack.damage || '-'}</span>
          </div>
        ))
      ) : (
        <p className={styles.emptyState}>Атаки не импортированы.</p>
      )}
      <TextBox label="Атаки и заклинания" value={attacksAndSpellsText} large />
      <TextBox label="Умения и способности" value={attackFeaturesText} large />
    </div>
  )
}

function FeaturesTab({ character }: { character: PlayerCharacter }) {
  const strength = character.stats.find((stat) => stat.id === 'str')?.score ?? 10
  const jumpHigh = Math.max(0, Math.floor((3 + Math.floor((strength - 10) / 2)) / 2))

  return (
    <div className={styles.tabPanel}>
      <div className={styles.jumpGrid}>
        <SmallField label="Прыжок в высоту" value={`${jumpHigh} фут.`} />
        <SmallField label="Прыжок в длину" value={`${strength} фут.`} />
      </div>
      <TextBox label="Дополнительные способности и умения" value={character.text.features} large />
      <TextBox label="Черты" value={character.text.traits} />
    </div>
  )
}

function EquipmentTab({ character }: { character: PlayerCharacter }) {
  const strength = character.stats.find((stat) => stat.id === 'str')?.score ?? 10

  return (
    <div className={styles.tabPanel}>
      <div className={styles.jumpGrid}>
        <SmallField label="Грузоподъёмность" value={`${strength * 15} фнт.`} />
        <SmallField label="Размер" value="средний" />
      </div>
      <TextBox label="Снаряжение" value={character.text.equipment} large />
      <TextBox label="Сокровища" value={character.text.treasures} />
    </div>
  )
}

function PersonalityTab({ character }: { character: PlayerCharacter }) {
  return (
    <div className={styles.tabPanel}>
      <div className={styles.personalityHeader}>
        <SmallField label="Предыстория" value={character.background || '-'} />
        <SmallField label="Мировоззрение" value={character.alignment || '-'} />
      </div>
      <TextBox label="Внешность" value={character.text.appearance} />
      <div className={styles.appearanceGrid}>
        {character.avatarSrc ? <img alt={character.name} src={character.avatarSrc} /> : null}
        <div className={styles.appearanceFields}>
          <SmallField label="Рост" value={character.subInfo.height || '-'} />
          <SmallField label="Вес" value={character.subInfo.weight || '-'} />
          <SmallField label="Возраст" value={character.subInfo.age || '-'} />
          <SmallField label="Глаза" value={character.subInfo.eyes || '-'} />
          <SmallField label="Кожа" value={character.subInfo.skin || '-'} />
          <SmallField label="Волосы" value={character.subInfo.hair || '-'} />
        </div>
      </div>
      <TextBox label="Предыстория персонажа" value={character.text.background} />
      <TextBox label="Союзники и организации" value={character.text.allies} />
      <TextBox label="Черты характера" value={character.text.personality} />
      <TextBox label="Идеалы" value={character.text.ideals} />
      <TextBox label="Привязанности" value={character.text.bonds} />
      <TextBox label="Слабости" value={character.text.flaws} />
    </div>
  )
}

function GoalsTab({ character }: { character: PlayerCharacter }) {
  return (
    <div className={styles.tabPanel}>
      <TextBox label="Цели и задачи" value={character.text.goals} large />
    </div>
  )
}

function NotesTab({ character }: { character: PlayerCharacter }) {
  const noteValues = [
    character.text.notes,
    character.text.notes2,
    character.text.notes3,
    character.text.notes4,
    character.text.notes5,
    character.text.notes6,
  ].filter(isFilled)

  return (
    <div className={styles.tabPanel}>
      {noteValues.length > 0 ? (
        noteValues.map((note, index) => (
          <TextBox key={index} label="Заметки" value={note} />
        ))
      ) : (
        <TextBox label="Заметки" />
      )}
    </div>
  )
}

function SpellGroups({
  character,
  onOpenSpell,
  spellLookup,
}: {
  character: PlayerCharacter
  onOpenSpell: (spell: SpellBlock) => void
  spellLookup: Map<string, SpellBlock>
}) {
  const spells = character.spellcasting.spells ?? []

  if (spells.length === 0) {
    return <p className={styles.emptyState}>Заклинания не импортированы.</p>
  }

  const levels = Array.from(new Set(spells.map((spell) => spell.level))).sort(
    (left, right) => left - right,
  )

  return (
    <div className={styles.spellGroups}>
      {levels.map((level) => {
        const levelSpells = spells.filter((spell) => spell.level === level)
        const slot = character.spellcasting.slots.find((entry) => entry.level === level)

        return (
          <section className={styles.spellGroup} key={level}>
            <div className={styles.spellGroupHeader}>
              <h3>{level === 0 ? 'Заговоры' : `${level}-й уровень`}</h3>
              {level > 0 && typeof slot?.total === 'number' ? (
                <span className={styles.spellSlotDots}>
                  {Array.from({ length: slot.total }, (_, index) => (
                    <i key={index} aria-hidden="true" />
                  ))}
                </span>
              ) : null}
            </div>
            <div className={styles.spellCardList}>
              {levelSpells.map((spell) => {
                const librarySpell = findLibrarySpell(spell.name, spellLookup)
                const content = (
                  <>
                    <div>
                      <strong>{spell.name}</strong>
                      <span>{level === 0 ? 'Заговор' : `${level}-й уровень`}</span>
                    </div>
                    {spell.summary ? <p>{spell.summary}</p> : null}
                  </>
                )

                return librarySpell ? (
                  <button
                    className={`${styles.spellCard} ${styles.linkedSpellCard}`}
                    key={spell.id}
                    onClick={() => onOpenSpell(librarySpell)}
                    type="button"
                  >
                    {content}
                  </button>
                ) : (
                  <article className={styles.spellCard} key={spell.id}>
                    {content}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function SpellsTab({
  character,
  onOpenSpell,
  spellLookup,
}: {
  character: PlayerCharacter
  onOpenSpell: (spell: SpellBlock) => void
  spellLookup: Map<string, SpellBlock>
}) {
  return (
    <div className={styles.tabPanel}>
      <div className={styles.spellTopline}>
        <SmallField label="Спасбросок" value={character.spellcasting.saveDc || '-'} />
        <SmallField label="Атака" value={character.spellcasting.attackBonus || '-'} />
      </div>
      <SpellGroups character={character} onOpenSpell={onOpenSpell} spellLookup={spellLookup} />
    </div>
  )
}

function CharacterTabPanel({
  character,
  onOpenSpell,
  spellLookup,
  tab,
}: {
  character: PlayerCharacter
  onOpenSpell: (spell: SpellBlock) => void
  spellLookup: Map<string, SpellBlock>
  tab: CharacterTab
}) {
  switch (tab) {
    case 'attacks':
      return <AttacksTab character={character} />
    case 'features':
      return <FeaturesTab character={character} />
    case 'equipment':
      return <EquipmentTab character={character} />
    case 'personality':
      return <PersonalityTab character={character} />
    case 'goals':
      return <GoalsTab character={character} />
    case 'notes':
      return <NotesTab character={character} />
    case 'spells':
      return <SpellsTab character={character} onOpenSpell={onOpenSpell} spellLookup={spellLookup} />
  }
}

export function CharacterModal({ character, onClose, spellLibrary }: CharacterModalProps) {
  const [activeTab, setActiveTab] = useState<CharacterTab>('attacks')
  const [selectedSpell, setSelectedSpell] = useState<SpellBlock | null>(null)
  const spellLookup = useMemo(() => createSpellLookup(spellLibrary), [spellLibrary])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label={`Карточка персонажа ${character.name}`}
        aria-modal="true"
        className={`modal-dialog ${styles.modal}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Закрыть">
          <i aria-hidden="true" className="fa-solid fa-xmark" />
        </button>
        <CharacterHeader character={character} />
        <div className={styles.body}>
          <CharacterSidebar character={character} />
          <section className={styles.main}>
            <nav className={styles.tabs} aria-label="Разделы карточки персонажа">
              {tabs.map((tab) => (
                <button
                  aria-selected={activeTab === tab.id}
                  className={activeTab === tab.id ? styles.activeTab : ''}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <CharacterTabPanel
              character={character}
              onOpenSpell={setSelectedSpell}
              spellLookup={spellLookup}
              tab={activeTab}
            />
          </section>
        </div>
        {selectedSpell ? (
          <SpellDetailCard onClose={() => setSelectedSpell(null)} spell={selectedSpell} />
        ) : null}
      </div>
    </div>
  )
}
