import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import Aura from '../fx/Aura'
import Trail from '../fx/Trail'
import { sharedMaterials } from '../materials'
import { ringGeometry } from '../ringShapes'
import { CAP_SCALE, COIL, ringColor, ringStyle, slinkyLook } from '../slinkyStyles'
import { STYLE } from '../materials'
import { advanceRoll, roll } from './rollControl'
import { HOOP_FROM, HOOP_FULL, RISE, RUN, SLINKY_SCALE, stepY, stepZ } from './stairsPath'

/**
 * The slinky going down the stairs, ring by ring: RINGS tori in one InstancedMesh (one
 * draw call), placed every frame along the coil's centre line, and its aura round it.
 *
 * The walk, as a real slinky does it: standing on step A, its top coils lift and arc over
 * (`flipT` 0-0.5) until its free end lands on step B - an arch from A to B - then its
 * coils pour over from A to B (0.5-1) until it stands on B, upside down from how it
 * started (so the ring order swaps every flip). The centre line is a cubic Bezier from one
 * end to the other: each end's control point sits straight out of the coil's end face,
 * and the ends swing round in half circles, so the stack, the arch and the stack again are
 * one smooth motion. Rings are spaced evenly along it by arc length. A long leap (fast,
 * over many steps) is a longer, flatter arch.
 */

const RINGS = 32
const SAMPLES = 20
const R = COIL.radius * SLINKY_SCALE
const H = COIL.height * SLINKY_SCALE * 1.05
/** The hoop's radius, curled up at top speed (stairsPath HOOP_FROM / HOOP_FULL). */
const HOOP_R = R * 1.4
const STAIR_LENGTH = Math.hypot(RISE, RUN)

const _m = new Matrix4()
const _q = new Quaternion()
const _qt = new Quaternion()
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)
const _t = new Vector3()
const _z = new Vector3(0, 0, 1)
const _x = new Vector3(1, 0, 0)
const _c = new Color()
const _centre = new Vector3()
/** Each ring's place and turn in two poses (the flip, the hoop), blended into the mesh. */
const flipPos = new Float32Array(RINGS * 3)
const flipQuat = new Float32Array(RINGS * 4)
const hoopPos = new Float32Array(RINGS * 3)
const hoopQuat = new Float32Array(RINGS * 4)
const _qb = new Quaternion()

/** The centre line's four control points in the (forward, up) plane, and its samples. */
const P = new Float64Array(8)
const lengths = new Float64Array(SAMPLES + 1)
const smooth = (x) => x * x * (3 - 2 * x)
const smoothstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))))

/** The Bezier's point (f, y) at u, into out[0..1]; its tangent into out[2..3]. */
function bezier(u, out) {
  const a = 1 - u
  const b0 = a * a * a
  const b1 = 3 * a * a * u
  const b2 = 3 * a * u * u
  const b3 = u * u * u
  out[0] = b0 * P[0] + b1 * P[2] + b2 * P[4] + b3 * P[6]
  out[1] = b0 * P[1] + b1 * P[3] + b2 * P[5] + b3 * P[7]
  const d0 = 3 * a * a
  const d1 = 6 * a * u
  const d2 = 3 * u * u
  out[2] = d0 * (P[2] - P[0]) + d1 * (P[4] - P[2]) + d2 * (P[6] - P[4])
  out[3] = d0 * (P[3] - P[1]) + d1 * (P[5] - P[3]) + d2 * (P[7] - P[5])
  return out
}
const pt = new Float64Array(4)

/**
 * Sets the control points for a flip from (0, 0) to step B = (bf, by) (forward, up),
 * `t` 0-1 through it.
 */
function setFlip(bf, by, t) {
  const dist = Math.hypot(bf, by)
  const K = H * 0.72 + 0.1 * dist
  // How high an arch may bulge: a long leap flattens out rather than loop the loop.
  const bulge = 0.9 + 0.12 * dist
  if (t < 0.5) {
    // The free end swings over from the top of the stack on A to land on B.
    const th = Math.PI * smooth(t * 2)
    const cf = bf / 2
    const cy = (H + by) / 2
    const vf = 0 - cf
    const vy = H - cy
    let wf = vy
    let wy = -vf
    const wl = Math.hypot(wf, wy)
    const k = Math.min(1, bulge / Math.max(1e-6, wl))
    wf *= k
    wy *= k
    const ef = cf + vf * Math.cos(th) + wf * Math.sin(th)
    const ey = cy + vy * Math.cos(th) + wy * Math.sin(th)
    // Out of the free end: up, round through forward, to down.
    const df = Math.sin(th)
    const dy = Math.cos(th)
    P[0] = 0
    P[1] = 0
    P[2] = 0
    P[3] = K
    P[4] = ef - df * K
    P[5] = ey - dy * K
    P[6] = ef
    P[7] = ey
  } else {
    // The far end lifts off A and swings over to stand on top of B.
    const th = Math.PI * smooth(t * 2 - 1)
    const cf = bf / 2
    const cy = (by + H) / 2
    const vf = 0 - cf
    const vy = 0 - cy
    let wf = vy
    let wy = -vf
    if (wy < 0) {
      wf = -wf
      wy = -wy
    }
    const wl = Math.hypot(wf, wy)
    const k = Math.min(1, bulge / Math.max(1e-6, wl))
    wf *= k
    wy *= k
    const sf = cf + vf * Math.cos(th) + wf * Math.sin(th)
    const sy = cy + vy * Math.cos(th) + wy * Math.sin(th)
    // Out of the lifting end: down into A, round through forward, to up.
    const df = Math.sin(th)
    const dy = -Math.cos(th)
    P[0] = sf
    P[1] = sy
    P[2] = sf - df * K
    P[3] = sy - dy * K
    P[4] = bf
    P[5] = by + K
    P[6] = bf
    P[7] = by
  }
}

