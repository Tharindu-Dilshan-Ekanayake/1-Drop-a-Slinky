import { comboBonus, HIT_GRADES, ZONES } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { fadeThrough } from '../../ui/fade'
import { burst, fireBurst } from '../fx/fxQueue'
import { spawnScattered } from '../fx/popups'
import { consumePull } from '../launch'
import { runtime } from '../runtime'
import { zones } from '../worldLook'
import { setBarScale, showHit } from './hudLink'
import { createDropState, dropState, laneFor, planDrop, releaseFrom, stepPoint } from './stairsPath'

/** How long the result shows over the slinky, stopped, before you're back at the top. */
const RESULT_HOLD_MS = 2600

/**
 * The drop currently playing (the template's "roll"), read every frame by the camera, the
 * stairs, your avatar and the effects. Everything about it is known when it starts (the
 * authority already resolved the distance and the Wins), so the client just plays it back:
 * no per-frame network traffic.
 *
 * It's a drop state (stairsPath.dropState: phase, position, meter, stage, the flip...)
 * plus the drop's numbers. Your logical position stays at the top of the stairs while it
 * goes (that's what the server checks); only the slinky and the camera go down.
 */
export const roll = {
  ...createDropState(),
  active: false,
  /** True once the slinky has stopped and the result is showing. */
  stopped: false,
  startedAt: 0,
  distance: 0,
  duration: 1,
  wins: 0,
  prize: 0,
  discovered: [],
  blocked: -1,
  /** How many stages it went into past the first. */
  broken: 0,
  best: false,
  /** Your best before this drop: the gold line on the stairs. */
  prevBest: 0,
  tireId: 'bicycle',
  /** How well you dropped (HIT_GRADES id), or null for Auto Drop. */
  hit: null,
  /** PERFECTs in a row with this drop (0: not a PERFECT), and its lucky gift or null. */
  combo: 0,
  gift: null,
  /** performance.now() of the release, of the last stage reached and of the landing. */
  releasedAt: 0,
  hitAt: 0,
  landedAt: 0,
  /** Stages reached so far this drop, and flips heard. */
  stagesSeen: 0,
  flipsHeard: 0,
  frameKey: -1,
  /** Kept for the effects that ask (the template's hit-stop): never behind here. */
  lag: 0,
}

let timers = []

function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers = []
}

/**
 * Moves the drop on to this frame. Idempotent per frame (keyed on the renderer's clock),
 * so the camera, the stairs and the effects all see exactly the same state however many
 * of them ask.
 */
export function advanceRoll(clockTime) {
  if (!roll.active || roll.frameKey === clockTime) return roll
  roll.frameKey = clockTime
  const now = performance.now()
  const wasPhase = roll.phase
  const wasStage = roll.stage
  const wasFlip = roll.flipIndex
  const wasLanded = roll.landed
  const wasSettle = roll.settleStage
  dropState((now - roll.startedAt) / 1000, roll, roll)

  if (wasPhase === 'throw' && roll.phase !== 'throw') release(now)
  if (wasPhase === 'air' && roll.phase !== 'air') sfx.slinkyStep(0, 1)
  if (roll.phase === 'stairs' && roll.flipIndex > wasFlip) {
    roll.flipsHeard += roll.flipIndex - wasFlip
    sfx.slinkyStep(roll.flipsHeard, roll.flipTo - roll.flipFrom)
  }
  // (On a very fast frame it can pass several gates at once: each gets its moment.)
  for (let i = wasStage + 1; i <= roll.stage; i += 1) reachStage(now, i)
  if (!wasLanded && roll.landed) land(now)
  if (roll.landed && roll.settleStage !== wasSettle) settleStep(now, roll.settleStage)
  // Standing still: the result, straight away rather than at the authority's last second.
  if (roll.phase === 'stopped' && !roll.stopped) stopRoll()
  return roll
}

/**
 * How each grade of drop looks and sounds as the slinky leaves your hand: its burst
 * (FireBurst kind) and confetti. The title follows the grade too (HitFlash.jsx).
 */
