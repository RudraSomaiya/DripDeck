import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import type { Update } from './App'
import { CATS, pickIndex, rank, saveFit, today, wearToday, weight, type Cat, type Db } from './logic'
import { photoUrl } from './store'
import { Icon, Tag } from './ui'

export function Dress({ db, update, goCloset }: { db: Db; update: Update; goCloset: () => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [building, setBuilding] = useState(false)
  return building ? (
    <Builder db={db} update={update} moods={picked} back={() => setBuilding(false)} />
  ) : (
    <Picker db={db} picked={picked} setPicked={setPicked} onGo={() => setBuilding(true)} goCloset={goCloset} />
  )
}

type PickerProps = { db: Db; picked: string[]; setPicked: (m: string[]) => void; onGo: () => void; goCloset: () => void }

function Picker({ db, picked, setPicked, onGo, goCloset }: PickerProps) {
  // Mood tags that are on at least one piece, most used first.
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const i of db.items) for (const t of i.tags) c.set(t, (c.get(t) ?? 0) + 1)
    return c
  }, [db.items])
  const moods = useMemo(
    () => Object.keys(db.tags).filter(t => db.tags[t].card && counts.get(t)).sort((a, b) => counts.get(b)! - counts.get(a)!),
    [db.tags, counts],
  )
  // A skipped card goes to the back of the deck; `n` gives it a new key so it animates out and back in.
  const [order, setOrder] = useState(() => moods.map(tag => ({ tag, n: 0 })))
  const exit = useRef<1 | -1>(1)
  const deck = order.filter(c => !picked.includes(c.tag))

  function swipe(dir: 1 | -1) {
    const top = deck[0]
    if (!top) return
    exit.current = dir
    if (dir === 1) setPicked([...picked, top.tag])
    else setOrder(o => [...o.filter(c => c !== top), { tag: top.tag, n: top.n + 1 }])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, dialog')) return
      if (e.key === 'ArrowRight') swipe(1)
      else if (e.key === 'ArrowLeft') swipe(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!moods.length)
    return (
      <>
        <header className="title-row"><h1>Get dressed</h1></header>
        <div className="empty">
          <h2>No moods yet</h2>
          <p>Tag a few pieces with moods like party, beach or office. Every mood becomes a card here.</p>
          <button className="btn primary" onClick={goCloset}>Go to closet</button>
        </div>
      </>
    )

  const toggle = (m: string) => setPicked(picked.includes(m) ? picked.filter(x => x !== m) : [...picked, m])
  return (
    <div className="picker">
      <header className="picker-head">
        <h1>What's the vibe?</h1>
        <p>Swipe right on every mood you're feeling and left to skip. Pick as many as you like.</p>
      </header>
      <div className="deck-wrap">
        <div className="deck">
          {!deck.length && <p className="muted">That's every mood.</p>}
          <AnimatePresence custom={exit.current}>
            {deck
              .slice(0, 3)
              .map((c, depth) => (
                <MoodCard
                  key={`${c.tag}-${c.n}`}
                  tag={c.tag}
                  count={counts.get(c.tag)!}
                  photos={db.items.filter(i => i.tags.includes(c.tag)).slice(0, 3).map(i => i.id)}
                  depth={depth}
                  onSwipe={swipe}
                />
              ))
              .reverse()}
          </AnimatePresence>
        </div>
        <div className="deck-actions">
          <button className="round" onClick={() => swipe(-1)} disabled={!deck.length} aria-label="Skip this mood"><Icon name="x" size={26} /></button>
          <button className="round in" onClick={() => swipe(1)} disabled={!deck.length} aria-label="Pick this mood"><Icon name="check" size={26} /></button>
        </div>
        <p className="keys" aria-hidden="true"><kbd>←</kbd> skip <kbd>→</kbd> pick</p>
      </div>
      <div className="picker-side">
        <h2>{picked.length ? `${picked.length} picked` : 'Or tap the moods'}</h2>
        <div className="tags">{moods.map(m => <Tag key={m} name={m} on={picked.includes(m)} onClick={() => toggle(m)} />)}</div>
        <button className="btn primary" disabled={!picked.length} onClick={onGo}>Show fits</button>
      </div>
    </div>
  )
}

type CardProps = { tag: string; count: number; photos: string[]; depth: number; onSwipe: (dir: 1 | -1) => void }

// A mood as a swing tag. Drag physics adapted from Skilldeck's cards.
function MoodCard({ tag, count, photos, depth, onSwipe }: CardProps) {
  const reduce = useReducedMotion() ?? false
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 240], reduce ? [0, 0] : [-14, 14])
  const inInk = useTransform(x, [24, 110], [0, 1])
  const nahInk = useTransform(x, [-110, -24], [1, 0])
  const top = depth === 0
  return (
    <motion.article
      className={top ? 'mood top' : 'mood'}
      aria-hidden={!top}
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={reduce ? { opacity: 0 } : { y: depth * 14 + 28, scale: 0.88, opacity: 0 }}
      animate={{ y: depth * 14, scale: 1 - depth * 0.05, opacity: 1 }}
      variants={{
        gone: (dir: 1 | -1) =>
          reduce
            ? { opacity: 0, transition: { duration: 0.15 } }
            : { x: dir * (window.innerWidth + 320), rotate: dir * 24, transition: { duration: 0.32, ease: [0.3, 0, 1, 1] } },
      }}
      exit="gone"
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      drag={top ? 'x' : false}
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 520, bounceDamping: 18 }}
      whileDrag={{ scale: 1.03 }}
      onDragEnd={(_, i) => {
        if (Math.abs(i.offset.x) > 110 || Math.abs(i.velocity.x) > 650) onSwipe(i.offset.x + i.velocity.x * 0.1 > 0 ? 1 : -1)
      }}
    >
      {top && (
        <svg className="mood-string" viewBox="0 0 44 88" aria-hidden="true">
          <path d="M22 86C22 60 6 52 10 34S36 14 30 0" />
        </svg>
      )}
      <div className="mood-face">
        <h2 className="mood-name" style={{ '--len': Math.max(...tag.split('-').map(w => w.length)) } as CSSProperties}>{tag}</h2>
        <p className="mood-count">{count} {count === 1 ? 'piece' : 'pieces'}</p>
        <div className="mood-photos">{photos.map(id => <img key={id} src={photoUrl(id)} alt="" draggable={false} />)}</div>
        <motion.span className="stamp in" style={{ opacity: inInk }}>In</motion.span>
        <motion.span className="stamp nah" style={{ opacity: nahInk }}>Nah</motion.span>
      </div>
    </motion.article>
  )
}

