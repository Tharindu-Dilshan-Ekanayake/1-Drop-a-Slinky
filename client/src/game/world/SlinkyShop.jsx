import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, Matrix4, Quaternion, Vector3 } from 'three'

import { RARITIES, TIRES } from '@shared/balance'
import { SHOP_STAGES, STAND_SIZE, TIRE_STANDS } from '@shared/world'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import { asToyInstance, BlockSet, disposeBlocks, PropBuilder } from '../blocks'
import Aura from '../fx/Aura'
import { createGlowInstances, disposeGlow } from '../glow'
import { standLabelSpec, standState } from '../labels/lobbyLabels'
import { updateWorldLabel } from '../labels/registry'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'
import { addSlinky, COIL, slinkyColor, slinkyTrail } from '../slinkyStyles'

/** Stand colours by state: green equipped, blue owned, red not yet. */
const STAND_COLORS = {
  equipped: new Color('#3fdc4a'),
  owned: new Color('#38c8ff'),
  buy: new Color('#ff3b3b'),
  locked: new Color('#b0262b'),
}

const _m = new Matrix4()
const _p = new Vector3()
const _halo = new Vector3()
const _haloQ = new Quaternion()
const _haloS = new Vector3()

/** Height of a stand's glowing cap above its pad; the slinky stands on it. */
const CAP_TOP = 1.12
/** Showroom slinkies' scale: about 1.5 m across. */
const SHOWN = 1.5
/** A showroom slinky's middle, over its stand. */
const SHOWN_MID = CAP_TOP + (COIL.height * SHOWN) / 2
/** The aura preview shows on the stand nearest you within this far (m). */
const PREVIEW_RANGE = 9

/**
 * Display stands, all in one block set. The first TIRE_STANDS.length blocks are the
 * stands' tops themselves (recoloured by state, so their instance index is the stand
 * index); the trimmings follow.
 */
function buildStands() {
  const set = new BlockSet()
  const slab = STAND_SIZE - 0.4
  const ring = slab / 2 - 0.3
  for (const stand of TIRE_STANDS) set.addOn(stand.x, stand.y - 0.1, stand.z, slab, 0.3, slab, '#ffffff', STYLE.STUDS)
  for (const stand of TIRE_STANDS) {
    const id = TIRES[stand.index].id
    const { x, y, z } = stand
    const e = slab / 2 + 0.1
    for (const side of [-1, 1]) {
      set.addOn(x, y - 0.1, z + side * e, slab + 0.5, 0.45, 0.3, '#c4ccd8', STYLE.SMOOTH)
      set.addOn(x + side * e, y - 0.1, z, 0.3, 0.45, slab + 0.2, '#c4ccd8', STYLE.SMOOTH)
    }
    // A glowing square ring on the stand in the slinky's own colour.
    const glow = slinkyTrail(id)
    for (const side of [-1, 1]) {
      set.addOn(x, y + 0.2, z + side * ring, ring * 2 + 0.18, 0.06, 0.18, glow, STYLE.GLOW)
      set.addOn(x + side * ring, y + 0.2, z, 0.18, 0.06, ring * 2 - 0.18, glow, STYLE.GLOW)
    }
    // Low pedestal with a cap in the slinky's colour.
    set.addOn(x, y + 0.2, z, 1.1, 0.7, 1.1, '#f4f7fb', STYLE.SMOOTH)
    set.addOn(x, y + 0.9, z, 1.5, CAP_TOP - 0.9, 1.5, slinkyColor(id), STYLE.GLOW)
  }
  // A blue carpet down the aisle between the two stages, edged in orange light.
  const [front, back] = SHOP_STAGES
  const aisleX = (Math.max(front.minX, back.minX) + Math.min(front.maxX, back.maxX)) / 2
  const length = front.maxZ - front.minZ
  const midZ = (front.minZ + front.maxZ) / 2
  set.addOn(aisleX, 0, midZ, 2.4, 0.06, length, '#1f5fd8', STYLE.SMOOTH)
  for (const side of [-1, 1]) set.addOn(aisleX + side * 1.25, 0, midZ, 0.18, 0.1, length, '#ff9a2e', STYLE.GLOW)
  return set.build(sharedMaterials().blocks)
}

