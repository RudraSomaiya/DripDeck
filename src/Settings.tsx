import { useEffect, useState } from 'react'
import type { Update } from './App'
import type { Db, Group } from './logic'
import { dataFolder, openDataFolder } from './store'
import { Icon, Tag } from './ui'

// The colours live in styles.css under [data-theme] and [data-font]; the previews below read them from there.
const THEMES = [
  ['old-money', 'Old Money'],
  ['barbiecore', 'Barbiecore'],
  ['clean-girl', 'Clean Girl'],
  ['matcha', 'Matcha'],
  ['y2k', 'Y2K'],
  ['coastal', 'Coastal'],
  ['mob-wife', 'Mob Wife'],
  ['goth', 'Goth'],
]
const FONTS = [
  ['editorial', 'Editorial', 'Syne and Manrope'],
  ['loud', 'Loud', 'Anton and Manrope'],
  ['soft', 'Soft', 'Nunito'],
  ['luxe', 'Luxe', 'Cormorant and Manrope'],
  ['clean', 'Clean', 'Outfit'],
  ['techy', 'Techy', 'Space Grotesk'],
]
const GROUPS: [Group, string][] = [
  ['occasion', 'Occasions'],
  ['season', 'Seasons'],
  ['style', 'Styles'],
  ['custom', 'Your tags'],
  ['type', 'Types'],
  ['color', 'Colours'],
]

export function Settings({ db, update }: { db: Db; update: Update }) {
  const [folder, setFolder] = useState('')
  useEffect(() => {
    dataFolder().then(setFolder)
  }, [])
  const used = new Set(db.items.flatMap(i => i.tags))
  const setTag = (t: string, card: boolean) => update(d => ({ ...d, tags: { ...d.tags, [t]: { ...d.tags[t], card } } }))
  const dropTag = (t: string) => update(d => ({ ...d, tags: Object.fromEntries(Object.entries(d.tags).filter(([k]) => k !== t)) }))

  return (
    <>
      <header className="title-row"><h1>Settings</h1></header>

      <section className="setting">
        <h2>Theme</h2>
        <div className="choices">
          {THEMES.map(([id, name]) => (
            <button key={id} className="choice" aria-pressed={db.theme === id} onClick={() => update(d => ({ ...d, theme: id }))}>
              <span className="preview" data-theme={id}><i /><i /><i /></span>
              {name}
            </button>
          ))}
        </div>
      </section>

      <section className="setting">
        <h2>Font</h2>
        <div className="choices">
          {FONTS.map(([id, name, faces]) => (
            <button key={id} className="choice" aria-pressed={db.font === id} onClick={() => update(d => ({ ...d, font: id }))}>
              <span className="font-sample" data-font={id}>Aa</span>
              <span>{name}<small>{faces}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="setting">
        <h2>Mood cards</h2>
        <p>Highlighted tags show up as cards in Get dressed. Tap a tag to switch it on or off.</p>
        {GROUPS.map(([group, label]) => {
          const names = Object.keys(db.tags).filter(t => db.tags[t].group === group)
          return (
            names.length > 0 && (
              <div key={group} className="tag-group">
                <h3>{label}</h3>
                <div className="tags">
                  {names.map(t => (
                    <Tag
                      key={t}
                      name={t}
                      on={db.tags[t].card}
                      onClick={() => setTag(t, !db.tags[t].card)}
                      onRemove={group === 'custom' && !used.has(t) ? () => dropTag(t) : undefined}
                    />
                  ))}
                </div>
              </div>
            )
          )
        })}
      </section>

      <section className="setting">
        <h2>Your data</h2>
        <p>Photos and tags are saved in this folder, next to the app. Copy the folder to back up your wardrobe or to move it to another PC.</p>
        {folder ? <p className="path">{folder}</p> : <p className="muted">This is a browser preview, so nothing is saved.</p>}
        <button className="btn" disabled={!folder} onClick={() => openDataFolder()}><Icon name="folder" />Open folder</button>
      </section>
    </>
  )
}
