import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, NormalBlending, ShaderMaterial, Vector3 } from 'three'

import { toyTime } from '../materials'
import { auraOf } from '../slinkyStyles'

/**
 * A slinky's aura as a trail: a glowing ribbon streaming behind whatever it follows (the
 * slinky on the stairs, your character walking about), in the aura's three colours, fading
 * out along its length, with bands of light running down it.
 *
 * The ribbon is rebuilt every frame from the last LIFE seconds of where its target has been
 * (a fixed ring of points, nothing allocated), each point's width turned to face the camera.
 * Its vertices are written relative to the newest point and the mesh sits there, so the
 * numbers stay small even ten kilometres down the stairs. One draw call, under a hundred
 * triangles: on every preset.
 *
 * `target()` returns where the trail starts this frame (a Vector3 to read now), or null for
 * none - the trail then just fades away. It works in world space: mount it at the root (or
 * in an untransformed group), never inside whatever it follows.
 */
const MAX_POINTS = 48

const vertexShader = /* glsl */ `
  attribute vec2 aTrail;
  varying vec2 vTrail;
  void main() {
    vTrail = aTrail;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying vec2 vTrail;
  void main() {
    float u = vTrail.x;
    float across = abs(vTrail.y * 2.0 - 1.0);
    // Bright at the head, gone by the tail; soft at the edges, a hot core down the middle.
    float fade = pow(1.0 - u, 0.85);
    float edge = 1.0 - across * across * across;
    float core = pow(1.0 - across, 4.0);
    // Bands of light running back down it.
    float bands = 0.8 + 0.2 * sin(u * 26.0 - uTime * 14.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.6, u));
    col = mix(col, uColorC, core * 0.55) * (1.0 + 0.35 * core);
    gl_FragColor = vec4(col, clamp(fade * edge * bands * uIntensity * 1.15, 0.0, 0.95));
    #include <colorspace_fragment>
  }
`

const _side = new Vector3()
const _tan = new Vector3()
const _view = new Vector3()
const _p = new Vector3()

export function Trail({ slinkyId, target, width = 0.8, life = 0.4, maxLength = 20, minStep = 0.12, intensity = 1 }) {
  const camera = useThree((s) => s.camera)
  const meshRef = useRef(null)
  // Where the target has been: a fixed ring of points, written every frame (so a ref).
  const historyRef = useRef(null)
  if (historyRef.current === null) historyRef.current = { pos: new Float64Array(MAX_POINTS * 3), time: new Float64Array(MAX_POINTS), head: 0, count: 0 }
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_POINTS * 2 * 3), 3))
    const trail = new Float32Array(MAX_POINTS * 2 * 2)
    g.setAttribute('aTrail', new BufferAttribute(trail, 2))
    const index = []
    for (let i = 0; i < MAX_POINTS - 1; i += 1) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    g.setIndex(index)
    g.setDrawRange(0, 0)
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const aura = useMemo(() => auraOf(slinkyId), [slinkyId])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: toyTime,
          uIntensity: { value: Math.min(1, 0.85 + 0.2 * aura.intensity) * intensity },
          uColorA: { value: new Color(aura.colors[0]) },
          uColorB: { value: new Color(aura.colors[1] ?? aura.colors[0]) },
          uColorC: { value: new Color(aura.colors[2] ?? '#ffffff') },
        },
        vertexShader,
        fragmentShader,
        // Painted over the scene, not added to it: a glow added onto grass or a white floor
        // all but vanishes, and the trail has to read on every stage.
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        side: DoubleSide,
      }),
    [aura, intensity],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const h = historyRef.current
    const now = performance.now() / 1000
    const at = target()
    const at3 = (i) => ((h.head - i + MAX_POINTS) % MAX_POINTS) * 3
    if (at) {
      const last = h.count > 0 ? at3(0) : -1
      const d = last >= 0 ? Math.hypot(at.x - h.pos[last], at.y - h.pos[last + 1], at.z - h.pos[last + 2]) : Infinity
      // A jump (back to the top of the stairs, through the portal) starts a fresh trail.
      if (d > Math.max(8, maxLength)) h.count = 0
      if (h.count === 0 || d >= minStep) {
        h.head = (h.head + 1) % MAX_POINTS
        h.count = Math.min(MAX_POINTS, h.count + 1)
      }
      // The newest point always sits on the target, so the trail never comes adrift of it.
      const o = at3(0)
      h.pos[o] = at.x
      h.pos[o + 1] = at.y
      h.pos[o + 2] = at.z
      h.time[o / 3] = now
    }
    // Points older than `life` drop off the tail; so do any past `maxLength` along it.
    let n = h.count
    let length = 0
    for (let i = 1; i < h.count; i += 1) {
      const a = at3(i - 1)
      const b = at3(i)
      length += Math.hypot(h.pos[a] - h.pos[b], h.pos[a + 1] - h.pos[b + 1], h.pos[a + 2] - h.pos[b + 2])
      if (now - h.time[b / 3] > life || length > maxLength) {
        n = i
        break
      }
    }
    if (!at && n > 0 && now - h.time[at3(0) / 3] > life) n = 0
    h.count = n
    if (n < 2) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    const head = at3(0)
    mesh.position.set(h.pos[head], h.pos[head + 1], h.pos[head + 2])
    const pos = geometry.getAttribute('position')
    const trail = geometry.getAttribute('aTrail')
    for (let i = 0; i < n; i += 1) {
      const o = at3(i)
      const prev = at3(Math.max(0, i - 1))
      const next = at3(Math.min(n - 1, i + 1))
      _tan.set(h.pos[prev] - h.pos[next], h.pos[prev + 1] - h.pos[next + 1], h.pos[prev + 2] - h.pos[next + 2])
      _p.set(h.pos[o], h.pos[o + 1], h.pos[o + 2])
      _view.copy(camera.position).sub(_p)
      _side.crossVectors(_tan, _view)
      const len = _side.length()
      if (len > 1e-6) _side.multiplyScalar(1 / len)
      else _side.set(1, 0, 0)
      const u = i / (n - 1)
      const half = (width / 2) * (1 - 0.5 * u)
      // Relative to the head (the mesh sits there): small numbers however far down.
      const rx = h.pos[o] - h.pos[head]
      const ry = h.pos[o + 1] - h.pos[head + 1]
      const rz = h.pos[o + 2] - h.pos[head + 2]
      pos.setXYZ(i * 2, rx + _side.x * half, ry + _side.y * half, rz + _side.z * half)
      pos.setXYZ(i * 2 + 1, rx - _side.x * half, ry - _side.y * half, rz - _side.z * half)
      trail.setXY(i * 2, u, 0)
      trail.setXY(i * 2 + 1, u, 1)
    }
    pos.clearUpdateRanges()
    pos.addUpdateRange(0, n * 6)
    pos.needsUpdate = true
    trail.clearUpdateRanges()
    trail.addUpdateRange(0, n * 4)
    trail.needsUpdate = true
    geometry.setDrawRange(0, (n - 1) * 6)
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} visible={false} />
}

export default Trail
