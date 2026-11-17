import { PropBuilder } from './blocks'
import { addSlinky } from './slinkyStyles'

/** How big a slinky is in someone's hand: a chunky toy. */
export const HAND_SLINKY_SCALE = 0.4

const cache = new Map()

/**
 * The merged geometry of slinky `id` at hand size, held upright in the palm. One geometry
 * per slinky, shared by every hand holding one.
 */
export function handSlinkyGeometry(id) {
  let geometry = cache.get(id)
  if (!geometry) {
    const p = new PropBuilder()
    // Upright, its lower half in the palm.
    addSlinky(p, id, { position: [0, -0.16, 0.06], scale: HAND_SLINKY_SCALE, rings: 9, low: true })
    geometry = p.build()
    cache.set(id, geometry)
  }
  return geometry
}

/** How big a practice slinky is: a little bigger than in the hand, to read from afar. */
export const PRACTICE_SLINKY_SCALE = 0.48
const practiceCache = new Map()

/**
 * The merged geometry of slinky `id` as it goes down the practice stairs: standing on its
 * foot, centred. One per slinky, shared by every practice toss.
 */
export function practiceSlinkyGeometry(id) {
  let geometry = practiceCache.get(id)
  if (!geometry) {
    const p = new PropBuilder()
    addSlinky(p, id, { scale: PRACTICE_SLINKY_SCALE, rings: 9, low: true })
    geometry = p.build()
    practiceCache.set(id, geometry)
  }
  return geometry
}
