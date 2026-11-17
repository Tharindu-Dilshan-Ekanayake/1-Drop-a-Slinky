import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { RARITIES, TIRES } from '@shared/balance'

import { STYLE } from './materials'
import { ringGeometry } from './ringShapes'

/**
 * How each slinky looks, by slinky id (the ids are the template's tire ids, kept for
 * saves; names and stats live in shared/balance.js TIRES), and its AURA - every slinky has
 * one of its own, a glowing shell round it and particles, shown round your character, on
 * its stand in the shop and round the slinky itself as it flips down the stairs.
 *
 * Coils: `colors` and `pattern` paint the rings from the bottom up -
 *   stripes   colours in turn, ring by ring
 *   gradient  first colour at the bottom to the last at the top
 *   rainbow   the hue all the way round, bottom to top
 *   tri       three colours in turn
 * `styles` are the rings' surfaces (materials STYLE), taken in turn like the colours, and
 * `trail` the colour of its speed lines.
 *
 * Shape (ringShapes.js): `shape` is the coils' outline and edge - a flat metal ribbon, a
 * fat jelly tube, a fine wire, a gem; squares, hexagons, triangles, diamonds; stars, suns,
 * spikes; flowers, clouds, hearts, a wavy crown - `twist` turns each ring that much more
 * than the one below (radians: stars and squares stack into a spiral), `caps` paints the
 * end rings in a glowing accent colour, a size up, and `size` scales the whole coil.
 *
 * Aura (fx/auraMaterial.js draws it):
 *   shell     the pattern on the glowing shell (AURA_SHELLS)
 *   particle  the shape of its particles (AURA_PARTICLES)
 *   motion    how they move (AURA_MOTIONS)
 *   colors    three colours the pattern and particles mix
 * No two slinkies share the same shell, particle and motion together. Rarer slinkies get
 * a bigger, brighter aura with more particles (rarityAura).
 */
