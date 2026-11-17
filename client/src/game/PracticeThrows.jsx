import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { sfx } from '../audio/sfx'
import { asToyInstance } from './blocks'
import { PRACTICE_SLINKY_SCALE, practiceSlinkyGeometry } from './handSlinky'
import { sharedMaterials } from './materials'
import {
  GROUND_HOPS,
  MAX_THROWS,
  PRACTICE_RISE,
  PRACTICE_RUN,
  PRACTICE_STEPS,
  THROW_FADE,
  THROW_FLIGHT,
  THROW_LIE,
  THROW_STEP,
  THROW_TARGET_TOP,
  THROW_TARGET_X,
  throws,
} from './practice'
import { COIL } from './slinkyStyles'

const _q = new Quaternion()
const _pos = new Vector3()
const _dir = new Vector3()
const _axis = new Vector3()
const _off = new Vector3()
/** How high a toss arcs on its way to the stairs. */
const ARC = 1.4
/** Half the practice slinky's height: it tumbles about its middle. */
const MID = (COIL.height * PRACTICE_SLINKY_SCALE) / 2
/** Tosses landing further than this from the camera aren't heard. */
const HEAR = 30

/**
 * The practice slinkies in the air (practice.js): each arcs from the hand onto the landing
 * at the top of its practice staircase and tumbles down it end over end towards you, a hop
 * a step, onto the target at the bottom - or, tossed anywhere else, lands and hops along the ground - rests a
 * moment and shrinks away. A fixed pool of MAX_THROWS meshes, each showing whichever
 * slinky was tossed; only the ones in the air are drawn (one draw call each, and rarely
 * more than two or three at once). Nothing allocated while it runs.
 */
export default function PracticeThrows() {
  const groupRef = useRef(null)
  const meshes = useMemo(
    () =>
      Array.from({ length: MAX_THROWS }, () => {
        const mesh = asToyInstance(practiceSlinkyGeometry('bicycle'), sharedMaterials().toy)
        mesh.visible = false
        mesh.frustumCulled = false
        return mesh
      }),
    [],
  )
  // The geometries are shared (cached per slinky); only the meshes are this component's.
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const now = performance.now()
    for (let i = 0; i < MAX_THROWS; i += 1) {
      const t = throws[i]
      const mesh = group.children[i]
      if (!mesh) continue
      if (!t.active) {
        mesh.visible = false
        continue
      }
      const hops = t.stairs ? PRACTICE_STEPS + 1 : GROUND_HOPS
      const down = THROW_FLIGHT + hops * THROW_STEP
      const e = (now - t.start) / 1000
      if (e >= down + THROW_LIE + THROW_FADE) {
        t.active = false
        mesh.visible = false
        continue
      }
      const geometry = practiceSlinkyGeometry(t.phoneId)
      if (mesh.geometry !== geometry) mesh.geometry = geometry
      mesh.visible = true
      let scale = 1
      let flip
      // Which way it's going: down the stairs (west, towards the mat), or the way it was tossed.
      if (t.stairs) _dir.set(-1, 0, 0)
      else {
        _dir.set(t.to.x - t.from.x, 0, t.to.z - t.from.z)
        if (_dir.lengthSq() < 1e-6) _dir.set(1, 0, 0)
        _dir.normalize()
      }
      if (e < THROW_FLIGHT) {
        // In the air onto the top step (or the ground), turning a little.
        const u = e / THROW_FLIGHT
        _pos.lerpVectors(t.from, t.to, u)
        _pos.y += ARC * 4 * u * (1 - u)
        flip = Math.PI * u
      } else if (e < down) {
        // Down the stairs a step a hop, flipping end over end (or hopping on along the ground).
        const v = (e - THROW_FLIGHT) / THROW_STEP
        const step = Math.min(hops - 1, Math.floor(v))
        const u = v - step
        if (t.stairs) {
          const last = step === hops - 1
          const x0 = t.to.x - step * PRACTICE_RUN
          const y0 = t.to.y - step * PRACTICE_RISE
          const x1 = last ? THROW_TARGET_X : x0 - PRACTICE_RUN
          const y1 = last ? THROW_TARGET_TOP : y0 - PRACTICE_RISE
          _pos.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + 0.45 * 4 * u * (1 - u), t.to.z)
        } else {
          const len = 0.9 * (1 - step * 0.35)
          let along = 0
          for (let k = 0; k < step; k += 1) along += 0.9 * (1 - k * 0.35)
          along += len * u
          _pos.set(t.to.x + _dir.x * along, t.to.y + 0.35 * (1 - step * 0.4) * 4 * u * (1 - u), t.to.z + _dir.z * along)
        }
        flip = Math.PI * (1 + step + u)
      } else {
        // At the bottom: a little bounce on its springs, then resting until it shrinks away.
        if (!t.landed) {
          t.landed = true
          if (state.camera.position.distanceTo(t.to) < HEAR) sfx.practiceLand()
        }
        const v = e - down
        if (t.stairs) _pos.set(THROW_TARGET_X, THROW_TARGET_TOP, t.to.z)
        else {
          let along = 0
          for (let k = 0; k < hops; k += 1) along += 0.9 * (1 - k * 0.35)
          _pos.set(t.to.x + _dir.x * along, t.to.y, t.to.z + _dir.z * along)
        }
        if (v > THROW_LIE) scale = Math.max(0.01, 1 - (v - THROW_LIE) / THROW_FADE)
        flip = Math.PI * (1 + hops)
        _pos.y += v < 0.2 ? 0.12 * Math.sin((v / 0.2) * Math.PI) : 0
      }
      // Tumbling end over end about its middle, towards where it's going: turned about the
      // level axis across its path, its foot (the mesh's origin) put back on the spot.
      _axis.set(_dir.z, 0, -_dir.x)
      _q.setFromAxisAngle(_axis, flip)
      _off.set(0, MID, 0).applyQuaternion(_q)
      mesh.quaternion.copy(_q)
      mesh.position.set(_pos.x - _off.x, _pos.y + MID - _off.y, _pos.z - _off.z)
      mesh.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef}>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  )
}
