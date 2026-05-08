import type { AdventureScene } from '../../types/adventure'
import styles from './CheckClueNotesPanel.module.css'

type CheckClueNotesPanelProps = {
  isVisible: boolean
  onClose: () => void
  scene: AdventureScene
}

export function CheckClueNotesPanel({ isVisible, onClose, scene }: CheckClueNotesPanelProps) {
  if (!isVisible) {
    return null
  }

  return (
    <aside
      aria-label="Проверки"
      className={styles.panel}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
      role="dialog"
    >
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.eyebrow}>Проверки</span>
          <strong className={styles.heading}>{scene.title}</strong>
        </div>
        <button
          aria-label="Скрыть проверки"
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          <i aria-hidden="true" className="fa-solid fa-xmark" />
        </button>
      </div>

      <div className={styles.content}>
        {scene.checksClues.length > 0 ? (
          scene.checksClues.map((entry, index) => (
            <article className={styles.checkCard} key={entry.id}>
              <div className={styles.checkMeta}>
                <strong>{entry.ability || `Проверка ${index + 1}`}</strong>
                <span>{entry.difficulty || 'без сложности'}</span>
              </div>
              <details className={styles.spoiler}>
                <summary className={styles.spoilerSummary}>
                  <span>Спойлер</span>
                  <i aria-hidden="true" className="fa-solid fa-chevron-down" />
                </summary>
                <p className={styles.text}>
                  {entry.outcome || 'Результат проверки не заполнен.'}
                </p>
              </details>
            </article>
          ))
        ) : (
          <p className={styles.text}>Проверки и улики пока не заполнены.</p>
        )}
      </div>
    </aside>
  )
}