const S = STYLE
export const SLINKY_STYLES = {
  bicycle: { shape: 'ribbon', colors: ['#eef2f8', '#aeb8c8'], pattern: 'stripes', trail: '#dfe8f5', aura: { shell: 'pulse', particle: 'dot', motion: 'orbit', colors: ['#ffffff', '#cfe3ff', '#9fc4ff'] } },
  mountain: { shape: 'chunky', colors: ['#ff8fc8', '#ffd0e8'], pattern: 'stripes', trail: '#ff9fd0', aura: { shell: 'bubble', particle: 'ring', motion: 'rise', colors: ['#ff9fd8', '#ffd6f0', '#ffffff'] } },
  wood: { shape: 'square', twist: 0.13, colors: ['#8ce83a', '#f0ff6a'], pattern: 'stripes', trail: '#c8ff6a', aura: { shell: 'leaf', particle: 'leaf', motion: 'fall', colors: ['#7ae84a', '#d8ff7a', '#3fbf3a'] } },
  stone: { shape: 'crown', twist: 0.09, colors: ['#1f7fff', '#7fe6ff'], pattern: 'gradient', trail: '#5fd0ff', aura: { shell: 'water', particle: 'drop', motion: 'fall', colors: ['#2fa8ff', '#9ff0ff', '#ffffff'] } },
  cookie: { shape: 'sun', twist: 0.1, colors: ['#ff7a1a', '#ffd21f'], pattern: 'gradient', trail: '#ffc21f', aura: { shell: 'holy', particle: 'spark', motion: 'burst', colors: ['#ffb01a', '#fff0a0', '#ffffff'] } },
  pizza: { shape: 'ribbon', size: 1.02, colors: [], pattern: 'rainbow', trail: '#ffffff', aura: { shell: 'rainbow', particle: 'star', motion: 'orbit', colors: ['#ff5a5a', '#5aff8a', '#5a8aff'] } },
  donut: { shape: 'round', caps: '#3fdc6a', colors: ['#ff2a3a', '#ffffff'], pattern: 'stripes', trail: '#ff6a7a', aura: { shell: 'swirl', particle: 'square', motion: 'burst', colors: ['#ff3a4a', '#ffffff', '#ffd0d8'] } },
  watermelon: { shape: 'hex', twist: 0.16, colors: ['#bff4ff', '#5fc8ff', '#ffffff'], pattern: 'tri', trail: '#bff4ff', aura: { shell: 'frost', particle: 'snow', motion: 'fall', colors: ['#bff6ff', '#ffffff', '#5fb8ff'] } },
  monster: { shape: 'cloud', colors: ['#7dff2a', '#1d2a18'], styles: [S.GLOW, S.SMOOTH], pattern: 'stripes', trail: '#7dff2a', aura: { shell: 'toxic', particle: 'dot', motion: 'rise', colors: ['#7dff2a', '#d8ff5a', '#2a8a1a'] } },
  mint: { shape: 'spiky', twist: 0.12, colors: ['#ffe23a', '#1f2a6a'], styles: [S.GLOW, S.SMOOTH], pattern: 'stripes', trail: '#fff27a', aura: { shell: 'electric', particle: 'bolt', motion: 'burst', colors: ['#fff27a', '#7fd8ff', '#ffffff'] } },
  silver: { shape: 'flower8', twist: 0.18, colors: ['#ff3a1a', '#ff9a1a'], styles: [S.LAVA], pattern: 'stripes', trail: '#ff7a2a', aura: { shell: 'flame', particle: 'flame', motion: 'rise', colors: ['#ff3a0a', '#ffa01a', '#fff0a0'] } },
  ice: { shape: 'flower', twist: 0.22, colors: ['#ffb7d5', '#fff0f6'], pattern: 'stripes', trail: '#ffc8e0', aura: { shell: 'pulse', particle: 'petal', motion: 'fall', colors: ['#ff9fc8', '#ffe0ee', '#ffffff'] } },
  gold: { shape: 'gem', caps: '#ffffff', size: 1.02, colors: ['#ffe066', '#ffb01a'], styles: [S.GLOW], pattern: 'gradient', trail: '#ffe27a', aura: { shell: 'holy', particle: 'coin', motion: 'rise', colors: ['#ffd23a', '#fff3b0', '#ffb01a'] } },
  lava: { shape: 'wire', caps: '#c08aff', colors: ['#2a1a3a', '#8a4aff'], styles: [S.SMOOTH, S.GLOW], pattern: 'stripes', trail: '#9a5aff', aura: { shell: 'void', particle: 'dot', motion: 'spiral', colors: ['#9a4aff', '#3a0a6a', '#ff4aff'] } },
  platinum: { shape: 'square', colors: ['#ff3a6a', '#3aff8a', '#3a8aff'], styles: [S.GLOW], pattern: 'tri', trail: '#7affc0', aura: { shell: 'pixel', particle: 'square', motion: 'rise', colors: ['#ff3a6a', '#3aff8a', '#3a8aff'] } },
  emerald: { shape: 'diamond', twist: 0.25, colors: ['#3aff9a', '#0a8a4a'], styles: [S.GLOW, S.SMOOTH], pattern: 'gradient', trail: '#3aff9a', aura: { shell: 'crystal', particle: 'diamond', motion: 'orbit', colors: ['#3aff9a', '#bfffe0', '#0aa85a'] } },
  ruby: { shape: 'heart', size: 1.04, colors: ['#ff1a4a', '#ff9ab8'], styles: [S.GLOW], pattern: 'gradient', trail: '#ff5a7a', aura: { shell: 'heart', particle: 'heart', motion: 'rise', colors: ['#ff2a5a', '#ff9ab8', '#ffffff'] } },
  diamond: { shape: 'star6', twist: 0.1, colors: ['#f0fdff', '#9fe8ff'], styles: [S.GLOW], pattern: 'stripes', trail: '#bff6ff', aura: { shell: 'crystal', particle: 'spark', motion: 'orbit', colors: ['#bff6ff', '#ffffff', '#7fd8ff'] } },
  rainbow: { shape: 'triangle', twist: 0.3, size: 1.02, colors: ['#ffffff'], styles: [S.RAINBOW], pattern: 'stripes', trail: '#ffffff', aura: { shell: 'swirl', particle: 'diamond', motion: 'spiral', colors: ['#ff7aff', '#7affff', '#ffff7a'] } },
  unicorn: { shape: 'star', twist: 0.08, caps: '#ffffff', colors: ['#ffb8f0', '#b8e8ff', '#fff0b8'], styles: [S.GLOW], pattern: 'tri', trail: '#ffd8f8', aura: { shell: 'holy', particle: 'star', motion: 'float', colors: ['#ffb8f0', '#b8e8ff', '#fff0b8'] } },
  galaxy: { shape: 'chunky', caps: '#ffd23a', size: 1.04, colors: ['#ffffff'], styles: [S.GALAXY], pattern: 'stripes', trail: '#8a7aff', aura: { shell: 'galaxy', particle: 'star', motion: 'orbit', colors: ['#5a3aff', '#ff5ad8', '#ffffff'] } },
  dragon: { shape: 'spiky', twist: 0.2, caps: '#ffd21a', size: 1.05, colors: ['#d81a1a', '#ffc21a'], styles: [S.LAVA, S.GLOW], pattern: 'stripes', trail: '#ff6a1a', aura: { shell: 'flame', particle: 'spark', motion: 'spiral', colors: ['#ff2a0a', '#ffd21a', '#ff8a0a'] } },
  cosmic: { shape: 'crown', twist: 0.15, size: 1.04, colors: ['#3affff', '#ff3aff'], styles: [S.GLOW], pattern: 'gradient', trail: '#9affff', aura: { shell: 'galaxy', particle: 'moon', motion: 'orbit', colors: ['#ff5aff', '#5affff', '#ffffff'] } },
  infinity: { shape: 'ribbon', caps: '#ffffff', size: 1.06, colors: ['#ffc21a', '#fff27a'], styles: [S.GLOW], pattern: 'stripes', trail: '#ffe27a', aura: { shell: 'rainbow', particle: 'ring', motion: 'burst', colors: ['#ffd23a', '#ffffff', '#ff9a1a'] } },
  tide: { shape: 'crown', twist: 0.04, caps: '#ffffff', size: 1.08, colors: ['#16b8c4', '#e8ffff'], pattern: 'stripes', trail: '#5fe8f0', aura: { shell: 'water', particle: 'ring', motion: 'rise', colors: ['#16d8e4', '#bfffff', '#ffffff'] } },
  coral: { shape: 'flower', twist: 0.1, caps: '#ffd0c0', size: 1.05, colors: ['#ff6f61', '#ffc8b0'], pattern: 'gradient', trail: '#ff8f81', aura: { shell: 'pulse', particle: 'petal', motion: 'spiral', colors: ['#ff6f61', '#ffd0c0', '#ff9a8a'] } },
  sunset: { shape: 'hex', twist: 0.12, caps: '#ffd27a', size: 1.05, colors: ['#ff8a2a', '#8a3aff'], styles: [S.GLOW], pattern: 'gradient', trail: '#ff7aa8', aura: { shell: 'holy', particle: 'dot', motion: 'rise', colors: ['#ff9a3a', '#ff5aa8', '#8a5aff'] } },
  pirate: { shape: 'square', twist: 0.08, caps: '#ffc21a', size: 1.06, colors: ['#1a1a1f', '#ffc21a'], styles: [S.SMOOTH, S.GLOW], pattern: 'stripes', trail: '#ffc21a', aura: { shell: 'smoke', particle: 'coin', motion: 'burst', colors: ['#ffc21a', '#5a5a6a', '#fff0a0'] } },
  kraken: { shape: 'flower8', twist: 0.25, size: 1.08, colors: ['#5a1a8a', '#16b8a4'], styles: [S.GLOW], pattern: 'stripes', trail: '#16d8b4', aura: { shell: 'void', particle: 'drop', motion: 'spiral', colors: ['#16d8b4', '#5a1a8a', '#bfffef'] } },
  magma: { shape: 'gem', caps: '#fff0a0', size: 1.08, colors: ['#ff5a0a', '#ffe0a0'], styles: [S.LAVA, S.GLOW], pattern: 'stripes', trail: '#ffa02a', aura: { shell: 'flame', particle: 'flame', motion: 'spiral', colors: ['#fff0d0', '#ffb01a', '#ff3a0a'] } },
  storm: { shape: 'star6', twist: 0.22, caps: '#7fd8ff', size: 1.08, colors: ['#5a6a8a', '#7fd8ff'], styles: [S.SMOOTH, S.GLOW], pattern: 'stripes', trail: '#7fd8ff', aura: { shell: 'electric', particle: 'bolt', motion: 'orbit', colors: ['#7fd8ff', '#ffffff', '#3a5aff'] } },
  aurora: { shape: 'flower', twist: 0.14, size: 1.1, colors: ['#3affa8', '#a83aff'], styles: [S.GLOW], pattern: 'gradient', trail: '#7affd8', aura: { shell: 'swirl', particle: 'star', motion: 'fall', colors: ['#3affa8', '#a85aff', '#5affff'] } },
  phoenix: { shape: 'star', twist: 0.16, caps: '#fff6c0', size: 1.1, colors: ['#ff3a1a', '#ffd23a'], styles: [S.GLOW], pattern: 'gradient', trail: '#ffa03a', aura: { shell: 'flame', particle: 'petal', motion: 'rise', colors: ['#ffd23a', '#ff5a1a', '#fff6c0'] } },
  celestial: { shape: 'sun', twist: 0.06, caps: '#ffffff', size: 1.1, colors: ['#ffffff', '#ffe27a'], styles: [S.GLOW], pattern: 'stripes', trail: '#fff6c8', aura: { shell: 'holy', particle: 'spark', motion: 'spiral', colors: ['#ffffff', '#fff0a0', '#bfe6ff'] } },
  blackhole: { shape: 'triangle', twist: 0.4, caps: '#ff7aff', size: 1.1, colors: ['#ffffff', '#5a1aff'], styles: [S.GALAXY, S.GLOW], pattern: 'stripes', trail: '#7a3aff', aura: { shell: 'void', particle: 'ring', motion: 'implode', colors: ['#7a3aff', '#14002a', '#ff7aff'] } },
  omega: { shape: 'spiky', twist: 0.18, caps: '#ffffff', size: 1.12, colors: ['#ffffff'], styles: [S.RAINBOW, S.GLOW], pattern: 'stripes', trail: '#ffffff', aura: { shell: 'galaxy', particle: 'star', motion: 'burst', colors: ['#ffffff', '#ff7aff', '#7affff'] } },
}

