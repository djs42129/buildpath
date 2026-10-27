import { useEffect, useState, type WheelEvent } from 'react'
import type { AbilityKey, LiveSnapshot, OverlayState, OverlayTab } from '../../shared/types'

// In-game panel. Purely passive: it renders what main sends and never takes input,
// except in edit mode (drag to move, scroll to change opacity).
//
// Step 2 spike: shows live data only. Recommendations fill these tabs in step 7.

const TABS: { id: OverlayTab; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'skills', label: 'Skills' },
  { id: 'runes', label: 'Runes' },
  { id: 'tiers', label: 'Tiers' }
]

export function App() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null)
  const [state, setState] = useState<OverlayState>({ editMode: false, tab: 'build', opacity: 0.85 })

  useEffect(() => window.api.onLiveUpdate(setSnapshot), [])
  useEffect(() => window.api.onOverlayState(setState), [])

  const onWheel = (e: WheelEvent): void => {
    if (state.editMode) window.api.adjustOpacity(e.deltaY < 0 ? 0.05 : -0.05)
  }

  return (
    <div className={`panel${state.editMode ? ' edit' : ''}`}>
      {state.editMode && (
        <div className="edit-banner" onWheel={onWheel}>
          Drag to move. Scroll here for opacity ({Math.round(state.opacity * 100)}%).
          <br />
          Ctrl+Shift+L to lock.
        </div>
      )}
      <header>
        {snapshot ? (
          <>
            <strong>{snapshot.champion}</strong>
            <span>Lv {snapshot.level}</span>
            <span className="gold">{snapshot.gold}g</span>
          </>
        ) : (
          <span className="muted">No game detected</span>
        )}
      </header>
      <nav>
        {TABS.map((t, i) => (
          <span key={t.id} className={t.id === state.tab ? 'active' : ''}>
            {t.label}
            <small>{i + 1}</small>
          </span>
        ))}
      </nav>
      <section>{snapshot && <TabBody tab={state.tab} snapshot={snapshot} />}</section>
    </div>
  )
}

function TabBody({ tab, snapshot }: { tab: OverlayTab; snapshot: LiveSnapshot }) {
  switch (tab) {
    case 'build':
      return <BuildTab snapshot={snapshot} />
    case 'skills':
      return <SkillsTab snapshot={snapshot} />
    case 'runes':
      return <RunesTab snapshot={snapshot} />
    case 'tiers':
      return <p className="muted">Tier list arrives with crawler stats (step 7).</p>
  }
}

function BuildTab({ snapshot }: { snapshot: LiveSnapshot }) {
  const bySlot = new Map(snapshot.items.map((i) => [i.slot, i]))
  return (
    <>
      <h2>Inventory</h2>
      <div className="items">
        {[0, 1, 2, 3, 4, 5, 6].map((slot) => {
          const item = bySlot.get(slot)
          return (
            <div key={slot} className={`item${slot === 6 ? ' trinket' : ''}`} title={item?.name}>
              {item && <img src={`ddragon://img/item/${item.id}.png`} alt={item.name} />}
            </div>
          )
        })}
      </div>
      <p className="muted">Recommended build arrives in step 7.</p>
    </>
  )
}

const ABILITY_KEYS: AbilityKey[] = ['Q', 'W', 'E', 'R']

function SkillsTab({ snapshot }: { snapshot: LiveSnapshot }) {
  const spent = ABILITY_KEYS.reduce((sum, k) => sum + snapshot.abilities[k], 0)
  return (
    <>
      <h2>Ability ranks</h2>
      {ABILITY_KEYS.map((key) => (
        <div key={key} className="ability">
          <span className="key">{key}</span>
          {Array.from({ length: key === 'R' ? 3 : 5 }, (_, i) => (
            <span key={i} className={`pip${i < snapshot.abilities[key] ? ' on' : ''}`} />
          ))}
        </div>
      ))}
      {spent < snapshot.level && (
        <p className="unspent">
          {snapshot.level - spent} unspent point{snapshot.level - spent > 1 ? 's' : ''}
        </p>
      )}
    </>
  )
}

function RunesTab({ snapshot }: { snapshot: LiveSnapshot }) {
  const { runes } = snapshot
  return (
    <>
      <h2>
        {runes.primaryTree?.name ?? '?'} / {runes.secondaryTree?.name ?? '?'}
      </h2>
      <ul className="runes">
        {runes.runes.map((r, i) => (
          <li key={r.id} className={i === 0 ? 'keystone' : ''}>
            {r.name}
          </li>
        ))}
      </ul>
    </>
  )
}