/** Every showroom slinky, standing on its stand, merged into one mesh. `low`: fewer rings (LOW preset). */
function buildSlinkies(low) {
  const p = new PropBuilder()
  for (const stand of TIRE_STANDS) {
    const id = TIRES[stand.index].id
    // Always the lighter ring geometry (36 of them, seen across the yard), fewer rings on LOW.
    addSlinky(p, id, { position: [stand.x, stand.y + CAP_TOP, stand.z], scale: SHOWN, rings: low ? 6 : 10, low: true })
  }
  return asToyInstance(p.build(), sharedMaterials().toy)
}

/**
 * The slinky shop: thirty-six display stands on the two showroom stages, each with its
 * slinky standing on it and a soft glow behind it in its rarity's colour, and - on the
 * stand nearest you - that slinky's aura, so you can see what you'd be buying. Stands
 * recolour and their labels rewrite as you buy and equip. Three draw calls (stands,
 * slinkies, halos) and two for the aura.
 */
export function SlinkyShop() {
  // As a string: the profile is a fresh copy after every update (a drop, a rep...).
  const ownedKey = useGame((s) => s.profile.ownedTires.join(','))
  const equipped = useGame((s) => s.profile.equippedTire)
  const world = useGame((s) => s.profile.world || 0)
  const low = useQuality((s) => s.settings.decorDensity < 0.6)
  const standsRef = useRef(null)
  const halosRef = useRef(null)
  const [preview, setPreview] = useState(-1)

  const assets = useMemo(() => {
    const stands = buildStands()
    const count = TIRES.length
    // A soft glow behind each slinky in its rarity's colour: the rarer, the brighter it reads.
    const halos = createGlowInstances(count, 0.45)
    TIRES.forEach((tire, i) => halos.setColorAt(i, new Color(RARITIES[tire.rarity]?.color ?? '#ffffff')))
    halos.count = count
    return { stands, halos }
  }, [])
  const slinkies = useMemo(() => buildSlinkies(low), [low])

  useEffect(
    () => () => {
      disposeBlocks(assets.stands)
      disposeGlow(assets.halos)
    },
    [assets],
  )
  useEffect(
    () => () => {
      slinkies.geometry.dispose()
      slinkies.dispose()
    },
    [slinkies],
  )

  // Recolour stands and rewrite their labels whenever ownership changes.
  useEffect(() => {
    const stands = standsRef.current
    const profile = { ownedTires: ownedKey.split(','), equippedTire: equipped }
    for (const stand of TIRE_STANDS) {
      const state = standState(profile, stand.index)
      stands?.setColorAt(stand.index, STAND_COLORS[state])
      updateWorldLabel(`stand-${stand.index}`, standLabelSpec(stand.index, state, world))
    }
    if (stands?.instanceColor) stands.instanceColor.needsUpdate = true
  }, [ownedKey, equipped, world])

  // Which stand is nearest you, a few times a second (never from the frame loop).
  useEffect(() => {
    const id = setInterval(() => {
      const p = runtime.player.position
      let best = -1
      let bestD = PREVIEW_RANGE
      for (const stand of TIRE_STANDS) {
        const d = Math.hypot(stand.x - p.x, stand.z - p.z)
        if (d < bestD) {
          bestD = d
          best = stand.index
        }
      }
      setPreview((was) => (was === best ? was : best))
    }, 250)
    return () => clearInterval(id)
  }, [])

  useFrame((state) => {
    const halos = halosRef.current
    if (!halos) return
    const t = state.clock.elapsedTime
    for (const stand of TIRE_STANDS) {
      _p.set(stand.x, stand.y + SHOWN_MID, stand.z)
      // Set back behind the slinky as seen from the camera, so it glows round it, not over it.
      _halo.copy(_p).sub(state.camera.position).normalize().multiplyScalar(1.2).add(_p)
      const pulse = 1 + Math.sin(t * 1.6 + stand.index) * 0.05
      halos.setMatrixAt(stand.index, _m.compose(_halo, _haloQ, _haloS.setScalar(SHOWN * 2 * pulse)))
    }
    halos.instanceMatrix.needsUpdate = true
  })

  const shown = preview >= 0 ? TIRE_STANDS[preview] : null
  return (
    <>
      <primitive ref={standsRef} object={assets.stands} />
      <primitive object={slinkies} />
      <primitive ref={halosRef} object={assets.halos} />
      {shown && (
        <group position={[shown.x, shown.y + CAP_TOP - 0.35, shown.z]}>
          <Aura slinkyId={TIRES[shown.index].id} radius={1.05} height={2.6} particleSize={0.24} />
        </group>
      )}
    </>
  )
}

export default SlinkyShop
