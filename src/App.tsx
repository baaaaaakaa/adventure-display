import { useMemo } from 'react'
import { GmWindow } from './windows/gm/GmWindow'
import { PlayerWindow } from './windows/player/PlayerWindow'

function App() {
  const isPlayerWindow = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get('window') === 'player'
  }, [])

  return isPlayerWindow ? <PlayerWindow /> : <GmWindow />
}

export default App
