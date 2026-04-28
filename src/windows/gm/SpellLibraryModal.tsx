import { useDeferredValue, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { SpellBlock } from '../../types/adventure'
import styles from './SpellLibraryModal.module.css'

type SpellLibraryModalProps = {
  spells: SpellBlock[]
  onClose: () => void
}

const levelValues = Array.from({ length: 10 }, (_, index) => index)
const spellRenderBatchSize = 240

type SpellFormState = {
  name: string
  level: string
  school: string
  components: string
  materialComponent: string
  castingTimeAmount: string
  castingTimeType: string
  castingCondition: string
  targetType: string
  areaSize: string
  areaUnits: string
  rangeType: string
  rangeAmount: string
  durationType: string
  durationAmount: string
  actionType: string
  ability: string
  damageDice: string
  damageType: string
  scalingType: string
  scalingDice: string
  description: string
  classes: string[]
  source: string
}

const initialSpellFormState: SpellFormState = {
  name: '',
  level: '0',
  school: 'evo',
  components: 'ВС',
  materialComponent: '',
  castingTimeAmount: '1',
  castingTimeType: 'Бонусное действие',
  castingCondition: '',
  targetType: '—',
  areaSize: '',
  areaUnits: 'футы',
  rangeType: 'Видимость',
  rangeAmount: '',
  durationType: '—',
  durationAmount: '',
  actionType: 'Вспомогательное',
  ability: 'dex',
  damageDice: '',
  damageType: '',
  scalingType: '',
  scalingDice: '',
  description: '',
  classes: [],
  source: 'Пользовательское',
}

const schoolOptions = [
  { value: 'abj', label: 'Ограждение' },
  { value: 'con', label: 'Вызов' },
  { value: 'div', label: 'Прорицание' },
  { value: 'enc', label: 'Очарование' },
  { value: 'evo', label: 'Воплощение' },
  { value: 'ill', label: 'Иллюзия' },
  { value: 'nec', label: 'Некромантия' },
  { value: 'trs', label: 'Преобразование' },
]

const actionTypeOptions = [
  { value: 'Вспомогательное', label: 'Вспомогательное' },
  { value: 'Дальнобойная атака', label: 'Дальнобойная атака' },
  { value: 'Другое', label: 'Другое' },
  { value: 'Лечение', label: 'Лечение' },
  { value: 'Рукопашная атака', label: 'Рукопашная атака' },
  { value: 'Спасбросок', label: 'Спасбросок' },
]

const abilityOptions = [
  { value: 'str', label: 'Сила' },
  { value: 'dex', label: 'Ловкость' },
  { value: 'con', label: 'Телосложение' },
  { value: 'int', label: 'Интеллект' },
  { value: 'wis', label: 'Мудрость' },
  { value: 'cha', label: 'Харизма' },
]

const damageTypeOptions = [
  { value: '', label: 'Без типа' },
  { value: 'acid', label: 'Кислота' },
  { value: 'bludgeoning', label: 'Дробящий' },
  { value: 'cold', label: 'Холод' },
  { value: 'fire', label: 'Огонь' },
  { value: 'force', label: 'Силовой' },
  { value: 'healing', label: 'Лечение' },
  { value: 'lightning', label: 'Молния' },
  { value: 'necrotic', label: 'Некротический' },
  { value: 'piercing', label: 'Колющий' },
  { value: 'poison', label: 'Яд' },
  { value: 'psychic', label: 'Психический' },
  { value: 'radiant', label: 'Излучение' },
  { value: 'slashing', label: 'Рубящий' },
  { value: 'thunder', label: 'Звук' },
]

const scalingTypeOptions = [
  { value: '', label: 'Нет' },
  { value: 'cantrip', label: 'Заговор' },
  { value: 'level', label: 'Круг заклинания' },
]

const castingTimeTypeOptions = [
  'Действие',
  'Бонусное действие',
  'Реакция',
  'Минута',
  'Час',
]

const targetTypeOptions = [
  '—',
  'Конус',
  'Куб',
  'Линия',
  'На себя',
  'Объект',
  'Площадь',
]

const areaUnitsOptions = [
  'футы',
  'мили',
]

const rangeTypeOptions = [
  'Видимость',
  'Касание',
  'Любая',
  'Мили',
  'На себя',
  'Специальная',
  'Футы',
]

const durationTypeOptions = [
  '—',
  'Дни',
  'Мгновенная',
  'Минуты',
  'Особая',
  'Пока не рассеется',
  'Пока не рассеется или не будет сработано',
]

const sourceFilterGroups = [
  { label: 'Базовые', sources: ['PHB', 'XGE', 'TCE', 'FTD', 'BMT'] },
  { label: 'Приключения', sources: ['LLK', 'AI', 'IDRotF'] },
  { label: 'Сеттинги', sources: ['SCAG', 'GGR', 'SCC', 'AAG', 'SatO'] },
  { label: 'Unearthed Arcana', sources: ['UAMM', 'UATOBM', 'UASS', 'UACDW', 'UAFRW', 'UA20POR', 'UASMT', 'UA21DO', 'UA22WotM'] },
  { label: '3rd party', sources: ['MHH', 'ODL', 'DMf5E', 'EGtW', 'GHtPG', 'TDCS', 'VSoS', 'DoDk'] },
  { label: 'Homebrew', sources: ['ICB', 'LH', 'PG'] },
]

function isSourceActive(selectedSources: string[], sourceValues: string[], source: string) {
  return selectedSources.length === 0 ? sourceValues.includes(source) : selectedSources.includes(source)
}

const schoolLabels: Record<string, string> = {
  abj: 'Ограждение',
  con: 'Вызов',
  div: 'Прорицание',
  enc: 'Очарование',
  evo: 'Воплощение',
  ill: 'Иллюзия',
  nec: 'Некромантия',
  trs: 'Преобразование',
}

const classLabels: Record<string, string> = {
  artificer: 'изобретатель',
  bard: 'бард',
  cleric: 'жрец',
  druid: 'друид',
  paladin: 'паладин',
  ranger: 'следопыт',
  sorcerer: 'чародей',
  warlock: 'колдун',
  wizard: 'волшебник',
}

const classOptions = Object.entries(classLabels).map(([value, label]) => ({
  value,
  label: label.charAt(0).toLocaleUpperCase('ru-RU') + label.slice(1),
}))

function levelLabel(level: number) {
  return level === 0 ? 'Заговор' : `${level}-й уровень`
}

function formatMetaValue(value: string) {
  return value.trim() || '-'
}

function formatComponentCodes(value: string) {
  const codes = value.split(',')[0]?.trim()

  return codes || '-'
}

function formatCardSubtitle(spell: SpellBlock) {
  return [
    levelLabel(spell.level),
    spell.components ? formatComponentCodes(spell.components) : '',
    spell.duration ? formatShortDuration(spell.duration) : '',
  ].filter(Boolean).join(' • ')
}

function formatAttackOrSaveValue(value: string) {
  const normalizedValue = value.trim().toLocaleLowerCase('ru-RU')
  const abilityLabels: Record<string, string> = {
    cha: 'Харизма',
    charisma: 'Харизма',
    con: 'Телосложение',
    constitution: 'Телосложение',
    dex: 'Ловкость',
    dexterity: 'Ловкость',
    int: 'Интеллект',
    intelligence: 'Интеллект',
    str: 'Сила',
    strength: 'Сила',
    wis: 'Мудрость',
    wisdom: 'Мудрость',
  }

  return abilityLabels[normalizedValue] ?? formatMetaValue(value)
}

function formatShortCastingTime(value: string) {
  const normalizedValue = formatMetaValue(value).toLocaleLowerCase('ru-RU')

  if (normalizedValue.includes('бонус')) {
    return 'БД'
  }

  if (normalizedValue.includes('реакц')) {
    return 'Р'
  }

  if (normalizedValue.includes('действ')) {
    return 'Действие'
  }

  return formatShortDuration(value)
}

function formatShortDistance(value: string) {
  return formatMetaValue(value)
    .replace(/футов/giu, 'фт')
    .replace(/фута/giu, 'фт')
    .replace(/фут/giu, 'фт')
    .replace(/миль/giu, 'миль')
    .replace(/\s*,\s*/gu, ', ')
}

function formatShortDuration(value: string) {
  return formatMetaValue(value)
    .replace(/,\s*вплоть до/giu, ',')
    .replace(/вплоть до/giu, '')
    .replace(/минуты/giu, 'мин')
    .replace(/минута/giu, 'мин')
    .replace(/минут/giu, 'мин')
    .replace(/часа/giu, 'ч')
    .replace(/часов/giu, 'ч')
    .replace(/час/giu, 'ч')
    .replace(/дня/giu, 'дн')
    .replace(/дней/giu, 'дн')
    .replace(/день/giu, 'дн')
    .replace(/\s{2,}/gu, ' ')
    .replace(/\s+,/gu, ',')
    .trim()
}

function formatShortAttackOrSaveValue(value: string) {
  const formattedValue = formatAttackOrSaveValue(value)

  if (formattedValue.toLocaleLowerCase('ru-RU').includes('атака')) {
    return 'Атака'
  }

  if (formattedValue === 'Телосложение') {
    return 'Телосл.'
  }

  return formattedValue
}

function schoolLabel(school: string) {
  const normalizedSchool = school.trim().toLocaleLowerCase('ru-RU')

  return schoolLabels[normalizedSchool] ?? school
}

function formatSubtitle(spell: SpellBlock) {
  return [levelLabel(spell.level), schoolLabel(spell.school)].filter(Boolean).join(', ')
}

function formatComponents(value: string) {
  const [codes, ...details] = value.split(',').map((part) => part.trim()).filter(Boolean)

  if (!codes) {
    return '-'
  }

  if (/^[ВСМ]+$/u.test(codes)) {
    const labels = Array.from(codes).map((code) => {
      if (code === 'В') {
        return 'вербальный'
      }

      if (code === 'С') {
        return 'соматический'
      }

      return 'материальный'
    })
    const componentText = labels.join(', ')
    const materialText = details.join(', ')

    return materialText ? `${componentText} (${materialText})` : componentText
  }

  return value.trim() || '-'
}

function formatClassName(value: string) {
  const label = classLabels[value.toLocaleLowerCase('ru-RU')] ?? value

  return label.toLocaleUpperCase('ru-RU')
}

function getDetailTags(spell: SpellBlock) {
  return spell.tags.filter((tag) => !tag.startsWith('Рост:') && !tag.startsWith('+'))
}

function renderInlineText(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return part
  })
}

