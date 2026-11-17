import { BufferAttribute, BufferGeometry } from 'three'

/**
 * The shapes a slinky's coils can have. Each ring is a closed path (an outline in its own
 * XY plane, axis +Z, about 1 across - a few wobble in Z too) swept with a cross-section:
 * a rounded tube, a flat ribbon like a real metal slinky's, or a three-sided gem edge.
 *
 *   round  ribbon  chunky  wire  gem           - round coils, from classic to crystal
 *   square hex  triangle  diamond              - polygons, softly rounded
 *   star  star6  sun  spiky                    - stars, from five fat points to a dozen sharp ones
 *   flower  flower8  cloud  heart  crown       - petals, puffs, a heart and a wavy crown
 *
 * Geometry is made once per shape and detail (`low`: about a third of the triangles, for
 * the shop, hands and practice tosses) and shared by everything that draws that shape.
 * The same outlines draw the coils in the Slinkies panel (outline2D).
 */
const TAU = Math.PI * 2

/** A star-like radius round the circle: `n` lobes between `inner` and 1, `pow` how sharp. */
const lobes = (n, inner, pow) => (a) => inner + (1 - inner) * Math.pow(0.5 + 0.5 * Math.cos(n * a), pow)
/** A regular polygon's radius at angle `a` (corners at 1), softened towards a circle by `soft`. */
const polygon = (n, soft) => (a) => {
  const k = TAU / n
  const m = ((a % k) + k) % k
  const r = Math.cos(Math.PI / n) / Math.cos(m - Math.PI / n)
  return r * (1 - soft) + soft * Math.cos(Math.PI / n) * 1.04
}
/** Rounded square: a superellipse, its corners a little past the circle. */
const squircle = (a) => Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), -0.25) * 0.86

const polar = (r) => (t, out) => {
  const a = t * TAU
  const rr = r(a)
  out[0] = Math.cos(a) * rr
  out[1] = Math.sin(a) * rr
  out[2] = 0
  return out
}

function heart(t, out) {
  const T = t * TAU
  const s = Math.sin(T)
  out[0] = (16 * s * s * s) / 17
  out[1] = (13 * Math.cos(T) - 5 * Math.cos(2 * T) - 2 * Math.cos(3 * T) - Math.cos(4 * T)) / 17 + 0.18
  out[2] = 0
  return out
}

function crown(t, out) {
  const a = t * TAU
  out[0] = Math.cos(a)
  out[1] = Math.sin(a)
  out[2] = 0.2 * Math.sin(6 * a)
  return out
}

/**
 * Every shape: its path, path segments (full, low), cross-section - `round` (sides full,
 * low; radius `tube`), `rect` (`w` across the ring by `h` along its axis) or `tri` - and
 * whether its faces are flat-shaded (gems).
 */
export const RING_SHAPES = {
  round: { path: polar(() => 1), seg: [24, 10], section: 'round', sides: [5, 3], tube: 0.11 },
  ribbon: { path: polar(() => 1), seg: [28, 12], section: 'rect', w: 0.17, h: 0.045 },
  chunky: { path: polar(() => 0.96), seg: [24, 12], section: 'round', sides: [6, 4], tube: 0.18 },
  wire: { path: polar(() => 1), seg: [24, 10], section: 'round', sides: [4, 3], tube: 0.06 },
  gem: { path: polar(() => 1), seg: [10, 8], section: 'tri', tube: 0.16, faceted: true },
  square: { path: polar(squircle), seg: [32, 16], section: 'round', sides: [5, 3], tube: 0.1 },
  hex: { path: polar(polygon(6, 0.18)), seg: [36, 18], section: 'rect', w: 0.14, h: 0.07, faceted: true },
  triangle: { path: polar(polygon(3, 0.22)), seg: [30, 15], section: 'round', sides: [5, 3], tube: 0.1 },
  diamond: { path: polar(polygon(4, 0.12)), seg: [24, 12], section: 'tri', tube: 0.14, faceted: true },
  star: { path: polar(lobes(5, 0.6, 1.4)), seg: [40, 20], section: 'round', sides: [5, 3], tube: 0.095 },
  star6: { path: polar(lobes(6, 0.66, 1.6)), seg: [48, 24], section: 'round', sides: [5, 3], tube: 0.09 },
  sun: { path: polar(lobes(8, 0.76, 1.2)), seg: [48, 24], section: 'round', sides: [5, 3], tube: 0.09 },
  spiky: { path: polar(lobes(12, 0.74, 3)), seg: [72, 36], section: 'round', sides: [4, 3], tube: 0.075 },
  flower: { path: polar((a) => 0.7 + 0.3 * Math.pow(Math.abs(Math.cos(2.5 * a)), 0.7)), seg: [40, 20], section: 'round', sides: [5, 3], tube: 0.1 },
  flower8: { path: polar((a) => 0.78 + 0.22 * Math.pow(Math.abs(Math.cos(4 * a)), 0.7)), seg: [48, 24], section: 'round', sides: [5, 3], tube: 0.09 },
  cloud: { path: polar((a) => 0.84 + 0.16 * Math.pow(Math.abs(Math.cos(3 * a)), 0.45)), seg: [36, 18], section: 'round', sides: [6, 3], tube: 0.13 },
  heart: { path: heart, seg: [40, 20], section: 'round', sides: [5, 3], tube: 0.1 },
  crown: { path: crown, seg: [36, 18], section: 'round', sides: [5, 3], tube: 0.09 },
}

