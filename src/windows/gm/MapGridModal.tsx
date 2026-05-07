import { useEffect, useState, type KeyboardEvent } from 'react'
import type { MapGridSettings } from '../../types/adventure'
import styles from './MapGridModal.module.css'

type MapGridModalProps = {
  mapGrid: MapGridSettings
  onClose: () => void
  onUpdateMapGrid: (axis: keyof MapGridSettings, value: number) => void
}

export function MapGridModal({
  mapGrid,
  onClose,
  onUpdateMapGrid,
}: MapGridModalProps) {
  const [draftGrid, setDraftGrid] = useState<Record<keyof MapGridSettings, string>>({
    columns: String(mapGrid.columns),
    rows: String(mapGrid.rows),
  })

  useEffect(() => {
    setDraftGrid({
      columns: String(mapGrid.columns),
      rows: String(mapGrid.rows),
    })
  }, [mapGrid.columns, mapGrid.rows])

  const commitDraftValue = (axis: keyof MapGridSettings) => {
    const nextValue = Number(draftGrid[axis])

    if (Number.isFinite(nextValue)) {
      onUpdateMapGrid(axis, nextValue)
      return
    }

    setDraftGrid((currentDraft) => ({
      ...currentDraft,
      [axis]: String(mapGrid[axis]),
    }))
  }

  const handleDraftKeyDown = (
    axis: keyof MapGridSettings,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      commitDraftValue(axis)
      event.currentTarget.blur()
    }

    if (event.key === 'Escape') {
      setDraftGrid((currentDraft) => ({
        ...currentDraft,
        [axis]: String(mapGrid[axis]),
      }))
      event.currentTarget.blur()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`modal-dialog ${styles.dialog}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Настройка сетки карты"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <span className="eyebrow">Сетка карты</span>
            <p className="editor-hint">
              Настрой количество клеток, чтобы зоны, фишки и туман совпадали с картой.
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
          <div className={`info-card ${styles.card}`}>
            <span className="eyebrow">Настройка сетки</span>
            <strong>Размер клеток для сцены</strong>
            <div className="inline-actions">
              <label className="compact-inline-field">
                <span>Колонки</span>
                <input
                  min={4}
                  max={64}
                  step={1}
                  type="number"
                  value={draftGrid.columns}
                  onBlur={() => commitDraftValue('columns')}
                  onChange={(event) =>
                    setDraftGrid((currentDraft) => ({
                      ...currentDraft,
                      columns: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => handleDraftKeyDown('columns', event)}
                />
              </label>
              <label className="compact-inline-field">
                <span>Ряды</span>
                <input
                  min={4}
                  max={64}
                  step={1}
                  type="number"
                  value={draftGrid.rows}
                  onBlur={() => commitDraftValue('rows')}
                  onChange={(event) =>
                    setDraftGrid((currentDraft) => ({
                      ...currentDraft,
                      rows: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => handleDraftKeyDown('rows', event)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
