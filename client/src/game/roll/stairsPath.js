import { Vector3 } from 'three'

import { DROP_AIR, DROP_SETTLE, ROLL_LAUNCH } from '@shared/balance'
import { zoneIndexAt } from '@shared/logic'
import { ROLL_ZONE } from '@shared/world'

/**
 * Geometry and timeline of a drop down the Great Staircase. Pure maths and
 * allocation-free once a drop has been planned, so the frame loop can call it freely.
 *
 * The lobby is a mountain top at y = 0. At the north edge of the DROP ZONE the staircase
 * starts: step k's tread is RUN long (north, -Z) and RISE below the one before, all the
 * way down the mountain - one stair per unit of distance, stage after stage (ZONES).
 *
 * A drop: you toss the slinky (in your hand, `throw`), it flies onto the top step (`air`),
 * then flips down the stairs (`stairs`) - slow at first, faster and faster, each flip a
 * leap over more steps as it picks up speed, slowing again for its last few steps - and
 * wobbles to a stop on its last step (`settle`, then `stopped`).
 */

/** One step: how far down, how far along (north), and half the staircase's width. */
export const RISE = 0.8
export const RUN = 1.6
export const STAIR_HALF = 5.5
/** The back edge of the top step (step 0): the DROP ZONE's north edge. */
export const STAIRS_Z0 = ROLL_ZONE.minZ

/** Top of step `k`'s tread (k may be fractional: the stair line). */
export const stepY = (k) => -(k + 1) * RISE
/** The middle of step `k`'s tread, north-south. */
export const stepZ = (k) => STAIRS_Z0 - (k + 0.5) * RUN
/** The middle of step `k`'s tread (k may be fractional) - or `x` across it - written into `out`. */
export const stepPoint = (k, out, x = 0) => out.set(x, stepY(k), stepZ(k))

/**
 * How far either side of the middle a slinky may walk down the stairs: you can drop from
 * anywhere in the DROP ZONE, and the slinky goes down the lane straight ahead of you, kept
 * clear of the kerbs.
 */
export const LANE_MAX = STAIR_HALF - 0.9
export const laneFor = (x) => Math.max(-LANE_MAX, Math.min(LANE_MAX, x))
/** Where a slinky leaves the hand of someone standing at (x, y, z) facing the stairs (north). */
export const releaseFrom = (x, y, z, out) => out.set(x + 0.35, y + 1.9, z - 0.8)

/**
 * Going really fast (stairs a second) the slinky curls up into a hoop and rolls - from
 * HOOP_FROM, fully by HOOP_FULL - rather than leap dozens of steps a flip.
 */
export const HOOP_FROM = 45
export const HOOP_FULL = 85

/** How big the slinky is in the drop. */
export const SLINKY_SCALE = 1.15

/** Seconds into a drop it leaves your hand, and lands on the top step. */
export const T_RELEASE = ROLL_LAUNCH
export const T_LAND = ROLL_LAUNCH + DROP_AIR


/**
 * The speed down the stairs over a drop, as a shape (`u` 0-1 through the stairs): slow to
 * start, building fast, then easing off over the last fifth to a crawl on its last steps.
 * SPEED_LUT holds the share of the stairs covered by each point (its integral).
 */
const LUT_N = 256
const speedShape = (u) => (0.3 + 2.4 * u * u) * (u < 0.8 ? 1 : Math.max(0.06, Math.cos(((u - 0.8) / 0.2) * (Math.PI / 2))))
const SPEED_LUT = new Float64Array(LUT_N + 1)
const SPEED_MEAN = (() => {
  let sum = 0
  SPEED_LUT[0] = 0
  for (let i = 1; i <= LUT_N; i += 1) {
    const u0 = (i - 1) / LUT_N
    const u1 = i / LUT_N
    sum += ((speedShape(u0) + speedShape(u1)) / 2) * (u1 - u0)
    SPEED_LUT[i] = sum
  }
  for (let i = 1; i <= LUT_N; i += 1) SPEED_LUT[i] /= sum
  return sum
})()

/** Share (0-1) of the stairs covered `u` (0-1) of the way through. */
function covered(u) {
  const x = Math.min(1, Math.max(0, u)) * LUT_N
  const i = Math.min(LUT_N - 1, Math.floor(x))
  return SPEED_LUT[i] + (SPEED_LUT[i + 1] - SPEED_LUT[i]) * (x - i)
}

/** The `u` at which `share` of the stairs is covered (the inverse of `covered`). */
function uAtShare(share) {
  if (share <= 0) return 0
  if (share >= 1) return 1
  let lo = 0
  let hi = LUT_N
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (SPEED_LUT[mid] < share) lo = mid
    else hi = mid
  }
  const span = SPEED_LUT[hi] - SPEED_LUT[lo]
  return (lo + (span > 0 ? (share - SPEED_LUT[lo]) / span : 0)) / LUT_N
}

