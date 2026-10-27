import { useEffect, useRef, useState } from 'react'
import type { Update } from './App'
import { CATS, TYPES, dominantColors, fmtDay, matches, norm, removeItem, withTags, type Cat, type Db, type Item, type Tags } from './logic'
import { deletePhoto, photoUrl, savePhoto } from './store'
import { Icon, Sheet, Tag } from './ui'

type Draft = { photo: Blob; url: string; colors: string[]; hex: string }
type Filter = Cat | 'all' | 'laundry'

// Shrinks the photo to 1000px WebP and reads its main colours from a 64px copy.
async function readPhoto(file: File): Promise<Draft> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, 1000 / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s))
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const tiny = new OffscreenCanvas(64, 64).getContext('2d')!
  tiny.drawImage(bmp, 0, 0, 64, 64)
  const { names, hex } = dominantColors(tiny.getImageData(0, 0, 64, 64).data, 64, 64)
  const photo = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
  return { photo, url: URL.createObjectURL(photo), colors: names, hex }
}

type Props = { db: Db; update: Update; query: string; setQuery: (q: string) => void; onError: (e: string) => void }

export function Closet({ db, update, query, setQuery, onError }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [dropping, setDropping] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const lastCat = useRef<Cat>('tops') // a batch of tees shouldn't need Tops picked every time

  async function add(files: File[]) {
    const bad: string[] = []
    for (const f of files.filter(f => f.type.startsWith('image/'))) {
      try {
        const d = await readPhoto(f)
        setDrafts(q => [...q, d])
      } catch {
        bad.push(f.name)
      }
    }
    if (bad.length) onError(`Couldn't read ${bad.join(', ')}. Save ${bad.length > 1 ? 'them' : 'it'} as JPG or PNG and add again.`)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) add(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const next = () =>
    setDrafts(([d, ...rest]) => {
      URL.revokeObjectURL(d.url)
      return rest
    })

  async function save(d: Draft, cat: Cat, tags: string[]) {
    const id = crypto.randomUUID()
    try {
      await savePhoto(id, d.photo) // photo first, so a piece never points at a missing file
    } catch (e) {
      return onError(`Couldn't save the photo: ${e}`)
    }
    lastCat.current = cat
    update(db => ({ ...db, items: [{ id, cat, tags, hex: d.hex, added: Date.now(), wears: 0 }, ...db.items], tags: withTags(db.tags, tags) }))
    next()
  }

  async function remove(id: string) {
    setOpenId(null)
    update(db => removeItem(db, id))
    await deletePhoto(id).catch(e => onError(`The piece is gone, but its photo couldn't be deleted: ${e}`))
  }

  const count = (f: Filter) => (f === 'all' ? db.items.length : db.items.filter(i => (f === 'laundry' ? i.laundry : i.cat === f)).length)
  const filters = (['all', ...Object.keys(CATS), 'laundry'] as Filter[]).filter(f => f === 'all' || count(f))
  const active = filters.includes(filter) ? filter : 'all'
  const shown = db.items.filter(i => (active === 'all' || (active === 'laundry' ? i.laundry : i.cat === active)) && matches(i, query))
  const open = db.items.find(i => i.id === openId)

  return (
    <section
      className={dropping ? 'closet dropping' : 'closet'}
      onDragOver={e => {
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={e => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
      onDrop={e => {
        e.preventDefault()
        setDropping(false)
        add([...e.dataTransfer.files])
      }}
    >
      <header className="title-row">
        <h1>Closet</h1>
        <p className="muted">{db.items.length} {db.items.length === 1 ? 'piece' : 'pieces'}</p>
        <button className="btn primary push" onClick={() => picker.current?.click()}>
          <Icon name="plus" />
          Add pieces
        </button>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            add(files)
          }}
        />
      </header>

      {db.items.length === 0 ? (
        <div className="empty">
          <h2>Start with the clothes you wear most</h2>
          <p>Drop photos here, paste one, or pick them from a folder. A plain background helps the colours come out right.</p>
          <button className="btn primary" onClick={() => picker.current?.click()}>Add pieces</button>
        </div>
      ) : (
        <>
          <label className="search">
            <Icon name="search" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tags, like party summer" aria-label="Search tags" />
            {query && (
              <button className="tag-x" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="x" size={16} />
              </button>
            )}
          </label>
          <div className="filters" role="group" aria-label="Category">
            {filters.map(f => (
              <button key={f} className="filter" aria-pressed={active === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'laundry' ? 'In the wash' : CATS[f]}
                <span>{count(f)}</span>
              </button>
            ))}
          </div>
          {active === 'laundry' && (
            <p className="note">
              Back from the wash?{' '}
              <button className="link" onClick={() => update(db => ({ ...db, items: db.items.map(i => ({ ...i, laundry: false })) }))}>
                Mark everything clean
              </button>
            </p>
          )}
          {shown.length ? (
            <div className="grid">
              {shown.map(i => <Piece key={i.id} item={i} tags={db.tags} onOpen={() => setOpenId(i.id)} />)}
            </div>
          ) : (
            <p className="muted">Nothing matches {query ? `“${query}”` : 'this filter'}.</p>
          )}
        </>
      )}

      {drafts[0] && (
        <NewPiece
          key={drafts[0].url}
          draft={drafts[0]}
          known={db.tags}
          startCat={lastCat.current}
          left={drafts.length - 1}
          onSave={(cat, tags) => save(drafts[0], cat, tags)}
          onSkip={next}
        />
      )}
      {open && (
        <EditPiece
          item={open}
          known={db.tags}
          update={update}
          onClose={() => setOpenId(null)}
          onDelete={() => remove(open.id)}
          onTag={t => {
            setQuery(t)
            setFilter('all')
            setOpenId(null)
          }}
        />
      )}
    </section>
  )
}

function Piece({ item, tags, onOpen }: { item: Item; tags: Tags; onOpen: () => void }) {
  const name = item.tags.find(t => tags[t]?.group === 'type') ?? CATS[item.cat]
  return (
    <button className="piece" onClick={onOpen} aria-label={[name, ...item.tags.filter(t => t !== name)].join(', ')}>
      <img src={photoUrl(item.id)} alt="" loading="lazy" />
      {item.laundry && <span className="badge">In the wash</span>}
      <span className="piece-cap">
        <span className="dot" style={{ background: item.hex }} />
        {name}
      </span>
    </button>
  )
}

type DraftProps = { draft: Draft; known: Tags; startCat: Cat; left: number; onSave: (cat: Cat, tags: string[]) => Promise<void>; onSkip: () => void }

function NewPiece({ draft, known, startCat, left, onSave, onSkip }: DraftProps) {
  const [cat, setCat] = useState(startCat)
  const [tags, setTags] = useState(draft.colors)
  const [busy, setBusy] = useState(false)
  return (
    <Sheet label="New piece" onClose={onSkip}>
      <img className="sheet-photo" src={draft.url} alt="The new piece" />
      <div className="sheet-form">
        <h2>New piece</h2>
        <Fields cat={cat} tags={tags} known={known} setCat={setCat} setTags={setTags} />
        <div className="sheet-actions">
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              onSave(cat, tags).finally(() => setBusy(false))
            }}
          >
            Save piece
          </button>
          <button className="btn" onClick={onSkip}>Skip</button>
          {left > 0 && <p className="muted">{left} more after this</p>}
        </div>
      </div>
    </Sheet>
  )
}

