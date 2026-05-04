import type { TokenInstance } from '../../types/adventure'
import styles from './InitiativeTracker.module.css'

type InitiativeTrackerProps = {
  focusToken: TokenInstance | null
  hiddenTokenCount: number
  isVisible: boolean
  onCycleTurn: (direction: 'next' | 'previous') => void
  onOpenToken: (tokenId: string) => void
  tokens: TokenInstance[]
}

function cx(...classNames: Array<string | false>) {
  return classNames.filter(Boolean).join(' ')
}

function getAvatarKindClassName(token: TokenInstance) {
  switch (token.kind) {
    case 'player':
      return styles.avatarPlayer
    case 'monster':
      return styles.avatarMonster
    case 'npc':
      return styles.avatarNpc
    default:
      return ''
  }
}

function formatHitPointsMax(token: TokenInstance) {
  const maxHitPoints = token.hitPointsMax ?? '—'
  const tempHitPoints = token.hitPointsTemp

  return typeof tempHitPoints === 'number' && tempHitPoints > 0
    ? `${maxHitPoints} (+${tempHitPoints})`
    : String(maxHitPoints)
}

function formatTokenHitPoints(token: TokenInstance) {
  return `${token.hitPointsCurrent ?? '—'}/${formatHitPointsMax(token)}`
}

export function InitiativeTracker({
  focusToken,
  hiddenTokenCount,
  isVisible,
  onCycleTurn,
  onOpenToken,
  tokens,
}: InitiativeTrackerProps) {
  if (!isVisible || tokens.length === 0) {
    return null
  }

  return (
    <div
      className={`${styles.tracker} map-initiative-tracker`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={styles.main}>
        <button
          aria-label="Предыдущий ход"
          className={styles.nav}
          data-tooltip="Предыдущий ход"
          onClick={() => onCycleTurn('previous')}
          type="button"
        >
          <i aria-hidden="true" className="fa-solid fa-chevron-left" />
        </button>
        <div className={styles.strip} role="list" aria-label="Трекер инициативы">
          {tokens.map((token) => {
            const isActive = token.id === focusToken?.id

            return (
              <button
                aria-label={`Открыть фишку ${token.name}`}
                className={cx(styles.token, isActive && styles.tokenActive)}
                key={token.id}
                onClick={() => onOpenToken(token.id)}
                type="button"
              >
                <span
                  className={cx(
                    styles.avatar,
                    getAvatarKindClassName(token),
                    token.imageSrc && styles.hasImage,
                    token.hiddenFromPlayers && styles.hidden,
                  )}
                  style={token.imageSrc ? { backgroundImage: `url(${token.imageSrc})` } : undefined}
                >
                  {!token.imageSrc ? token.name.charAt(0).toUpperCase() : null}
                </span>
              </button>
            )
          })}
          {hiddenTokenCount > 0 ? (
            <span
              className={styles.more}
              title={`${hiddenTokenCount} участников скрыто`}
            >
              +{hiddenTokenCount}
            </span>
          ) : null}
        </div>
        <button
          aria-label="Следующий ход"
          className={styles.nav}
          data-tooltip="Следующий ход"
          onClick={() => onCycleTurn('next')}
          type="button"
        >
          <i aria-hidden="true" className="fa-solid fa-chevron-right" />
        </button>
      </div>
      {focusToken ? (
        <div className={styles.caption}>
          <strong className={styles.name}>
            {focusToken.name}
          </strong>
          <span aria-hidden="true" className={styles.divider}>/</span>
          <span className={styles.meta}>
            {`ХП ${formatTokenHitPoints(focusToken)}`}
          </span>
        </div>
      ) : null}
    </div>
  )
}
