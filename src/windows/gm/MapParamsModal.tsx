import { StyledSelect } from '../../components/StyledSelect'
import type { AdventureScene, AssetRecord } from '../../types/adventure'

type MapParamsModalProps = {
  hasResolvedSceneMapImage: boolean
  imageAssets: AssetRecord[]
  scene: AdventureScene
  onApplyLibraryImage: (assetId: string) => void
  onChangeMapId: (value: string) => void
  onChangeMapPlaceholder: (value: string) => void
  onChangeMapTitle: (value: string) => void
  onClose: () => void
}

export function MapParamsModal({
  hasResolvedSceneMapImage,
  imageAssets,
  scene,
  onApplyLibraryImage,
  onChangeMapId,
  onChangeMapPlaceholder,
  onChangeMapTitle,
  onClose,
}: MapParamsModalProps) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-dialog token-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Параметры карты"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <span className="eyebrow">Параметры карты</span>
            <p className="editor-hint">
              Измени название, идентификатор и источник карты для текущей сцены.
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
            <span>ID карты</span>
            <input
              onChange={(event) => onChangeMapId(event.target.value)}
              value={scene.map.id}
            />
          </label>

          <label className="field">
            <span>Название карты</span>
            <input
              onChange={(event) => onChangeMapTitle(event.target.value)}
              value={scene.map.title}
            />
          </label>

          <label className="field">
            <span>Источник из библиотеки</span>
            <StyledSelect
              onChange={(event) => {
                if (event.target.value) {
                  onApplyLibraryImage(event.target.value)
                }
              }}
              value={scene.map.imageAssetId ?? ''}
            >
              <option value="">не выбран</option>
              {imageAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </StyledSelect>
          </label>

          <label className="field">
            <span>Текст заглушки</span>
            <textarea
              onChange={(event) => onChangeMapPlaceholder(event.target.value)}
              rows={4}
              value={scene.map.placeholder}
            />
          </label>

          {hasResolvedSceneMapImage ? (
            <p className="editor-hint">
              Карта сцены уже связана с библиотекой и может переиспользоваться в других сценах.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
