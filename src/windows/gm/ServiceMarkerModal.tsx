import { useState } from 'react'
import { StyledSelect } from '../../components/StyledSelect'
import type { AdventureScene, ServiceMarker } from '../../types/adventure'
import styles from './ServiceMarkerModal.module.css'

type ServiceMarkerModalProps = {
  activeScene: AdventureScene
  marker: ServiceMarker
  onClose: () => void
  onRemoveMarker: (markerId: string) => void
  onUpdateMarker: (
    markerId: string,
    updater: (marker: ServiceMarker) => ServiceMarker,
  ) => void
}

export function ServiceMarkerModal({
  activeScene,
  marker,
  onClose,
  onRemoveMarker,
  onUpdateMarker,
}: ServiceMarkerModalProps) {
  const [isCheckSelectOpen, setIsCheckSelectOpen] = useState(false)
  const linkedCheckIds = Array.from(
    new Set([
      ...(marker.linkedCheckIds ?? []),
      ...(marker.linkedCheckId ? [marker.linkedCheckId] : []),
    ]),
  ).filter((checkId) => activeScene.checksClues.some((entry) => entry.id === checkId))
  const linkedCheckSummary =
    linkedCheckIds.length > 0 ? `Выбрано: ${linkedCheckIds.length}` : 'не привязаны'

  const toggleLinkedCheck = (checkId: string) => {
    const nextIds = linkedCheckIds.includes(checkId)
      ? linkedCheckIds.filter((currentId) => currentId !== checkId)
      : [...linkedCheckIds, checkId]

    onUpdateMarker(marker.id, (currentMarker) => ({
      ...currentMarker,
      linkedCheckId: nextIds[0] ?? null,
      linkedCheckIds: nextIds,
    }))
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Редактор служебной отметки"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <div className={`scene-editor-panel-title-row ${styles.titleRow}`}>
              <span className="eyebrow">Служебная отметка</span>
              <button
                aria-label="Удалить отметку"
                className={`ghost-button compact-button token-modal-icon-button ${styles.deleteButton}`}
                onClick={() => onRemoveMarker(marker.id)}
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-trash" />
              </button>
            </div>
            <p className="editor-hint">
              Измени подпись, заметку и порядок слоя для отметки на карте.
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

        <div className="editor-stack">
          <label className="field">
            <span>Подпись</span>
            <input
              onChange={(event) =>
                onUpdateMarker(marker.id, (currentMarker) => ({
                  ...currentMarker,
                  label: event.target.value,
                }))
              }
              value={marker.label}
            />
          </label>

          <label className="field">
            <span>Заметка</span>
            <textarea
              onChange={(event) =>
                onUpdateMarker(marker.id, (currentMarker) => ({
                  ...currentMarker,
                  note: event.target.value,
                }))
              }
              rows={4}
              value={marker.note}
            />
          </label>

          <label className="field">
            <span>Связанная раздатка</span>
            <StyledSelect
              onChange={(event) =>
                onUpdateMarker(marker.id, (currentMarker) => ({
                  ...currentMarker,
                  linkedHandoutId: event.target.value || null,
                }))
              }
              value={marker.linkedHandoutId ?? ''}
            >
              <option value="">не привязана</option>
              {activeScene.handouts.map((handout) => (
                <option key={handout.id} value={handout.id}>
                  {handout.title}
                </option>
              ))}
            </StyledSelect>
          </label>

          <div className="field">
            <span>Связанные проверки и улики</span>
            <div className={styles.multiSelect}>
              <button
                aria-expanded={isCheckSelectOpen}
                className={styles.multiSelectTrigger}
                onClick={() => setIsCheckSelectOpen((currentValue) => !currentValue)}
                type="button"
              >
                <span>{linkedCheckSummary}</span>
                <i aria-hidden="true" className={`fa-solid fa-chevron-${isCheckSelectOpen ? 'up' : 'down'}`} />
              </button>
              {isCheckSelectOpen ? (
                <div className={styles.multiSelectList}>
                  {activeScene.checksClues.length > 0 ? (
                    activeScene.checksClues.map((entry) => {
                      const isSelected = linkedCheckIds.includes(entry.id)

                      return (
                        <label className={styles.multiSelectOption} key={entry.id}>
                          <input
                            checked={isSelected}
                            onChange={() => toggleLinkedCheck(entry.id)}
                            type="checkbox"
                          />
                          <span>
                            <strong>{entry.ability || 'Без характеристики'}</strong>
                            <small>{entry.difficulty || 'без сложности'}</small>
                          </span>
                        </label>
                      )
                    })
                  ) : (
                    <p className={styles.emptyHint}>Проверки и улики пока не добавлены.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <label className={`field ${styles.orderField}`}>
            <span>Порядок слоя</span>
            <div className={styles.orderRow}>
              <input
                onChange={(event) =>
                  onUpdateMarker(marker.id, (currentMarker) => ({
                    ...currentMarker,
                    zIndex: Number(event.target.value),
                  }))
                }
                type="number"
                value={marker.zIndex}
              />
              <button
                aria-label="Поднять выше"
                className="ghost-button compact-button token-modal-icon-button"
                onClick={() =>
                  onUpdateMarker(marker.id, (currentMarker) => ({
                    ...currentMarker,
                    zIndex: currentMarker.zIndex + 1,
                  }))
                }
                title="Выше"
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-arrow-up" />
              </button>
              <button
                aria-label="Опустить ниже"
                className="ghost-button compact-button token-modal-icon-button"
                onClick={() =>
                  onUpdateMarker(marker.id, (currentMarker) => ({
                    ...currentMarker,
                    zIndex: currentMarker.zIndex - 1,
                  }))
                }
                title="Ниже"
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-arrow-down" />
              </button>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
