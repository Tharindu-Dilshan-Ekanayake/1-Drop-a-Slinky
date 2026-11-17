import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { mulberry32 } from '@shared/rng'
import { PLAZA } from '@shared/world'

import { BlockSet, toColor } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { venueOf } from '../sceneStyle'
import { DECOR, themeOf } from './stageThemes'
import { RISE, RUN, STAIR_HALF } from './stairsPath'

/**
 * Building the Great Staircase's boxes (Stairs.jsx draws them): the mountain under the
 * lobby, and a window of steps with everything round them. Plain functions over an
 * InstancedMesh, no React, so they can be checked outside the browser too.
 */

/** The hillside and its scenery are built in patches this many steps long. */
export const CHUNK = 4
/** Steps in a stage gate's span between pillars, and how tall. */
const GATE_H = 7.5
/** Room in the pool: steps x4, hillside, scenery, gates, mountains, the ramp. */
export const MAX_BOXES = 2600
/** Width of the hillside either side, from the kerb out. */
const SIDE = 30

/** 3 x 5 pixel digits for the stage numbers on the gates. */
const DIGITS = [
  ['111', '101', '101', '101', '111'],
  ['010', '110', '010', '010', '111'],
  ['111', '001', '111', '100', '111'],
  ['111', '001', '111', '001', '111'],
  ['101', '101', '111', '001', '001'],
  ['111', '100', '111', '001', '111'],
  ['111', '100', '111', '101', '111'],
  ['111', '001', '010', '010', '010'],
  ['111', '101', '111', '101', '111'],
  ['111', '101', '111', '001', '111'],
]

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _e = new Euler()

/** A tiny seeded random generator, reseeded per patch of hillside: allocation-free. */
const rng = {
  state: 1,
  seed(n) {
    this.state = (n * 2654435761) >>> 0 || 1
  },
  next: () => {
    let t = (rng.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  },
}

/**
 * The mountain the lobby stands on - terraces widening down, in the venue's rock - and
 * clouds drifting below the plaza either side of the stairs. Built once per world.
 */
export function buildMountain(world, clouds) {
  const venue = venueOf(world)
  const set = new BlockSet()
  const r = mulberry32(77 + world)
  const rock = venue.hills.rock
  const rockStyle = venue.hills.style ?? STYLE.MESA
  const tiers = [
    [0, -34, 0],
    [-34, -90, 10],
    [-90, -170, 24],
  ]
  tiers.forEach(([top, bottom, grow], i) => {
    const minX = PLAZA.minX - 14 - grow
    const maxX = PLAZA.maxX + 14 + grow
    const minZ = PLAZA.minZ + (i === 0 ? 0 : 6)
    const maxZ = PLAZA.maxZ + 30 + grow
    // Its top well under the plaza's floor (only 5 cm under, it would show through it on a
    // phone's coarse depth buffer), and its north face no further than the top step.
    const t = i === 0 ? top - 0.6 : top - 0.05
    set.add((minX + maxX) / 2, (t + bottom) / 2, (minZ + maxZ) / 2, maxX - minX, t - bottom, maxZ - minZ, rock[i % rock.length], rockStyle)
  })
  const count = Math.round(clouds * 2.5)
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 ? 1 : -1
    const x = side * (55 + r() * 120)
    const z = -40 - r() * 260 + 120
    const y = -20 - r() * 40
    const size = 4 + r() * 5
    set.add(x, y, z, size * 2.2, size * 0.8, size * 1.4, '#ffffff', STYLE.SMOOTH)
    set.add(x - size * 0.7, y + size * 0.35, z, size * 1.1, size * 0.9, size * 1.1, '#ffffff', STYLE.SMOOTH)
    set.add(x + size * 0.5, y + size * 0.45, z - size * 0.2, size * 1.2, size, size, '#f4f8ff', STYLE.SMOOTH)
  }
  return set.build(sharedMaterials().blocks)
}

