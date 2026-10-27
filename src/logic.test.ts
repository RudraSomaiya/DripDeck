import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colorName, dominantColors, matches, norm, pickIndex, rank, removeItem, wearToday, withTags, type Db, type Item } from './logic.ts'

const item = (id: string, cat: Item['cat'], tags: string[], extra: Partial<Item> = {}): Item =>
  ({ id, cat, tags, hex: '#000000', added: 0, wears: 0, ...extra })

test('colour names', () => {
  assert.equal(colorName(250, 250, 248), 'white')
  assert.equal(colorName(25, 35, 85), 'navy')
  assert.equal(colorName(200, 30, 40), 'red')
})

test('the piece wins over the background', () => {
  // A 64px photo: `piece(x, y)` says whether that pixel is the piece or the background.
  const photo = (piece: (x: number, y: number) => boolean, fg: number[], bg: number[]) => {
    const px = new Uint8ClampedArray(64 * 64 * 4)
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) px.set(piece(x, y) ? [...fg, 255] : [...bg, 255], (y * 64 + x) * 4)
    return dominantColors(px, 64, 64).names
  }
  const white = [245, 245, 245], navy = [25, 35, 85], black = [20, 20, 20]
  assert.deepEqual(photo((x, y) => x > 12 && x < 52 && y > 8 && y < 58, navy, white), ['navy'])
  assert.deepEqual(photo((x, y) => Math.abs(Math.hypot(x - 32, y - 32) - 12) < 2, black, white), ['black']) // thin frames
  assert.deepEqual(photo(() => true, navy, white), ['navy']) // a close-up that fills the photo
  assert.deepEqual(photo((x, y) => x > 12 && x < 52 && y > 8 && y < 58, white, white), ['white']) // white on white
})

test('tags and search', () => {
  assert.equal(norm('  Party Wear! '), 'party-wear')
  assert.equal(withTags({}, ['party']).party.group, 'custom')
  const tee = item('a', 'tops', ['t-shirt', 'party', 'summer'])
  assert.ok(matches(tee, 'party sum'))
  assert.ok(matches(tee, 'tops'))
  assert.ok(!matches(tee, 'party winter'))
})

test('ranking skips the laundry and puts full matches first', () => {
  const now = '2026-10-24'
  const items = [
    item('one', 'tops', ['party']),
    item('both', 'tops', ['party', 'summer'], { worn: now }),
    item('wash', 'tops', ['party', 'summer'], { laundry: true }),
    item('jeans', 'bottoms', ['party']),
  ]
  assert.deepEqual(rank(items, 'tops', ['party', 'summer'], now).map(c => c.item.id), ['both', 'one'])
  assert.equal(pickIndex([1, 1, 1], () => 0), 0)
  assert.equal(pickIndex([1, 1, 1], () => 0.99), 2)
  assert.equal(pickIndex([0, 5, 0], () => 0.5), 1)
})

test('wearing a fit twice in a day counts once, and deleting a piece cleans up fits', () => {
  const db: Db = { items: [item('a', 'tops', []), item('b', 'bottoms', [])], fits: [], tags: {}, theme: '', font: '' }
  const once = wearToday(db, ['a', 'b'], ['party'], '2026-10-24')
  const twice = wearToday(once, ['b', 'a'], ['party'], '2026-10-24')
  assert.equal(twice.fits.length, 1)
  assert.deepEqual(twice.fits[0].worn, ['2026-10-24'])
  assert.deepEqual(twice.items.map(i => i.wears), [1, 1])
  assert.deepEqual(removeItem(twice, 'a').fits[0].items, ['b'])
  assert.equal(removeItem(removeItem(twice, 'a'), 'b').fits.length, 0)
})
