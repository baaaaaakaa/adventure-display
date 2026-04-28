import type { SpellBlock } from '../../types/adventure'
import styles from './SpellLibraryModal.module.css'

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

function levelLabel(level: number) {
  return level === 0 ? 'Заговор' : `${level}-й уровень`
}

function formatMetaValue(value: string) {
  return value.trim() || '-'
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
