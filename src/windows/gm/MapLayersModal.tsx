import type { RefObject } from 'react'
import { createCssUrl } from '../../lib/css'
import type { MapLayerInstance } from '../../types/adventure'
import styles from './MapLayersModal.module.css'

type MapLayersModalProps = {
  activeLayer: MapLayerInstance | null
  baseLayerId: string | null
  layerImageInputRef: RefObject<HTMLInputElement | null>
  layers: MapLayerInstance[]
  onAddLayer: () => void
  onClose: () => void
  onRemoveLayer: (layerId: string) => void
  onReplaceLayerImage: (layerId: string, file: File | null) => void | Promise<void>
  onSetActiveLayer: (layerId: string) => void
  onUpdateLayer: (layerId: string, updater: (layer: MapLayerInstance) => MapLayerInstance) => void
}

export function MapLayersModal({
  activeLayer,
  baseLayerId,
  layerImageInputRef,
  layers,
  onAddLayer,
  onClose,
  onRemoveLayer,
  onReplaceLayerImage,
  onSetActiveLayer,
  onUpdateLayer,
}: MapLayersModalProps) {
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
        aria-label="Слои карты"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <span className="eyebrow">Слои карты</span>
            <p className="editor-hint">
              Управляй слоями и подгоняй карту под сетку прямо поверх сцены.
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

        <div className={styles.layout}>
          <div className={`editor-stack ${styles.editorStack} ${styles.sidebar}`}>
            <div className={`section-row ${styles.sectionRow} ${styles.sidebarHeader}`}>
              <span className="eyebrow">Список слоёв</span>
              <button
                aria-label="Добавить новый слой"
                className={`ghost-button compact-button token-modal-icon-button ${styles.addButton}`}
                data-tooltip="Добавить слой"
                onClick={onAddLayer}
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-plus" />
              </button>
            </div>

            <div className={`layer-list ${styles.list}`}>
              {layers.map((layer, index) => (
                <div
                  className={`layer-row ${layer.id === activeLayer?.id ? 'active' : ''}`}
                  key={layer.id}
                  onClick={() => onSetActiveLayer(layer.id)}
                >
                  {index > 0 ? (
                    <button
                      aria-label="Удалить слой"
                      className="ghost-button compact-button token-modal-icon-button layer-row-delete-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveLayer(layer.id)
                      }}
                      title="Удалить слой"
                      type="button"
                    >
                      <i aria-hidden="true" className="fa-solid fa-trash" />
                    </button>
                  ) : null}
                  <div className="layer-row-content">
                    <strong>{layer.title}</strong>
                    <span className="scene-card-summary">
                      {index === 0 ? 'Базовый слой' : 'Дополнительный слой'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeLayer ? (
            <div className={`editor-stack ${styles.editorStack} ${styles.editor}`}>
              <div className={`section-row ${styles.sectionRow} ${styles.editorHeader}`}>
                <span className="eyebrow">Выбранный слой</span>
                {activeLayer.id !== baseLayerId ? (
                  <button
                    aria-label="Удалить слой"
                    className="ghost-button compact-button token-modal-icon-button"
                    onClick={() => onRemoveLayer(activeLayer.id)}
                    title="Удалить слой"
                    type="button"
                  >
                    <i aria-hidden="true" className="fa-solid fa-trash" />
                  </button>
                ) : null}
              </div>

              <div className={styles.hero}>
                <div className={styles.imageField}>
                  <label className={styles.imagePicker}>
                    <div className={styles.imagePreview}>
                      {activeLayer.imageSrc ? (
                        <div
                          aria-label={activeLayer.title}
                          className={styles.imagePreviewImage}
                          role="img"
                          style={{ backgroundImage: createCssUrl(activeLayer.imageSrc) }}
                        />
                      ) : (
                        <div className={styles.imagePlaceholder}>
                          <i aria-hidden="true" className="fa-regular fa-image" />
                        </div>
                      )}
                      <div className="token-image-overlay">
                        <i aria-hidden="true" className="fa-solid fa-upload" />
                      </div>
                    </div>
                    <input
                      accept="image/*"
                      className="token-image-input"
                      onChange={(event) => {
                        void onReplaceLayerImage(activeLayer.id, event.target.files?.[0] ?? null)
                        event.target.value = ''
                      }}
                      ref={layerImageInputRef}
                      type="file"
                    />
                  </label>
                </div>

                <div className={styles.heroFields}>
                  <label className="field">
                    <span>Название слоя</span>
                    <input
                      onChange={(event) =>
                        onUpdateLayer(activeLayer.id, (layer) => ({
                          ...layer,
                          title: event.target.value,
                        }))
                      }
                      value={activeLayer.title}
                    />
                  </label>

                  <div className="layer-controls">
                    <button
                      className={`ghost-button compact-button ${styles.visibilityButton} ${activeLayer.visibleToGm ? 'is-active' : ''}`}
                      onClick={() =>
                        onUpdateLayer(activeLayer.id, (layer) => ({
                          ...layer,
                          visibleToGm: !layer.visibleToGm,
                        }))
                      }
                      type="button"
                    >
                      Видно мастеру
                    </button>
                    <button
                      className={`ghost-button compact-button ${styles.visibilityButton} ${activeLayer.visibleToPlayers ? 'is-active' : ''}`}
                      onClick={() =>
                        onUpdateLayer(activeLayer.id, (layer) => ({
                          ...layer,
                          visibleToPlayers: !layer.visibleToPlayers,
                        }))
                      }
                      type="button"
                    >
                      Видно игрокам
                    </button>
                  </div>

                  <div className={styles.transformRow}>
                    <div className={`field ${styles.scaleField}`}>
                      <div className={`layer-controls ${styles.scaleControls}`}>
                        <button
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Уменьшить на 5%"
                          onClick={() =>
                            onUpdateLayer(activeLayer.id, (layer) => ({
                              ...layer,
                              scale: Math.max(0.25, Math.round((layer.scale * 100 - 5)) / 100),
                            }))
                          }
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-minus" />
                        </button>
                        <label className={`compact-inline-field ${styles.scaleInput}`}>
                          <input
                            min="25"
                            max="400"
                            onChange={(event) => {
                              const nextPercent = Number(event.target.value)
                              if (Number.isNaN(nextPercent)) {
                                return
                              }
                              onUpdateLayer(activeLayer.id, (layer) => ({
                                ...layer,
                                scale: Math.min(4, Math.max(0.25, nextPercent / 100)),
                              }))
                            }}
                            step="5"
                            type="number"
                            value={Math.round(activeLayer.scale * 100)}
                          />
                        </label>
                        <button
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Увеличить на 5%"
                          onClick={() =>
                            onUpdateLayer(activeLayer.id, (layer) => ({
                              ...layer,
                              scale: Math.min(4, Math.round((layer.scale * 100 + 5)) / 100),
                            }))
                          }
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-plus" />
                        </button>
                      </div>
                    </div>

                    <div className={`field ${styles.rotationField}`}>
                      <div className={`layer-controls ${styles.rotationControls}`}>
                        <button
                          aria-label="Повернуть влево на 90 градусов"
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Повернуть влево"
                          onClick={() =>
                            onUpdateLayer(activeLayer.id, (layer) => ({
                              ...layer,
                              rotation: layer.rotation - 90,
                            }))
                          }
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-rotate-left" />
                        </button>
                        <button
                          aria-label="Повернуть вправо на 90 градусов"
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Повернуть вправо"
                          onClick={() =>
                            onUpdateLayer(activeLayer.id, (layer) => ({
                              ...layer,
                              rotation: layer.rotation + 90,
                            }))
                          }
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-rotate-right" />
                        </button>
                        <button
                          aria-label="Сбросить трансформацию"
                          className="ghost-button compact-button token-modal-icon-button"
                          data-tooltip="Сбросить трансформацию"
                          onClick={() =>
                            onUpdateLayer(activeLayer.id, (layer) => ({
                              ...layer,
                              scale: 1,
                              rotation: 0,
                            }))
                          }
                          type="button"
                        >
                          <i aria-hidden="true" className="fa-solid fa-rotate" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