function SpellDescription({ description }: { description: string }) {
  const paragraphs = description.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)

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

function SpellCard({
  spell,
  onEdit,
  onSelect,
}: {
  spell: SpellBlock
  onEdit: () => void
  onSelect: () => void
}) {
  const tags = [
    spell.requiresConcentration ? 'К' : '',
    spell.isRitual ? 'Р' : '',
  ].filter(Boolean)

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
            <h3>{spell.name}</h3>
            <button
              aria-label={`Редактировать ${spell.name}`}
              className={styles.editSpellButton}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
              onKeyDown={(event) => event.stopPropagation()}
              title="Редактировать заклинание"
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-pen" />
            </button>
          </div>
          <span>{formatCardSubtitle(spell)}</span>
        </div>
        <div className={styles.cardTags}>
          {tags.slice(0, 3).map((tag) => (
            <i key={tag}>{tag}</i>
          ))}
          <small>{spell.source || 'SRD'}</small>
        </div>
      </div>

      <div className={styles.metaGrid} aria-label="Параметры заклинания">
        <span title="Время сотворения">
          <i aria-hidden="true" className="fa-solid fa-hourglass-half" />
          <strong>{formatShortCastingTime(spell.castingTime)}</strong>
        </span>
        <span title="Дистанция">
          <i aria-hidden="true" className="fa-solid fa-ruler-horizontal" />
          <strong>{formatShortDistance(spell.range)}</strong>
        </span>
        <span title="Атака или испытание">
          <i aria-hidden="true" className="fa-solid fa-wand-sparkles" />
          <strong>{formatShortAttackOrSaveValue(spell.attackBonus || spell.save)}</strong>
        </span>
        <span title="Кость урона">
          <i aria-hidden="true" className="fa-solid fa-dice-d20" />
          <strong>{formatMetaValue(spell.damage)}</strong>
        </span>
      </div>

    </article>
  )
}

