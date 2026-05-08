import styles from './MapTitleBadge.module.css'

type MapTitleBadgeProps = {
  audioLabel: string
  canRedo: boolean
  canGoNextScene: boolean
  canGoPreviousScene: boolean
  canShowQuickHandout: boolean
  canUndo: boolean
  isPlayerShowingActiveMap: boolean
  isPlayerShowingActiveSplash: boolean
  isPlayerShowingQuickHandout: boolean
  mapTitle: string
  materialLabel: string
  onOpenMapParams: () => void
  onOpenPlayerWindow: () => void
  onGoNextScene: () => void
  onGoPreviousScene: () => void
  onPushMapToPlayer: () => void
  onPushQuickHandout: () => void
  onPushSplashToPlayer: () => void
  onRedo: () => void
  onSetStandby: () => void
  onUndo: () => void
  playerModeLabel: string
  playerSceneLabel: string
}

function cx(...classNames: Array<string | false>) {
  return classNames.filter(Boolean).join(' ')
}

export function MapTitleBadge({
  audioLabel,
  canRedo,
  canGoNextScene,
  canGoPreviousScene,
  canShowQuickHandout,
  canUndo,
  isPlayerShowingActiveMap,
  isPlayerShowingActiveSplash,
  isPlayerShowingQuickHandout,
  mapTitle,
  materialLabel,
  onOpenMapParams,
  onOpenPlayerWindow,
  onGoNextScene,
  onGoPreviousScene,
  onPushMapToPlayer,
  onPushQuickHandout,
  onPushSplashToPlayer,
  onRedo,
  onSetStandby,
  onUndo,
  playerModeLabel,
  playerSceneLabel,
}: MapTitleBadgeProps) {
  return (
    <div className={`${styles.badge} map-title-badge`}>
      <div className={styles.header}>
        <div className={styles.topline}>
          <span className={styles.label}>{mapTitle}</span>
          <button
            aria-label="Открыть параметры карты"
            className={styles.editButton}
            onClick={(event) => {
              event.stopPropagation()
              onOpenMapParams()
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            title="Параметры карты"
            type="button"
          >
            <i className="fa-solid fa-pen" aria-hidden="true" />
          </button>
        </div>
        <div className={styles.status} aria-label="Экран игроков">
          <span>Экран игроков</span>
          <strong>{playerModeLabel}</strong>
          <span>Сцена</span>
          <strong>{playerSceneLabel}</strong>
          <span>Материал</span>
          <strong>{materialLabel}</strong>
          <span>Аудио</span>
          <strong>{audioLabel}</strong>
        </div>
      </div>
      <div className={styles.actions} role="toolbar" aria-label="Быстрые действия сцены">
        <button
          className={cx('toolbar-button', styles.actionButton)}
          disabled={!canGoPreviousScene}
          onClick={onGoPreviousScene}
          type="button"
          title="Предыдущая сцена"
          aria-label="Предыдущая сцена"
        >
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button', styles.actionButton)}
          disabled={!canGoNextScene}
          onClick={onGoNextScene}
          type="button"
          title="Следующая сцена"
          aria-label="Следующая сцена"
        >
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button toolbar-button-primary', styles.actionButton, isPlayerShowingActiveSplash && 'is-active')}
          onClick={onPushSplashToPlayer}
          type="button"
          title={isPlayerShowingActiveSplash ? 'Скрыть splash-экран' : 'Показать splash-экран'}
          aria-label={isPlayerShowingActiveSplash ? 'Скрыть splash-экран' : 'Показать splash-экран'}
        >
          <i className="fa-solid fa-image" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button toolbar-button-primary', styles.actionButton, isPlayerShowingActiveMap && 'is-active')}
          onClick={onPushMapToPlayer}
          type="button"
          title={isPlayerShowingActiveMap ? 'Скрыть карту игроков' : 'Показать карту игрокам'}
          aria-label={isPlayerShowingActiveMap ? 'Скрыть карту игроков' : 'Показать карту игрокам'}
        >
          <i className="fa-solid fa-map" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button toolbar-button-primary', styles.actionButton, isPlayerShowingQuickHandout && 'is-active')}
          disabled={!canShowQuickHandout}
          onClick={onPushQuickHandout}
          type="button"
          title={isPlayerShowingQuickHandout ? 'Скрыть связанную раздатку' : 'Показать связанную раздатку'}
          aria-label={isPlayerShowingQuickHandout ? 'Скрыть связанную раздатку' : 'Показать связанную раздатку'}
        >
          <i className="fa-solid fa-note-sticky" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button', styles.actionButton)}
          onClick={onOpenPlayerWindow}
          type="button"
          title="Открыть окно игроков"
          aria-label="Открыть окно игроков"
        >
          <i className="fa-solid fa-up-right-from-square" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button', styles.actionButton)}
          onClick={onSetStandby}
          type="button"
          title="Пауза"
          aria-label="Пауза"
        >
          <i className="fa-solid fa-pause" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button', styles.actionButton)}
          disabled={!canUndo}
          onClick={onUndo}
          type="button"
          title="Отменить последнее изменение"
          aria-label="Отменить последнее изменение"
        >
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
        </button>
        <button
          className={cx('toolbar-button', styles.actionButton)}
          disabled={!canRedo}
          onClick={onRedo}
          type="button"
          title="Вернуть отменённое изменение"
          aria-label="Вернуть отменённое изменение"
        >
          <i className="fa-solid fa-rotate-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