/** A straight stack from (0, 0) to (0, h). */
function setStack(h) {
  P[0] = 0
  P[1] = 0
  P[2] = 0
  P[3] = h / 3
  P[4] = 0
  P[5] = (2 * h) / 3
  P[6] = 0
  P[7] = h
}

/** Each ring's size this drop (the slinky's size; its end caps a size up), and its twist. */
const ringScale = new Float32Array(32).fill(R)
let ringTwist = 0
const _qz = new Quaternion()

/** RINGS rings of shape `shape` (`low`: the lighter geometry) in one InstancedMesh. */
function createRings(shape, low) {
  // Its own copy of the shared ring (this mesh adds a per-ring style, and disposes it).
  const geometry = ringGeometry(shape, low).clone()
  geometry.setAttribute('aStyle', new InstancedBufferAttribute(new Float32Array(RINGS), 1))
  const mesh = new InstancedMesh(geometry, sharedMaterials().blocks, RINGS)
  for (let i = 0; i < RINGS; i += 1) mesh.setColorAt(i, _c.set('#ffffff'))
  mesh.frustumCulled = false
  mesh.visible = false
  return mesh
}

/**
 * Lays the rings along the current centre line (in the mesh's own frame) into `pos` and
 * `quat`, `reversed` running them from its far end (the ring order swaps every flip),
 * turned end over end by `tumble` about the stack's middle.
 */
function layRings(pos, quat, reversed, tumble = 0) {
  // Arc length along the curve, sampled.
  lengths[0] = 0
  let px = P[0]
  let py = P[1]
  for (let i = 1; i <= SAMPLES; i += 1) {
    bezier(i / SAMPLES, pt)
    lengths[i] = lengths[i - 1] + Math.hypot(pt[0] - px, pt[1] - py)
    px = pt[0]
    py = pt[1]
  }
  const total = lengths[SAMPLES]
  let seg = 0
  for (let r = 0; r < RINGS; r += 1) {
    const share = r / (RINGS - 1)
    const want = share * total
    while (seg < SAMPLES - 1 && lengths[seg + 1] < want) seg += 1
    const span = lengths[seg + 1] - lengths[seg]
    const u = (seg + (span > 0 ? (want - lengths[seg]) / span : 0)) / SAMPLES
    bezier(u, pt)
    // (forward, up) -> world: forward is -Z.
    _p.set(0, pt[1], -pt[0])
    _t.set(0, pt[3], -pt[2])
    if (_t.lengthSq() < 1e-10) _t.set(0, 1, 0)
    _t.normalize()
    _q.setFromUnitVectors(_z, _t)
    if (tumble !== 0) {
      _qt.setFromAxisAngle(_x, tumble)
      _p.y -= H / 2
      _p.applyQuaternion(_qt)
      _p.y += H / 2
      _q.premultiply(_qt)
    }
    const k = reversed ? RINGS - 1 - r : r
    _p.toArray(pos, k * 3)
    _q.toArray(quat, k * 4)
  }
}

/**
 * The hoop: the coil curled into a ring standing on the stairs, `d` stairs on from the
 * mesh's frame, rolled round by `spin`.
 */
function layHoop(pos, quat, d, spin) {
  const cf = d * RUN
  const cy = -d * RISE + HOOP_R + R * 0.9
  for (let r = 0; r < RINGS; r += 1) {
    const a = (r / RINGS) * Math.PI * 2 + spin
    _p.set(0, cy + Math.cos(a) * HOOP_R, -(cf + Math.sin(a) * HOOP_R))
    _t.set(0, -Math.sin(a), -Math.cos(a))
    _q.setFromUnitVectors(_z, _t)
    _p.toArray(pos, r * 3)
    _q.toArray(quat, r * 4)
  }
}

/** Writes the rings into the mesh: pose A, or A blended `h` of the way to B. Returns their middle. */
function writeRings(mesh, posA, quatA, posB, quatB, h) {
  _centre.set(0, 0, 0)
  for (let r = 0; r < RINGS; r += 1) {
    _p.fromArray(posA, r * 3)
    _q.fromArray(quatA, r * 4)
    if (h > 0) {
      _t.fromArray(posB, r * 3)
      _p.lerp(_t, h)
      _qb.fromArray(quatB, r * 4)
      _q.slerp(_qb, h)
    }
    // Turned about its own axis by the slinky's twist (stars and squares spiral up the coil).
    if (ringTwist !== 0) _q.multiply(_qz.setFromAxisAngle(_z, r * ringTwist))
    _s.setScalar(ringScale[r])
    mesh.setMatrixAt(r, _m.compose(_p, _q, _s))
    _centre.add(_p)
  }
  mesh.instanceMatrix.needsUpdate = true
  return _centre.multiplyScalar(1 / RINGS)
}