const HIT_FX = {
  perfect: { fire: 'perfect', palette: 'gold', count: 50, speed: 11 },
  great: { fire: 'great', palette: 'power', count: 30, speed: 9 },
  good: { fire: 'good', palette: 'confetti', count: 14, speed: 6 },
  weak: { fire: null, palette: null, count: 0, speed: 0 },
}

/** The slinky leaving your hand: the drop's grade, straight away, so you see why it goes as far as it does. */
function release(now) {
  roll.releasedAt = now
  const grade = HIT_GRADES.find((g) => g.id === roll.hit)
  sfx.tossSlinky(grade ? { perfect: 1, great: 0.8, good: 0.6, weak: 0.3 }[grade.id] : 0.7)
  if (!grade) return
  const fx = HIT_FX[grade.id]
  const p = roll.position
  if (fx.count) burst({ x: p.x, y: p.y, z: p.z, count: fx.count, palette: fx.palette, speed: fx.speed })
  if (grade.id === 'perfect' && roll.combo >= 2) {
    timers.push(setTimeout(() => spawnScattered(`PERFECT COMBO x${roll.combo}! +${Math.round((comboBonus(roll.combo) - 1) * 100)}% WINS`, { scale: 1.25 }), 450))
  }
  if (grade.id === 'weak') {
    spawnScattered(grade.label, { scale: 1.3 })
    sfx.weakHit()
    return
  }
  if (fx.fire && getQuality().particles) fireBurst(p.x, p.y, p.z, fx.fire)
  showHit(grade.id)
  sfx.gradeHit(grade.id)
}

/** Through stage `index`'s gate: its name on the HUD (Roll.jsx), a chime, confetti and - the first time ever - a cheer. */
function reachStage(now, index) {
  roll.hitAt = now
  roll.stagesSeen += 1
  sfx.stageGate(index + 1)
  const first = roll.discovered.includes(index)
  const stage = zones()[index]
  // One title at a time when they fly by many a second (the HUD names the stage anyway);
  // a stage you've never seen always gets its moment.
  if (first || now - (roll.titleAt || 0) > 1100) {
    roll.titleAt = now
    spawnScattered(first ? `NEW STAGE! ${stage.name}` : `STAGE ${index + 1}: ${stage.name}`, { scale: first ? 1.35 : 1.1 })
  }
  const p = roll.position
  // Not on every gate when they fly by many a second: the screen would be all confetti.
  if (now - (roll.confettiAt || 0) > 350) {
    roll.confettiAt = now
    burst({ x: p.x, y: p.y + 2.5, z: p.z - 2, count: first ? 40 : 18, palette: first ? 'gold' : 'confetti', speed: 8 })
  }
  if (first || (index + 1) % 5 === 0) sfx.stageUp()
}

/** On its last step: the clink of its coils (the boing comes when it falls back for good). */
function land(now) {
  roll.landedAt = now
  sfx.slinkyStep(roll.flipsHeard + 1, 1)
}

/**
 * The teeter at the end: reaching over the edge for one more step, the strain as it hangs
 * there - SO CLOSE! - and the springy boing as it falls back onto its step and stops (with
 * a little jolt of the camera).
 */
function settleStep(now, stage) {
  if (stage === 1) sfx.slinkyCreak()
  else if (stage === 2) spawnScattered('SO CLOSE!', { scale: 1.3 })
  else if (stage === 4) {
    roll.fellBackAt = now
    roll.hitAt = now
    sfx.slinkyLand(Math.min(1, 0.4 + roll.stage / 30))
  }
}

/**
 * Starts a drop the authority already resolved: you swing and toss from the top of the
 * stairs, and the slinky flips its way down to the step the authority said.
 */
