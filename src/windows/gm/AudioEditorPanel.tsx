import { StyledSelect } from '../../components/StyledSelect'
import type { AssetRecord, AudioTrack, AudioTrackKind } from '../../types/adventure'
import styles from './AudioEditorPanel.module.css'

const audioKindLabels: Record<AudioTrackKind, string> = {
  music: 'Музыка',
  ambience: 'Атмосфера',
  sfx: 'Эффект',
}

type AudioEditorPanelProps = {
  activeTrack: AudioTrack | null
  audioAssets: AssetRecord[]
  audioLoop: boolean
  audioTracks: AudioTrack[]
  audioVolume: number
  isAudioPlaying: boolean
  newAudioKind: AudioTrackKind
  newAudioTitle: string
  recommendedAudioIds: string[]
  onAddAudioTrack: (file: File | null) => void | Promise<void>
  onApplyLibraryAudioToTrack: (trackId: string, assetId: string) => void
  onNewAudioKindChange: (kind: AudioTrackKind) => void
  onNewAudioTitleChange: (title: string) => void
  onPauseAudioPlayback: () => void
  onPlayAudioTrack: (trackId: string) => void | Promise<void>
  onRemoveAudioTrack: (trackId: string) => void
  onSelectAudioTrack: (trackId: string) => void
  onSetAudioLoop: (value: boolean) => void
  onSetAudioVolume: (value: number) => void
  onStopAudioPlayback: () => void
  onToggleSceneAudioRecommendation: (trackId: string) => void
  onUpdateAudioTrack: (trackId: string, updater: (track: AudioTrack) => AudioTrack) => void
}