/** Where the aura trail streams from: the slinky itself, while it's on its way down. */
const trailPoint = () => (roll.active && !roll.inHand && roll.phase !== 'stopped' ? roll.slinkyCenter : null)

/** The slinky you dropped, flipping its way down the stairs, with its aura and its aura's trail. */
export default function Slinky() {
  const meshRef = useRef(null)
  const auraRef = useRef(null)
  const equipped = useGame((s) => s.profile.equippedTire)
  const low = useQuality((s) => s.level === 'LOW')
  // (You can't change slinky mid-drop: you're frozen at the top of the stairs.)
  const slinkyId = equipped
  const look = useMemo(() => slinkyLook(slinkyId), [slinkyId])
  const mesh = useMemo(() => createRings(look.shape, low), [look.shape, low])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.dispose()
    },
    [mesh],
  )
  // Its colours, surfaces and sizes, ring by ring: glowing caps on its end rings if it has them.
  useEffect(() => {
    const rings = meshRef.current
    if (!rings) return
    const styles = rings.geometry.getAttribute('aStyle')
    for (let i = 0; i < RINGS; i += 1) {
      const end = look.caps && (i === 0 || i === RINGS - 1)
      rings.setColorAt(i, end ? _c.set(look.caps) : ringColor(slinkyId, i, RINGS, _c))
      styles.array[i] = end ? STYLE.GLOW : ringStyle(slinkyId, i)
      ringScale[i] = R * look.size * (end ? CAP_SCALE : 1)
    }
    ringTwist = look.twist
    styles.needsUpdate = true
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true
  }, [mesh, slinkyId, look])

  // Before the camera (Roll.jsx, -1): it frames the slinky where it is this frame.
  useFrame((state) => {
    const m = meshRef.current
    const aura = auraRef.current
    if (!m) return
    if (roll.active) advanceRoll(state.clock.elapsedTime)
    const showing = roll.active && !roll.inHand
    m.visible = showing
    if (aura) aura.visible = showing
    if (!showing) {
      roll.slinkyCenter.copy(roll.position)
      return
    }
    let centre
    if (roll.phase === 'air') {
      setStack(H)
      m.position.copy(roll.airPosition)
      layRings(flipPos, flipQuat, false, roll.airTumble)
      centre = writeRings(m, flipPos, flipQuat, null, null, 0)
    } else if (roll.phase === 'stairs') {
      const a = roll.flipFrom
      const hoop = smoothstep(HOOP_FROM, HOOP_FULL, roll.speed)
      m.position.set(roll.lane, stepY(a), stepZ(a))
      if (hoop > 0) layHoop(hoopPos, hoopQuat, roll.meter - a, (-roll.meter * STAIR_LENGTH) / HOOP_R)
      if (hoop < 1) {
        const steps = roll.flipTo - a
        setFlip(steps * RUN, -steps * RISE, roll.flipT)
        layRings(flipPos, flipQuat, roll.flipIndex % 2 === 1)
        centre = writeRings(m, flipPos, flipQuat, hoopPos, hoopQuat, hoop)
      } else {
        centre = writeRings(m, hoopPos, hoopQuat, null, null, 0)
      }
    } else if (roll.teeter > 0) {
      // On its last step, reaching over the edge for the next one - the start of a flip it
      // never finishes - then falling back.
      setFlip(RUN, -RISE, roll.teeter)
      m.position.set(roll.lane, stepY(roll.end), stepZ(roll.end))
      layRings(flipPos, flipQuat, roll.flipIndex % 2 === 1)
      centre = writeRings(m, flipPos, flipQuat, null, null, 0)
    } else {
      // Standing on its last step, bouncing on its springs.
      setStack(H * (1 + 0.28 * roll.wobble))
      m.position.set(roll.lane, stepY(roll.end), stepZ(roll.end))
      layRings(flipPos, flipQuat, (roll.flipIndex - 1) % 2 === 0)
      centre = writeRings(m, flipPos, flipQuat, null, null, 0)
    }
    roll.slinkyCenter.set(m.position.x + centre.x, m.position.y + centre.y, m.position.z + centre.z)
    if (aura) aura.position.set(roll.slinkyCenter.x, roll.slinkyCenter.y - 0.95, roll.slinkyCenter.z)
  }, -2)

  return (
    <>
      <primitive ref={meshRef} object={mesh} />
      <Aura ref={auraRef} slinkyId={slinkyId} radius={1} height={2.2} particleSize={0.22} visible={false} />
      <Trail slinkyId={slinkyId} target={trailPoint} width={1.45} life={0.8} maxLength={32} />
    </>
  )
}
