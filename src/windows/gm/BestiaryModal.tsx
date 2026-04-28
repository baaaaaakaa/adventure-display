import { useDeferredValue, useMemo, useState } from 'react'
import type { MonsterBlock, MonsterFeature } from '../../types/adventure'
import type { MonsterSummary } from '../../library/bestiary/bestiaryRepository'
import styles from './SpellLibraryModal.module.css'

type BestiaryModalProps = {
  loadMonsterDetail: (monsterId: string) => Promise<MonsterBlock | null>
  monsters: MonsterSummary[]
  onAddMonsterToScene?: (monster: MonsterBlock) => void
  onClose: () => void
}

const monsterRenderBatchSize = 180

const sourceFilterGroups = [
  { label: 'Базовые', sources: ['MM', 'VGM', 'MTF', 'MPMM', 'FTD', 'BGG'] },
  { label: 'Приключения', sources: ['LMoP', 'PaBTSO', 'CoS', 'SKT', 'ToA', 'WDH', 'WDMM', 'GoS', 'BGDIA', 'IDRotF', 'WBtW', 'TftYP', 'CM', 'JttRC', 'KftGV'] },
  { label: 'Сеттинги', sources: ['SCAG', 'ERLW', 'EGtW', 'GGR', 'MOoT', 'SCC', 'AAG', 'SatO', 'PSX', 'PSI', 'PSZ'] },
  { label: 'Unearthed Arcana', sources: ['UA'] },
  { label: '3rd party', sources: ['TDCSR', 'TDCS', 'DoDk', 'HftT', 'ToB1', 'ToB2', 'ToB3'] },
  { label: 'Homebrew', sources: ['HB'] },
]

const featureSections: Array<{
  key: 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions'
  title: string
}> = [
  { key: 'traits', title: 'Черты' },
  { key: 'actions', title: 'Действия' },
  { key: 'bonusActions', title: 'Бонусные действия' },
  { key: 'reactions', title: 'Реакции' },
  { key: 'legendaryActions', title: 'Легендарные действия' },
]

function isSourceActive(selectedSources: string[], sourceValues: string[], source: string) {
  return selectedSources.length === 0 ? sourceValues.includes(source) : selectedSources.includes(source)
}

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function firstChallengeToken(challenge: string) {
  return challenge.split(' ')[0]?.trim() || '—'
}

function challengeRank(challenge: string) {
  if (challenge === '—') {
    return Number.POSITIVE_INFINITY
  }

  if (challenge.includes('/')) {
    const [left, right] = challenge.split('/').map(Number)

    return right ? left / right : Number.POSITIVE_INFINITY
  }

  const numericValue = Number(challenge)

  return Number.isFinite(numericValue) ? numericValue : Number.POSITIVE_INFINITY
}

function compareChallenges(left: string, right: string) {
  return challengeRank(left) - challengeRank(right) || left.localeCompare(right, 'ru-RU')
}

function isChallengeActive(selectedChallenges: string[], challengeValues: string[], challenge: string) {
  return selectedChallenges.length === 0 ? challengeValues.includes(challenge) : selectedChallenges.includes(challenge)
}

function formatModifier(score: number) {
  const modifier = Math.floor((score - 10) / 2)

  return modifier >= 0 ? `+${modifier}` : String(modifier)
}

function renderInlineText(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return part
  })
}

function TextBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)

  if (paragraphs.length === 0) {
    return null
  }

  return (
    <div className={styles.detailDescription}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`}>{renderInlineText(paragraph)}</p>
      ))}
    </div>
  )
}

function FeatureList({ features }: { features: MonsterFeature[] }) {
  if (features.length === 0) {
    return null
  }

  return (
    <div className={styles.detailDescription}>
      {features.map((feature) => (
        <p key={feature.id}>
          <strong>{feature.title}</strong>
          {feature.body ? ` ${feature.body}` : ''}
        </p>
      ))}
    </div>
  )
}

function MonsterFeatureSection({ features, title }: { features: MonsterFeature[]; title: string }) {
  if (features.length === 0) {
    return null
  }

  return (
    <section className={styles.monsterStatBlockSection}>
      <h3>{title}</h3>
      <FeatureList features={features} />
    </section>
  )
}

function MonsterInfoDisclosure({ section }: { section: MonsterFeature }) {
  return (
    <details className={styles.monsterInfoDisclosure}>
      <summary>
        <span>{section.title}</span>
        <i aria-hidden="true" className="fa-solid fa-plus" />
      </summary>
      {section.body ? <TextBlock text={section.body} /> : null}
    </details>
  )
}

function MonsterCard({
  monster,
  onAdd,
  onSelect,
}: {
  monster: MonsterSummary
  onAdd?: () => void
  onSelect: () => void
}) {
  return (
    <article
      className={styles.card}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cardTopline}>
        <div>
          <div className={styles.cardTitleRow}>
            <h3>{monster.name}</h3>
            {onAdd ? (
              <button
                aria-label={`Добавить ${monster.name} в сцену`}
                className={styles.editSpellButton}
                onClick={(event) => {
                  event.stopPropagation()
                  onAdd()
                }}
                onKeyDown={(event) => event.stopPropagation()}
                title="Добавить в сцену"
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-plus" />
              </button>
            ) : null}
          </div>
          <span>{[monster.size, monster.creatureType].filter(isFilled).join(' • ')}</span>
        </div>
        <div className={styles.cardTags}>
          <small>{monster.source || 'TTG'}</small>
          <small>{firstChallengeToken(monster.challenge)}</small>
        </div>
      </div>

      <div className={`${styles.metaGrid} ${styles.monsterMetaGrid}`} aria-label="Параметры монстра">
        <span title="Класс доспеха">
          <i aria-hidden="true" className="fa-solid fa-shield-halved" />
          <strong>{monster.armorClass || '—'}</strong>
        </span>
        <span title="Хиты">
          <i aria-hidden="true" className="fa-solid fa-heart-pulse" />
          <strong>{monster.hitPoints || '—'}</strong>
        </span>
        <span title="Скорость">
          <i aria-hidden="true" className="fa-solid fa-person-running" />
          <strong>{monster.speed || '—'}</strong>
        </span>
      </div>
    </article>
  )
}

function MonsterDetailCard({
  monster,
  onAddMonsterToScene,
  onClose,
}: {
  monster: MonsterBlock
  onAddMonsterToScene?: (monster: MonsterBlock) => void
  onClose: () => void
}) {
  const hasAnyFeature = featureSections.some((section) => monster[section.key].length > 0)
  const infoSections = monster.infoSections ?? []
  const profileRows = [
    ['Спасброски', monster.savingThrows],
    ['Навыки', monster.skills],
    ['Уязвимости', monster.damageVulnerabilities],
    ['Сопротивления', monster.damageResistances],
    ['Иммунитеты к урону', monster.damageImmunities],
    ['Иммунитеты к состояниям', monster.conditionImmunities],
    ['Чувства', monster.senses],
    ['Языки', monster.languages],
    ['Уровень опасности', monster.challenge],
    ['Бонус мастерства', monster.proficiencyBonus],
  ].filter(([, value]) => isFilled(value))
  const abilityScores = [
    ['СИЛ', monster.strength],
    ['ЛОВ', monster.dexterity],
    ['ТЕЛ', monster.constitution],
    ['ИНТ', monster.intelligence],
    ['МДР', monster.wisdom],
    ['ХАР', monster.charisma],
  ] as const

  return (
    <div className={styles.detailBackdrop} onClick={onClose} role="presentation">
      <article
        aria-label={monster.name}
        aria-modal="true"
        className={`${styles.detailCard} ${styles.monsterDetailCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className={styles.detailCloseButton} onClick={onClose} type="button" aria-label="Закрыть">
          <i aria-hidden="true" className="fa-solid fa-xmark" />
        </button>

        <header className={styles.monsterDetailHeader}>
          <h2>{monster.name}</h2>
          <span>{[monster.subtitle, monster.source].filter(isFilled).join(' • ')}</span>
        </header>

        <div className={styles.monsterStatBlock}>
          <section className={styles.monsterStatHero}>
            <div className={styles.monsterStatSummary}>
              <div className={styles.monsterVitals}>
                <p><strong>Класс доспеха</strong><span>{monster.armorClass || '—'}</span></p>
                <p><strong>Хиты</strong><span>{monster.hitPoints || '—'}</span></p>
                <p><strong>Скорость</strong><span>{monster.speed || '—'}</span></p>
              </div>

              <div className={styles.monsterAbilityGrid}>
                {abilityScores.map(([label, score]) => (
                  <div className={styles.monsterAbilityBox} key={label}>
                    <strong>{label}</strong>
                    <span>{score} ({formatModifier(score)})</span>
                  </div>
                ))}
              </div>

              {profileRows.length > 0 ? (
                <div className={styles.monsterProfileRows}>
                  {profileRows.map(([label, value]) => (
                    <p key={label}><strong>{label}</strong> {value}</p>
                  ))}
                </div>
              ) : null}
            </div>

            {monster.imageSrc ? (
              <img className={styles.monsterStatPortrait} alt={monster.name} src={monster.imageSrc} />
            ) : null}
          </section>

          {hasAnyFeature ? (
            <>
              {featureSections.map((section) =>
                monster[section.key].length > 0 ? (
                  <MonsterFeatureSection
                    features={monster[section.key]}
                    key={section.key}
                    title={section.title}
                  />
                ) : null,
              )}
            </>
          ) : null}

          {infoSections.length > 0 ? (
            <div className={styles.monsterInfoDisclosureList}>
              {infoSections.map((section) => (
                <MonsterInfoDisclosure key={section.id} section={section} />
              ))}
            </div>
          ) : null}
        </div>

        {onAddMonsterToScene ? (
          <div className={styles.detailFooter}>
            <button className={styles.saveButton} onClick={() => onAddMonsterToScene(monster)} type="button">
              Добавить в сцену
            </button>
          </div>
        ) : null}
      </article>
    </div>
  )
}