/**
 * Flips per second the eye can follow: faster than this and each flip leaps more steps.
 * Kept low enough that every flip - the lift, the arch, the pour over - reads on screen.
 */
const FLIP_RATE = 4.5
const MAX_LEAP = 12
const MAX_FLIPS = 4096

/**
 * The plan of the drop playing: the step it ends on, how long it flips for, and every
 * flip's first step (a flip goes from flipStart[i] to flipStart[i + 1]). Planned once per
 * drop (planDrop), then only read.
 */
const plan = {
  key: -1,
  end: 1,
  time: 1,
  count: 0,
  starts: new Int32Array(MAX_FLIPS + 1),
}

/** Plans a drop to `distance` stairs lasting `duration` seconds (the authority's numbers). */
export function planDrop(distance, duration) {
  const end = Math.max(1, Math.floor(distance))
  const time = Math.max(0.5, duration - T_LAND - DROP_SETTLE)
  plan.key = distance * 1000 + duration
  plan.end = end
  plan.time = time
  let k = 0
  let n = 0
  plan.starts[n++] = 0
  while (k < end && n < MAX_FLIPS) {
    const u = uAtShare(k / end)
    const speed = ((end / time) * speedShape(u)) / SPEED_MEAN
    let leap = Math.max(1, Math.min(MAX_LEAP, Math.round(speed / FLIP_RATE)))
    // Never so many flips that the table overflows: the rest go in bigger leaps.
    const left = MAX_FLIPS - n
    if (left < 8) leap = Math.max(leap, Math.ceil((end - k) / Math.max(1, left - 1)))
    k = Math.min(end, k + leap)
    plan.starts[n++] = k
  }
  plan.starts[n - 1] = end
  plan.count = n - 1
  return plan
}

/** The flip the slinky is in at `meter` stairs: writes from/to steps and how far through (0-1). */
function flipAt(meter, out) {
  const starts = plan.starts
  let lo = 0
  let hi = plan.count
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= meter) lo = mid
    else hi = mid
  }
  const a = starts[lo]
  const b = starts[Math.min(plan.count, lo + 1)]
  out.flipFrom = a
  out.flipTo = b
  out.flipT = b > a ? Math.min(1, Math.max(0, (meter - a) / (b - a))) : 1
  out.flipIndex = lo
}

/** The stage at stair `meter` (index into ZONES; every world's stages start at the same stairs). */
export const stageAt = (meter) => zoneIndexAt(meter)

/** A fresh state for dropState to write into. */
export const createDropState = () => ({
  /** 'throw' (still in your hand) | 'air' | 'stairs' | 'settle' | 'stopped' */
  phase: 'throw',
  /** 0-1 through the toss's swing. */
  throwT: 0,
  /** Still in your hand. */
  inHand: true,
  /** The point on the stair line the slinky has reached: what the camera follows. */
  position: new Vector3(),
  /** Where it left your hand, and the lane across the stairs it goes down (x). */
  release: new Vector3(),
  lane: 0,
  /** In the air: where the slinky's foot is, and its end-over-end turn. */
  airPosition: new Vector3(),
  airTumble: 0,
  /** The middle of the slinky itself (Slinky.jsx writes it): what the camera frames. */
  slinkyCenter: new Vector3(),
  /** On the stairs: the flip it's in - from step, to step, 0-1 through, its number. */
  flipFrom: 0,
  flipTo: 0,
  flipT: 0,
  flipIndex: 0,
  /** Settling: how much it still bounces (0 still). */
  wobble: 0,
  /** Stairs gone down so far (what the counter reads). */
  meter: 0,
  /** Stairs a second. */
  speed: 0,
  /** The stage it's in. */
  stage: 0,
  /** The step it will stop on. */
  end: 1,
  /** True once it has stopped on its last step (teetering, then still). */
  landed: false,
  /**
   * Its last moments, on its last step: how far it has started to flip on over the edge to
   * the next one (0-TEETER_REACH, as a flip's 0-1), and which part it's in - 0 just landed,
   * 1 reaching over, 2 teetering on the edge, 3 falling back, 4 still.
   */
  teeter: 0,
  settleStage: 0,
  /** Seconds into the drop when it lies still: the drop is over. */
  settleAt: 0,
  size: SLINKY_SCALE,
})

const smooth = (x) => x * x * (3 - 2 * x)

/**
 * The teeter at the end (seconds after landing on its last step): it reaches over the edge
 * for the next step (as far as TEETER_REACH of a flip - its free end just short of
 * landing), hangs there wobbling, falls back, and bounces still on its springs.
 */
