import { useEffect, useState } from 'react'
import { sampleAdventure } from '../../data/sampleAdventure'
import {
  createInitialProjectState,
  getActiveAdventureBundle,
  playerDisplayChannelName,
} from '../../lib/playerDisplay'
import { createCssUrl } from '../../lib/css'
import { resolvePublicAssetSrc } from '../../lib/publicAssets'
import { getFogCellRects, getZoneFogRect } from '../../lib/fog'
import { defaultMapGrid, tokenSpaceFootprints } from '../../types/adventure'
import type { ProjectState } from '../../types/adventure'

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
    createInitialProjectState(sampleAdventure),
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
  const mapGrid = sceneRuntime?.mapGrid ?? defaultMapGrid
  const mapGridAspectRatio = mapGrid.columns / mapGrid.rows
  const mapFrameStyle = {
    width: `min(100%, ${mapGridAspectRatio * 100}dvh)`,
    height: `min(100%, ${(mapGrid.rows / mapGrid.columns) * 100}dvw)`,
    aspectRatio: `${mapGrid.columns} / ${mapGrid.rows}`,
  }
  const isMapGridVisible = sceneRuntime?.mapGridVisible ?? true
  const mapViewport = sceneRuntime?.mapViewport ?? {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
  const hiddenFogZones = sceneRuntime
    ? scene.zones.filter((zone) => sceneRuntime.hiddenZoneIds.includes(zone.id))
    : []
  const effectiveFogCells = sceneRuntime
    ? sceneRuntime.fogCells ?? []
    : []
  const fogCellRects = getFogCellRects(effectiveFogCells, mapGrid)
  const hiddenFogZoneRects = hiddenFogZones.map((zone) => getZoneFogRect(zone))
  const playerFogMaskId = `player-fog-mask-${scene.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const playerFogSoftEdgeId = `player-fog-soft-edge-${scene.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const playerFogClipId = `player-fog-clip-${scene.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const hasPlayerFog = fogCellRects.length > 0 || hiddenFogZoneRects.length > 0
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
          {splash.imageSrc ? (
            <img
              alt={splash.title || scene.title}
              className="splash-fullscreen-image"
              src={splash.imageSrc}
            />
          ) : null}
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
            </div>
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
      className={`player-stage player-stage-enter player-map-stage accent-${scene.accent}`}
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
          <div className="map-frame" style={mapFrameStyle}>
          <div
            className="map-transform-layer"
            style={{
              transform: `translate(${mapViewport.offsetX}px, ${mapViewport.offsetY}px) scale(${mapViewport.scale})`,
            }}
          >
            <div className="map-layer-stack">
              {playerVisibleLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="map-layer"
                  style={{
                    backgroundImage: createCssUrl(layer.imageSrc),
                    transform: `scale(${layer.scale}) rotate(${layer.rotation}deg)`,
                  }}
                />
              ))}
            </div>

            {isMapGridVisible ? (
              <div
                className="map-grid-overlay"
                style={{
                  backgroundSize: `${100 / mapGrid.columns}% ${100 / mapGrid.rows}%`,
                }}
              />
            ) : null}

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
                data-tooltip-disabled="true"
                className={`token token-${token.kind} player-token ${
                  token.id === activeInitiativeToken?.id ? 'active-turn' : ''
                }`}
                style={{
                  left: `${token.x}%`,
                  top: `${token.y}%`,
                  width: `${(tokenSpaceFootprints[token.space] / mapGrid.columns) * 100}%`,
                  height: `${(tokenSpaceFootprints[token.space] / mapGrid.rows) * 100}%`,
                  backgroundImage: `url(${token.imageSrc})`,
                  transform: `translate(-50%, -50%) rotate(${token.rotation}deg)`,
                  zIndex: token.zIndex,
                }}
              >
                <span className="token-label">{token.name}</span>
              </div>
            ))}

            {hasPlayerFog ? (
              <svg
                className="fog-layer fog-layer-player"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <filter id={playerFogSoftEdgeId} x="-4%" y="-4%" width="108%" height="108%">
                    <feMorphology operator="erode" radius="0.22" />
                    <feGaussianBlur stdDeviation="0.42" />
                  </filter>
                  <clipPath id={playerFogClipId} clipPathUnits="userSpaceOnUse">
                    {hiddenFogZoneRects.map((zone) => (
                      <rect
                        key={`clip-zone-${zone.id}`}
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                      />
                    ))}
                    {fogCellRects.map((cell) => (
                      <rect
                        key={`clip-cell-${cell.id}`}
                        x={cell.x}
                        y={cell.y}
                        width={cell.width}
                        height={cell.height}
                      />
                    ))}
                  </clipPath>
                  <mask id={playerFogMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                    <rect x="0" y="0" width="100" height="100" fill="black" />
                    <g
                      fill="white"
                      clipPath={`url(#${playerFogClipId})`}
                      filter={`url(#${playerFogSoftEdgeId})`}
                    >
                      {hiddenFogZoneRects.map((zone) => (
                        <rect
                          key={`zone-${zone.id}`}
                          x={zone.x}
                          y={zone.y}
                          width={zone.width}
                          height={zone.height}
                        />
                      ))}
                      {fogCellRects.map((cell) => (
                        <rect
                          key={`cell-${cell.id}`}
                          x={cell.x}
                          y={cell.y}
                          width={cell.width}
                          height={cell.height}
                        />
                      ))}
                    </g>
                  </mask>
                </defs>
                <rect
                  className="fog-player-base"
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  mask={`url(#${playerFogMaskId})`}
                />
                <image
                  className="fog-player-texture"
                  href={resolvePublicAssetSrc('/fog-pattern.png')}
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  preserveAspectRatio="xMidYMid slice"
                  mask={`url(#${playerFogMaskId})`}
                />
                <rect
                  className="fog-player-veil"
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  mask={`url(#${playerFogMaskId})`}
                />
              </svg>
            ) : null}
          </div>

          {playerVisibleLayers.length === 0 ? (
            <div className="map-placeholder player-placeholder">
              <span className="eyebrow">{scene.map.title}</span>
              <strong>Карта пока не загружена</strong>
              <p>{scene.map.placeholder}</p>
            </div>
          ) : null}
          </div>

          {handout ? (
            <div className="handout-modal-backdrop player-handout-modal" role="presentation">
              <article className={`handout-modal-card ${handout.imageSrc ? 'with-art' : 'text-only'}`}>
                {handout.title ? <h2>{handout.title}</h2> : null}
                {handout.imageSrc ? (
                  <figure className="handout-modal-figure">
                    <img alt={handout.title} className="handout-modal-image" src={handout.imageSrc} />
                  </figure>
                ) : null}
                {handout.body ? <p>{handout.body}</p> : null}
              </article>
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
