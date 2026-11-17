import { forwardRef, useEffect, useMemo } from 'react'

import { useQuality } from '../../store/quality'
import { auraOf } from '../slinkyStyles'
import {
  AURA_MAX_PARTICLES,
  AURA_SHELL_GEOMETRY,
  createAuraParticleGeometry,
  createParticleMaterial,
  createShellMaterial,
} from './auraMaterial'

/**
 * Slinky `slinkyId`'s aura: its glowing shell and its particles, standing on the group's
 * origin, `radius` wide and `height` tall (scaled up for rarer slinkies). Whoever places
 * it moves the group (pass a ref) or nests it.
 *
 * Quality: the shell is one cheap quad strip on every preset; the particles follow the
 * preset (none on LOW, which has no particles at all; fewer on MEDIUM). Two draw calls at
 * most, no per-frame CPU work.
 */
export const Aura = forwardRef(function Aura({ slinkyId, radius = 0.9, height = 2.1, particleSize = 0.22, intensity = 1, visible = true }, ref) {
  const particlesOn = useQuality((s) => s.settings.particles)
  const level = useQuality((s) => s.level)
  const aura = useMemo(() => auraOf(slinkyId), [slinkyId])
  const r = radius * aura.size
  const h = height * aura.size

  const shellMaterial = useMemo(() => createShellMaterial(aura, intensity), [aura, intensity])
  useEffect(() => () => shellMaterial.dispose(), [shellMaterial])

  const count = particlesOn ? Math.round(AURA_MAX_PARTICLES * aura.particles * (level === 'HIGH' ? 1 : 0.6)) : 0
  const particles = useMemo(() => {
    if (count === 0) return null
    return {
      geometry: createAuraParticleGeometry(count),
      material: createParticleMaterial(aura, r, h, particleSize * aura.size, intensity),
    }
  }, [count, aura, r, h, particleSize, intensity])
  useEffect(
    () => () => {
      if (!particles) return
      particles.geometry.dispose()
      particles.material.dispose()
    },
    [particles],
  )

  return (
    <group ref={ref} visible={visible}>
      <mesh geometry={AURA_SHELL_GEOMETRY} material={shellMaterial} scale={[r, h, r]} frustumCulled={false} renderOrder={6} />
      {particles && <mesh geometry={particles.geometry} material={particles.material} frustumCulled={false} renderOrder={7} />}
    </group>
  )
})

export default Aura