/** Shell patterns, particle shapes and motions, by name: their index is the shader's id. */
export const AURA_SHELLS = ['pulse', 'bubble', 'leaf', 'water', 'holy', 'rainbow', 'swirl', 'frost', 'toxic', 'electric', 'flame', 'crystal', 'pixel', 'galaxy', 'void', 'smoke', 'heart']
export const AURA_PARTICLES = ['dot', 'star', 'heart', 'spark', 'flame', 'snow', 'square', 'leaf', 'bolt', 'ring', 'diamond', 'petal', 'drop', 'coin', 'moon']
export const AURA_MOTIONS = ['orbit', 'rise', 'fall', 'burst', 'spiral', 'float', 'implode']

/** How grand an aura is by the slinky's rarity: size, brightness, share of the particles. */
const RARITY_AURA = {
  common: { size: 0.85, intensity: 0.65, particles: 0.45 },
  uncommon: { size: 0.9, intensity: 0.72, particles: 0.55 },
  rare: { size: 0.95, intensity: 0.8, particles: 0.65 },
  epic: { size: 1, intensity: 0.88, particles: 0.75 },
  legendary: { size: 1.08, intensity: 0.95, particles: 0.85 },
  mythic: { size: 1.14, intensity: 1, particles: 0.9 },
  secret: { size: 1.2, intensity: 1.05, particles: 1 },
  divine: { size: 1.26, intensity: 1.1, particles: 1 },
  celestial: { size: 1.34, intensity: 1.18, particles: 1 },
}

