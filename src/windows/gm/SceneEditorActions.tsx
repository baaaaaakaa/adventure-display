import type { RefObject } from 'react'
import styles from './SceneEditorActions.module.css'

export type EditorTab = 'scene' | 'splash' | 'handouts' | 'checks' | 'monsters' | 'audio'

const sceneEditorActions: Array<{
  id: EditorTab
  iconClassName: string
  label: string
}> = [
  { id: 'scene', iconClassName: 'fa-solid fa-pen-to-square', label: 'Поля сцены' },
  { id: 'splash', iconClassName: 'fa-solid fa-image', label: 'Сплеш экран сцены' },
  { id: 'handouts', iconClassName: 'fa-solid fa-note-sticky', label: 'Раздатки' },
  { id: 'checks', iconClassName: 'fa-solid fa-list-check', label: 'Проверки' },
  { id: 'monsters', iconClassName: 'fa-solid fa-dragon', label: 'Монстры' },
  { id: 'audio', iconClassName: 'fa-solid fa-music', label: 'Аудио' },
]

type SceneEditorActionsProps = {
  activeEditorTab: EditorTab
  containerRef: RefObject<HTMLDivElement | null>
  isModalOpen: boolean
  isOpen: boolean
  onOpenSection: (tabId: EditorTab) => void
  onToggle: () => void
  sceneTitle: string
}

export function SceneEditorActions({
  activeEditorTab,
  containerRef,
  isModalOpen,
  isOpen,
  onOpenSection,
  onToggle,
  sceneTitle,
}: SceneEditorActionsProps) {
  return (
    <div className={`${styles.badge} map-scene-editor-badge`}>
      <span className={styles.title}>{sceneTitle}</span>
      <div
        className={`scene-menu-action-disclosure ${styles.disclosure} ${isOpen ? 'is-open' : ''}`}
        ref={containerRef}
      >
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Скрыть настройки сцены' : 'Показать настройки сцены'}
          className={styles.toggle}
          data-tooltip={isOpen ? 'Скрыть настройки сцены' : 'Настройки сцены'}
          onClick={onToggle}
          type="button"
        >
          <i className="fa-solid fa-gear" aria-hidden="true" />
        </button>
        <div className={`scene-menu-action-flyout ${styles.flyout}`}>
          {sceneEditorActions.map((action) => (
            <button
              key={action.id}
              aria-label={action.label}
              className={`scene-menu-action-button scene-menu-icon-button ${isModalOpen && activeEditorTab === action.id ? 'is-active' : ''}`}
              data-tooltip={action.label}
              onClick={() => onOpenSection(action.id)}
              type="button"
            >
              <i aria-hidden="true" className={action.iconClassName} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
