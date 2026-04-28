import {
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { MapViewport, SceneRuntimeState } from '../../types/adventure'

type UpdateSceneRuntimeState = (
  sceneId: string,
  updater: (sceneState: SceneRuntimeState) => SceneRuntimeState,
  label?: string,
) => void

type UseMapViewportControlsOptions = {
  activeSceneId: string | null
  activeMapViewport: MapViewport
  mapBoardRef: RefObject<HTMLDivElement | null>
  updateSceneRuntimeState: UpdateSceneRuntimeState
}

const minMapScale = 0.5
const maxMapScale = 2.5

export const mapScaleStep = 0.25

function clampMapScale(value: number) {
  return Math.min(maxMapScale, Math.max(minMapScale, value))
}

export function useMapViewportControls({
  activeSceneId,
  activeMapViewport,
  mapBoardRef,
  updateSceneRuntimeState,
}: UseMapViewportControlsOptions) {
  const [isMapPanning, setIsMapPanning] = useState(false)

  const updateMapViewport = useCallback(
    (updater: (viewport: MapViewport) => MapViewport) => {
      if (!activeSceneId) {
        return
      }

      updateSceneRuntimeState(activeSceneId, (sceneState) => ({
        ...sceneState,
        mapViewport: updater(sceneState.mapViewport),
      }))
    },
    [activeSceneId, updateSceneRuntimeState],
  )

  const zoomMap = useCallback(
    (delta: number) => {
      updateMapViewport((viewport) => ({
        ...viewport,
        scale: clampMapScale(Number((viewport.scale + delta).toFixed(2))),
      }))
    },
    [updateMapViewport],
  )

  const zoomMapAtPoint = useCallback(
    (clientX: number, clientY: number, delta: number) => {
      const board = mapBoardRef.current

      if (!board) {
        zoomMap(delta)
        return
      }

      const rect = board.getBoundingClientRect()

      updateMapViewport((viewport) => {
        const nextScale = clampMapScale(Number((viewport.scale + delta).toFixed(2)))

        if (nextScale === viewport.scale) {
          return viewport
        }

        const localX = clientX - rect.left
        const localY = clientY - rect.top
        const contentX = (localX - viewport.offsetX) / viewport.scale
        const contentY = (localY - viewport.offsetY) / viewport.scale

        return {
          ...viewport,
          scale: nextScale,
          offsetX: localX - contentX * nextScale,
          offsetY: localY - contentY * nextScale,
        }
      })
    },
    [mapBoardRef, updateMapViewport, zoomMap],
  )

  useEffect(() => {
    const board = mapBoardRef.current

    if (!board) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomMapAtPoint(event.clientX, event.clientY, event.deltaY < 0 ? mapScaleStep : -mapScaleStep)
    }

    board.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      board.removeEventListener('wheel', handleWheel)
    }
  }, [mapBoardRef, zoomMapAtPoint])

  const resetMapViewport = useCallback(() => {
    updateMapViewport(() => ({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }))
  }, [updateMapViewport])

  const stopMapPan = useCallback(() => {
    setIsMapPanning(false)
  }, [])

  const beginMapPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!activeSceneId) {
        return
      }

      event.preventDefault()
      setIsMapPanning(true)

      const startX = event.clientX
      const startY = event.clientY
      const startViewport = activeMapViewport

      const handleMove = (moveEvent: PointerEvent) => {
        updateMapViewport(() => ({
          ...startViewport,
          offsetX: startViewport.offsetX + (moveEvent.clientX - startX),
          offsetY: startViewport.offsetY + (moveEvent.clientY - startY),
        }))
      }

      const handleUp = () => {
        setIsMapPanning(false)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [activeMapViewport, activeSceneId, updateMapViewport],
  )

  return {
    beginMapPan,
    isMapPanning,
    resetMapViewport,
    stopMapPan,
    zoomMap,
  }
}
