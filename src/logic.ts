// Types, built-in lists and the pure logic. No browser or Tauri calls in here, so `npm test` runs it in Node.

export type Cat = keyof typeof CATS
export type Group = 'type' | 'occasion' | 'season' | 'style' | 'color' | 'custom'
export type Item = {
  id: string
  cat: Cat
  tags: string[]
  hex: string // main colour, for the swatch
  added: number
  wears: number
  worn?: string // last day worn, YYYY-MM-DD
  laundry?: boolean
}
export type Fit = { id: string; items: string[]; moods: string[]; saved: number; worn: string[] }
export type Tags = Record<string, { group: Group; card: boolean }>
export type Db = { items: Item[]; fits: Fit[]; tags: Tags; theme: string; font: string }

// Order matters: it's the order of the closet filters and of an outfit, head to toe.
export const CATS = {
  headwear: 'Headwear',
  eyewear: 'Eyewear',
  outerwear: 'Outerwear',
  tops: 'Tops',
  onepiece: 'One-pieces',
  bottoms: 'Bottoms',
  footwear: 'Footwear',
  bags: 'Bags',
  accessories: 'Accessories',
  other: 'Other',
}

export const TYPES: Record<Cat, string[]> = {
  headwear: ['cap', 'beanie', 'hat', 'bandana'],
  eyewear: ['sunglasses', 'glasses'],
  outerwear: ['jacket', 'denim-jacket', 'bomber', 'blazer', 'coat', 'shacket', 'cardigan'],
  tops: ['t-shirt', 'shirt', 'polo', 'hoodie', 'sweatshirt', 'sweater', 'tank-top', 'crop-top', 'kurta'],
  onepiece: ['dress', 'jumpsuit', 'co-ord'],
  bottoms: ['jeans', 'chinos', 'trousers', 'shorts', 'skirt', 'joggers', 'cargos'],
  footwear: ['sneakers', 'loafers', 'sandals', 'heels', 'boots', 'slides'],
  bags: ['tote', 'backpack', 'sling-bag'],
  accessories: ['watch', 'belt', 'chain', 'bracelet', 'ring', 'earrings'],
  other: [],
}

const MOODS = {
  occasion: ['casual', 'college', 'office', 'formal', 'party', 'date-night', 'wedding', 'festive', 'gym', 'beach', 'travel', 'lounge'],
  season: ['summer', 'winter', 'monsoon', 'all-season'],
  style: ['streetwear', 'minimal', 'old-money', 'y2k', 'ethnic', 'sporty', 'vintage'],
}

// Colour names a photo can be tagged with, and a typical clothing shade for each.
const PALETTE: [string, number, number, number][] = [
  ['black', 24, 24, 24],
  ['white', 242, 242, 240],
  ['grey', 140, 140, 140],
  ['beige', 214, 196, 160],
  ['brown', 112, 72, 44],
  ['red', 196, 32, 42],
  ['maroon', 112, 26, 38],
  ['pink', 236, 140, 178],
  ['orange', 232, 120, 40],
  ['yellow', 236, 200, 60],
  ['olive', 112, 112, 52],
  ['green', 46, 130, 72],
  ['teal', 24, 124, 124],
  ['blue', 44, 92, 190],
  ['light-blue', 150, 190, 230],
  ['navy', 28, 36, 82],
  ['purple', 110, 58, 150],
  ['lavender', 186, 168, 220],
]

// Mood tags show up as cards in Get dressed; types and colours don't, unless switched on in Settings.
export const DEFAULT_TAGS: Tags = Object.fromEntries([
  ...Object.values(TYPES).flat().map(t => [t, { group: 'type', card: false }]),
  ...Object.entries(MOODS).flatMap(([group, ts]) => ts.map(t => [t, { group, card: true }])),
  ...PALETTE.map(([name]) => [name, { group: 'color', card: false }]),
])

// Tags work like GitHub topics: lowercase, words joined by hyphens.
export const norm = (s: string) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 24)

// New tags become custom mood tags, so they show up as cards right away.
export const withTags = (tags: Tags, names: string[]): Tags =>
  names.every(n => tags[n]) ? tags : { ...tags, ...Object.fromEntries(names.filter(n => !tags[n]).map(n => [n, { group: 'custom', card: true }])) }

// Every word must match the start of one of the piece's tags or its category: "party sum" finds party + summer.
export const matches = (item: Item, query: string) =>
  query.split(/[\s,]+/).map(norm).filter(Boolean).every(w => item.cat.startsWith(w) || item.tags.some(t => t.startsWith(w)))

