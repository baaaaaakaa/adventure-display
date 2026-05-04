import { StyledSelect } from '../../components/StyledSelect'
import type { AssetRecord, Handout } from '../../types/adventure'
import styles from './HandoutsEditorPanel.module.css'

type HandoutsEditorPanelProps = {
  activeHandout: Handout | null
  handouts: Handout[]
  imageAssets: AssetRecord[]
  selectedHandoutId: string | null
  onAddHandout: () => void
  onApplyLibraryImageToHandout: (handoutId: string, assetId: string) => void
  onRemoveHandout: (handoutId: string) => void
  onRenameHandoutId: (handoutId: string, nextIdRaw: string) => void
  onSelectHandout: (handoutId: string | null) => void
  onUpdateHandout: (handoutId: string, updater: (handout: Handout) => Handout) => void
  onUploadHandoutImage: (handoutId: string, file: File | null) => void | Promise<void>
}

function getAssetFileLabel(
  assets: AssetRecord[],
  assetId: string | null | undefined,
  fallbackSrc: string | null | undefined,
) {
  const asset = assets.find((currentAsset) => currentAsset.id === assetId)

  if (asset) {
    return asset.originalName || asset.title
  }

  return fallbackSrc ? 'Файл загружен' : 'Файл не выбран'
}

export function HandoutsEditorPanel({
  activeHandout,
  handouts,
  imageAssets,
  selectedHandoutId,
  onAddHandout,
  onApplyLibraryImageToHandout,
  onRemoveHandout,
  onRenameHandoutId,
  onSelectHandout,
  onUpdateHandout,
  onUploadHandoutImage,
}: HandoutsEditorPanelProps) {
  return (
    <div className="editor-card">
      <div className="section-row scene-editor-card-title-row">
        <span className="eyebrow">Раздатки</span>
        <button
          aria-label="Добавить раздатку"
          className="ghost-button compact-button token-modal-icon-button"
          data-tooltip="Добавить раздатку"
          onClick={onAddHandout}
          type="button"
        >
          <i aria-hidden="true" className="fa-solid fa-plus" />
        </button>
      </div>

      <details className={styles.spoiler}>
        <summary className={styles.spoilerSummary}>
          <span>Созданные раздатки</span>
          <span className={styles.spoilerCount}>{handouts.length}</span>
          <i aria-hidden="true" className="fa-solid fa-chevron-down" />
        </summary>

        <div className={styles.list}>
          {handouts.map((handout) => (
            <button
              key={handout.id}
              className={`${styles.card} ${handout.id === activeHandout?.id ? styles.active : ''}`}
              onClick={() => onSelectHandout(selectedHandoutId === handout.id ? null : handout.id)}
              type="button"
            >
              <strong>{handout.title}</strong>
            </button>
          ))}
        </div>
      </details>

      {activeHandout ? (
        <div className={styles.editor}>
          <div className="section-row">
            <span className="eyebrow">Выбранная раздатка</span>
            <button
              aria-label="Удалить раздатку"
              className="ghost-button compact-button token-modal-icon-button"
              data-tooltip="Удалить раздатку"
              onClick={() => onRemoveHandout(activeHandout.id)}
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-trash" />
            </button>
          </div>

          <label className="field">
            <span>ID раздатки</span>
            <input
              onChange={(event) => onRenameHandoutId(activeHandout.id, event.target.value)}
              value={activeHandout.id}
            />
          </label>

          <label className="field">
            <span>Название</span>
            <input
              onChange={(event) =>
                onUpdateHandout(activeHandout.id, (handout) => ({
                  ...handout,
                  title: event.target.value,
                }))
              }
              value={activeHandout.title}
            />
          </label>


          <label className="field">
            <span>Изображение из библиотеки</span>
            <StyledSelect
              onChange={(event) => {
                if (event.target.value) {
                  onApplyLibraryImageToHandout(activeHandout.id, event.target.value)
                }
              }}
              value={activeHandout.imageAssetId ?? ''}
            >
              <option value="">Не выбрано</option>
              {imageAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </StyledSelect>
          </label>

          <label className="field">
            <span>Текст</span>
            <textarea
              onChange={(event) =>
                onUpdateHandout(activeHandout.id, (handout) => ({
                  ...handout,
                  body: event.target.value,
                }))
              }
              rows={5}
              value={activeHandout.body}
            />
          </label>

          <label className="field file-field">
            <span>Загрузить изображение</span>
            <span className="file-upload-control">
              <span className="file-upload-button" aria-hidden="true">
                <i className="fa-solid fa-plus" />
              </span>
              <span className="file-upload-name">
                {getAssetFileLabel(imageAssets, activeHandout.imageAssetId, activeHandout.imageSrc)}
              </span>
            </span>
            <input
              accept="image/*"
              className="visually-hidden"
              onChange={(event) => {
                void onUploadHandoutImage(activeHandout.id, event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
              type="file"
            />
          </label>
        </div>
      ) : (
        <p className={`editor-empty ${styles.empty}`}>
          Раздатка пока не выбрана. Нажми на карточку, чтобы начать редактирование.
        </p>
      )}
    </div>
  )
}