type EditProps = { item: Item; known: Tags; update: Update; onClose: () => void; onDelete: () => void; onTag: (t: string) => void }

function EditPiece({ item, known, update, onClose, onDelete, onTag }: EditProps) {
  const [sure, setSure] = useState(false)
  const set = (change: Partial<Item>) =>
    update(db => ({
      ...db,
      items: db.items.map(i => (i.id === item.id ? { ...i, ...change } : i)),
      tags: change.tags ? withTags(db.tags, change.tags) : db.tags,
    }))
  return (
    <Sheet label="Piece" onClose={onClose}>
      <img className="sheet-photo" src={photoUrl(item.id)} alt="" />
      <div className="sheet-form">
        <Fields cat={item.cat} tags={item.tags} known={known} setCat={cat => set({ cat })} setTags={tags => set({ tags })} onTag={onTag} />
        <label className="check">
          <input type="checkbox" checked={!!item.laundry} onChange={e => set({ laundry: e.target.checked })} />
          In the wash
        </label>
        <p className="muted">{item.worn ? `Worn ${item.wears} ${item.wears === 1 ? 'time' : 'times'}, last on ${fmtDay(item.worn)}` : 'Not worn yet'}</p>
        <div className="sheet-actions">
          <button className="btn primary" onClick={onClose}>Done</button>
          <button className={sure ? 'btn danger' : 'btn'} onClick={() => (sure ? onDelete() : setSure(true))}>
            {sure ? 'Delete for good' : 'Delete'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

type FieldProps = { cat: Cat; tags: string[]; known: Tags; setCat: (c: Cat) => void; setTags: (t: string[]) => void; onTag?: (t: string) => void }

function Fields({ cat, tags, known, setCat, setTags, onTag }: FieldProps) {
  const [text, setText] = useState('')
  const q = norm(text)
  const add = (t: string) => {
    if (t && !tags.includes(t)) setTags([...tags, t])
    setText('')
  }
  // This category's types first, then moods, then everything else.
  const moods = Object.keys(known).filter(t => known[t].card)
  const ideas = [...new Set([...TYPES[cat], ...moods, ...Object.keys(known)])].filter(t => !tags.includes(t) && t.startsWith(q)).slice(0, q ? 12 : 16)
  return (
    <>
      <div className="field">
        <h3>Category</h3>
        <div className="cats">
          {(Object.keys(CATS) as Cat[]).map(c => (
            <button key={c} type="button" className="filter" aria-pressed={c === cat} onClick={() => setCat(c)}>{CATS[c]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <h3>Tags</h3>
        {tags.length > 0 && (
          <div className="tags">
            {tags.map(t => <Tag key={t} name={t} on onClick={onTag && (() => onTag(t))} onRemove={() => setTags(tags.filter(x => x !== t))} />)}
          </div>
        )}
        <input
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(q)
            }
          }}
          placeholder="Type a tag and press Enter"
          aria-label="New tag"
        />
        <div className="tags">
          {q && !known[q] && !tags.includes(q) && <Tag name={`+ ${q}`} onClick={() => add(q)} />}
          {ideas.map(t => <Tag key={t} name={t} onClick={() => add(t)} />)}
        </div>
      </div>
    </>
  )
}
