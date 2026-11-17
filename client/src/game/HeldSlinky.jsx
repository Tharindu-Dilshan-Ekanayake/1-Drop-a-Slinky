import { forwardRef, useEffect, useMemo } from 'react'

import { asToyInstance } from './blocks'
import { handSlinkyGeometry } from './handSlinky'
import { sharedMaterials } from './materials'

/**
 * The slinky in a character's right hand. The avatar moves this group onto its palm every
 * frame (its `handRef`); whoever owns it hides it while the slinky is on the stairs.
 */
export const HeldSlinky = forwardRef(function HeldSlinky({ slinkyId }, ref) {
  const mesh = useMemo(() => asToyInstance(handSlinkyGeometry(slinkyId), sharedMaterials().toy), [slinkyId])
  // The geometry is shared (cached); only the mesh is this hand's.
  useEffect(() => () => mesh.dispose(), [mesh])
  return (
    <group ref={ref}>
      <primitive object={mesh} />
    </group>
  )
})

export default HeldSlinky
