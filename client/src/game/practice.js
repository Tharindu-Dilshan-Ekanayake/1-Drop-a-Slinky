import { Vector3 } from 'three'

import { clampToWalkable, groundHeightAt, PAD_X, PAD_YAW, padCenterZ } from '@shared/world'

/**
 * Practice tosses for Power (toss.js starts one; the Power comes from the authority): on
 * practice stairs onto the top of its little staircase, where the slinky tumbles down
 * step by step to the target at the bottom; anywhere else a few metres ahead, where it
 * lands and hops along. Shared by the stairs' scenery (structures.js), the tossers
 * (Player, RemoteAvatars) and the slinkies in the air (PracticeThrows.jsx).
 */

/**
 * Each practice staircase, east of its mat, coming down towards it (so the tosser - and
 * the camera behind them - watch the slinky come down every step): a landing at the top,
 * at the far end, then PRACTICE_STEPS steps, each PRACTICE_RUN nearer the mat (west) and
 * PRACTICE_RISE lower. Step i's middle is at PRACTICE_X0 - i * PRACTICE_RUN, its top at
 * PRACTICE_TOP - i * PRACTICE_RISE (i = 0 is the landing the slinky is tossed onto).
 */
export const PRACTICE_STEPS = 4
export const PRACTICE_RUN = 0.8
export const PRACTICE_RISE = 0.4
export const PRACTICE_TOP = 2.0
export const PRACTICE_X0 = PAD_X + 8.3
/** The staircase's half width (north-south). */
export const PRACTICE_HALF = 1.1

/** The target's middle at the foot of each pad's stairs (x), and the height of its top. */
export const THROW_TARGET_X = PRACTICE_X0 - (PRACTICE_STEPS + 1) * PRACTICE_RUN
export const THROW_TARGET_TOP = 0.15
/** Where pad `index`'s target is. */
export const throwTargetZ = (index) => padCenterZ(index)

/** Seconds one toss takes, reaching back to straightening up again. */
export const TOSS_TIME = 0.45
/** How far through a toss (0-1) the slinky leaves the hand. */
export const THROW_RELEASE = 0.6
/** How far ahead a toss off the practice stairs lands (m). */
export const TOSS_REACH = 7
/**
 * Seconds a practice slinky flies to where it lands, then takes per step (or hop) on the
 * way down, rests at the bottom, and shrinks away.
 */
export const THROW_FLIGHT = 0.32
export const THROW_STEP = 0.11
export const THROW_LIE = 0.3
export const THROW_FADE = 0.15
/** Hops a slinky tossed on the ground makes after landing. */
export const GROUND_HOPS = 2

/** The slinkies in the air: a fixed pool, the oldest reused once it's full. */
export const MAX_THROWS = 10
export const throws = Array.from({ length: MAX_THROWS }, () => ({
  active: false,
  start: 0,
  from: new Vector3(),
  to: new Vector3(),
  phoneId: 'bicycle',
  /** Down practice stairs (true), or hopping along the ground. */
  stairs: false,
  /** How much it turns, so no two tosses look the same. */
  spin: 1,
  turn: 0,
  /** Whether its landing has been heard yet. */
  landed: false,
}))
let next = 0

/**
 * Tosses slinky `phoneId` from (x, y, z) - the tosser's hand - to land at (toX, toY, toZ):
 * the top of practice stairs (tossTarget's answer on a pad) or the ground. Allocation-free:
 * safe to call from a frame loop.
 */
export function spawnThrow(x, y, z, toX, toZ, phoneId, toY = THROW_TARGET_TOP) {
  const t = throws[next]
  next = (next + 1) % MAX_THROWS
  t.active = true
  t.start = performance.now()
  t.from.set(x, y, z)
  t.stairs = Math.abs(toX - PRACTICE_X0) < 0.01 && Math.abs(toY - PRACTICE_TOP) < 0.01
  // Not dead centre every time: a little scatter across the step, or round the spot.
  if (t.stairs) t.to.set(toX, toY, toZ + (Math.random() - 0.5) * 0.7)
  else t.to.set(toX + (Math.random() - 0.5) * 0.9, toY, toZ + (Math.random() - 0.5) * 0.9)
  t.phoneId = phoneId
  t.spin = Math.random() < 0.5 ? 1 : -1
  t.turn = (Math.random() - 0.5) * 1.6
  t.landed = false
}

/**
 * Where the slinky leaves a tosser's right hand, standing at `pos` facing `yaw` (towards a
 * pad's stairs by default): up over the shoulder and a little forward.
 */
export function releasePoint(pos, out, yaw = PAD_YAW) {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  return out.set(pos.x + fx * 0.55 - fz * 0.35, pos.y + 2.25, pos.z + fz * 0.55 + fx * 0.35)
}

const _land = { x: 0, z: 0 }

/**
 * Where a toss lands: on practice stairs `pad`, the landing at the top of its staircase;
 * anywhere else (`pad` -1) TOSS_REACH ahead along `yaw`, on the ground (kept on the plaza).
 */
export function tossTarget(pos, yaw, pad, out) {
  if (pad >= 0) return out.set(PRACTICE_X0, PRACTICE_TOP, throwTargetZ(pad))
  clampToWalkable(pos.x + Math.sin(yaw) * TOSS_REACH, pos.z + Math.cos(yaw) * TOSS_REACH, _land)
  return out.set(_land.x, groundHeightAt(_land.x, _land.z) + 0.02, _land.z)
}