/**
 * Refills the window mesh for steps `from` to `to` (inclusive) of `stages` (world `world`), its
 * frame at step `from`. `best` is your best drop so far (a gold line across that step),
 * `density` the preset's scenery density, `ramp` whether to draw the far ramp. Returns the
 * box count.
 */
export function fillWindow(mesh, stages, world, from, to, best, density, ramp, bare) {
  const styles = mesh.geometry.getAttribute('aStyle').array
  let n = 0
  const box = (x, y, z, sx, sy, sz, color, style = STYLE.SMOOTH, rotY = 0, rotX = 0) => {
    if (n >= MAX_BOXES) return
    _p.set(x, y, z)
    _s.set(sx, sy, sz)
    if (rotY === 0 && rotX === 0) _q.identity()
    else _q.setFromEuler(_e.set(rotX, rotY, 0))
    mesh.setMatrixAt(n, _m.compose(_p, _q, _s))
    // (Parsed once and cached: a rebuild sets a thousand of them.)
    mesh.setColorAt(n, toColor(color))
    styles[n] = style
    n += 1
  }
  /** Local coordinates in the window's frame: the top and middle of step k. */
  const ly = (k) => -(k - from) * RISE
  const lz = (k) => -(k - from + 0.5) * RUN
  const W = STAIR_HALF * 2

  let stage = 0
  while (stage + 1 < stages.length && stages[stage + 1].start <= from) stage += 1
  for (let k = from; k <= to; k += 1) {
    while (stage + 1 < stages.length && stages[stage + 1].start <= k) stage += 1
    const t = themeOf(stages[stage].theme)
    const y = ly(k)
    const z = lz(k)
    // The step, the strip along its nose, a kerb either side.
    box(0, y - 1.6, z, W, 3.2, RUN, t.steps[k % 2], t.step)
    // No two faces share a plane (they'd flicker, worst on a phone's coarser depth buffer):
    // the nose stands 6 cm proud of the riser and 6 cm over the tread, its ends buried in
    // the kerbs; kerbs and hillside patches meet their neighbours exactly, never overlapping.
    box(0, y - 0.1, z - RUN / 2 + 0.09, W + 0.3, 0.32, 0.3, t.nose, t.noseStyle ?? STYLE.SMOOTH)
    for (const side of [-1, 1]) box(side * (STAIR_HALF + 0.35), y - 0.05, z, 0.7, 0.9, RUN, t.kerb, t.kerbStyle ?? STYLE.SMOOTH)

    // Your best drop: a gold line across the step, and a flag on each kerb.
    if (k === Math.floor(best) && best > 0) {
      box(0, y + 0.05, z + 0.2, W - 0.2, 0.1, 0.35, '#ffd21f', STYLE.GLOW)
      for (const side of [-1, 1]) {
        box(side * (STAIR_HALF + 0.35), y + 1.6, z, 0.12, 2.6, 0.12, '#ffffff', STYLE.SMOOTH)
        box(side * (STAIR_HALF + 0.35) - side * 0.55, y + 2.55, z, 1, 0.6, 0.06, '#ffd21f', STYLE.GLOW)
      }
    }

    // A stage's first step: its gate, the stage number lit up on the beam.
    if (k === stages[stage].start && stage > 0) {
      const top = y + GATE_H
      for (const side of [-1, 1]) {
        box(side * (STAIR_HALF + 1.45), y + GATE_H / 2 - 0.5, z, 1.2, GATE_H + 1, 1.2, t.kerb, STYLE.STRIPES)
        box(side * (STAIR_HALF + 1.45), top + 0.6, z, 1.6, 1.2, 1.6, t.nose, STYLE.GLOW)
      }
      box(0, top, z, W + 3.6, 1.6, 0.9, t.steps[0] === '#ffffff' ? t.kerb : t.steps[0], t.step === STYLE.STUDS ? STYLE.SMOOTH : t.step)
      box(0, top - 0.95, z + 0.1, W + 1, 0.2, 0.7, t.nose, STYLE.GLOW)
      const label = String(stage + 1)
      const px = 0.32
      const width = label.length * 4 * px - px
      let x0 = -width / 2
      for (const ch of label) {
        const rows = DIGITS[ch.charCodeAt(0) - 48]
        for (let row = 0; row < 5; row += 1) {
          for (let col = 0; col < 3; col += 1) {
            if (rows[row][col] === '1') box(x0 + (col + 0.5) * px, top + 0.64 - row * px, z + 0.5, px * 0.9, px * 0.9, 0.12, '#ffffff', STYLE.GLOW)
          }
        }
        x0 += 4 * px
      }
    }

    // The hillside either side, every CHUNK steps, with its scenery.
    if (k % CHUNK === 0 && !bare) {
      const zc = -(k - from + CHUNK / 2) * RUN
      const depth = CHUNK * RUN
      for (const side of [-1, 1]) {
        const wet = t.water && side < 0
        const top = y + (wet ? -0.4 : 0.5)
        box(side * (STAIR_HALF + 0.7 + SIDE / 2), top - 6, zc, SIDE, 12, depth, t.ground, t.groundStyle)
        if (wet) box(side * (STAIR_HALF + 0.7 + SIDE + 30), top - 1.2, zc, 60, 1, depth, '#2fc6ff', STYLE.WATER)
        rng.seed(k * 7 + (side > 0 ? 3 : 0) + world * 100003)
        const pick = rng.next()
        if (!wet && pick < 0.85 * density + 0.1) {
          const kind = DECOR[t.decor[Math.floor(rng.next() * t.decor.length)]]
          // Two pieces of scenery a patch, apart (nearer and further, back and front of the
          // patch) so they can't stand inside each other with their faces flush.
          const x = side * (STAIR_HALF + 2.6 + rng.next() * (SIDE / 2 - 5))
          kind?.(box, x, top, zc + (0.2 + rng.next() * 0.25) * CHUNK * RUN, 0.8 + rng.next() * 0.6, rng.next, t)
        }
        if (density > 0.6 && rng.next() < 0.4) {
          const kind = DECOR[t.decor[Math.floor(rng.next() * t.decor.length)]]
          const x = side * (STAIR_HALF + SIDE / 2 + 1.5 + rng.next() * (SIDE / 2 - 6))
          kind?.(box, x, top, zc - (0.2 + rng.next() * 0.25) * CHUNK * RUN, 0.7 + rng.next() * 0.5, rng.next, t)
        }
      }
    }

    // Mountains far off either side, every 24 steps.
    if (k % 24 === 0) {
      for (const side of [-1, 1]) {
        rng.seed(k * 13 + (side > 0 ? 5 : 1) + world * 7919)
        const h = 40 + rng.next() * 70
        const w = 30 + rng.next() * 30
        box(side * (STAIR_HALF + SIDE + 30 + rng.next() * 50), y + h / 2 - 40, z, w, h, w * 0.8, t.far[k % 2 ? 1 : 0], STYLE.SMOOTH, rng.next())
      }
    }
  }

  // Beyond the window: the stairs carry on as one long ramp into the haze.
  if (ramp) {
    const t = themeOf(stages[stage].theme)
    const len = 420
    const slope = Math.atan2(RISE, RUN)
    const run = Math.hypot(RISE, RUN) * len
    const k = to + 1 + len / 2
    box(0, ly(k) - 0.6, lz(k), W + 1.4, 1.2, run, t.steps[0], t.step, 0, -slope)
    for (const side of [-1, 1]) box(side * (STAIR_HALF + 0.7 + SIDE / 2), ly(k) - 0.2, lz(k), SIDE, 1.2, run, t.ground, t.groundStyle, 0, -slope)
  }
  return n
}

