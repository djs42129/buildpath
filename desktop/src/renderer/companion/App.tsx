import { useEffect, useState } from 'react'
import type { DdragonStatus } from '../../shared/types'

// Champ-select companion window. For now it only reports Data Dragon status;
// champ select detection and recommendations arrive in steps 3 and 4.
export function App() {
  const [ddragon, setDdragon] = useState<DdragonStatus | null>(null)

  useEffect(() => {
    window.api.getDdragonStatus().then(setDdragon)
  }, [])

  return (
    <main>
      <h1>Buildpath</h1>
      <p className="muted">Waiting for champ select.</p>
      <footer>{renderDdragon(ddragon)}</footer>
    </main>
  )
}

function renderDdragon(status: DdragonStatus | null): string {
  if (!status) return 'Loading game data...'
  if (!status.version) return `Game data unavailable: ${status.error ?? 'unknown error'}`
  return `Patch data ${status.version}${status.offline ? ' (offline, cached)' : ''}`
}