// An outfit head to toe, laid out like a flat lay that fits one screen.
const ROWS: Cat[][] = [['headwear', 'eyewear'], ['outerwear', 'tops', 'onepiece', 'bottoms'], ['footwear', 'bags', 'accessories']]
const BIG: Cat[] = ['outerwear', 'tops', 'onepiece', 'bottoms']

function Builder({ db, update, moods, back }: { db: Db; update: Update; moods: string[]; back: () => void }) {
  const reduce = useReducedMotion() ?? false
  const lists = useMemo(() => {
    const now = today()
    return Object.fromEntries(ROWS.flat().map(c => [c, rank(db.items, c, moods, now)])) as Record<Cat, ReturnType<typeof rank>>
  }, [db.items, moods])
  const has = (c: Cat) => lists[c].length > 0
  // A one-piece replaces top and bottom, so it starts switched off when there are tops or bottoms.
  const [off, setOff] = useState(() => new Set<Cat>(has('tops') || has('bottoms') ? ['onepiece'] : []))
  const [locked, setLocked] = useState(new Set<Cat>())
  // Picks are piece ids, not positions: logging a wear re-sorts the lists, and the fit on screen must stay put.
  const [pick, setPick] = useState<Partial<Record<Cat, string>>>({})
  const [round, setRound] = useState(0)
  const [note, setNote] = useState('')
  const shuffled = useRef(true) // only a shuffle cascades; stepping one slot moves just that slot

  const index = (c: Cat) => Math.max(0, lists[c].findIndex(x => x.item.id === pick[c]))
  const shuffle = () => {
    shuffled.current = true
    setPick(p =>
      Object.fromEntries(ROWS.flat().filter(has).map(c => [c, locked.has(c) && p[c] ? p[c] : lists[c][pickIndex(lists[c].map(weight))].item.id])),
    )
    setRound(r => r + 1)
  }
  useEffect(shuffle, []) // deal a first fit straight away

  const step = (c: Cat, d: 1 | -1) => {
    shuffled.current = false
    const list = lists[c]
    setPick(p => ({ ...p, [c]: list[(index(c) + d + list.length) % list.length].item.id }))
  }
  const flip = (set: Set<Cat>, c: Cat) => {
    const s = new Set(set)
    if (!s.delete(c)) s.add(c)
    return s
  }
  const toggleSlot = (c: Cat) =>
    setOff(prev => {
      const s = flip(prev, c)
      if (!s.has(c) && c === 'onepiece') s.add('tops').add('bottoms')
      if (!s.has(c) && (c === 'tops' || c === 'bottoms')) s.add('onepiece')
      return s
    })

  const shown = ROWS.flat().filter(c => has(c) && !off.has(c))
  const ids = shown.map(c => lists[c][index(c)].item.id)
  const hidden = ROWS.flat().filter(c => has(c) && off.has(c))
  const missing = (['tops', 'bottoms', 'footwear'] as Cat[]).filter(c => !has(c))
  const act = (change: (db: Db) => Db, text: string) => {
    update(change)
    setNote(text)
    setTimeout(() => setNote(''), 2400)
  }

  return (
    <div className="builder">
      <div className="builder-side">
        <h1>{moods.join(' + ')}</h1>
        <button className="link" onClick={back}>Change the vibe</button>
        <div className="row">
          <button className="btn primary" onClick={shuffle} disabled={!ids.length}><Icon name="shuffle" />Shuffle</button>
          <button className="btn" disabled={!ids.length} onClick={() => act(db => saveFit(db, ids, moods), 'Saved to your fits')}>
            Save fit
          </button>
        </div>
        <button className="btn" disabled={!ids.length} onClick={() => act(db => wearToday(db, ids, moods, today()), 'Logged for today')}>
          Wearing this today
        </button>
        <p className="note" role="status">{note}</p>
        {hidden.length > 0 && (
          <div className="tags">
            {hidden.map(c => <Tag key={c} name={`+ ${CATS[c]}`} onClick={() => toggleSlot(c)} />)}
          </div>
        )}
        {missing.length > 0 && (
          <p className="muted">Nothing in {missing.map(c => CATS[c].toLowerCase()).join(', ')} is tagged {moods.join(' or ')} yet.</p>
        )}
        <p className="muted">Lock what you like, shuffle the rest. Pieces in the wash stay out.</p>
      </div>

      <div className="slots">
        {ROWS.map((row, r) => {
          const cats = row.filter(c => shown.includes(c))
          if (!cats.length) return null
          return (
            <div className="slot-row" key={r}>
              {cats.map((c, i) => {
                const list = lists[c], n = index(c), item = list[n].item, isLocked = locked.has(c), name = CATS[c].toLowerCase()
                return (
                  <section key={c} className={`slot${BIG.includes(c) ? ' big' : ''}${isLocked ? ' locked' : ''}`} aria-label={CATS[c]}>
                    <div className="slot-stage">
                      <motion.img
                        key={isLocked ? item.id : `${item.id}-${round}`}
                        className="slot-img"
                        src={photoUrl(item.id)}
                        alt={item.tags.join(', ')}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, rotate: -3 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 26, delay: shuffled.current ? (r * 2 + i) * 0.035 : 0 }}
                      />
                      <span className="slot-count">{n + 1} of {list.length}</span>
                      {list.length > 1 && (
                        <>
                          <button className="slot-arrow prev" onClick={() => step(c, -1)} aria-label={`Previous ${name}`}><Icon name="left" /></button>
                          <button className="slot-arrow next" onClick={() => step(c, 1)} aria-label={`Next ${name}`}><Icon name="right" /></button>
                        </>
                      )}
                    </div>
                    <div className="slot-bar">
                      <span className="slot-name">{CATS[c]}</span>
                      <button className="icon-btn" aria-pressed={isLocked} onClick={() => setLocked(s => flip(s, c))} aria-label={`Lock ${name}`}>
                        <Icon name={isLocked ? 'lock' : 'unlock'} size={18} />
                      </button>
                      <button className="icon-btn" onClick={() => toggleSlot(c)} aria-label={`Leave out ${name}`}><Icon name="x" size={18} /></button>
                    </div>
                  </section>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
