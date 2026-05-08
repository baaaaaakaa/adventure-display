import overlayStyles from './MapOverlayControls.module.css'
import styles from './MapUtilityPanel.module.css'

export type MapInteractionMode =
  | 'navigate'
  | 'marker'
  | 'token'
  | 'zone'
  | 'fog-draw'
  | 'fog-erase'
  | 'fog-area-draw'
  | 'fog-area-erase'

type MapUtilityPanelProps = {
  activeMapScale: number
  hasFog: boolean
  isCheckClueNotesVisible: boolean
  isGmNotesVisible: boolean
  isInitiativeTrackerVisible: boolean
  mapInteractionMode: MapInteractionMode
  mapScaleStep: number
  onClearAllFog: () => void
  onResetMapViewport: () => void
  onSetMapInteractionMode: (mode: MapInteractionMode) => void
  onToggleCheckClueNotes: () => void
  onToggleGmNotes: () => void
  onToggleInitiativeTracker: () => void
  onZoomMap: (delta: number) => void
}

const fogInteractionModes: MapInteractionMode[] = [
  'fog-draw',
  'fog-erase',
  'fog-area-erase',
  'fog-area-draw',
]

function cx(...classNames: Array<string | false>) {
  return classNames.filter(Boolean).join(' ')
}

export function MapUtilityPanel({
  activeMapScale,
  hasFog,
  isCheckClueNotesVisible,
  isGmNotesVisible,
  isInitiativeTrackerVisible,
  mapInteractionMode,
  mapScaleStep,
  onClearAllFog,
  onResetMapViewport,
  onSetMapInteractionMode,
  onToggleCheckClueNotes,
  onToggleGmNotes,
  onToggleInitiativeTracker,
  onZoomMap,
}: MapUtilityPanelProps) {
  return (
    <div
      className={`${styles.panel} map-utility-panel`}
      aria-label="Служебные слои"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={cx(overlayStyles.group, overlayStyles.disclosure)}>
        <button className={cx(overlayStyles.button, overlayStyles.groupTrigger, overlayStyles.sideTooltip)} type="button" data-tooltip="Масштаб" aria-label="Масштаб">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        </button>
        <div className={overlayStyles.flyout} role="toolbar" aria-label="Масштаб карты">
          <button className={overlayStyles.button} onClick={() => onZoomMap(-mapScaleStep)} type="button" data-tooltip="Уменьшить масштаб" aria-label="Уменьшить масштаб">
            <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
          </button>
          <button className={overlayStyles.button} onClick={onResetMapViewport} type="button" data-tooltip={`Сбросить вид (${Math.round(activeMapScale * 100)}%)`} aria-label="Сбросить вид">
            <i className="fa-solid fa-arrows-to-dot" aria-hidden="true" />
          </button>
          <button className={overlayStyles.button} onClick={() => onZoomMap(mapScaleStep)} type="button" data-tooltip="Увеличить масштаб" aria-label="Увеличить масштаб">
            <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={cx(overlayStyles.group, overlayStyles.disclosure)}>
        <button className={cx(overlayStyles.button, overlayStyles.groupTrigger, overlayStyles.sideTooltip)} type="button" data-tooltip="Инструменты карты" aria-label="Инструменты карты">
          <i className="fa-solid fa-arrow-pointer" aria-hidden="true" />
        </button>
        <div className={overlayStyles.flyout} role="toolbar" aria-label="Инструменты карты">
          <button className={cx(overlayStyles.button, mapInteractionMode === 'navigate' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('navigate')} type="button" data-tooltip="Навигация" aria-label="Навигация">
            <i className="fa-solid fa-arrows-up-down-left-right" aria-hidden="true" />
          </button>
          <button className={cx(overlayStyles.button, mapInteractionMode === 'marker' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('marker')} type="button" data-tooltip="Ставить метки" aria-label="Ставить метки">
            <i className="fa-solid fa-location-dot" aria-hidden="true" />
          </button>
          <button className={cx(overlayStyles.button, mapInteractionMode === 'token' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('token')} type="button" data-tooltip="Ставить фишки" aria-label="Ставить фишки">
            <i className="fa-solid fa-chess-pawn" aria-hidden="true" />
          </button>
          <button className={cx(overlayStyles.button, mapInteractionMode === 'zone' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('zone')} type="button" data-tooltip="Ставить зоны" aria-label="Ставить зоны">
            <i className="fa-solid fa-draw-polygon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={cx(overlayStyles.group, overlayStyles.disclosure)}>
        <button className={cx(overlayStyles.button, overlayStyles.groupTrigger, overlayStyles.sideTooltip, fogInteractionModes.includes(mapInteractionMode) && overlayStyles.active)} type="button" data-tooltip="Туман" aria-label="Туман">
          <i className="fa-solid fa-cloud" aria-hidden="true" />
        </button>
        <div className={overlayStyles.flyout} role="toolbar" aria-label="Туман карты">
          <button className={cx(overlayStyles.button, mapInteractionMode === 'fog-draw' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('fog-draw')} type="button" data-tooltip="Рисовать туман" aria-label="Рисовать туман">
            <i className="fa-solid fa-cloud" aria-hidden="true" />
          </button>
          <button className={cx(overlayStyles.button, mapInteractionMode === 'fog-erase' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('fog-erase')} type="button" data-tooltip="Стирать туман" aria-label="Стирать туман">
            <i className="fa-solid fa-eraser" aria-hidden="true" />
          </button>
          <button className={cx(overlayStyles.button, mapInteractionMode === 'fog-area-erase' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('fog-area-erase')} type="button" data-tooltip="Открыть область" aria-label="Открыть область">
            <i className="fa-solid fa-object-ungroup" aria-hidden="true" />
          </button>
          <button className={cx(overlayStyles.button, mapInteractionMode === 'fog-area-draw' && overlayStyles.active)} onClick={() => onSetMapInteractionMode('fog-area-draw')} type="button" data-tooltip="Скрыть область" aria-label="Скрыть область">
            <i className="fa-solid fa-object-group" aria-hidden="true" />
          </button>
          <button className={overlayStyles.button} disabled={!hasFog} onClick={onClearAllFog} type="button" data-tooltip="Очистить весь туман" aria-label="Очистить весь туман">
            <i className="fa-solid fa-broom" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={overlayStyles.group}>
        <button
          className={cx(overlayStyles.button, overlayStyles.groupTrigger, overlayStyles.sideTooltip, isInitiativeTrackerVisible && overlayStyles.active)}
          onClick={onToggleInitiativeTracker}
          type="button"
          data-tooltip={isInitiativeTrackerVisible ? 'Скрыть трекер инициативы' : 'Показать трекер инициативы'}
          aria-label={isInitiativeTrackerVisible ? 'Скрыть трекер инициативы' : 'Показать трекер инициативы'}
        >
          <i className={`fa-solid ${isInitiativeTrackerVisible ? 'fa-list-ol' : 'fa-list'}`} aria-hidden="true" />
        </button>
      </div>

      <div className={overlayStyles.group}>
        <button
          className={cx(overlayStyles.button, overlayStyles.groupTrigger, overlayStyles.sideTooltip, isGmNotesVisible && overlayStyles.active)}
          onClick={onToggleGmNotes}
          type="button"
          data-tooltip={isGmNotesVisible ? 'Скрыть заметки мастера' : 'Показать заметки мастера'}
          aria-label={isGmNotesVisible ? 'Скрыть заметки мастера' : 'Показать заметки мастера'}
        >
          <i className="fa-solid fa-scroll" aria-hidden="true" />
        </button>
      </div>

      <div className={overlayStyles.group}>
        <button
          className={cx(overlayStyles.button, overlayStyles.groupTrigger, overlayStyles.sideTooltip, isCheckClueNotesVisible && overlayStyles.active)}
          onClick={onToggleCheckClueNotes}
          type="button"
          data-tooltip={isCheckClueNotesVisible ? 'Скрыть проверки' : 'Показать проверки'}
          aria-label={isCheckClueNotesVisible ? 'Скрыть проверки' : 'Показать проверки'}
        >
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