const FALLBACK = SLINKY_STYLES.bicycle
export const slinkyStyle = (id) => SLINKY_STYLES[id] ?? FALLBACK
/** The colour a slinky's speed lines and stand glow take. */
export const slinkyTrail = (id) => slinkyStyle(id).trail
/** Its main colour, for anything tinted to match (labels, stands). */
export const slinkyColor = (id) => slinkyStyle(id).colors[0] ?? '#ffffff'

const TIRE_BY_ID = Object.fromEntries(TIRES.map((t) => [t.id, t]))

/** Everything an aura needs for slinky `id`, its ids resolved for the shader. */
export function auraOf(id) {
  const a = slinkyStyle(id).aura
  const grand = RARITY_AURA[TIRE_BY_ID[id]?.rarity] ?? RARITY_AURA.common
  return {
    shell: Math.max(0, AURA_SHELLS.indexOf(a.shell)),
    particle: Math.max(0, AURA_PARTICLES.indexOf(a.particle)),
    motion: Math.max(0, AURA_MOTIONS.indexOf(a.motion)),
    colors: a.colors,
    size: grand.size,
    intensity: grand.intensity,
    particles: grand.particles,
  }
}

/** The CSS colours of slinky `id`'s aura, for the shop and inventory cards. */
export const auraCss = (id) => slinkyStyle(id).aura.colors
/** The rarity colour of slinky `id` (for halos and cards). */
export const slinkyRarityColor = (id) => RARITIES[TIRE_BY_ID[id]?.rarity]?.color ?? '#ffffff'

