import { StyledSelect } from '../../components/StyledSelect'
import type { AdventureScene, CheckClueEntry } from '../../types/adventure'
import styles from './CheckClueNotesModal.module.css'

type CheckClueNotesModalProps = {
  abilityOptions: readonly string[]
  difficultyOptions: readonly string[]
  scene: AdventureScene
  selectedEntryId: string | null
  onAddEntry: () => void
  onClose: () => void
  onRemoveEntry: (entryId: string) => void
  onSelectEntry: (entryId: string) => void
  onUpdateEntry: (entryId: string, updater: (entry: CheckClueEntry) => CheckClueEntry) => void
}

export function CheckClueNotesModal({
  abilityOptions,
  difficultyOptions,
  scene,
  selectedEntryId,
  onAddEntry,
  onClose,
  onRemoveEntry,
  onSelectEntry,
  onUpdateEntry,
}: CheckClueNotesModalProps) {
  const activeEntry =
    scene.checksClues.find((entry) => entry.id === selectedEntryId) ?? scene.checksClues[0] ?? null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label="Заметки улики"
        aria-modal="true"
        className={`modal-dialog token-modal ${styles.dialog}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <div className={`scene-editor-panel-title-row ${styles.titleRow}`}>
              <span className="eyebrow">Заметки улики</span>
              <button
                aria-label="Добавить проверку"
                className="ghost-button compact-button token-modal-icon-button"
                data-tooltip="Добавить проверку"
                onClick={onAddEntry}
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-plus" />
              </button>
            </div>
            <p className="editor-hint">
              Заполни проверку, сложность и спойлер. Спойлер показывается как основной результат проверки.
            </p>
          </div>
          <button
            aria-label="Закрыть"
            className="ghost-button compact-button token-modal-icon-button"
            onClick={onClose}
            title="Закрыть"
            type="button"
          >
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className={`editor-stack ${styles.stack}`}>
          {activeEntry ? (
            <>
              <div className={styles.entryHeader}>
                <label className="field">
                  <span>Улика</span>
                  <StyledSelect
                    onChange={(event) => onSelectEntry(event.target.value)}
                    value={activeEntry.id}
                  >
                    {scene.checksClues.map((entry, index) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.ability || `Улика ${index + 1}`} • {entry.difficulty || 'без сложности'}
                      </option>
                    ))}
                  </StyledSelect>
                </label>
                <button
                  aria-label="Удалить проверку"
                  className="ghost-button compact-button token-modal-icon-button"
                  data-tooltip="Удалить проверку"
                  onClick={() => onRemoveEntry(activeEntry.id)}
                  type="button"
                >
                  <i aria-hidden="true" className="fa-solid fa-trash" />
                </button>
              </div>

              <label className="field">
                <span>Проверка</span>
                <input
                  list="check-clue-ability-options"
                  onChange={(event) =>
                    onUpdateEntry(activeEntry.id, (entry) => ({
                      ...entry,
                      ability: event.target.value,
                    }))
                  }
                  placeholder="Например: Внимательность"
                  value={activeEntry.ability}
                />
                <datalist id="check-clue-ability-options">
                  {abilityOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span>Сложность</span>
                <input
                  list="check-clue-difficulty-options"
                  onChange={(event) =>
                    onUpdateEntry(activeEntry.id, (entry) => ({
                      ...entry,
                      difficulty: event.target.value,
                    }))
                  }
                  placeholder="Например: Сл 15"
                  value={activeEntry.difficulty}
                />
                <datalist id="check-clue-difficulty-options">
                  {difficultyOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>

              <label className={`field ${styles.spoilerField}`}>
                <span>Спойлер</span>
                <textarea
                  onChange={(event) =>
                    onUpdateEntry(activeEntry.id, (entry) => ({
                      ...entry,
                      outcome: event.target.value,
                    }))
                  }
                  placeholder="Основной текст результата проверки."
                  rows={6}
                  value={activeEntry.outcome}
                />
              </label>
            </>
          ) : (
            <p className="editor-empty">Проверок и улик пока нет. Нажми плюс, чтобы добавить первую.</p>
          )}
        </div>
      </div>
    </div>
  )
}