export function BestiaryModal({ loadMonsterDetail, monsters, onAddMonsterToScene, onClose }: BestiaryModalProps) {
  const [query, setQuery] = useState('')
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [areSourceFiltersOpen, setAreSourceFiltersOpen] = useState(true)
  const [selectedMonster, setSelectedMonster] = useState<MonsterBlock | null>(null)
  const [loadingMonsterId, setLoadingMonsterId] = useState<string | null>(null)
  const [monsterDetailError, setMonsterDetailError] = useState<string | null>(null)
  const [visibleMonsterLimit, setVisibleMonsterLimit] = useState(monsterRenderBatchSize)
  const deferredQuery = useDeferredValue(query)

  const challengeValues = useMemo(
    () => Array.from(new Set(monsters.map((monster) => firstChallengeToken(monster.challenge)))).sort(compareChallenges),
    [monsters],
  )
  const sourceValues = useMemo(
    () => Array.from(new Set(monsters.map((monster) => monster.source).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [monsters],
  )
  const sourceGroups = useMemo(() => {
    const groupedSources = new Set(sourceFilterGroups.flatMap((group) => group.sources))
    const knownGroups = sourceFilterGroups
      .map((group) => ({
        ...group,
        sources: group.sources.filter((source) => sourceValues.includes(source)),
      }))
      .filter((group) => group.sources.length > 0)
    const otherSources = sourceValues.filter((source) => !groupedSources.has(source))

    return otherSources.length > 0
      ? [...knownGroups, { label: 'Прочее', sources: otherSources }]
      : knownGroups
  }, [sourceValues])

  const groupedMonsters = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase('ru-RU')
    const selectedChallengeSet = new Set(selectedChallenges)
    const selectedSourceSet = new Set(selectedSources)
    const groups = new Map<string, MonsterSummary[]>()

    monsters.forEach((monster) => {
      const challenge = firstChallengeToken(monster.challenge)

      if (selectedChallengeSet.size > 0 && !selectedChallengeSet.has(challenge)) {
        return
      }

      if (selectedSourceSet.size > 0 && !selectedSourceSet.has(monster.source)) {
        return
      }

      if (normalizedQuery) {
        const searchText = [monster.name, monster.subtitle, monster.source, monster.creatureType, monster.challenge]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('ru-RU')

        if (!searchText.includes(normalizedQuery)) {
          return
        }
      }

      const group = groups.get(challenge)

      if (group) {
        group.push(monster)
      } else {
        groups.set(challenge, [monster])
      }
    })

    return Array.from(groups.entries()).sort(([left], [right]) => compareChallenges(left, right)).map(([challenge, groupMonsters]) => ({
      challenge,
      monsters: groupMonsters,
    }))
    .filter((group) => group.monsters.length > 0)
  }, [deferredQuery, monsters, selectedChallenges, selectedSources])
  const filteredMonsterCount = groupedMonsters.reduce((count, group) => count + group.monsters.length, 0)
  const visibleGroupedMonsters = useMemo(() => {
    return groupedMonsters.reduce<{
      groups: Array<{ challenge: string; monsters: MonsterSummary[] }>
      remaining: number
    }>(
      (state, group) => {
        if (state.remaining <= 0) {
          return state
        }

        const visibleMonsters = group.monsters.slice(0, state.remaining)

        if (visibleMonsters.length === 0) {
          return state
        }

        return {
          groups: [...state.groups, { ...group, monsters: visibleMonsters }],
          remaining: state.remaining - visibleMonsters.length,
        }
      },
      { groups: [], remaining: visibleMonsterLimit },
    ).groups
  }, [groupedMonsters, visibleMonsterLimit])

  function toggleSource(source: string) {
    setVisibleMonsterLimit(monsterRenderBatchSize)
    setSelectedSources((currentSources) => {
      if (currentSources.length === 0) {
        return sourceValues.filter((currentSource) => currentSource !== source)
      }

      if (currentSources.length === 1 && currentSources.includes(source)) {
        return []
      }

      return currentSources.includes(source)
        ? currentSources.filter((currentSource) => currentSource !== source)
        : [...currentSources, source].sort((left, right) => left.localeCompare(right, 'ru-RU'))
    })
  }

  function toggleSourceGroup(sources: string[]) {
    setVisibleMonsterLimit(monsterRenderBatchSize)
    setSelectedSources((currentSources) => {
      const activeSources = currentSources.length === 0 ? sourceValues : currentSources
      const isGroupActive = sources.every((source) => activeSources.includes(source))
      const nextSources = isGroupActive
        ? activeSources.filter((source) => !sources.includes(source))
        : Array.from(new Set([...activeSources, ...sources]))

      if (nextSources.length === sourceValues.length || nextSources.length === 0) {
        return []
      }

      return nextSources.sort((left, right) => left.localeCompare(right, 'ru-RU'))
    })
  }

  function toggleChallenge(challenge: string) {
    setVisibleMonsterLimit(monsterRenderBatchSize)
    setSelectedChallenges((currentChallenges) => {
      const activeChallenges = currentChallenges.length === 0 ? challengeValues : currentChallenges

      if (activeChallenges.length === 1 && activeChallenges.includes(challenge)) {
        return []
      }

      const nextChallenges = activeChallenges.includes(challenge)
        ? activeChallenges.filter((currentChallenge) => currentChallenge !== challenge)
        : [...activeChallenges, challenge]

      if (nextChallenges.length === challengeValues.length || nextChallenges.length === 0) {
        return []
      }

      return nextChallenges.sort(compareChallenges)
    })
  }

  async function loadDetail(monster: MonsterSummary) {
    setLoadingMonsterId(monster.id)
    setMonsterDetailError(null)

    try {
      const detail = await loadMonsterDetail(monster.id)

      if (!detail) {
        setMonsterDetailError(`Не удалось найти монстра "${monster.name}".`)
        return null
      }

      return detail
    } catch (error) {
      setMonsterDetailError(error instanceof Error ? error.message : `Не удалось загрузить монстра "${monster.name}".`)
      return null
    } finally {
      setLoadingMonsterId(null)
    }
  }

  async function selectMonster(monster: MonsterSummary) {
    const detail = await loadDetail(monster)

    if (detail) {
      setSelectedMonster(detail)
    }
  }

  function handleAddMonster(monster: MonsterBlock) {
    onAddMonsterToScene?.(monster)
  }

  async function handleAddMonsterSummary(monster: MonsterSummary) {
    const detail = await loadDetail(monster)

    if (detail) {
      handleAddMonster(detail)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label="Бестиарий"
        aria-modal="true"
        className={`modal-dialog ${styles.modal}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.header}>
          <div className={styles.titleLine}>
            <h2>Бестиарий</h2>
          </div>
          <div className={styles.sourceFilters} aria-label="Источники бестиария">
            <div className={styles.sourceFiltersHeader}>
              <strong>Источники</strong>
              <button
                aria-expanded={areSourceFiltersOpen}
                onClick={() => setAreSourceFiltersOpen((isOpen) => !isOpen)}
                type="button"
              >
                <i aria-hidden="true" className={`fa-solid ${areSourceFiltersOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
              </button>
            </div>
            {areSourceFiltersOpen ? (
              <div className={styles.sourceDropdown}>
                <div className={styles.sourceGroupList}>
                  {sourceGroups.map((group) => {
                    const isGroupActive = group.sources.every((source) => isSourceActive(selectedSources, sourceValues, source))

                    return (
                      <section className={styles.sourceGroup} key={group.label}>
                        <div className={styles.sourceGroupHeader}>
                          <span>{group.label}</span>
                          <button
                            aria-pressed={isGroupActive}
                            className={isGroupActive ? styles.activeSourceSwitch : ''}
                            onClick={() => toggleSourceGroup(group.sources)}
                            type="button"
                          >
                            <i aria-hidden="true" />
                          </button>
                        </div>
                        <div className={styles.sourceChips}>
                          {group.sources.map((source) => {
                            const isActive = isSourceActive(selectedSources, sourceValues, source)

                            return (
                              <button
                                aria-pressed={isActive}
                                className={isActive ? styles.activeSource : ''}
                                key={source}
                                onClick={() => toggleSource(source)}
                                type="button"
                              >
                                {source}
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <strong>{filteredMonsterCount} / {monsters.length}</strong>
          <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Закрыть">
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </header>

        <section className={`${styles.toolbar} ${styles.bestiaryToolbar}`}>
          <label className={styles.searchField}>
            <i aria-hidden="true" className="fa-solid fa-magnifying-glass" />
            <input
              onChange={(event) => {
                setVisibleMonsterLimit(monsterRenderBatchSize)
                setQuery(event.target.value)
              }}
              placeholder="Поиск"
              type="search"
              value={query}
            />
          </label>

          <div className={`${styles.levels} ${styles.challengeLevels}`} aria-label="Уровни опасности">
            {challengeValues.map((challenge) => (
              <button
                aria-pressed={isChallengeActive(selectedChallenges, challengeValues, challenge)}
                className={isChallengeActive(selectedChallenges, challengeValues, challenge) ? styles.activeLevel : ''}
                key={challenge}
                onClick={() => toggleChallenge(challenge)}
                title={`Опасность ${challenge}`}
                type="button"
              >
                {challenge}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.content}>
          {monsterDetailError ? <p className={styles.emptyState}>{monsterDetailError}</p> : null}
          {visibleGroupedMonsters.length > 0 ? (
            <>
            {visibleGroupedMonsters.map((group) => (
              <section className={styles.group} key={group.challenge}>
                <div className={styles.groupHeader}>
                  <h3>Опасность {group.challenge}</h3>
                  <span>{group.monsters.length}</span>
                </div>
                <div className={styles.grid}>
                  {group.monsters.map((monster) => (
                    <MonsterCard
                      key={monster.id}
                      monster={monster}
                      onAdd={onAddMonsterToScene ? () => void handleAddMonsterSummary(monster) : undefined}
                      onSelect={() => void selectMonster(monster)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {visibleMonsterLimit < filteredMonsterCount ? (
              <button
                className={styles.loadMoreButton}
                onClick={() => setVisibleMonsterLimit((currentLimit) => currentLimit + monsterRenderBatchSize)}
                type="button"
              >
                Показать еще {Math.min(monsterRenderBatchSize, filteredMonsterCount - visibleMonsterLimit)}
              </button>
            ) : null}
            {loadingMonsterId ? <p className={styles.emptyState}>Загружаю карточку монстра...</p> : null}
            </>
          ) : (
            <p className={styles.emptyState}>В бестиарии нет монстров по этому запросу.</p>
          )}
        </div>

        {selectedMonster ? (
          <MonsterDetailCard
            monster={selectedMonster}
            onAddMonsterToScene={onAddMonsterToScene ? handleAddMonster : undefined}
            onClose={() => setSelectedMonster(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
