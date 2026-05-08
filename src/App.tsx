import { Fragment, useEffect, useMemo } from 'react'
import { AppTooltipLayer } from './components/AppTooltipLayer'
import { GmWindow } from './windows/gm/GmWindow'
import { PlayerWindow } from './windows/player/PlayerWindow'

function App() {
  const isPlayerWindow = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get('window') === 'player'
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('player-window-root', isPlayerWindow)

    return () => {
      document.documentElement.classList.remove('player-window-root')
    }
  }, [isPlayerWindow])

  return (
    <Fragment>
      {isPlayerWindow ? <PlayerWindow /> : <GmWindow />}
      <AppTooltipLayer />
    </Fragment>
  )
}

export default App