export const ringShape = (id) => RING_SHAPES[id] ?? RING_SHAPES.round

const p0 = [0, 0, 0]
const p1 = [0, 0, 0]
const p2 = [0, 0, 0]

/** The cross-section's corners: [u (out from the ring), v (along its axis)] pairs. */
function sectionOf(shape, low) {
  if (shape.section === 'rect') return [[shape.w, shape.h], [-shape.w, shape.h], [-shape.w, -shape.h], [shape.w, -shape.h]]
  const n = shape.section === 'tri' ? 3 : shape.sides[low ? 1 : 0]
  const out = []
  for (let j = 0; j < n; j += 1) {
    const a = (j / n) * TAU + (shape.section === 'tri' ? Math.PI / 2 : 0)
    out.push([Math.cos(a) * shape.tube, Math.sin(a) * shape.tube])
  }
  return out
}

const cache = new Map()

/**
 * Ring geometry for shape `id` (`low`: the lighter version), radius 1 about +Z, with a
 * white vertex colour (the toy material reads vertex colours; each ring's own colour is
 * its instance colour). Shared - never dispose it.
 */
export function ringGeometry(id, low = false) {
  const key = `${id}:${low ? 1 : 0}`
  let g = cache.get(key)
  if (g) return g
  const shape = ringShape(id)
  const segs = shape.seg[low ? 1 : 0]
  const section = sectionOf(shape, low)
  const n = section.length
  const pos = new Float32Array(segs * n * 3)
  for (let i = 0; i < segs; i += 1) {
    shape.path(i / segs, p0)
    shape.path(((i - 1 + segs) % segs) / segs, p1)
    shape.path(((i + 1) % segs) / segs, p2)
    // The path's direction, the way out from it (in the ring's plane) and its axis.
    let tx = p2[0] - p1[0]
    let ty = p2[1] - p1[1]
    let tz = p2[2] - p1[2]
    const tl = Math.hypot(tx, ty, tz) || 1
    tx /= tl
    ty /= tl
    tz /= tl
    // out = tangent x axis(0,0,1); axis' = out x tangent
    let ox = ty
    let oy = -tx
    const ol = Math.hypot(ox, oy) || 1
    ox /= ol
    oy /= ol
    const bx = oy * tz
    const by = -ox * tz
    const bz = ox * ty - oy * tx
    for (let j = 0; j < n; j += 1) {
      const [u, v] = section[j]
      const o = (i * n + j) * 3
      pos[o] = p0[0] + ox * u + bx * v
      pos[o + 1] = p0[1] + oy * u + by * v
      pos[o + 2] = p0[2] + bz * v
    }
  }
  const index = []
  for (let i = 0; i < segs; i += 1) {
    const i2 = (i + 1) % segs
    for (let j = 0; j < n; j += 1) {
      const j2 = (j + 1) % n
      const a = i * n + j
      const b = i2 * n + j
      const c = i2 * n + j2
      const d = i * n + j2
      index.push(a, b, d, b, c, d)
    }
  }
  g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setIndex(index)
  if (shape.faceted) g = g.toNonIndexed()
  g.computeVertexNormals()
  const count = g.getAttribute('position').count
  g.setAttribute('color', new BufferAttribute(new Float32Array(count * 3).fill(1), 3))
  g.computeBoundingSphere()
  cache.set(key, g)
  return g
}

/** Shape `id`'s outline as [x, y, z] points (`n` of them), for drawing it flat (SVG). */
export function outline2D(id, n = 48) {
  const shape = ringShape(id)
  const pts = []
  const p = [0, 0, 0]
  for (let i = 0; i < n; i += 1) {
    shape.path(i / n, p)
    pts.push([p[0], p[1], p[2]])
  }
  return pts
}
