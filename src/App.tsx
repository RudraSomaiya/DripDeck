import { useEffect, useState } from 'react'
import type { Db } from './logic'
import { loadDb, saveDb } from './store'
import { Closet } from './Closet'
import { Dress } from './Dress'
import { Fits } from './Fits'
import { Settings } from './Settings'
import { Icon, Mark, type IconName } from './ui'

export type Update = (change: (db: Db) => Db) => void
type View = 'closet' | 'dress' | 'fits' | 'settings'

const NAV: [View, string, IconName][] = [
  ['closet', 'Closet', 'hanger'],
  ['dress', 'Get dressed', 'shuffle'],
  ['fits', 'Saved fits', 'bookmark'],
  ['settings', 'Settings', 'sliders'],
]

export function App() {
  const [db, setDb] = useState<Db | null>(null)
  const [view, setView] = useState<View>('closet')
  const [query, setQuery] = useState('') // lives here so a tag on any screen can open the closet filtered by it
  const [error, setError] = useState('')

  // A wardrobe file that can't be read stops the app here, so it's never overwritten with an empty one.
  useEffect(() => {
    loadDb().then(setDb, e => setError(`Couldn't read data\\wardrobe.json: ${e}. Nothing was changed.`))
  }, [])
  useEffect(() => {
    if (db) saveDb(db).catch(e => setError(`Couldn't save your last change: ${e}`))
  }, [db])
  useEffect(() => {
    if (!db) return
    document.documentElement.dataset.theme = db.theme
    document.documentElement.dataset.font = db.font
  }, [db?.theme, db?.font])

  if (!db) return error ? <p className="fatal" role="alert">{error}</p> : null
  const update: Update = change => setDb(d => d && change(d))
  const showTag = (tag: string) => {
    setQuery(tag)
    setView('closet')
  }

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <p className="wordmark"><Mark />Dripdeck</p>
        {NAV.map(([id, label, icon]) => (
          <button key={id} className="nav-item" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      <main className="main" key={view}>
        {error && (
          <p className="error" role="alert">
            {error} <button className="link" onClick={() => setError('')}>Dismiss</button>
          </p>
        )}
        {view === 'closet' && <Closet db={db} update={update} query={query} setQuery={setQuery} onError={setError} />}
        {view === 'dress' && <Dress db={db} update={update} goCloset={() => setView('closet')} />}
        {view === 'fits' && <Fits db={db} update={update} showTag={showTag} />}
        {view === 'settings' && <Settings db={db} update={update} />}
      </main>
    </div>
  )
}
