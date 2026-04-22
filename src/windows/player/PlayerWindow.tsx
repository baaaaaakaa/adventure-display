import { useEffect, useState } from 'react'
import { sampleAdventure } from '../../data/sampleAdventure'
import {
  createInitialProjectState,
  getActiveAdventureBundle,
  loadProjectState,
  playerDisplayChannelName,
} from '../../lib/playerDisplay'
import type { ProjectState } from '../../types/adventure'

const fogGridColumns = 24
const fogGridRows = 16

function getFogCellStyle(cellId: string) {
  const [columnRaw, rowRaw] = cellId.split(':')
  const column = Number(columnRaw)
  const row = Number(rowRaw)

  return {
    left: `${(column / fogGridColumns) * 100}%`,
    top: `${(row / fogGridRows) * 100}%`,
    width: `${100 / fogGridColumns}%`,
    height: `${100 / fogGridRows}%`,
  }
}

function EmptyPlayerState() {
  return (
    <main className="player-stage standby-stage">
      <div className="player-frame">
        <span className="eyebrow">Экран игроков</span>
        <h1>Ожидание первой сцены</h1>
        <p>
          Держи это окно на общем экране. Мастерское окно будет выводить сюда карты,
          раздаточные материалы и позиции фишек.
        </p>
      </div>
    </main>
  )
}

