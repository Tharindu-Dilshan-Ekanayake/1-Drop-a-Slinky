import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { getGame } from '../../store/game'
import { getQuality, useQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { sharedMaterials } from '../materials'
import { activeWorld, zones } from '../worldLook'
import { roll } from './rollControl'
import { buildMountain, CHUNK, fillWindow, MAX_BOXES } from './stairsBuild'
import { RUN, stepY, stepZ } from './stairsPath'

/**
 * The Great Staircase and everything round it.
 *
 * The staircase is endless as far as anyone can see - twenty thousand steps and more -
 * but only a window of it is ever built: from a couple of dozen steps behind the slinky
 * (or the top of the stairs, from the lobby) to as far as the preset's view distance
 * reaches. Its steps, nose strips and kerbs, the hillside either side with its scenery,
 * the gate at the start of every stage with its number in lights, your best-drop line,
 * the far mountains and a long low-detail ramp beyond the window: all one InstancedMesh,
 * refilled only when the window moves on by a CHUNK of steps. One draw call for all of
 * it, whether the slinky is on stage 1 or stage 60, plus one for the mountain under the
 * lobby.
 *
 * The window is built round its own first step (the mesh sits there), so every box is
 * placed in small numbers even ten thousand metres down the mountain: no float jitter.
 */

/** Steps kept behind the slinky (the window snaps along by CHUNK). */
const BEHIND = 24
/**
 * How many steps the slinky may run on into the window before it is rebuilt round it again
 * (the window reaches this much further ahead to make up for it): going fast, a rebuild
 * every few frames rather than every frame.
 */
const SLACK = 40
/** Faster than this (stairs a second) the hillside goes by too fast for scenery: none is built. */
const BARE_SPEED = 150
/**
 * Lazily loaded with the drop scene (Roll.jsx). While nobody drops, the window sits at
 * the top of the stairs: what you see from the lobby, the staircase falling away down the
 * mountain into the haze.
 */
export default function Stairs() {
  const meshRef = useRef(null)
  const shown = useRef({ from: -1, world: -1, best: -1, span: 0, bare: false, active: false })
  const decorDensity = useQuality((s) => s.settings.decorDensity)
  const cloudCount = useQuality((s) => s.settings.cloudCount)

  // Roll (and so this) is remounted when you change worlds.
  const world = useMemo(() => activeWorld(), [])
  const assets = useMemo(() => {
    const steps = createBoxInstances(MAX_BOXES, sharedMaterials().blocks)
    steps.frustumCulled = false
    return { steps }
  }, [])
  const mountain = useMemo(() => buildMountain(world, cloudCount), [world, cloudCount])

  useEffect(() => () => disposeBlocks(assets.steps), [assets])
  useEffect(() => () => disposeBlocks(mountain), [mountain])
  // A new preset (density, view distance) rebuilds the window next frame.
  useEffect(() => {
    shown.current.from = -1
  }, [decorDensity])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const settings = getQuality()
    const span = Math.max(110, Math.min(230, Math.round(settings.viewDistance / 1.7))) + SLACK
    const at = roll.active ? roll.meter : 0
    const want = Math.max(0, Math.floor((at - BEHIND) / CHUNK) * CHUNK)
    const s = shown.current
    // The window stays put while the slinky is within its slack, and is rebuilt round it
    // once it runs on past (or a new drop starts, or the drop ends).
    const keep = s.from >= 0 && s.active === roll.active && want >= s.from && want < s.from + SLACK
    const from = keep ? s.from : want
    const bare = roll.active && roll.speed > BARE_SPEED
    const best = roll.active ? roll.prevBest : getGame().profile.stats.bestDistance || 0
    if (s.from === from && s.world === world && s.best === Math.floor(best) && s.span === span && s.bare === bare && s.active === roll.active) return
    s.from = from
    s.world = world
    s.best = Math.floor(best)
    s.span = span
    s.bare = bare
    s.active = roll.active
    const n = fillWindow(mesh, zones(), world, from, from + span, best, settings.decorDensity, settings.viewDistance > span * 1.8, bare)
    mesh.count = n
    // Only the boxes in use go up to the GPU.
    const upload = (attribute, size) => {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, n * size)
      attribute.needsUpdate = true
    }
    upload(mesh.instanceMatrix, 16)
    if (mesh.instanceColor) upload(mesh.instanceColor, 3)
    upload(mesh.geometry.getAttribute('aStyle'), 1)
    mesh.position.set(0, stepY(from), stepZ(from) + RUN / 2)
    mesh.updateMatrix()
  })

  return (
    <>
      <primitive object={mountain} />
      <primitive ref={meshRef} object={assets.steps} />
    </>
  )
}
