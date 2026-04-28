import { StyledSelect } from '../../components/StyledSelect'
import type { CheckClueEntry } from '../../types/adventure'
import styles from './ChecksEditorPanel.module.css'

type ChecksEditorPanelProps = {
  abilityOptions: readonly string[]
  difficultyOptions: readonly string[]
  entries: CheckClueEntry[]
  linkedPreviewEntry: CheckClueEntry | null
  onAddEntry: () => void
  onRemoveEntry: (entryId: string) => void
  onUpdateEntry: (entryId: string, updater: (entry: CheckClueEntry) => CheckClueEntry) => void
}

export function ChecksEditorPanel({
  abilityOptions,
  difficultyOptions,
  entries,
  linkedPreviewEntry,
  onAddEntry,
  onRemoveEntry,
  onUpdateEntry,
}: ChecksEditorPanelProps) {
  return (
    <div className="editor-card">
      <div className="section-row scene-editor-card-title-row">
        <span className="eyebrow">Проверки и улики</span>
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

      {linkedPreviewEntry ? (
        <article className={styles.linkedCard}>
          <div className={styles.linkedCardMeta}>
            <span>{linkedPreviewEntry.ability || 'Без характеристики'}</span>
            <strong>{linkedPreviewEntry.difficulty || 'Без сложности'}</strong>
          </div>
          <p>{linkedPreviewEntry.outcome || 'Итог проверки не заполнен.'}</p>
        </article>
      ) : entries.length > 0 ? (
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.headerRow}`}>
            <span>Характеристика</span>
            <span>Сложность</span>
            <span>Итог</span>
            <span />
          </div>

          <div className={styles.list}>
            {entries.map((entry) => {
              const usesCustomAbility = !abilityOptions.includes(entry.ability)
              const usesCustomDifficulty = !difficultyOptions.includes(entry.difficulty)

              return (
                <div className={styles.row} key={entry.id}>
                  <div className={styles.choiceCell}>
                    <StyledSelect
                      onChange={(event) =>
                        onUpdateEntry(entry.id, (currentEntry) => ({
                          ...currentEntry,
                          ability: event.target.value,
                        }))
                      }
                      value={usesCustomAbility ? '' : entry.ability}
                    >
                      <option value="">Свой вариант</option>
                      {abilityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </StyledSelect>

                    {usesCustomAbility ? (
                      <input
                        aria-label="Своя характеристика"
                        onChange={(event) =>
                          onUpdateEntry(entry.id, (currentEntry) => ({
                            ...currentEntry,
                            ability: event.target.value,
                          }))
                        }
                        placeholder="Своя характеристика"
                        value={entry.ability}
                      />
                    ) : null}
                  </div>

                  <div className={styles.choiceCell}>
                    <StyledSelect
                      onChange={(event) =>
                        onUpdateEntry(entry.id, (currentEntry) => ({
                          ...currentEntry,
                          difficulty: event.target.value,
                        }))
                      }
                      value={usesCustomDifficulty ? '' : entry.difficulty}
                    >
                      <option value="">Свой вариант</option>
                      {difficultyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </StyledSelect>

                    {usesCustomDifficulty ? (
                      <input
                        aria-label="Своя сложность"
                        onChange={(event) =>
                          onUpdateEntry(entry.id, (currentEntry) => ({
                            ...currentEntry,
                            difficulty: event.target.value,
                          }))
                        }
                        placeholder="Своя сложность"
                        value={entry.difficulty}
                      />
                    ) : null}
                  </div>

                  <textarea
                    onChange={(event) =>
                      onUpdateEntry(entry.id, (currentEntry) => ({
                        ...currentEntry,
                        outcome: event.target.value,
                      }))
                    }
                    rows={2}
                    value={entry.outcome}
                  />

                  <button
                    aria-label="Удалить проверку"
                    className="ghost-button compact-button token-modal-icon-button"
                    data-tooltip="Удалить проверку"
                    onClick={() => onRemoveEntry(entry.id)}
                    type="button"
                  >
                    <i aria-hidden="true" className="fa-solid fa-trash" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="editor-empty">
          Пока нет проверок и порогов улик. Добавь строку, чтобы зафиксировать открытия для мастера.
        </p>
      )}
    </div>
  )
}
