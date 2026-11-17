import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three'

import { TROPHY_FIRST, TROPHY_SPACING } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { trophyValue, winsMultiplier } from '@shared/logic'
import { mulberry32 } from '@shared/rng'

import { sfx } from '../../audio/sfx'
import { getGame, useGame } from '../../store/game'
import { getQuality, useQuality } from '../../store/quality'
import { iconUrl } from '../../ui/icons'
import { createToyInstances, PropBuilder } from '../blocks'
import FireBurst from '../fx/FireBurst'
import { spawnScattered } from '../fx/popups'
import { linkPrograms } from '../linkPrograms'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'
import { slinkyTrail } from '../slinkyStyles'
import { activeWorld, blendSky, showLobbySky, zones } from '../worldLook'
import { writeDistance, writeSpeed, writeZone } from './hudLink'
import { advanceRoll, roll } from './rollControl'
import Slinky from './Slinky'
import SpeedBlur from './SpeedBlur'
import { stageNameGradient, THEME_SKIES } from './stageThemes'
import Stairs from './Stairs'
import { HOOP_FROM, HOOP_FULL, RISE, RUN, stepPoint } from './stairsPath'

const MAX_TROPHIES = 12
const STREAKS = 36
/**
 * Frame-loop priority: before every other system, so the camera has moved before anything
 * projects into it (name tags, popups). Negative, so R3F still renders itself.
 */
const BEFORE_EVERYTHING = -1
/** Metres per stair along the slope. */
const STAIR_LENGTH = Math.hypot(RISE, RUN)

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _v = new Vector3()
const _look = new Vector3()
const _want = new Vector3()
const _wantLook = new Vector3()
const _ay = new Vector3(0, 1, 0)
/** The camera's offset from the slinky and where it looks (from it), both eased. */
const camOffset = new Vector3()
const lookOffset = new Vector3()
/** Where the slinky itself is, from the stair line, smoothed: what the camera frames. */
const focusOffset = new Vector3()
const _focus = new Vector3()
const _toSlinky = new Vector3()
/** How far the camera has drawn back to fit the flip in view (metres of arch past one step), eased. */
let archReach = 0
/** Stable vector for runtime.flightFocus (the scratch ones are reused mid-frame). */
const slinkyFocus = new Vector3()

/** The camera's field of view widens with speed, up to this much more. */
const FOV_KICK = 12
/** A small jolt as it lands on its last step (no shaking while it goes: it hides the slinky). */
const LAND_SHAKE = 0.12
const LAND_SHAKE_MS = 140

/**
 * At most one trophy popup this often (longer on LOW); the trophies in between are summed
 * into it. Each popup is outlined, gradient-filled text moved every frame - the DOM's
 * dearest thing on a slow phone - so a fast drop shows a few big sums, not a stream.
 */
const TROPHY_POPUP_MS = 420
const TROPHY_POPUP_MS_LOW = 750
const TROPHY_POPUP = { iconUrl: iconUrl('trophy'), scale: 1.2 }

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Speed-line streaks, made once: alternately down the left and right of the view, each a
 * little thicker or longer than the next, and every third tinted with your slinky's colour.
 */
const streakState = (() => {
  const r = mulberry32(5)
  return Array.from({ length: STREAKS }, (_, i) => ({
    a: (i % 2 ? 0 : Math.PI) + (r() - 0.5) * 1.6,
    r: 2.8 + r() * 4,
    z: -r() * 30,
    width: 0.06 + r() * 0.06,
    length: 0.7 + r() * 0.6,
    tinted: i % 3 === 0,
  }))
})()
/** Speed lines show from this many metres a second, fully by STREAKS_FULL. */
const STREAKS_FROM = 25
const STREAKS_FULL = 90
const WHITE = new Color('#ffffff')
const _tint = new Color()

function createStreakGeometry() {
  const geometry = new BufferGeometry()
  const positions = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5]
  const uvs = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
  return geometry
}

const streakVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const streakFragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vDepth;
  varying vec3 vColor;
  void main() {
    float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
    float along = smoothstep(0.0, 0.75, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
    float depth = smoothstep(1.5, 6.0, vDepth) * (1.0 - smoothstep(24.0, 34.0, vDepth));
    gl_FragColor = vec4(vColor, across * across * along * depth * uOpacity);
    #include <colorspace_fragment>
  }
`

function createTrophyGeometry() {
  const p = new PropBuilder()
  const gold = '#ffcc1f'
  p.add(new CylinderGeometry(0.42, 0.24, 0.62, 12), { position: [0, 0.55, 0], color: gold, style: STYLE.GLOW })
  p.add(new TorusGeometry(0.2, 0.06, 6, 10, Math.PI), { position: [-0.42, 0.62, 0], rotation: [0, 0, Math.PI / 2], color: gold })
  p.add(new TorusGeometry(0.2, 0.06, 6, 10, Math.PI), { position: [0.42, 0.62, 0], rotation: [0, 0, -Math.PI / 2], color: gold })
  p.add(new CylinderGeometry(0.08, 0.08, 0.3, 6), { position: [0, 0.12, 0], color: gold })
  p.box(0, -0.05, 0, 0.5, 0.14, 0.5, '#ffb01e', STYLE.SMOOTH)
  return p.build()
}

/**
 * Where the camera sits and looks, both from the slinky, in each part of the drop.
 *
 * A slinky flips in the plane of the stairs (an arch from one step down to the next), so a
 * camera straight behind it sees each arch edge-on - just a bob. This one rides beside and
 * above it, three-quarters on, over the right of the staircase: every arch shows in full,
 * and the stairs ahead still run away into the view. Close while it's slow, so you watch
 * every flip; pulling back and up as it speeds along.
 */
function cameraAim(outOffset, outLook, zoom) {
  if (roll.phase === 'throw') {
    // Over your shoulder at the top, looking down the stairs.
    outOffset.set(1.6, 1.9, 4.8)
    outLook.set(0, -4.5, -11)
  } else if (roll.phase === 'air') {
    // Swinging round beside it as it flies onto the top step.
    outOffset.set(roll.lane > 0.5 ? -3.8 : 3.8, 2.6, 4)
    outLook.set(0, -0.4, -1.6)
  } else if (roll.phase === 'stairs') {
    const f = smoothstep(6, 90, roll.speed)
    // On the side of the staircase with more room (a slinky going down its right-hand lane
    // is watched from the left), so the camera stays over the steps, clear of the hillside.
    const side = roll.lane > 0.5 ? -1 : 1
    // Clear of the steps behind (they climb half as fast as they run back), never past the kerb.
    // Drawn back (zoom) so a long leap's whole arch fits, its far end not past the lens.
    const back = (3 + 4.2 * f) * zoom
    outOffset.set(side * (3.9 + 0.9 * f) * Math.min(1.25, zoom), back * (RISE / RUN) + (1.3 + 1.6 * f) * zoom, back)
    // Aimed just past the slinky, so it sits mid-screen (clear of the bars along the bottom).
    outLook.set(0, -0.1 - 0.7 * f, -0.7 - 4.3 * f)
  } else {
    // Stopped: round to the front side and in close, to see it bounce on its last step.
    const since = Math.max(0, (performance.now() - roll.landedAt) / 1000)
    const u = smoothstep(0, 1.8, since)
    const a = 0.85 + 0.45 * u
    const r = 3.8 - 0.5 * u
    const side = roll.lane > 0.5 ? -1 : 1
    outOffset.set(side * Math.sin(a) * r, 1.7 + Math.max(0, Math.cos(a) * r) * (RISE / RUN), Math.cos(a) * r)
    outLook.set(0, 0.15, -0.3)
  }
}

/**
 * Lazily loaded: everything beyond the top of the stairs - the Great Staircase and its
 * scenery (Stairs), the slinky going down it with its aura (Slinky), the trophies on the
 * way, the speed lines and the camera while it goes. While nobody is dropping it still
 * shows the stairs falling away down the mountain, which is what you see from the lobby.
 */
export default function Roll() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const rootRef = useRef(null)
  const trophyRef = useRef(null)
  const streakRef = useRef(null)
  const streakTintedFor = useRef(-1)
  const startedFor = useRef(0)
  const trophyTally = useRef({ next: TROPHY_FIRST, pending: 0, shownAt: 0 })
  const zoneShown = useRef(-2)
  const wasActive = useRef(false)
  const baseFov = useRef(60)
  const motionBlur = useQuality((s) => s.settings.motionBlur)
  const antialias = useQuality((s) => s.antialias)
  const rolling = useGame((s) => Boolean(s.roll))

  const assets = useMemo(() => {
    const trophies = createToyInstances(createTrophyGeometry(), sharedMaterials().toy, MAX_TROPHIES)
    const streakMaterial = new ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: streakVertexShader,
      fragmentShader: streakFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
    const streakMesh = new InstancedMesh(createStreakGeometry(), streakMaterial, STREAKS)
    for (let i = 0; i < STREAKS; i += 1) streakMesh.setColorAt(i, WHITE)
    streakMesh.frustumCulled = false
    streakMesh.count = 0
    return { trophies, streakMesh, streakMaterial }
  }, [])

  // This module loads after the lobby is on screen; compile its shaders in the background
  // before showing it, so the first drop doesn't stall on them.
  useEffect(() => {
    const root = rootRef.current
    if (!root || import.meta.env.DEV) return undefined
    let cancelled = false
    // compile() only gathers what's visible: the slinky, its aura and the effects all
    // start hidden, so everything is shown for the gathering and hidden again straight
    // after - otherwise their shaders compile mid-drop, the first time each shows.
    root.visible = true
    const hidden = []
    root.traverse((object) => {
      if (object.visible) return
      hidden.push(object)
      object.visible = true
    })
    const compiling = gl.compileAsync(root, camera, scene)
    for (const object of hidden) object.visible = false
    root.visible = false
    compiling
      .catch(() => null)
      .finally(() => {
        if (cancelled) return
        linkPrograms(gl)
        root.visible = true
      })
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene])

  useEffect(
    () => () => {
      assets.trophies.geometry.dispose()
      assets.trophies.dispose()
      assets.streakMesh.geometry.dispose()
      assets.streakMaterial.dispose()
      assets.streakMesh.dispose()
      showLobbySky(null)
    },
    [assets],
  )

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const settings = getQuality()
    const now = performance.now()

    // --- The drop -----------------------------------------------------------------
    let speed = 0
    if (roll.active) {
      advanceRoll(state.clock.elapsedTime)
      const p = roll.position
      if (startedFor.current !== roll.startedAt) {
        startedFor.current = roll.startedAt
        // Ease from wherever the lobby camera was.
        camOffset.copy(camera.position).sub(p)
        lookOffset.set(0, -4, -10)
        focusOffset.set(0, 0, 0)
        archReach = 0
        baseFov.current = camera.fov
        const tally = trophyTally.current
        tally.next = TROPHY_FIRST
        tally.pending = 0
        tally.shownAt = 0
        zoneShown.current = -2
      }
      speed = roll.speed * STAIR_LENGTH
      runtime.flightFocus = slinkyFocus.copy(p)
      writeDistance(roll.meter)
      // The stage's name as the slinky reaches it, and its sky.
      const zi = roll.inHand ? -1 : roll.stage
      const stage = zi >= 0 ? zones()[zi] : null
      if (zi !== zoneShown.current) {
        zoneShown.current = zi
        if (stage) writeZone(zi, `STAGE ${zi + 1} · ${stage.name}`, stageNameGradient(stage.theme))
        else writeZone(-1, ' ', 'linear-gradient(180deg, #ffffff, #ffffff)')
      }
      if (stage) blendSky(THEME_SKIES[stage.theme] ?? THEME_SKIES.meadow, 1 - Math.exp(-2.2 * delta), scene.fog)

      // The wind, swelling with the speed, gone once it stops.
      if (roll.phase === 'stairs') {
        sfx.windStart()
        sfx.windSet(Math.min(1, speed / 120), true, 0)
      } else if (roll.landed) {
        sfx.windStop()
      }

      if (runtime.camera.mode === 'roll') {
        // A flip leaping several steps is a long arch: draw back to fit it (a hoop needs no room).
        const hoop = smoothstep(HOOP_FROM, HOOP_FULL, roll.speed)
        const reach = roll.phase === 'stairs' ? Math.max(0, (roll.flipTo - roll.flipFrom - 1) * STAIR_LENGTH) * (1 - hoop) : 0
        archReach += (reach - archReach) * (1 - Math.exp(-2.5 * delta))
        cameraAim(_want, _wantLook, 1 + 0.11 * archReach)
        const k = 1 - Math.exp(-(roll.phase === 'throw' ? 5 : roll.phase === 'stairs' ? 3.5 : 4) * delta)
        camOffset.lerp(_want, k)
        lookOffset.lerp(_wantLook, k)
        // Framed on the slinky itself, not the stair line it's walking: smoothed (as an
        // offset from the line, so it never lags however fast it goes), so the camera follows
        // its flips without bobbing up and down with every one.
        _toSlinky.copy(roll.slinkyCenter).sub(p)
        focusOffset.lerp(_toSlinky, 1 - Math.exp(-6 * delta))
        _focus.copy(p).add(focusOffset)
        const sinceLand = roll.fellBackAt ? now - roll.fellBackAt : Infinity
        const amp = sinceLand < LAND_SHAKE_MS * 3 ? LAND_SHAKE * Math.exp(-sinceLand / LAND_SHAKE_MS) : 0
        camera.position.set(_focus.x + camOffset.x + (Math.random() - 0.5) * amp, _focus.y + camOffset.y + (Math.random() - 0.5) * amp, _focus.z + camOffset.z)
        camera.lookAt(_look.copy(_focus).add(lookOffset))
        const sinceHit = now - roll.hitAt
        // The view widens with speed, and punches wider for a moment at every gate.
        const punch = sinceHit < 500 ? 4 * Math.exp(-sinceHit / 120) : 0
        const fov = baseFov.current + punch + (roll.phase === 'stairs' ? Math.min(FOV_KICK, speed * 0.1) : roll.landed ? -4 : 0)
        const lens = state.camera
        if (Math.abs(fov - lens.fov) > 0.05) {
          lens.fov += (fov - lens.fov) * (1 - Math.exp(-4 * delta))
          lens.updateProjectionMatrix()
        }
      }
    }
    if (wasActive.current && !roll.active) {
      state.camera.fov = baseFov.current
      state.camera.updateProjectionMatrix()
      sfx.windStop()
      showLobbySky(scene.fog)
    }
    wasActive.current = roll.active

    // --- Trophies on the way down -----------------------------------------------------
    const trophies = trophyRef.current
    if (trophies) {
      let count = 0
      if (roll.active && !roll.inHand) {
        // Tally the ones just passed: the Wins came with the drop; this is the receipt.
        const tally = trophyTally.current
        while (tally.next <= Math.min(roll.meter, roll.distance)) {
          tally.pending += trophyValue(tally.next, activeWorld())
          tally.next += TROPHY_SPACING
        }
        if (tally.pending > 0 && now - tally.shownAt >= (settings.particles ? TROPHY_POPUP_MS : TROPHY_POPUP_MS_LOW)) {
          const multiplier = winsMultiplier(getGame().profile, Date.now())
          spawnScattered(`+${formatNumber(Math.round(tally.pending * multiplier))}`, TROPHY_POPUP)
          sfx.trophy()
          tally.pending = 0
          tally.shownAt = now
        }
        // The next few still ahead, spinning over their steps. (Placed from the slinky,
        // so the numbers stay small however far down it is.)
        const spin = now * 0.004
        const origin = roll.position
        trophies.position.copy(origin)
        for (let m = tally.next; m <= roll.distance && count < MAX_TROPHIES; m += TROPHY_SPACING) {
          if (m - roll.meter > 140) break
          stepPoint(m, _p, roll.lane).sub(origin)
          _p.y += 0.9 + 0.15 * Math.sin(spin * 2 + m)
          _q.setFromAxisAngle(_ay, spin + m)
          _s.setScalar(1.5)
          trophies.setMatrixAt(count, _m.compose(_p, _q, _s))
          count += 1
        }
      }
      trophies.count = count
      trophies.instanceMatrix.needsUpdate = true
    }

    // --- Speed lines --------------------------------------------------------------
    const flying = roll.active && roll.phase === 'stairs'
    writeSpeed(flying ? smoothstep(STREAKS_FROM, STREAKS_FULL * 1.5, speed) : 0, now)
    const lines = streakRef.current
    if (lines) {
      if (!(flying && settings.speedLines && speed > STREAKS_FROM)) {
        lines.count = 0
      } else {
        if (streakTintedFor.current !== roll.startedAt) {
          streakTintedFor.current = roll.startedAt
          _tint.set(slinkyTrail(roll.tireId)).lerp(WHITE, 0.35)
          for (let i = 0; i < STREAKS; i += 1) lines.setColorAt(i, streakState[i].tinted ? _tint : WHITE)
          lines.instanceColor.needsUpdate = true
        }
        const fast = Math.min(speed, 300)
        lines.material.uniforms.uOpacity.value = smoothstep(STREAKS_FROM, STREAKS_FULL, speed)
        const travel = fast * delta * 0.6
        lines.count = STREAKS
        // Round the camera (the mesh sits on it), so the numbers stay small.
        lines.position.copy(camera.position)
        for (let i = 0; i < STREAKS; i += 1) {
          const st = streakState[i]
          st.z += travel
          if (st.z > 4) st.z -= 34
          _v.set(Math.cos(st.a) * st.r * 1.15, Math.sin(st.a) * st.r * 0.75, st.z - 4)
          _v.applyQuaternion(camera.quaternion)
          _q.copy(camera.quaternion)
          _s.set(st.width, st.width, (2 + fast * 0.02) * st.length)
          lines.setMatrixAt(i, _m.compose(_v, _q, _s))
        }
        lines.instanceMatrix.needsUpdate = true
      }
    }
  }, BEFORE_EVERYTHING)

  return (
    <group ref={rootRef}>
      <Stairs />
      <Slinky />
      <FireBurst />
      <primitive ref={trophyRef} object={assets.trophies} />
      <primitive ref={streakRef} object={assets.streakMesh} />
      {rolling && motionBlur > 0 && <SpeedBlur samples={motionBlur} antialias={antialias} />}
    </group>
  )
}