export function PlayerWindow() {
  const [projectState, setProjectState] = useState<ProjectState>(() =>
    loadProjectState(createInitialProjectState(sampleAdventure)),
  )

  useEffect(() => {
    const channel = new BroadcastChannel(playerDisplayChannelName)

    channel.onmessage = (event) => {
      setProjectState(event.data as ProjectState)
    }

    return () => {
      channel.close()
    }
  }, [])

  const activeBundle = getActiveAdventureBundle(projectState)

  if (!activeBundle) {
    return <EmptyPlayerState />
  }

  const { adventure, session } = activeBundle
  const scene =
    adventure.scenes.find(
      (entry) => entry.id === session.playerDisplay.sceneId,
    ) ?? null

  if (!scene) {
    return <EmptyPlayerState />
  }

  const sceneRuntime = session.sceneStates[scene.id] ?? null
  const handout =
    scene.handouts.find(
      (entry) => entry.id === session.playerDisplay.activeHandoutId,
    ) ?? null
  const splash = scene.splash
  const playerVisibleLayers =
    sceneRuntime?.mapLayers.filter(
      (layer) => layer.visibleToPlayers && layer.imageSrc,
    ) ?? []
  const playerVisibleZones = scene.zones.filter((zone) => zone.visibleToPlayers)
  const orderedTokens = [...(sceneRuntime?.tokens ?? [])]
    .filter((token) => !token.hiddenFromPlayers)
    .sort((left, right) => left.zIndex - right.zIndex)
  const activeInitiativeToken =
    sceneRuntime?.activeInitiativeTokenId
      ? orderedTokens.find((token) => token.id === sceneRuntime.activeInitiativeTokenId) ?? null
      : null
  const presentationKey = [
    session.playerDisplay.mode,
    session.playerDisplay.sceneId ?? 'none',
    session.playerDisplay.activeHandoutId ?? 'none',
    session.playerDisplay.updatedAt,
  ].join(':')

  if (session.playerDisplay.mode === 'handout' && handout) {
    return (
      <main
        className={`player-stage player-stage-enter accent-${scene.accent}`}
        key={presentationKey}
      >
        <section className="player-hero">
          <div className="player-overlay"></div>
          <div
            className={`player-frame handout-frame ${handout.imageSrc ? 'with-art' : 'text-only'}`}
          >
            <div className="handout-shell">
              {handout.imageSrc ? (
                <figure className="handout-figure">
                  <img
                    alt={handout.title}
                    className="handout-image"
                    src={handout.imageSrc}
                  />
                </figure>
              ) : null}
              <article className="handout-copy">
                <div className="handout-chips">
                  <span className="eyebrow">{handout.caption}</span>
                  <span className="player-chip">{scene.title}</span>
                </div>
                <h1>{handout.title}</h1>
                <p>{handout.body}</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (session.playerDisplay.mode === 'splash') {
    return (
      <main
        className={`player-stage player-stage-enter accent-${scene.accent}`}
        key={presentationKey}
      >
        <section className="player-hero splash-stage">
          <div className="player-overlay"></div>
          {splash.imageSrc ? (
            <div
              className="splash-backdrop"
              style={{ backgroundImage: `url(${splash.imageSrc})` }}
            />
          ) : null}
          <div
            className={`player-frame splash-frame ${splash.imageSrc ? 'with-art' : 'text-only'}`}
          >
            {splash.imageSrc ? (
              <div className="splash-hero-image-wrap">
                <img
                  alt={splash.title}
                  className="splash-hero-image"
                  src={splash.imageSrc}
                />
              </div>
            ) : null}
            <div className="splash-copy">
              <div className="handout-chips">
                <span className="eyebrow">{splash.subtitle || scene.location}</span>
                <span className="player-chip">Сцена</span>
              </div>
              <h1>{splash.title || scene.title}</h1>
              <p>{splash.body || scene.gmSummary}</p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (session.playerDisplay.mode === 'standby') {
    return (
      <main
        className={`player-stage player-stage-enter accent-${scene.accent}`}
        key={presentationKey}
      >
        <section className="player-hero">
          <div className="player-overlay"></div>
          <div className="player-frame player-standby-frame">
            <div className="standby-chip-row">
              <span className="eyebrow">Пауза</span>
              <span className="player-chip">{scene.location}</span>
              <span className="player-chip">{scene.map.title}</span>
            </div>
            <h1>{scene.title}</h1>
            <p>Игра на паузе. Ждите следующую карту, новую раздатку или переход к новой сцене.</p>
            <div className="standby-meta">
              <strong>На общем экране скоро появится новый показ.</strong>
              <span>Мастер управляет картой, раздатками и фишками из своего окна.</span>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main
      className={`player-stage player-stage-enter accent-${scene.accent}`}
      key={presentationKey}
    >
      <section className="player-map-shell">
        <header className="player-map-header">
          <div className="player-map-meta">
            <span className="eyebrow">{scene.location}</span>
            <span className="player-chip">{scene.map.title}</span>
            <span className="player-chip">Зоны: {playerVisibleZones.length}</span>
            <span className="player-chip">Фишки: {orderedTokens.length}</span>
            {activeInitiativeToken ? (
              <span className="player-chip accent-chip">Ход: {activeInitiativeToken.name}</span>
            ) : null}
          </div>
          <h1>{scene.title}</h1>
        </header>

        <div
          className={`player-map-board ${playerVisibleLayers.length > 0 ? 'with-image' : ''}`}
        >
          <div className="player-map-vignette" />
          <div className="map-transform-layer">
            <div className="map-layer-stack">
              {playerVisibleLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="map-layer"
                  style={{ backgroundImage: layer.imageSrc ? `url(${layer.imageSrc})` : undefined }}
                />
              ))}
            </div>

            <div className="map-grid-overlay" />

            {playerVisibleZones.map((zone) => (
              <div
                key={zone.id}
                className="map-zone player-zone player-visible"
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                }}
                title={zone.title}
              >
                <span>{zone.title}</span>
              </div>
            ))}

            {orderedTokens.map((token) => (
              <div
                key={token.id}
                className={`token token-${token.kind} player-token ${
                  token.id === activeInitiativeToken?.id ? 'active-turn' : ''
                }`}
                style={{
                  left: `${token.x}%`,
                  top: `${token.y}%`,
                  width: `${token.size}px`,
                  height: `${token.size}px`,
                  backgroundImage: `url(${token.imageSrc})`,
                  transform: `translate(-50%, -50%) rotate(${token.rotation}deg)`,
                  zIndex: token.zIndex,
                }}
                title={token.name}
              >
                <span>{token.name}</span>
              </div>
            ))}

            <div className="fog-layer fog-layer-player">
              {sceneRuntime?.fogCells.map((cellId) => (
                <div
                  key={cellId}
                  className="fog-cell"
                  style={getFogCellStyle(cellId)}
                />
              ))}
            </div>
          </div>

          {playerVisibleLayers.length === 0 ? (
            <div className="map-placeholder player-placeholder">
              <span className="eyebrow">{scene.map.title}</span>
              <strong>Карта пока не загружена</strong>
              <p>{scene.map.placeholder}</p>
            </div>
          ) : null}

          <div className="player-scene-ribbon">
            <strong>{scene.title}</strong>
            <span>{scene.location}</span>
          </div>
        </div>
      </section>
    </main>
  )
}