export const TEETER_REACH = 0.37
const TEETER_LIFT = 0.12
const TEETER_HOLD = 0.68
const TEETER_BACK = 0.98
const TEETER_DOWN = 1.28
/** The result shows this long after landing (the drop's last DROP_SETTLE seconds end after it). */
const SETTLED_AFTER = 1.45

/**
 * Everything about a drop `elapsed` seconds in. `drop` is `{ distance, duration }`
 * (duration from the authority: rollDuration). Writes into `out` (createDropState).
 */
export function dropState(elapsed, drop, out) {
  const key = drop.distance * 1000 + drop.duration
  if (plan.key !== key) planDrop(drop.distance, drop.duration)
  const end = plan.end
  out.end = end
  out.settleAt = T_LAND + plan.time + Math.min(DROP_SETTLE, SETTLED_AFTER)
  out.wobble = 0
  out.teeter = 0
  out.settleStage = 0
  if (elapsed < T_RELEASE) {
    out.phase = 'throw'
    out.throwT = Math.min(1, Math.max(0, elapsed / T_RELEASE))
    out.inHand = true
    out.meter = 0
    out.speed = 0
    out.stage = 0
    out.landed = false
    out.position.copy(out.release)
    out.airPosition.copy(out.release)
    out.airTumble = 0
    out.flipFrom = 0
    out.flipTo = 0
    out.flipT = 0
    return out
  }
  out.throwT = 1
  out.inHand = false
  if (elapsed < T_LAND) {
    // Tossed up and over onto the top step of its lane, turning once end over end - a
    // higher arc the further back in the zone you stood.
    const u = (elapsed - T_RELEASE) / (T_LAND - T_RELEASE)
    const x0 = out.release.x
    const y0 = out.release.y
    const z0 = out.release.z
    const x1 = out.lane
    const y1 = stepY(0)
    const z1 = stepZ(0)
    const arc = 1.6 + 0.09 * Math.hypot(x1 - x0, z1 - z0)
    out.phase = 'air'
    out.airPosition.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + arc * 4 * u * (1 - u), z0 + (z1 - z0) * u)
    out.airTumble = -Math.PI * 2 * smooth(u)
    out.position.copy(out.airPosition)
    out.meter = 0
    out.speed = 0
    out.stage = 0
    out.landed = false
    out.flipFrom = 0
    out.flipTo = 0
    out.flipT = 0
    return out
  }
  const t = elapsed - T_LAND
  if (t < plan.time) {
    const u = t / plan.time
    out.phase = 'stairs'
    out.meter = end * covered(u)
    out.speed = ((end / plan.time) * speedShape(u)) / SPEED_MEAN
    out.landed = false
    flipAt(out.meter, out)
  } else {
    // On its last step: it reaches on over the edge for the next one, teeters, falls back
    // and wobbles still.
    const since = t - plan.time
    out.phase = elapsed >= out.settleAt ? 'stopped' : 'settle'
    out.meter = end
    out.speed = 0
    out.landed = true
    out.flipFrom = end
    out.flipTo = end + 1
    out.flipT = 1
    out.flipIndex = plan.count
    if (since < TEETER_LIFT) {
      // Just landed: a little squash on its springs.
      out.settleStage = 0
      out.wobble = -0.35 * Math.sin((since / TEETER_LIFT) * Math.PI)
    } else if (since < TEETER_HOLD) {
      // Reaching over the edge, slowing as it goes.
      const u = (since - TEETER_LIFT) / (TEETER_HOLD - TEETER_LIFT)
      out.settleStage = 1
      out.teeter = TEETER_REACH * (1 - (1 - u) * (1 - u) * (1 - u))
    } else if (since < TEETER_BACK) {
      // Hanging over the edge - will it go? - rocking back and forth.
      const u = (since - TEETER_HOLD) / (TEETER_BACK - TEETER_HOLD)
      out.settleStage = 2
      out.teeter = TEETER_REACH + 0.03 * Math.sin(u * Math.PI * 3) * (1 - u)
    } else if (since < TEETER_DOWN) {
      // No: it falls back onto its step.
      const u = (since - TEETER_BACK) / (TEETER_DOWN - TEETER_BACK)
      out.settleStage = 3
      out.teeter = TEETER_REACH * (1 - u * u)
    } else {
      // Back on its step, bouncing still.
      const b = since - TEETER_DOWN
      out.settleStage = 4
      out.wobble = Math.exp(-b / 0.2) * Math.sin(b * 26)
    }
  }
  out.stage = stageAt(out.meter)
  stepPoint(out.meter, out.position, out.lane)
  return out
}

/** How many flips the drop playing has made by `meter` (for the step sounds). */
export const flipsBy = (meter, state) => {
  flipAt(meter, state)
  return state.flipIndex
}
