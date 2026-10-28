import type { Update } from './App'
import { fmtDay, today, wearToday, type Db } from './logic'
import { photoUrl } from './store'
import { Tag } from './ui'

export function Fits({ db, update, showTag }: { db: Db; update: Update; showTag: (t: string) => void }) {
  const now = today()
  return (
    <>
      <header className="title-row">
        <h1>Saved fits</h1>
        <p className="muted">{db.fits.length} {db.fits.length === 1 ? 'fit' : 'fits'}</p>
      </header>
      {db.fits.length === 0 ? (
        <div className="empty">
          <h2>No saved fits yet</h2>
          <p>In Get dressed, save a combination you like or tap Wearing this today. It lands here.</p>
        </div>
      ) : (
        <ul className="fits">
          {db.fits.map(f => {
            const wornToday = f.worn.includes(now)
            return (
              <li key={f.id} className="fit">
                <div className="fit-photos">{f.items.map(id => <img key={id} src={photoUrl(id)} alt="" loading="lazy" />)}</div>
                <div className="tags">{f.moods.map(m => <Tag key={m} name={m} onClick={() => showTag(m)} />)}</div>
                <p className="muted">
                  {f.worn.length
                    ? `Worn ${f.worn.length} ${f.worn.length === 1 ? 'time' : 'times'}, last on ${fmtDay(f.worn[f.worn.length - 1])}`
                    : `Saved ${fmtDay(f.saved)}, not worn yet`}
                </p>
                <div className="row">
                  <button className="btn" disabled={wornToday} onClick={() => update(db => wearToday(db, f.items, f.moods, now))}>
                    {wornToday ? 'Wearing today' : 'Wear today'}
                  </button>
                  <button className="link" onClick={() => update(db => ({ ...db, fits: db.fits.filter(x => x.id !== f.id) }))}>Delete</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