export function SpellDetailCard({ spell, onClose }: { spell: SpellBlock; onClose: () => void }) {
  const detailTags = getDetailTags(spell)

  return (
    <div className={styles.detailBackdrop} onClick={onClose} role="presentation">
      <article
        aria-label={spell.name}
        aria-modal="true"
        className={styles.detailCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className={styles.detailCloseButton} onClick={onClose} type="button" aria-label="Закрыть">
          <i aria-hidden="true" className="fa-solid fa-xmark" />
        </button>

        <header className={styles.detailHeader}>
          <h2>{spell.name}</h2>
          <span>{formatSubtitle(spell)}</span>
        </header>

        <div className={styles.detailFixedContent}>
          <dl className={styles.detailStats}>
            <div>
              <dt>
                <i aria-hidden="true" className="fa-solid fa-hourglass-half" />
                Время сотворения:
              </dt>
              <dd>{formatMetaValue(spell.castingTime)}</dd>
            </div>
            <div>
              <dt>
                <i aria-hidden="true" className="fa-solid fa-ruler-horizontal" />
                Дистанция:
              </dt>
              <dd>{formatMetaValue(spell.range)}</dd>
            </div>
            <div>
              <dt>
                <i aria-hidden="true" className="fa-solid fa-stopwatch" />
                Длительность:
              </dt>
              <dd>{formatMetaValue(spell.duration)}</dd>
            </div>
            <div>
              <dt>
                <i aria-hidden="true" className="fa-solid fa-seedling" />
                Компоненты:
              </dt>
              <dd>{formatComponents(spell.components)}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.detailScrollContent}>
          <SpellDescription description={spell.description} />
        </div>

        {detailTags.length > 0 || spell.classes.length > 0 ? (
          <div className={styles.detailFooter}>
            {detailTags.length > 0 ? (
            <section className={styles.detailTags} aria-label="Типы урона">
              <h3>Тип урона:</h3>
              <div>
                {detailTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>
          ) : null}

            {spell.classes.length > 0 ? (
            <section className={styles.detailClasses} aria-label="Доступно классам">
              <h3>Доступно классам:</h3>
              <div>
                {spell.classes.map((className) => (
                  <span key={className}>{formatClassName(className)}</span>
                ))}
              </div>
            </section>
          ) : null}
          </div>
        ) : null}
      </article>
    </div>
  )
}

function createSpellId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `custom-spell-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function joinAmountAndType(amount: string, type: string) {
  return [amount.trim(), type.trim()].filter(Boolean).join(' ')
}

function formatFormComponents(form: SpellFormState) {
  return [form.components.trim().toLocaleUpperCase('ru-RU'), form.materialComponent.trim()]
    .filter(Boolean)
    .join(', ')
}

function formatFormRange(form: SpellFormState) {
  if (form.rangeType === '—') {
    return ''
  }

  return joinAmountAndType(form.rangeAmount, form.rangeType)
}

function formatFormDuration(form: SpellFormState) {
  if (form.durationType === '—') {
    return ''
  }

  return joinAmountAndType(form.durationAmount, form.durationType)
}

function parseComponentsForForm(value: string) {
  const [componentCodes = '', ...materialParts] = value.split(',')
  const normalizedCodes = ['В', 'С', 'М'].filter((code) => componentCodes.toLocaleUpperCase('ru-RU').includes(code)).join('')

  return {
    components: normalizedCodes || initialSpellFormState.components,
    materialComponent: materialParts.join(',').trim(),
  }
}

function firstNumber(value: string) {
  return value.match(/\d+/)?.[0] ?? ''
}

function parseCastingTimeForForm(value: string) {
  const normalizedValue = value.toLocaleLowerCase('ru-RU')
  const matchedType = castingTimeTypeOptions.find((option) =>
    normalizedValue.includes(option.toLocaleLowerCase('ru-RU').replace('ое ', 'ого ')),
  )

  return {
    castingTimeAmount: firstNumber(value) || initialSpellFormState.castingTimeAmount,
    castingTimeType: matchedType ?? initialSpellFormState.castingTimeType,
  }
}

function parseRangeForForm(value: string) {
  const normalizedValue = value.toLocaleLowerCase('ru-RU')

  if (normalizedValue.includes('фут')) {
    return { rangeType: 'Футы', rangeAmount: firstNumber(value) }
  }

  if (normalizedValue.includes('мил')) {
    return { rangeType: 'Мили', rangeAmount: firstNumber(value) }
  }

  const matchedType = rangeTypeOptions.find((option) => normalizedValue.includes(option.toLocaleLowerCase('ru-RU')))

  return {
    rangeType: matchedType ?? initialSpellFormState.rangeType,
    rangeAmount: firstNumber(value),
  }
}

function parseDurationForForm(value: string) {
  const normalizedValue = value.toLocaleLowerCase('ru-RU')

  if (!value.trim()) {
    return {
      durationType: initialSpellFormState.durationType,
      durationAmount: initialSpellFormState.durationAmount,
    }
  }

  if (normalizedValue.includes('мгнов')) {
    return { durationType: 'Мгновенная', durationAmount: '' }
  }

  if (normalizedValue.includes('дн')) {
    return { durationType: 'Дни', durationAmount: firstNumber(value) }
  }

  if (normalizedValue.includes('мин')) {
    return { durationType: 'Минуты', durationAmount: firstNumber(value) }
  }

  if (normalizedValue.includes('рассе')) {
    return { durationType: 'Пока не рассеется', durationAmount: '' }
  }

  return { durationType: 'Особая', durationAmount: firstNumber(value) }
}

function parseActionForForm(spell: SpellBlock) {
  if (spell.save) {
    return 'Спасбросок'
  }

  if (spell.attackBonus) {
    return spell.range.toLocaleLowerCase('ru-RU').includes('касание') ? 'Рукопашная атака' : 'Дальнобойная атака'
  }

  if (spell.damage.toLocaleLowerCase('ru-RU').includes('healing')) {
    return 'Лечение'
  }

  return initialSpellFormState.actionType
}

function parseAbilityForForm(value: string) {
  const normalizedValue = value.toLocaleLowerCase('ru-RU')

  return abilityOptions.find((option) => option.label.toLocaleLowerCase('ru-RU') === normalizedValue)?.value ?? initialSpellFormState.ability
}

function parseDamageForForm(spell: SpellBlock) {
  const damageTypeByLabel = damageTypeOptions.find((option) =>
    spell.tags.some((tag) => tag.toLocaleLowerCase('ru-RU') === option.label.toLocaleLowerCase('ru-RU')),
  )
  const damageTypeByValue = damageTypeOptions.find((option) =>
    spell.damage.toLocaleLowerCase('ru-RU').includes(option.value.toLocaleLowerCase('ru-RU')),
  )

  return {
    damageDice: spell.damage.replace(/\b[a-z]+\b/gi, '').trim(),
    damageType: damageTypeByLabel?.value ?? damageTypeByValue?.value ?? '',
  }
}

function parseScalingForForm(spell: SpellBlock) {
  const scalingTypeTag = spell.tags.find((tag) => tag.startsWith('Рост:'))
  const scalingDiceTag = spell.tags.find((tag) => tag.startsWith('+'))
  const scalingType = scalingTypeOptions.find((option) => scalingTypeTag?.includes(option.label))?.value ?? ''

  return {
    scalingType,
    scalingDice: scalingDiceTag?.replace(/^\+/, '') ?? '',
  }
}

function spellToFormState(spell: SpellBlock): SpellFormState {
  const components = parseComponentsForForm(spell.components)
  const castingTime = parseCastingTimeForForm(spell.castingTime)
  const range = parseRangeForForm(spell.range)
  const duration = parseDurationForForm(spell.duration)
  const damage = parseDamageForForm(spell)
  const scaling = parseScalingForForm(spell)

  return {
    name: spell.name,
    level: String(spell.level),
    school: spell.school,
    components: components.components,
    materialComponent: components.materialComponent,
    castingTimeAmount: castingTime.castingTimeAmount,
    castingTimeType: castingTime.castingTimeType,
    castingCondition: '',
    targetType: initialSpellFormState.targetType,
    areaSize: '',
    areaUnits: initialSpellFormState.areaUnits,
    rangeType: range.rangeType,
    rangeAmount: range.rangeAmount,
    durationType: duration.durationType,
    durationAmount: duration.durationAmount,
    actionType: parseActionForForm(spell),
    ability: parseAbilityForForm(spell.save),
    damageDice: damage.damageDice,
    damageType: damage.damageType,
    scalingType: scaling.scalingType,
    scalingDice: scaling.scalingDice,
    description: spell.description,
    classes: spell.classes,
    source: spell.source,
  }
}

function isAttackAction(actionType: string) {
  return actionType === 'Дальнобойная атака' || actionType === 'Рукопашная атака'
}

function buildSpellFromForm(form: SpellFormState, baseSpell?: SpellBlock): SpellBlock {
  const actionType = form.actionType
  const damage = [form.damageDice.trim(), form.damageType.trim()].filter(Boolean).join(' ')
  const damageTypeLabel = form.damageType ? optionLabel(damageTypeOptions, form.damageType) : ''

  return {
    id: baseSpell?.id ?? createSpellId(),
    name: form.name.trim(),
    level: Number(form.level),
    school: form.school,
    source: form.source.trim() || 'Пользовательское',
    castingTime: joinAmountAndType(form.castingTimeAmount, form.castingTimeType),
    range: formatFormRange(form),
    components: formatFormComponents(form),
    duration: formatFormDuration(form),
    attackBonus: isAttackAction(actionType) ? 'атака заклинанием' : '',
    save: actionType === 'Спасбросок' ? optionLabel(abilityOptions, form.ability) : '',
    damage: actionType === 'Лечение' && damage ? `${form.damageDice.trim()} healing` : damage,
    classes: form.classes,
    tags: [
      damageTypeLabel,
      form.scalingType ? `Рост: ${optionLabel(scalingTypeOptions, form.scalingType)}` : '',
      form.scalingDice.trim() ? `+${form.scalingDice.trim()}` : '',
    ].filter(Boolean),
    description: form.description.trim(),
    isRitual: baseSpell?.isRitual ?? false,
    requiresConcentration: baseSpell?.requiresConcentration ?? false,
    createdByUser: baseSpell?.createdByUser ?? true,
  }
}

function mergeSpellLists(...spellLists: SpellBlock[][]) {
  const spellMap = new Map<string, SpellBlock>()

  spellLists.flat().forEach((spell) => {
    spellMap.set(spell.id, spell)
  })

  return Array.from(spellMap.values())
}

type SaveFilePicker = (options: {
  suggestedName?: string
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>
    close: () => Promise<void>
  }>
}>

async function saveSpellsJson(spells: SpellBlock[], suggestedName: string) {
  const payload = `${JSON.stringify(spells, null, 2)}\n`
  const blob = new Blob([payload], { type: 'application/json' })
  const savePicker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker

  if (savePicker) {
    const handle = await savePicker({
      suggestedName,
      types: [
        {
          description: 'JSON библиотека заклинаний',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    const writable = await handle.createWritable()

    await writable.write(blob)
    await writable.close()
    return
  }

  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = suggestedName
  link.click()
  URL.revokeObjectURL(url)
}

async function saveBuiltinSpellsJson(spells: SpellBlock[]) {
  await saveSpellsJson(spells, 'builtinSpells.json')
}

async function saveCustomSpellsJson(spells: SpellBlock[]) {
  await saveSpellsJson(spells, 'customSpells.json')
}

function AddSpellModal({
  onClose,
  onDelete,
  onSave,
  spell,
}: {
  onClose: () => void
  onDelete?: (spell: SpellBlock) => Promise<void>
  onSave: (spell: SpellBlock) => Promise<void>
  spell?: SpellBlock
}) {
  const isEditing = Boolean(spell)
  const [form, setForm] = useState<SpellFormState>(() => (spell ? spellToFormState(spell) : initialSpellFormState))
  const [error, setError] = useState('')
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field: keyof SpellFormState, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function toggleComponent(code: string) {
    setForm((currentForm) => {
      const currentCodes = new Set(Array.from(currentForm.components.toLocaleUpperCase('ru-RU')))

      if (currentCodes.has(code)) {
        currentCodes.delete(code)
      } else {
        currentCodes.add(code)
      }

      const orderedCodes = ['В', 'С', 'М'].filter((componentCode) => currentCodes.has(componentCode)).join('')

      return { ...currentForm, components: orderedCodes }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Укажи название заклинания.')
      return
    }

    if (!form.description.trim()) {
      setError('Добавь описание заклинания.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      await onSave(buildSpellFromForm(form, spell))
    } catch {
      setError('Не удалось сохранить JSON-файл.')
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!spell || !onDelete) {
      return
    }

    setIsDeleting(true)
    setError('')

    try {
      await onDelete(spell)
    } catch {
      setError('Не удалось сохранить JSON-файл.')
      setIsDeleting(false)
      setIsDeleteConfirmOpen(false)
    }
  }

  return (
    <div className={styles.editorBackdrop} onClick={onClose} role="presentation">
      <form
        aria-label={isEditing ? 'Редактировать заклинание' : 'Добавить заклинание'}
        aria-modal="true"
        className={styles.spellEditor}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
      >
        <header className={styles.editorHeader}>
          <div>
            <span>{isEditing ? 'Редактирование' : 'Новое заклинание'}</span>
            <h3>{isEditing ? 'Редактировать заклинание' : 'Добавить заклинание'}</h3>
          </div>
          <button className={styles.detailCloseButton} onClick={onClose} type="button" aria-label="Закрыть">
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className={styles.editorBody}>
          <section className={styles.editorSection}>
            <h4>Общие данные</h4>
            <div className={styles.formGrid}>
              <label className={`${styles.formField} ${styles.wideField}`}>
                <span>Название *</span>
                <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              </label>
              <label className={styles.formField}>
                <span>Уровень</span>
                <select value={form.level} onChange={(event) => updateField('level', event.target.value)}>
                  {levelValues.map((level) => (
                    <option key={level} value={level}>{level === 0 ? 'Заговор' : `${level}-й круг`}</option>
                  ))}
                </select>
              </label>
              <label className={`${styles.formField} ${styles.fullField}`}>
                <span>Школа</span>
                <select value={form.school} onChange={(event) => updateField('school', event.target.value)}>
                  {schoolOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={styles.editorSection}>
            <h4>Компоненты</h4>
            <div className={styles.componentToggleRow}>
              {[
                ['В', 'Вербальный'],
                ['С', 'Соматический'],
                ['М', 'Материальный'],
              ].map(([code, label]) => (
                <button
                  aria-pressed={form.components.includes(code)}
                  className={form.components.includes(code) ? styles.activeComponent : ''}
                  key={code}
                  onClick={() => toggleComponent(code)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className={styles.formField}>
              <span>Материальный компонент</span>
              <input
                value={form.materialComponent}
                onChange={(event) => updateField('materialComponent', event.target.value)}
                placeholder="небольшое перо или кусочек пуха"
              />
            </label>
          </section>

          <section className={styles.editorSection}>
            <h4>Сотворение</h4>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Время сотворения *</span>
                <input
                  min="0"
                  type="number"
                  value={form.castingTimeAmount}
                  onChange={(event) => updateField('castingTimeAmount', event.target.value)}
                />
              </label>
              <label className={styles.formField}>
                <span>&nbsp;</span>
                <select value={form.castingTimeType} onChange={(event) => updateField('castingTimeType', event.target.value)}>
                  {castingTimeTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className={`${styles.formField} ${styles.fullField}`}>
                <span>Условие сотворения</span>
                <input
                  value={form.castingCondition}
                  onChange={(event) => updateField('castingCondition', event.target.value)}
                  placeholder="При получении урона кислотой"
                />
              </label>
              <label className={styles.formField}>
                <span>Цель/область</span>
                <select value={form.targetType} onChange={(event) => updateField('targetType', event.target.value)}>
                  {targetTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Размер</span>
                <input
                  min="0"
                  type="number"
                  value={form.areaSize}
                  onChange={(event) => updateField('areaSize', event.target.value)}
                />
              </label>
              <label className={styles.formField}>
                <span>&nbsp;</span>
                <select value={form.areaUnits} onChange={(event) => updateField('areaUnits', event.target.value)}>
                  {areaUnitsOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Дистанция *</span>
                <select value={form.rangeType} onChange={(event) => updateField('rangeType', event.target.value)}>
                  {rangeTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Количество</span>
                <input
                  min="0"
                  type="number"
                  value={form.rangeAmount}
                  onChange={(event) => updateField('rangeAmount', event.target.value)}
                />
              </label>
              <label className={styles.formField}>
                <span>Длительность *</span>
                <select value={form.durationType} onChange={(event) => updateField('durationType', event.target.value)}>
                  {durationTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Количество</span>
                <input
                  min="0"
                  type="number"
                  value={form.durationAmount}
                  onChange={(event) => updateField('durationAmount', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={styles.editorSection}>
            <h4>Эффект</h4>
            <div className={styles.formGrid}>
              <label className={`${styles.formField} ${styles.fullField}`}>
                <span>Тип действия *</span>
                <select value={form.actionType} onChange={(event) => updateField('actionType', event.target.value)}>
                  {actionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={`${styles.formField} ${styles.fullField}`}>
                <span>Характеристика</span>
                <select value={form.ability} onChange={(event) => updateField('ability', event.target.value)}>
                  {abilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Кость</span>
                <input value={form.damageDice} onChange={(event) => updateField('damageDice', event.target.value)} placeholder="3d10" />
              </label>
              <label className={styles.formField}>
                <span>Тип</span>
                <select value={form.damageType} onChange={(event) => updateField('damageType', event.target.value)}>
                  {damageTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={styles.editorSection}>
            <h4>На высоких кругах</h4>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Тип</span>
                <select value={form.scalingType} onChange={(event) => updateField('scalingType', event.target.value)}>
                  {scalingTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Кость</span>
                <input value={form.scalingDice} onChange={(event) => updateField('scalingDice', event.target.value)} placeholder="1d10" />
              </label>
            </div>
          </section>

          <section className={styles.editorSection}>
            <h4>Описание</h4>
            <label className={styles.formField}>
              <span>Описание *</span>
              <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={5} />
            </label>
          </section>

          <section className={styles.editorSection}>
            <h4>Системные поля</h4>
            <div className={styles.formGrid}>
              <label className={`${styles.formField} ${styles.fullField}`}>
                <span>Доступно классам</span>
                <select
                  value=""
                  onChange={(event) => {
                    const selectedClass = event.target.value

                    if (!selectedClass) {
                      return
                    }

                    setForm((currentForm) => ({
                      ...currentForm,
                      classes: currentForm.classes.includes(selectedClass)
                        ? currentForm.classes
                        : [...currentForm.classes, selectedClass],
                    }))
                  }}
                >
                  <option value="">
                    {form.classes.length > 0
                      ? form.classes.map((className) => classOptions.find((option) => option.value === className)?.label ?? className).join(', ')
                      : ''}
                  </option>
                  {classOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>Источник</span>
                <input value={form.source} onChange={(event) => updateField('source', event.target.value)} />
              </label>
            </div>
          </section>
        </div>

        <footer className={styles.editorFooter}>
          {error ? <p>{error}</p> : <span />}
          <button className={styles.saveButton} disabled={isSaving} type="submit">
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {isEditing && onDelete ? (
            <button
              className={styles.deleteButton}
              onClick={() => setIsDeleteConfirmOpen(true)}
              type="button"
              aria-label="Удалить"
            >
              <i aria-hidden="true" className="fa-solid fa-trash" />
            </button>
          ) : null}
        </footer>

        {isDeleteConfirmOpen ? (
          <div className={styles.confirmBackdrop} role="presentation">
            <section className={styles.confirmDialog} aria-label="Подтвердить удаление" role="alertdialog">
              <h4>Удалить заклинание?</h4>
              <p>{spell?.name}</p>
              <div>
                <button
                  className={styles.saveButton}
                  disabled={isDeleting}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  type="button"
                >
                  Отмена
                </button>
                <button
                  className={styles.confirmDeleteButton}
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  type="button"
                >
                  {isDeleting ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </form>
    </div>
  )
}

export function SpellLibraryModal({ spells, onClose }: SpellLibraryModalProps) {
  const [query, setQuery] = useState('')
  const [selectedLevels, setSelectedLevels] = useState<number[]>(levelValues)
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [areSourceFiltersOpen, setAreSourceFiltersOpen] = useState(true)
  const [onlyConcentration, setOnlyConcentration] = useState(false)
  const [onlyRitual, setOnlyRitual] = useState(false)
  const [onlyCreatedByUser, setOnlyCreatedByUser] = useState(false)
  const [selectedSpell, setSelectedSpell] = useState<SpellBlock | null>(null)
  const [createdSpells, setCreatedSpells] = useState<SpellBlock[]>([])
  const [editedBuiltinSpells, setEditedBuiltinSpells] = useState<SpellBlock[]>([])
  const [deletedSpellIds, setDeletedSpellIds] = useState<string[]>([])
  const [isAddSpellModalOpen, setIsAddSpellModalOpen] = useState(false)
  const [editingSpell, setEditingSpell] = useState<SpellBlock | null>(null)
  const [visibleSpellLimit, setVisibleSpellLimit] = useState(spellRenderBatchSize)
  const deferredQuery = useDeferredValue(query)
  const allSpells = useMemo(
    () => {
      const deletedIds = new Set(deletedSpellIds)

      return mergeSpellLists(spells, editedBuiltinSpells, createdSpells).filter((spell) => !deletedIds.has(spell.id))
    },
    [createdSpells, deletedSpellIds, editedBuiltinSpells, spells],
  )
  const sourceValues = useMemo(
    () => Array.from(new Set(allSpells.map((spell) => spell.source).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [allSpells],
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
  const fileBackedCustomSpells = useMemo(
    () => spells.filter((spell) => spell.createdByUser),
    [spells],
  )
  const fileBackedBuiltinSpells = useMemo(
    () => spells.filter((spell) => !spell.createdByUser),
    [spells],
  )

  const groupedSpells = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase('ru-RU')
    const selectedLevelSet = new Set(selectedLevels)
    const selectedSourceSet = new Set(selectedSources)
    const groups = new Map<number, SpellBlock[]>()

    allSpells.forEach((spell) => {
      if (!selectedLevelSet.has(spell.level)) {
        return
      }

      if (selectedSourceSet.size > 0 && !selectedSourceSet.has(spell.source)) {
        return
      }

      if (onlyConcentration && !spell.requiresConcentration) {
        return
      }

      if (onlyRitual && !spell.isRitual) {
        return
      }

      if (onlyCreatedByUser && !spell.createdByUser) {
        return
      }

      if (normalizedQuery && !spell.name.toLocaleLowerCase('ru-RU').includes(normalizedQuery)) {
        return
      }

      const group = groups.get(spell.level)

      if (group) {
        group.push(spell)
      } else {
        groups.set(spell.level, [spell])
      }
    })

    return levelValues
      .filter((level) => groups.has(level))
      .map((level) => ({
      level,
      spells: groups.get(level) ?? [],
    }))
  }, [allSpells, deferredQuery, onlyConcentration, onlyCreatedByUser, onlyRitual, selectedLevels, selectedSources])
  const filteredSpellCount = groupedSpells.reduce((count, group) => count + group.spells.length, 0)
  const visibleGroupedSpells = useMemo(() => {
    return groupedSpells.reduce<{
      groups: Array<{ level: number; spells: SpellBlock[] }>
      remaining: number
    }>(
      (state, group) => {
        if (state.remaining <= 0) {
          return state
        }

        const visibleSpells = group.spells.slice(0, state.remaining)

        if (visibleSpells.length === 0) {
          return state
        }

        return {
          groups: [...state.groups, { ...group, spells: visibleSpells }],
          remaining: state.remaining - visibleSpells.length,
        }
      },
      { groups: [], remaining: visibleSpellLimit },
    ).groups
  }, [groupedSpells, visibleSpellLimit])

  function toggleLevel(level: number) {
    setVisibleSpellLimit(spellRenderBatchSize)
    setSelectedLevels((currentLevels) => {
      if (currentLevels.length === 1 && currentLevels.includes(level)) {
        return levelValues
      }

      return currentLevels.includes(level)
        ? currentLevels.filter((currentLevel) => currentLevel !== level)
        : [...currentLevels, level].sort((left, right) => left - right)
    })
  }

  function toggleSource(source: string) {
    setVisibleSpellLimit(spellRenderBatchSize)
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
    setVisibleSpellLimit(spellRenderBatchSize)
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

  async function handleSaveCreatedSpell(spell: SpellBlock) {
    const nextCreatedSpells = mergeSpellLists(createdSpells, [spell])

    await saveCustomSpellsJson(mergeSpellLists(fileBackedCustomSpells, nextCreatedSpells))
    setCreatedSpells(nextCreatedSpells)
    setIsAddSpellModalOpen(false)
  }

  async function handleSaveEditedSpell(spell: SpellBlock) {
    if (editingSpell?.createdByUser) {
      const nextCreatedSpells = mergeSpellLists(createdSpells, [spell])

      await saveCustomSpellsJson(mergeSpellLists(fileBackedCustomSpells, nextCreatedSpells))
      setCreatedSpells(nextCreatedSpells)
    } else {
      const nextEditedBuiltinSpells = mergeSpellLists(editedBuiltinSpells, [spell])

      await saveBuiltinSpellsJson(mergeSpellLists(fileBackedBuiltinSpells, nextEditedBuiltinSpells))
      setEditedBuiltinSpells(nextEditedBuiltinSpells)
    }

    setEditingSpell(null)

    if (selectedSpell?.id === spell.id) {
      setSelectedSpell(spell)
    }
  }

  async function handleDeleteSpell(spell: SpellBlock) {
    const nextDeletedSpellIds = Array.from(new Set([...deletedSpellIds, spell.id]))

    if (spell.createdByUser) {
      const nextCreatedSpells = createdSpells.filter((createdSpell) => createdSpell.id !== spell.id)

      await saveCustomSpellsJson(
        mergeSpellLists(fileBackedCustomSpells.filter((customSpell) => customSpell.id !== spell.id), nextCreatedSpells),
      )
      setCreatedSpells(nextCreatedSpells)
    } else {
      const nextEditedBuiltinSpells = editedBuiltinSpells.filter((editedSpell) => editedSpell.id !== spell.id)

      await saveBuiltinSpellsJson(
        mergeSpellLists(fileBackedBuiltinSpells.filter((builtinSpell) => builtinSpell.id !== spell.id), nextEditedBuiltinSpells),
      )
      setEditedBuiltinSpells(nextEditedBuiltinSpells)
    }

    setDeletedSpellIds(nextDeletedSpellIds)
    setEditingSpell(null)

    if (selectedSpell?.id === spell.id) {
      setSelectedSpell(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label="Библиотека заклинаний"
        aria-modal="true"
        className={`modal-dialog ${styles.modal}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.header}>
          <div className={styles.titleLine}>
            <h2>Библиотека заклинаний</h2>
            <button
              className={styles.addSpellButton}
              onClick={() => setIsAddSpellModalOpen(true)}
              title="Добавить заклинание"
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-plus" />
            </button>
          </div>
          <div className={styles.sourceFilters} aria-label="Источники заклинаний">
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
          <strong>{filteredSpellCount} / {allSpells.length}</strong>
          <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Закрыть">
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </header>

        <section className={styles.toolbar}>
          <label className={styles.searchField}>
            <i aria-hidden="true" className="fa-solid fa-magnifying-glass" />
            <input
              onChange={(event) => {
                setVisibleSpellLimit(spellRenderBatchSize)
                setQuery(event.target.value)
              }}
              placeholder="Поиск"
              type="search"
              value={query}
            />
          </label>

          <div className={styles.levels} aria-label="Уровни заклинаний">
            {levelValues.map((level) => (
              <button
                aria-pressed={selectedLevels.includes(level)}
                className={selectedLevels.includes(level) ? styles.activeLevel : ''}
                key={level}
                onClick={() => toggleLevel(level)}
                type="button"
              >
                {level}
              </button>
            ))}
          </div>

          <div className={styles.filterButtons}>
            <button
              aria-pressed={onlyConcentration}
              className={onlyConcentration ? styles.activeFilter : ''}
              onClick={() => {
                setVisibleSpellLimit(spellRenderBatchSize)
                setOnlyConcentration((current) => !current)
              }}
              type="button"
            >
              К
            </button>
            <button
              aria-pressed={onlyRitual}
              className={onlyRitual ? styles.activeFilter : ''}
              onClick={() => {
                setVisibleSpellLimit(spellRenderBatchSize)
                setOnlyRitual((current) => !current)
              }}
              type="button"
            >
              Р
            </button>
            <button
              aria-pressed={onlyCreatedByUser}
              className={onlyCreatedByUser ? styles.activeFilter : ''}
              onClick={() => {
                setVisibleSpellLimit(spellRenderBatchSize)
                setOnlyCreatedByUser((current) => !current)
              }}
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-user-pen" />
            </button>
          </div>
        </section>

        <div className={styles.content}>
          {visibleGroupedSpells.length > 0 ? (
            <>
            {visibleGroupedSpells.map((group) => (
              <section className={styles.group} key={group.level}>
                <div className={styles.groupHeader}>
                  <h3>{group.level === 0 ? 'Заговоры' : levelLabel(group.level)}</h3>
                  <span>{group.spells.length}</span>
                </div>
                <div className={styles.grid}>
                  {group.spells.map((spell) => (
                    <SpellCard
                      key={spell.id}
                      onEdit={() => setEditingSpell(spell)}
                      onSelect={() => setSelectedSpell(spell)}
                      spell={spell}
                    />
                  ))}
                </div>
              </section>
            ))}
            {visibleSpellLimit < filteredSpellCount ? (
              <button
                className={styles.loadMoreButton}
                onClick={() => setVisibleSpellLimit((currentLimit) => currentLimit + spellRenderBatchSize)}
                type="button"
              >
                Показать еще {Math.min(spellRenderBatchSize, filteredSpellCount - visibleSpellLimit)}
              </button>
            ) : null}
            </>
          ) : (
            <p className={styles.emptyState}>В библиотеке пока нет заклинаний.</p>
          )}
        </div>

        {selectedSpell ? (
          <SpellDetailCard onClose={() => setSelectedSpell(null)} spell={selectedSpell} />
        ) : null}
        {isAddSpellModalOpen ? (
          <AddSpellModal onClose={() => setIsAddSpellModalOpen(false)} onSave={handleSaveCreatedSpell} />
        ) : null}
        {editingSpell ? (
          <AddSpellModal
            onClose={() => setEditingSpell(null)}
            onDelete={handleDeleteSpell}
            onSave={handleSaveEditedSpell}
            spell={editingSpell}
          />
        ) : null}
      </div>
    </div>
  )
}
