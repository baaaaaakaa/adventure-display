import { useMemo, useState } from 'react'
import { StyledSelect } from '../../components/StyledSelect'
import type { AssetRecord, AudioTrack } from '../../types/adventure'
import styles from './AudioEditorPanel.module.css'

type AudioEditorPanelProps = {
  activeTrack: AudioTrack | null
  audioAssets: AssetRecord[]
  audioLoop: boolean
  audioTracks: AudioTrack[]
  audioVolume: number
  recommendedAudioIds: string[]
  onApplyLibraryAudioToTrack: (trackId: string, assetId: string) => void
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

export function AudioEditorPanel({
  activeTrack,
  audioAssets,
  audioLoop,
  audioTracks,
  audioVolume,
  recommendedAudioIds,
  onApplyLibraryAudioToTrack,
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
  const [isTrackListOpen, setIsTrackListOpen] = useState(false)
  const [trackSearch, setTrackSearch] = useState('')
  const filteredTracks = useMemo(() => {
    const searchValue = trackSearch.trim().toLocaleLowerCase('ru-RU')

    if (!searchValue) {
      return audioTracks
    }

    return audioTracks.filter((track) =>
      [track.title]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('ru-RU').includes(searchValue)),
    )
  }, [audioTracks, trackSearch])
  const isActiveTrackRecommended = activeTrack ? recommendedAudioIds.includes(activeTrack.id) : false
  const activeTrackHasFile = activeTrack
    ? Boolean(activeTrack.src || (activeTrack.assetId && audioAssets.some((asset) => asset.id === activeTrack.assetId)))
    : false

  return (
    <div className="editor-card">
      <div className="section-row scene-editor-card-title-row">
        <span className="eyebrow">Аудио</span>
        <strong>{recommendedAudioIds.length} треков в сцене</strong>
      </div>

      <div className={styles.trackPicker}>
        <span>Доступные треки</span>
        <div className={`${styles.trackDropdown} ${isTrackListOpen ? styles.open : ''}`}>
          <button
            aria-expanded={isTrackListOpen}
            aria-haspopup="listbox"
            className={styles.trackTrigger}
            onClick={() => setIsTrackListOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span>{activeTrack ? activeTrack.title : 'Выбрать трек'}</span>
            <i aria-hidden="true" className="fa-solid fa-chevron-down" />
          </button>

          {isTrackListOpen ? (
            <div className={styles.trackMenu} role="listbox">
              <label className={styles.trackSearch}>
                <i aria-hidden="true" className="fa-solid fa-magnifying-glass" />
                <input
                  autoFocus
                  onChange={(event) => setTrackSearch(event.target.value)}
                  placeholder="Поиск трека"
                  value={trackSearch}
                />
              </label>

              <div className={styles.trackOptions}>
                {filteredTracks.map((track) => {
                  const isRecommended = recommendedAudioIds.includes(track.id)
                  const isSelected = track.id === activeTrack?.id

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`${styles.trackOption} ${isSelected ? styles.selectedTrack : ''}`}
                      key={track.id}
                      onClick={() => {
                        onSelectAudioTrack(track.id)
                        setIsTrackListOpen(false)
                        setTrackSearch('')
                      }}
                      role="option"
                      type="button"
                    >
                      <span className={styles.trackOptionName}>{track.title}</span>
                      <span className={styles.trackOptionMeta}>
                        {isRecommended ? 'в сцене' : 'в библиотеке'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {activeTrack ? (
        <div className={styles.playerCard}>
          <div className={styles.playerHeader}>
            <div className={styles.playerTitle}>
              <span className="eyebrow">Выбранный трек</span>
            </div>
            <div className={styles.headerActions}>
              <button
                aria-label={isActiveTrackRecommended ? 'Убрать из сцены' : 'Добавить в сцену'}
                className={styles.iconButton}
                data-tooltip={isActiveTrackRecommended ? 'Убрать из сцены' : 'Добавить в сцену'}
                onClick={() => onToggleSceneAudioRecommendation(activeTrack.id)}
                title={isActiveTrackRecommended ? 'Убрать из сцены' : 'Добавить в сцену'}
                type="button"
              >
                <i aria-hidden="true" className={`fa-solid ${isActiveTrackRecommended ? 'fa-minus' : 'fa-plus'}`} />
              </button>
              <button
                aria-label="Удалить трек"
                className={`${styles.iconButton} ${styles.deleteButton}`}
                data-tooltip="Удалить трек"
                onClick={() => onRemoveAudioTrack(activeTrack.id)}
                title="Удалить трек"
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-trash" />
              </button>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              aria-label={activeTrackHasFile ? 'Воспроизвести' : 'Файл не выбран'}
              className={`${styles.transportButton} ${styles.playButton}`}
              data-tooltip={activeTrackHasFile ? 'Воспроизвести' : 'Файл не выбран'}
              disabled={!activeTrackHasFile}
              onClick={() => void onPlayAudioTrack(activeTrack.id)}
              title={activeTrackHasFile ? 'Воспроизвести' : 'Файл не выбран'}
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-play" />
            </button>
            <button
              aria-label="Пауза"
              className={styles.transportButton}
              data-tooltip="Пауза"
              onClick={onPauseAudioPlayback}
              title="Пауза"
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-pause" />
            </button>
            <button
              aria-label="Стоп"
              className={styles.transportButton}
              data-tooltip="Стоп"
              onClick={onStopAudioPlayback}
              title="Стоп"
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-stop" />
            </button>
            <button
              aria-label={audioLoop ? 'Выключить повтор' : 'Зациклить текущий трек'}
              aria-pressed={audioLoop}
              className={`${styles.transportButton} ${audioLoop ? styles.activeLoopButton : ''}`}
              data-tooltip={audioLoop ? 'Повтор включен' : 'Зациклить текущий трек'}
              onClick={() => onSetAudioLoop(!audioLoop)}
              title={audioLoop ? 'Повтор включен' : 'Зациклить текущий трек'}
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-repeat" />
            </button>
          </div>

          <div className={styles.compactFields}>
            <label className="field">
              <span>Название</span>
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
              <span>Файл</span>
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
          </div>
        </div>
      ) : null}
    </div>
  )
}