function getAudioKindClassName(kind: AudioTrackKind) {
  return [
    styles.kind,
    kind === 'music' ? styles.kindMusic : '',
    kind === 'ambience' ? styles.kindAmbience : '',
    kind === 'sfx' ? styles.kindSfx : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function AudioEditorPanel({
  activeTrack,
  audioAssets,
  audioLoop,
  audioTracks,
  audioVolume,
  isAudioPlaying,
  newAudioKind,
  newAudioTitle,
  recommendedAudioIds,
  onAddAudioTrack,
  onApplyLibraryAudioToTrack,
  onNewAudioKindChange,
  onNewAudioTitleChange,
  onPauseAudioPlayback,
  onPlayAudioTrack,
  onRemoveAudioTrack,
  onSelectAudioTrack,
  onSetAudioLoop,
  onSetAudioVolume,
  onStopAudioPlayback,
  onToggleSceneAudioRecommendation,
  onUpdateAudioTrack,
}: AudioEditorPanelProps) {
  return (
    <div className="editor-card">
      <div className="section-row scene-editor-card-title-row">
        <span className="eyebrow">Аудио</span>
        <strong>{recommendedAudioIds.length} треков в сцене</strong>
      </div>

      <div className={styles.uploadGrid}>
        <label className="field">
          <span>Название трека</span>
          <input
            onChange={(event) => onNewAudioTitleChange(event.target.value)}
            placeholder="Введи название, затем выбери файл"
            value={newAudioTitle}
          />
        </label>

        <label className="field">
          <span>Тип трека</span>
          <StyledSelect
            onChange={(event) => onNewAudioKindChange(event.target.value as AudioTrackKind)}
            value={newAudioKind}
          >
            <option value="music">Музыка</option>
            <option value="ambience">Атмосфера</option>
            <option value="sfx">Эффект</option>
          </StyledSelect>
        </label>

        <label className="field file-field">
          <span>Загрузить аудио</span>
          <span className="file-upload-control">
            <span className="file-upload-button" aria-hidden="true">
              <i className="fa-solid fa-plus" />
            </span>
            <span className="file-upload-name">
              {newAudioTitle.trim() ? `${newAudioTitle.trim()}` : 'Файл не выбран'}
            </span>
          </span>
          <input
            accept="audio/*"
            className="visually-hidden"
            onChange={(event) => {
              void onAddAudioTrack(event.target.files?.[0] ?? null)
              event.target.value = ''
            }}
            type="file"
          />
        </label>
      </div>

      {activeTrack ? (
        <div className={styles.playerCard}>
          <div className="section-row">
            <div>
              <span className="eyebrow">Выбранный трек</span>
              <h3>{activeTrack.title}</h3>
            </div>
            <span className={getAudioKindClassName(activeTrack.kind)}>
              {audioKindLabels[activeTrack.kind]}
            </span>
          </div>

          <div className={styles.controls}>
            <button
              className="primary-button compact-button"
              onClick={() => void onPlayAudioTrack(activeTrack.id)}
              type="button"
            >
              Воспроизвести
            </button>
            <button
              className="ghost-button compact-button"
              onClick={onPauseAudioPlayback}
              type="button"
            >
              Пауза
            </button>
            <button
              className="ghost-button compact-button"
              onClick={onStopAudioPlayback}
              type="button"
            >
              Стоп
            </button>
          </div>

          <div className={styles.settingsGrid}>
            <label className="field range-field">
              <span>Громкость: {audioVolume}%</span>
              <input
                max="100"
                min="0"
                onChange={(event) => onSetAudioVolume(Number(event.target.value))}
                type="range"
                value={audioVolume}
              />
            </label>
            <label className="checkbox-field">
              <input
                checked={audioLoop}
                onChange={(event) => onSetAudioLoop(event.target.checked)}
                type="checkbox"
              />
              <span>Зациклить текущий трек</span>
            </label>
          </div>

          <label className="field">
            <span>Файл из библиотеки</span>
            <StyledSelect
              onChange={(event) => {
                if (event.target.value) {
                  onApplyLibraryAudioToTrack(activeTrack.id, event.target.value)
                }
              }}
              value={activeTrack.assetId ?? ''}
            >
              <option value="">Не выбрано</option>
              {audioAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </StyledSelect>
          </label>

          <label className="field">
            <span>Название трека</span>
            <input
              onChange={(event) =>
                onUpdateAudioTrack(activeTrack.id, (track) => ({
                  ...track,
                  title: event.target.value,
                }))
              }
              value={activeTrack.title}
            />
          </label>

          <label className="field">
            <span>Тип трека</span>
            <StyledSelect
              onChange={(event) =>
                onUpdateAudioTrack(activeTrack.id, (track) => ({
                  ...track,
                  kind: event.target.value as AudioTrackKind,
                }))
              }
              value={activeTrack.kind}
            >
              <option value="music">Музыка</option>
              <option value="ambience">Атмосфера</option>
              <option value="sfx">Эффект</option>
            </StyledSelect>
          </label>

          <div className="section-row">
            <button
              className="ghost-button compact-button"
              onClick={() => onToggleSceneAudioRecommendation(activeTrack.id)}
              type="button"
            >
              {recommendedAudioIds.includes(activeTrack.id) ? 'Убрать из сцены' : 'Добавить в сцену'}
            </button>
            <button
              className="inline-link"
              onClick={() => onRemoveAudioTrack(activeTrack.id)}
              type="button"
            >
              Удалить трек
            </button>
          </div>

          {!activeTrack.src ? (
            <p className="editor-empty">
              У этого трека пока нет подключенного файла, выбери его в библиотеке или загрузи заново.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="editor-empty">
          Трек пока не выбран. Выбери карточку, чтобы открыть настройки звука.
        </p>
      )}

      <div className={styles.list}>
        {audioTracks.map((track) => {
          const isRecommended = recommendedAudioIds.includes(track.id)
          const isSelected = track.id === activeTrack?.id

          return (
            <button
              key={track.id}
              className={`${styles.card} ${isSelected ? styles.active : ''}`}
              onClick={() => onSelectAudioTrack(track.id)}
              type="button"
            >
              <div className={styles.cardHeader}>
                <strong>{track.title}</strong>
                <span className={getAudioKindClassName(track.kind)}>
                  {audioKindLabels[track.kind]}
                </span>
              </div>
              <span className={styles.meta}>
                {isRecommended ? 'Рекомендован для этой сцены' : 'Только в библиотеке'}
              </span>
              <span className={styles.meta}>
                {track.src
                  ? isAudioPlaying && isSelected
                    ? 'Сейчас играет'
                    : 'Готов к воспроизведению'
                  : 'Файл не найден'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