const _hsl = new Color()
/** Ring `i` of `n`'s colour (a Color, written into `out`). */
export function ringColor(id, i, n, out = new Color()) {
  const s = slinkyStyle(id)
  const c = s.colors
  if (s.pattern === 'rainbow') return out.setHSL((i / Math.max(1, n)) * 0.85, 0.85, 0.6)
  if (s.pattern === 'gradient' && c.length > 1) {
    const t = n > 1 ? i / (n - 1) : 0
    return out.set(c[0]).lerp(_hsl.set(c[c.length - 1]), t)
  }
  return out.set(c[i % Math.max(1, c.length)] ?? '#ffffff')
}

/** Ring `i`'s surface style (materials STYLE). */
export function ringStyle(id, i) {
  const styles = slinkyStyle(id).styles
  if (!styles || styles.length === 0) return STYLE.SMOOTH
  return styles[i % styles.length]
}

/**
 * The coil's size at scale 1: ring radius (to the tube's middle), the tube's radius, how
 * tall the stack stands at rest and how many rings it has.
 */
export const COIL = { radius: 0.5, tube: 0.05, height: 0.86, rings: 11 }

/** How slinky `id`'s coils are shaped: { shape, twist, caps (or null), size }. */
export function slinkyLook(id) {
  const s = slinkyStyle(id)
  return { shape: s.shape ?? 'round', twist: s.twist ?? 0, caps: s.caps ?? null, size: s.size ?? 1 }
}
/** End rings stand this much bigger when the slinky has caps. */
export const CAP_SCALE = 1.1

const _qr = new Quaternion()
const _qt = new Quaternion()
const _qw = new Quaternion()
const _p = new Vector3()
const _one = new Vector3(1, 1, 1)
const _e = new Euler()
const _ax = new Vector3()
const _up = new Vector3(0, 1, 0)
const _color = new Color()
/** Lying flat (a ring stands in its XY plane, axis +Z). */
const FLAT = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))

/**
 * Adds one slinky of `id` at rest - a stack of rings in its shape and colours - to a
 * PropBuilder: its bottom ring at `position`, turned by `rotation` (Euler XYZ), at `scale`.
 * In its own frame it stands up +Y. `rings` (default COIL.rings) and `low` (lighter ring
 * geometry, for things seen small or many times over) trade detail for triangles.
 */
export function addSlinky(builder, id, { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, rings = COIL.rings, low = false } = {}) {
  const look = slinkyLook(id)
  const saved = builder.transform
  const placed = new Matrix4().compose(_p.fromArray(position), _qr.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2])), _one)
  builder.transform = saved ? new Matrix4().copy(saved).multiply(placed) : placed
  const step = COIL.height / Math.max(1, rings - 1)
  const geometry = ringGeometry(look.shape, low)
  for (let i = 0; i < rings; i += 1) {
    // A coil, not a pile of hoops: each ring tipped a little, the tip turning round the
    // stack - and turned about its own axis by the slinky's twist.
    const turn = i * 0.9
    _qt.setFromAxisAngle(_ax.set(Math.cos(turn), 0, Math.sin(turn)), 0.06)
    _qw.setFromAxisAngle(_up, i * look.twist)
    const q = new Quaternion().copy(_qt).multiply(_qw).multiply(FLAT)
    const rot = new Euler().setFromQuaternion(q)
    const end = look.caps && (i === 0 || i === rings - 1)
    if (end) _color.set(look.caps)
    else ringColor(id, i, rings, _color)
    const r = COIL.radius * scale * look.size * (end ? CAP_SCALE : 1)
    builder.add(geometry, {
      position: [0, (COIL.tube + i * step) * scale, 0],
      rotation: [rot.x, rot.y, rot.z],
      scale: [r, r, r],
      color: `#${_color.getHexString()}`,
      style: end ? STYLE.GLOW : ringStyle(id, i),
    })
  }
  builder.transform = saved
  return builder
}

export const SLINKY_IDS = TIRES.map((t) => t.id)
