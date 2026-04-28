import { Fragment, useMemo } from 'react'
import { AppTooltipLayer } from './components/AppTooltipLayer'
import { GmWindow } from './windows/gm/GmWindow'
import { PlayerWindow } from './windows/player/PlayerWindow'

function App() {
  const isPlayerWindow = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get('window') === 'player'
  }, [])

  return (
    <Fragment>
      {isPlayerWindow ? <PlayerWindow /> : <GmWindow />}
      <AppTooltipLayer />
    </Fragment>
  )
}

export default App
