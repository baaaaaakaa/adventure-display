import { StyledSelect } from '../../components/StyledSelect'
import type { AdventureScene, MapZone } from '../../types/adventure'
import styles from './ZoneModal.module.css'

type ZoneModalProps = {
  activeScene: AdventureScene
  zone: MapZone
  onClose: () => void
  onRemoveZone: (zoneId: string) => void
  onUpdateZone: (zoneId: string, updater: (zone: MapZone) => MapZone) => void
}

export function ZoneModal({
  activeScene,
  zone,
  onClose,
  onRemoveZone,
  onUpdateZone,
}: ZoneModalProps) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`modal-dialog token-modal ${styles.dialog}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Редактор зоны"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <div className={`scene-editor-panel-title-row ${styles.titleRow}`}>
              <span className="eyebrow">Зона</span>
              <div className={styles.toggleRow} role="group" aria-label="Настройки зоны">
                <button
                  aria-pressed={zone.visibleToPlayers}
                  className={`${styles.toggleButton} ${zone.visibleToPlayers ? styles.active : ''}`}
                  data-tooltip={zone.visibleToPlayers ? 'Скрыть зону от игроков' : 'Показать зону игрокам'}
                  onClick={() =>
                    onUpdateZone(zone.id, (currentZone) => ({
                      ...currentZone,
                      visibleToPlayers: !currentZone.visibleToPlayers,
                    }))
                  }
                  aria-label={zone.visibleToPlayers ? 'Скрыть зону от игроков' : 'Показать зону игрокам'}
                  type="button"
                >
                  <i
                    aria-hidden="true"
                    className={`fa-solid ${zone.visibleToPlayers ? 'fa-eye' : 'fa-eye-slash'}`}
                  />
                </button>
                <button
                  aria-pressed={zone.autoRevealOnEnter}
                  className={`${styles.toggleButton} ${zone.autoRevealOnEnter ? styles.active : ''}`}
                  data-tooltip={
                    zone.autoRevealOnEnter
                      ? 'Не открывать туман автоматически'
                      : 'Открывать туман автоматически'
                  }
                  onClick={() =>
                    onUpdateZone(zone.id, (currentZone) => ({
                      ...currentZone,
                      autoRevealOnEnter: !currentZone.autoRevealOnEnter,
                    }))
                  }
                  aria-label={
                    zone.autoRevealOnEnter
                      ? 'Не открывать туман автоматически'
                      : 'Открывать туман автоматически'
                  }
                  type="button"
                >
                  <i
                    aria-hidden="true"
                    className={`fa-solid ${zone.autoRevealOnEnter ? 'fa-wand-magic-sparkles' : 'fa-wand-magic'}`}
                  />
                </button>
              </div>
              <button
                aria-label="Удалить зону"
                className={`ghost-button compact-button token-modal-icon-button ${styles.deleteButton}`}
                onClick={() => onRemoveZone(zone.id)}
                title="Удалить зону"
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-trash" />
              </button>
            </div>
            <p className="editor-hint">
              Измени описание, связи и поведение тумана для выбранной области карты.
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
          <label className="field">
            <span>Название зоны</span>
            <input
              onChange={(event) =>
                onUpdateZone(zone.id, (currentZone) => ({
                  ...currentZone,
                  title: event.target.value,
                }))
              }
              value={zone.title}
            />
          </label>

          <label className="field">
            <span>Заметка мастера</span>
            <textarea
              onChange={(event) =>
                onUpdateZone(zone.id, (currentZone) => ({
                  ...currentZone,
                  note: event.target.value,
                }))
              }
              rows={3}
              value={zone.note}
            />
          </label>

          <label className="field">
            <span>Фокус-заметка зоны</span>
            <textarea
              onChange={(event) =>
                onUpdateZone(zone.id, (currentZone) => ({
                  ...currentZone,
                  focusNote: event.target.value,
                }))
              }
              placeholder="Короткая памятка мастеру: что происходит в зоне и на чём держать фокус."
              rows={4}
              value={zone.focusNote}
            />
          </label>

          <label className="field">
            <span>Связанная раздатка</span>
            <StyledSelect
              onChange={(event) =>
                onUpdateZone(zone.id, (currentZone) => ({
                  ...currentZone,
                  linkedHandoutId: event.target.value || null,
                }))
              }
              value={zone.linkedHandoutId ?? ''}
            >
              <option value="">не привязана</option>
              {activeScene.handouts.map((handout) => (
                <option key={handout.id} value={handout.id}>
                  {handout.title}
                </option>
              ))}
            </StyledSelect>
          </label>

          <label className="field">
            <span>Связанная проверка или улика</span>
            <StyledSelect
              onChange={(event) =>
                onUpdateZone(zone.id, (currentZone) => ({
                  ...currentZone,
                  linkedCheckId: event.target.value || null,
                }))
              }
              value={zone.linkedCheckId ?? ''}
            >
              <option value="">не привязана</option>
              {activeScene.checksClues.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.ability || 'Без названия'} • {entry.difficulty || 'без сложности'}
                </option>
              ))}
            </StyledSelect>
          </label>

          <label className="field">
            <span>Связанный монстр</span>
            <StyledSelect
              onChange={(event) =>
                onUpdateZone(zone.id, (currentZone) => ({
                  ...currentZone,
                  linkedMonsterId: event.target.value || null,
                }))
              }
              value={zone.linkedMonsterId ?? ''}
            >
              <option value="">не привязан</option>
              {activeScene.monsterBlocks.map((monster) => (
                <option key={monster.id} value={monster.id}>
                  {monster.name}
                </option>
              ))}
            </StyledSelect>
          </label>
        </div>
      </div>
    </div>
  )
}