export function colorName(r: number, g: number, b: number) {
  let best = PALETTE[0][0], bestD = Infinity
  for (const [name, r2, g2, b2] of PALETTE) {
    const m = (r + r2) / 2, dr = r - r2, dg = g - g2, db = b - b2
    const d = (2 + m / 256) * dr * dr + 4 * dg * dg + (2 + (255 - m) / 256) * db * db // "redmean" distance
    if (d < bestD) { best = name; bestD = d }
  }
  return best
}

// ponytail: edge-vs-middle counting, not real segmentation. Good for a piece photographed on a plain
// background; a busy, patterned one can confuse it. The colour tags stay editable.
export function dominantColors(px: ArrayLike<number>, w: number, h: number) {
  const middle = new Map<string, number[]>() // name -> [count, r, g, b]
  const edge = new Map<string, number>()
  let ne = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2]
    const name = colorName(r, g, b), fx = x / w, fy = y / h
    if (fx < 0.12 || fx >= 0.88 || fy < 0.12 || fy >= 0.88) { edge.set(name, (edge.get(name) ?? 0) + 1); ne++ }
    else if (fx >= 0.25 && fx < 0.75 && fy >= 0.2 && fy < 0.8) {
      const c = middle.get(name) ?? [0, 0, 0, 0]
      c[0]++; c[1] += r; c[2] += g; c[3] += b
      middle.set(name, c)
    }
  }
  // The background is the colour filling most of the edges. The piece is the middle minus that colour,
  // unless the middle is nearly all that colour too (a white tee on a white sheet).
  const [bg, bgCount] = [...edge].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  const all = [...middle].sort((a, b) => b[1][0] - a[1][0])
  const fg = bgCount / (ne || 1) >= 0.5 ? all.filter(([n]) => n !== bg) : all
  const sum = (xs: typeof all) => xs.reduce((s, [, c]) => s + c[0], 0)
  const pool = sum(fg) >= 0.15 * sum(all) ? fg : all
  const keep = pool.filter(([, c], i) => i === 0 || c[0] >= 0.25 * sum(pool)).slice(0, 2)
  const [n, r, g, b] = keep[0]?.[1] ?? [1, 136, 136, 136]
  return { names: keep.map(([name]) => name), hex: '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('') }
}

export const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
export const fmtDay = (d: string | number) =>
  new Date(typeof d === 'number' ? d : `${d}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const daysSince = (day: string | undefined, now: string) => (day ? Math.round((Date.parse(now) - Date.parse(day)) / 864e5) : 30)

// Clean pieces in one category that share a picked mood: more moods matched first, then the longest unworn.
export function rank(items: Item[], cat: Cat, moods: string[], now: string) {
  return items
    .filter(i => i.cat === cat && !i.laundry)
    .map(item => ({ item, score: moods.filter(m => item.tags.includes(m)).length, days: daysSince(item.worn, now) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || b.days - a.days)
}

// Shuffle leans towards pieces that match more moods and pieces you haven't worn lately.
export const weight = (c: { score: number; days: number }) => 2 ** (c.score - 1) * (1 + Math.min(c.days, 30) / 10)

export function pickIndex(weights: number[], rand = Math.random) {
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  const i = weights.findIndex(w => (r -= w) < 0)
  return i < 0 ? weights.length - 1 : i
}

const sameFit = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id))

export function saveFit(db: Db, ids: string[], moods: string[]): Db {
  if (db.fits.some(f => sameFit(f.items, ids))) return db
  return { ...db, fits: [{ id: crypto.randomUUID(), items: ids, moods, saved: Date.now(), worn: [] }, ...db.fits] }
}

// Logs the fit (saving it if it's new) and counts a wear for each piece, once per day.
export function wearToday(db: Db, ids: string[], moods: string[], now: string): Db {
  const saved = saveFit(db, ids, moods)
  return {
    ...saved,
    fits: saved.fits.map(f => (sameFit(f.items, ids) && !f.worn.includes(now) ? { ...f, worn: [...f.worn, now] } : f)),
    items: saved.items.map(i => (ids.includes(i.id) && i.worn !== now ? { ...i, wears: i.wears + 1, worn: now } : i)),
  }
}

export function removeItem(db: Db, id: string): Db {
  return {
    ...db,
    items: db.items.filter(i => i.id !== id),
    fits: db.fits.map(f => ({ ...f, items: f.items.filter(x => x !== id) })).filter(f => f.items.length),
  }
}
