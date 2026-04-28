import type { AdventureScene } from '../../types/adventure'
import styles from './GmNotesPanel.module.css'

type GmNotesPanelProps = {
  isVisible: boolean
  onClose: () => void
  scene: AdventureScene
}

export function GmNotesPanel({ isVisible, onClose, scene }: GmNotesPanelProps) {
  if (!isVisible) {
    return null
  }

  return (
    <aside
      className={styles.panel}
      role="dialog"
      aria-label="Заметки мастера"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.eyebrow}>Заметки мастера</span>
          <strong className={styles.heading}>{scene.title}</strong>
        </div>
        <button
          aria-label="Скрыть заметки мастера"
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
      <div className={styles.content}>
        <section className={styles.section}>
          <span className={styles.eyebrow}>Локация</span>
          <p className={styles.text}>{scene.location || 'Локация не заполнена.'}</p>
        </section>
        <section className={styles.section}>
          <span className={styles.eyebrow}>Кратко для мастера</span>
          <p className={styles.text}>{scene.gmSummary || 'Краткое описание не заполнено.'}</p>
        </section>
        <section className={styles.section}>
          <span className={styles.eyebrow}>Заметки</span>
          <p className={styles.text}>{scene.gmNotes || 'Заметки мастера не заполнены.'}</p>
        </section>
        <section className={styles.section}>
          <span className={styles.eyebrow}>Цели сцены</span>
          {scene.objectives.length > 0 ? (
            <ul className={styles.list}>
              {scene.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.text}>Цели сцены не заполнены.</p>
          )}
        </section>
      </div>
    </aside>
  )
}