export function beginRoll(result) {
  clearTimers()
  const game = getGame()
  consumePull()
  planDrop(result.distance, result.duration)
  Object.assign(roll, createDropState(), {
    active: true,
    stopped: false,
    startedAt: performance.now(),
    distance: result.distance,
    duration: result.duration,
    wins: result.wins,
    prize: result.prize || 0,
    discovered: result.discovered || [],
    blocked: result.blocked ?? -1,
    broken: result.broken || 0,
    best: result.best,
    // Your best before this drop (the profile with the new one may already be on its way).
    prevBest: game.profile.stats.bestDistance || 0,
    tireId: result.tireId || game.profile.equippedTire,
    hit: result.hit ?? null,
    combo: result.combo || 0,
    gift: result.gift || null,
    releasedAt: 0,
    hitAt: 0,
    landedAt: 0,
    stagesSeen: 0,
    flipsHeard: 0,
    confettiAt: 0,
    titleAt: 0,
    fellBackAt: 0,
    frameKey: -1,
    lag: 0,
  })
  // Tossed from wherever you stand in the DROP ZONE (you stay put, turned to face down
  // the stairs), down the lane straight ahead of you.
  const player = runtime.player
  const at = player.position
  releaseFrom(at.x, at.y, at.z, roll.release)
  roll.lane = laneFor(at.x)
  dropState(0, roll, roll)
  player.frozen = true
  player.yaw = Math.PI
  runtime.camera.mode = 'roll'
  // The HUD's switch to the drop (a React update and a restyle) in a task of its own, not
  // the frame the drop starts in.
  const started = {
    distance: result.distance,
    wins: result.wins,
    prize: result.prize || 0,
    blocked: result.blocked ?? -1,
    duration: result.duration,
    best: result.best,
    giftWins: result.gift?.wins || 0,
    prevBest: roll.prevBest,
    floor: roll.end,
  }
  setBarScale(Math.max(result.distance, started.prevBest, ZONES[1].start) * 1.12)
  timers.push(setTimeout(() => game.startRoll(started), 0))
  // The result shows as soon as the slinky stands still (advanceRoll); this is the
  // backstop for a tab that stopped drawing frames.
  timers.push(setTimeout(stopRoll, result.duration * 1000))
}

/**
 * The slinky stands still: the Wins pour in, a first-time stage and any lucky gift are
 * announced, and after a moment you're back at the top. Once per drop.
 */
function stopRoll() {
  if (!roll.active || roll.stopped) return
  roll.stopped = true
  const game = getGame()
  sfx.wins()
  const f = stepPoint(roll.end, roll.airPosition, roll.lane)
  burst({ x: f.x, y: f.y + 2, z: f.z, count: 50, palette: 'gold', speed: 9 })
  game.endRoll()
  // A stage reached for the first time ever: its name and the prize, once.
  const stages = zones()
  for (const zi of roll.discovered) {
    game.showToast(`NEW STAGE: ${stages[zi].name}! +${formatNumber(stages[zi].discover)} Wins`)
  }
  // A lucky gift: a present bursting open over the slinky, and what was in it.
  const gift = roll.gift
  if (gift) {
    timers.push(
      setTimeout(
        () => {
          sfx.reveal()
          burst({ x: f.x, y: f.y + 2.4, z: f.z, count: 70, palette: 'confetti', speed: 11 })
          const what = gift.wins ? `+${formatNumber(gift.wins)} Wins` : gift.label
          game.showToast(`LUCKY GIFT! ${gift.wins ? `${gift.label}: ${what}` : what}`)
        },
        roll.discovered.length ? 1600 : 500,
      ),
    )
  }
  // Back to the top once the result has shown - and never before the authority has
  // finished the drop, so the next one is accepted.
  const ready = roll.startedAt + roll.duration * 1000 + 400 - performance.now()
  timers.push(setTimeout(() => fadeThrough(finishRoll), Math.max(RESULT_HOLD_MS, ready)))
}

/**
 * Back where you dropped from, camera behind you: hold DROP again for the next one (with
 * Auto Drop on, it goes straight away).
 */
export function finishRoll() {
  clearTimers()
  roll.active = false
  roll.stopped = false
  runtime.flightFocus = null
  const player = runtime.player
  player.yaw = Math.PI
  player.frozen = false
  runtime.camera.mode = 'follow'
  runtime.camera.yaw = 0
  runtime.camera.snap = true
  getGame().clearRollResult()
}
