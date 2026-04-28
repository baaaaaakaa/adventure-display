import type { MapLayerInstance } from '../../types/adventure'
import overlayStyles from './MapOverlayControls.module.css'
import styles from './MapCornerPanel.module.css'

type MapCornerPanelProps = {
  isMapGridVisible: boolean
  onOpenGridSettings: () => void
  onOpenLayerSettings: () => void
  onToggleMapGridVisibility: () => void
  onUpdateMapLayer: (layerId: string, updater: (layer: MapLayerInstance) => MapLayerInstance) => void
  quickMapLayer: MapLayerInstance | null
}

function cx(...classNames: Array<string | false>) {
  return classNames.filter(Boolean).join(' ')
}

export function MapCornerPanel({
  isMapGridVisible,
  onOpenGridSettings,
  onOpenLayerSettings,
  onToggleMapGridVisibility,
  onUpdateMapLayer,
  quickMapLayer,
}: MapCornerPanelProps) {
  return (
    <div
      className={`${styles.panel} map-corner-panel`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={styles.actionRow}>
        <div className={styles.gridTools}>
          <div className={styles.flyout} aria-label="Быстрое редактирование сетки">
            <button
              className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
              onClick={onOpenGridSettings}
              type="button"
              data-tooltip="Открыть настройки сетки"
              aria-label="Открыть настройки сетки"
            >
              <i className="fa-solid fa-sliders" aria-hidden="true" />
            </button>
            <button
              className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
              onClick={onToggleMapGridVisibility}
              type="button"
              data-tooltip={isMapGridVisible ? 'Скрыть сетку' : 'Показать сетку'}
              aria-label={isMapGridVisible ? 'Скрыть сетку' : 'Показать сетку'}
            >
              <i
                className={`fa-solid ${isMapGridVisible ? 'fa-eye-slash' : 'fa-eye'}`}
                aria-hidden="true"
              />
            </button>
          </div>
          <button
            className={overlayStyles.button}
            type="button"
            data-tooltip="Сетка карты"
            aria-label="Сетка карты"
          >
            <i className="fa-solid fa-border-all" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.layerTools}>
          {quickMapLayer ? (
            <div className={styles.flyout} aria-label="Быстрое редактирование масштаба слоя">
              <button
                className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
                onClick={onOpenLayerSettings}
                type="button"
                data-tooltip="Открыть настройки слоёв"
                aria-label="Открыть настройки слоёв"
              >
                <i className="fa-solid fa-sliders" aria-hidden="true" />
              </button>
              <button
                className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
                onClick={() =>
                  onUpdateMapLayer(quickMapLayer.id, (layer) => ({
                    ...layer,
                    rotation: layer.rotation + 90,
                  }))
                }
                type="button"
                data-tooltip="Повернуть слой вправо"
                aria-label="Повернуть слой вправо"
              >
                <i className="fa-solid fa-rotate-right" aria-hidden="true" />
              </button>
              <button
                className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
                onClick={() =>
                  onUpdateMapLayer(quickMapLayer.id, (layer) => ({
                    ...layer,
                    scale: Math.min(4, Math.round((layer.scale * 100 + 5)) / 100),
                  }))
                }
                type="button"
                data-tooltip="Увеличить слой на 5%"
                aria-label="Увеличить слой на 5%"
              >
                <i className="fa-solid fa-plus" aria-hidden="true" />
              </button>
              <button
                className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
                onClick={() =>
                  onUpdateMapLayer(quickMapLayer.id, (layer) => ({
                    ...layer,
                    scale: 1,
                  }))
                }
                type="button"
                data-tooltip="Сбросить масштаб слоя"
                aria-label="Сбросить масштаб слоя"
              >
                <span className={styles.flyoutButtonText} aria-hidden="true">100</span>
              </button>
              <button
                className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
                onClick={() =>
                  onUpdateMapLayer(quickMapLayer.id, (layer) => ({
                    ...layer,
                    scale: Math.max(0.25, Math.round((layer.scale * 100 - 5)) / 100),
                  }))
                }
                type="button"
                data-tooltip="Уменьшить слой на 5%"
                aria-label="Уменьшить слой на 5%"
              >
                <i className="fa-solid fa-minus" aria-hidden="true" />
              </button>
              <button
                className={cx(overlayStyles.button, overlayStyles.leftTooltip)}
                onClick={() =>
                  onUpdateMapLayer(quickMapLayer.id, (layer) => ({
                    ...layer,
                    rotation: layer.rotation - 90,
                  }))
                }
                type="button"
                data-tooltip="Повернуть слой влево"
                aria-label="Повернуть слой влево"
              >
                <i className="fa-solid fa-rotate-left" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <button
            className={overlayStyles.button}
            type="button"
            data-tooltip="Слои карты"
            aria-label="Слои карты"
          >
            <i className="fa-solid fa-layer-group" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
