import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  ShaderMaterial,
} from 'three'

import { mulberry32 } from '@shared/rng'

import { toyTime } from '../materials'

/**
 * A slinky's aura, all in the shader (no textures): a glowing shell - an open cylinder
 * flaring out at its foot, painted with one of AURA_SHELLS' animated patterns - and a
 * cloud of particles, each a camera-facing quad drawn as one of AURA_PARTICLES' shapes and
 * moved by one of AURA_MOTIONS entirely on the GPU. Two draw calls an aura, nothing
 * computed per frame on the CPU: both read the shared toy clock (materials toyTime).
 *
 * Every aura shares the same two shader programs; what tells one from another is
 * uniforms only, so switching slinky never compiles anything.
 */

/** Most particles an aura ever has (HIGH preset, the rarest slinkies). */
export const AURA_MAX_PARTICLES = 36

const COMMON_GLSL = /* glsl */ `
  float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float aNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(aHash(i), aHash(i + vec2(1.0, 0.0)), u.x), mix(aHash(i + vec2(0.0, 1.0)), aHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float aFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * aNoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
  vec3 aHsv(float h, float s, float v) {
    vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), k, s);
  }
  float aDot2(vec2 v) { return dot(v, v); }
  float aHeart(vec2 p) {
    p.x = abs(p.x);
    if (p.y + p.x > 1.0) return sqrt(aDot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
    return sqrt(min(aDot2(p - vec2(0.0, 1.0)), aDot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
  }
`

const shellVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vRim;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Flares out at the foot, like heat rising off the ground.
    p.xz *= 1.0 + 0.32 * (1.0 - uv.y) * (1.0 - uv.y);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`

const shellFragment = /* glsl */ `
  uniform float uTime;
  uniform float uShell;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying vec2 vUv;
  varying float vRim;
  ${COMMON_GLSL}
  void main() {
    float u = vUv.x;
    float v = vUv.y;
    float t = uTime;
    float p = 0.0;
    vec3 col = uColorA;
    float rimPow = 1.0;
    if (uShell < 0.5) {
      // pulse: soft rings rising
      float w = pow(0.5 + 0.5 * sin((v * 5.0 - t * 1.6) * 3.1416), 3.0);
      p = 0.3 + 0.7 * w;
      col = mix(uColorA, uColorB, v + 0.3 * w);
    } else if (uShell < 1.5) {
      // bubble: rising rings in cells
      vec2 g = vec2(u * 10.0, v * 5.0 - t * 0.7);
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      float h = aHash(id);
      float d = length(f - vec2(h - 0.5, aHash(id + 7.0) - 0.5) * 0.3);
      float ring = smoothstep(0.07, 0.0, abs(d - (0.14 + 0.12 * h)));
      p = 0.18 + ring;
      col = mix(uColorA, uColorC, ring);
    } else if (uShell < 2.5) {
      // leaf: drifting dappled light
      float n = aFbm(vec2(u * 7.0 + t * 0.15, v * 3.0 - t * 0.35));
      float spot = smoothstep(0.5, 0.75, n);
      p = 0.15 + 0.85 * spot;
      col = mix(uColorC, uColorB, spot);
    } else if (uShell < 3.5) {
      // water: caustics
      vec2 q = vec2(u * 9.0, v * 4.0);
      float c = abs(sin(q.x + sin(q.y + t * 1.4)) + sin(q.y * 1.3 - t + sin(q.x * 0.7 + t * 0.5)));
      float l = smoothstep(1.1, 1.9, c);
      p = 0.18 + 0.82 * l;
      col = mix(uColorA, uColorC, l);
    } else if (uShell < 4.5) {
      // holy: rays of light streaming up
      float r = pow(0.5 + 0.5 * sin(u * 6.2831 * 7.0 + aNoise(vec2(u * 18.0, t * 0.6)) * 3.0), 5.0);
      float streak = 0.55 + 0.45 * sin((v * 3.0 - t * 1.8) * 3.1416);
      p = 0.2 + r * streak;
      col = mix(uColorA, uColorC, r);
    } else if (uShell < 5.5) {
      // rainbow: hue bands winding up
      float hue = fract(v * 0.8 - t * 0.25 + u * 2.0);
      col = mix(aHsv(hue, 0.75, 1.0), uColorA, 0.15);
      p = 0.45 + 0.4 * (0.5 + 0.5 * sin(v * 9.0 - t * 3.0));
    } else if (uShell < 6.5) {
      // swirl: spiralling two-tone bands
      float s = sin((u * 4.0 + v * 2.5 - t * 1.1) * 6.2831);
      float band = smoothstep(0.1, 0.9, s);
      col = mix(uColorA, uColorB, band);
      p = 0.25 + 0.75 * band;
    } else if (uShell < 7.5) {
      // frost: glittering haze
      float base = aFbm(vec2(u * 5.0, v * 3.0 - t * 0.2));
      float sparkle = step(0.965, aHash(floor(vec2(u * 60.0, v * 36.0)) + floor(t * 7.0)));
      p = base * 0.6 + sparkle * 1.2;
      col = mix(uColorC, uColorB, base) + sparkle * 0.6;
    } else if (uShell < 8.5) {
      // toxic: blobs dripping down
      float n = aFbm(vec2(u * 5.0, v * 2.5 + t * 0.9));
      float drip = smoothstep(0.52, 0.68, n);
      p = 0.15 + 0.95 * drip;
      col = mix(uColorC, uColorA, drip) + uColorB * drip * 0.25;
    } else if (uShell < 9.5) {
      // electric: crackling arcs
      float n = aNoise(vec2(u * 11.0, v * 4.0 + floor(t * 12.0) * 1.7));
      float line = 1.0 - smoothstep(0.0, 0.06, abs(n - 0.5));
      float flicker = step(0.3, aHash(vec2(floor(t * 15.0), 1.0)));
      p = 0.1 + line * flicker * 1.6;
      col = mix(uColorB, uColorC, line);
    } else if (uShell < 10.5) {
      // flame: tongues of fire licking up
      float n = aFbm(vec2(u * 7.0, v * 2.6 - t * 2.2));
      float f = n * 1.25 - v * 0.95;
      p = smoothstep(0.0, 0.22, f);
      col = mix(uColorA, uColorB, smoothstep(0.05, 0.35, f));
      col = mix(col, uColorC, smoothstep(0.3, 0.55, f));
    } else if (uShell < 11.5) {
      // crystal: shimmering facets
      vec2 q = vec2(u * 9.0, v * 5.0);
      vec2 id = floor(vec2(q.x, q.y + floor(q.x) * 0.5));
      float h = aHash(id);
      float shimmer = 0.5 + 0.5 * sin(t * 3.0 + h * 6.2831);
      p = 0.15 + shimmer * 0.7 * h;
      col = mix(uColorA, uColorB, h) + uColorC * pow(shimmer, 8.0);
    } else if (uShell < 12.5) {
      // pixel: blinking blocks
      vec2 id = floor(vec2(u * 16.0, v * 10.0));
      float h = aHash(id + floor(t * 5.0));
      p = step(0.62, h) * 0.95 + 0.08;
      col = h < 0.75 ? uColorA : (h < 0.88 ? uColorB : uColorC);
    } else if (uShell < 13.5) {
      // galaxy: nebula and twinkling stars
      float n = aFbm(vec2(u * 4.0 + t * 0.08, v * 3.0));
      vec2 sid = floor(vec2(u * 70.0, v * 44.0));
      float stars = step(0.975, aHash(sid)) * (0.5 + 0.5 * sin(t * 4.0 + aHash(sid + 3.0) * 30.0));
      col = mix(uColorA, uColorB, n) + uColorC * stars * 1.5;
      p = 0.3 + n * 0.5 + stars;
    } else if (uShell < 14.5) {
      // void: dark rings pulled inwards, bright only at the rim
      float w = pow(0.5 + 0.5 * sin((v * 7.0 + t * 2.4) * 3.1416), 4.0);
      col = mix(uColorB, uColorA, w) + uColorC * w * 0.4;
      p = 0.35 + 0.65 * w;
      rimPow = 2.2;
    } else if (uShell < 15.5) {
      // smoke: soft drifting wisps
      float n = aFbm(vec2(u * 4.0, v * 2.0 - t * 0.5));
      p = smoothstep(0.35, 0.75, n) * 0.75 + 0.08;
      col = mix(uColorB, uColorA, n) + uColorC * step(0.985, aHash(floor(vec2(u * 50.0, v * 30.0 - t * 3.0))));
    } else {
      // heart: little hearts floating up
      vec2 g = vec2(u * 8.0, v * 4.5 - t * 0.7);
      vec2 f = (fract(g) - 0.5) * 2.4;
      float d = aHeart(vec2(f.x, f.y + 0.55));
      float m = smoothstep(0.06, -0.02, d);
      p = 0.12 + 0.9 * m;
      col = mix(uColorA, uColorB, m);
    }
    float fade = smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.42, 1.0, v));
    float rim = pow(vRim, rimPow);
    float alpha = clamp(p, 0.0, 1.5) * fade * (0.3 + 0.7 * rim) * uIntensity * 0.75;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`

const particleVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uMotion;
  uniform float uRadius;
  uniform float uHeight;
  uniform float uSize;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vMix;
  void main() {
    vec4 s = aSeed;
    float t = uTime;
    float life = fract(t * (0.35 + 0.45 * s.z) + s.x);
    float ang = s.x * 6.2831;
    vec3 c;
    float a = 1.0;
    if (uMotion < 0.5) {
      float an = ang + t * (0.7 + 0.6 * s.z) * (s.w > 0.5 ? 1.0 : -1.0);
      float r = uRadius * (0.85 + 0.25 * s.y);
      c = vec3(cos(an) * r, uHeight * (0.12 + 0.72 * s.y) + 0.06 * uHeight * sin(t * 2.0 + s.x * 20.0), sin(an) * r);
    } else if (uMotion < 1.5) {
      float an = ang + sin(t + s.y * 10.0) * 0.3;
      float r = uRadius * (0.35 + 0.65 * s.y);
      c = vec3(cos(an) * r, uHeight * life * 1.05, sin(an) * r);
      a = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.7, 1.0, life));
    } else if (uMotion < 2.5) {
      float an = ang + life * 1.5;
      float r = uRadius * (0.4 + 0.7 * s.y);
      c = vec3(cos(an) * r + sin(life * 6.0 + s.z * 9.0) * 0.15 * uRadius, uHeight * (1.1 - life * 1.1), sin(an) * r);
      a = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.8, 1.0, life));
    } else if (uMotion < 3.5) {
      float r = uRadius * (0.2 + life * 1.3);
      c = vec3(cos(ang) * r, uHeight * (0.42 + (s.y - 0.5) * 0.5 + life * 0.25), sin(ang) * r);
      a = 1.0 - smoothstep(0.45, 1.0, life);
    } else if (uMotion < 4.5) {
      float an = ang + life * 9.0;
      float r = uRadius * (1.0 - life * 0.45);
      c = vec3(cos(an) * r, uHeight * life, sin(an) * r);
      a = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.85, 1.0, life));
    } else if (uMotion < 5.5) {
      c = vec3(
        sin(t * 0.6 + s.x * 20.0) * uRadius * 0.95,
        uHeight * (0.15 + 0.7 * (0.5 + 0.5 * sin(t * 0.45 + s.y * 20.0))),
        cos(t * 0.5 + s.z * 20.0) * uRadius * 0.95
      );
    } else {
      float r = uRadius * (1.5 - life * 1.4);
      c = vec3(cos(ang + life * 2.0) * r, uHeight * (0.45 + (s.y - 0.5) * 0.4), sin(ang + life * 2.0) * r);
      a = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.9, 1.0, life));
    }
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += position.xy * uSize * (0.6 + 0.8 * s.w);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vAlpha = a;
    vMix = s.y;
  }
`

const particleFragment = /* glsl */ `
  uniform float uShape;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vMix;
  ${COMMON_GLSL}
  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }
  float starShape(vec2 p) {
    float a = atan(p.y, p.x) + 1.5708;
    float r = length(p);
    float k = 0.5 + 0.5 * cos(a * 5.0);
    float edge = mix(0.17, 0.44, pow(k, 3.0));
    return smoothstep(edge + 0.02, edge - 0.02, r);
  }
  float shapeAlpha(vec2 p) {
    float r = length(p);
    if (uShape < 0.5) return pow(max(0.0, 1.0 - r * 2.0), 1.6);
    if (uShape < 1.5) return starShape(p);
    if (uShape < 2.5) return smoothstep(0.05, -0.03, aHeart(vec2(p.x, p.y + 0.38) * 1.35));
    if (uShape < 3.5) {
      float a = max(0.0, 1.0 - abs(p.x) * 9.0) * max(0.0, 1.0 - abs(p.y) * 2.1);
      float b = max(0.0, 1.0 - abs(p.y) * 9.0) * max(0.0, 1.0 - abs(p.x) * 2.1);
      return clamp(a + b + (1.0 - smoothstep(0.0, 0.16, r)), 0.0, 1.0);
    }
    if (uShape < 4.5) {
      float d = length(vec2(p.x * (1.5 + 2.2 * (p.y + 0.5)), p.y * 1.05 + 0.08));
      return smoothstep(0.42, 0.26, d);
    }
    if (uShape < 5.5) {
      float a = atan(p.y, p.x);
      float arm = smoothstep(0.05, 0.0, abs(sin(a * 3.0)) * r) * step(r, 0.46);
      return max(arm, smoothstep(0.12, 0.0, r));
    }
    if (uShape < 6.5) return smoothstep(0.36, 0.3, max(abs(p.x), abs(p.y)));
    if (uShape < 7.5) {
      vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071;
      return smoothstep(0.46, 0.38, length(vec2(q.x * 2.4, q.y)));
    }
    if (uShape < 8.5) {
      float d = min(min(segDist(p, vec2(0.12, 0.45), vec2(-0.12, 0.02)), segDist(p, vec2(-0.12, 0.02), vec2(0.1, 0.02))), segDist(p, vec2(0.1, 0.02), vec2(-0.1, -0.45)));
      return smoothstep(0.07, 0.03, d);
    }
    if (uShape < 9.5) return smoothstep(0.09, 0.04, abs(r - 0.32));
    if (uShape < 10.5) return smoothstep(0.46, 0.4, abs(p.x) * 1.35 + abs(p.y));
    if (uShape < 11.5) return smoothstep(0.45, 0.38, length(vec2(p.x * 1.9, p.y * 1.05)));
    if (uShape < 12.5) {
      float d = length(vec2(p.x * (1.0 + 2.4 * max(0.0, p.y + 0.12)), p.y + 0.1));
      return smoothstep(0.34, 0.27, d);
    }
    if (uShape < 13.5) return smoothstep(0.42, 0.38, r) * (0.75 + 0.25 * smoothstep(0.05, 0.0, abs(r - 0.27)));
    return smoothstep(0.4, 0.36, r) * smoothstep(0.3, 0.36, length(p - vec2(0.15, 0.1)));
  }
  void main() {
    float m = shapeAlpha(vUv - 0.5);
    if (m < 0.01) discard;
    vec3 col = mix(uColorA, uColorB, vMix);
    col = mix(col, uColorC, 0.2 + 0.2 * sin(vMix * 20.0));
    gl_FragColor = vec4(col * 1.25, m * vAlpha * uIntensity);
    #include <colorspace_fragment>
  }
`

/** The shell: a unit open cylinder standing on y = 0 (scaled to the aura's size). */
export const AURA_SHELL_GEOMETRY = (() => {
  const g = new CylinderGeometry(1, 1, 1, 28, 1, true)
  g.translate(0, 0.5, 0)
  return g
})()

/** Random seeds for every particle slot, made once (the same pattern for every aura). */
const SEEDS = (() => {
  const r = mulberry32(911)
  const a = new Float32Array(AURA_MAX_PARTICLES * 4)
  for (let i = 0; i < a.length; i += 1) a[i] = r()
  return a
})()

/** A fresh particle geometry: one quad, instanced `count` times. Its owner disposes it. */
export function createAuraParticleGeometry(count) {
  const g = new InstancedBufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.setAttribute('aSeed', new InstancedBufferAttribute(SEEDS.slice(0, AURA_MAX_PARTICLES * 4), 4))
  g.instanceCount = Math.max(0, Math.min(AURA_MAX_PARTICLES, count))
  return g
}

const colors = (list) => ({
  uColorA: { value: new Color(list[0] ?? '#ffffff') },
  uColorB: { value: new Color(list[1] ?? list[0] ?? '#ffffff') },
  uColorC: { value: new Color(list[2] ?? list[0] ?? '#ffffff') },
})

/** The shell's material for aura `aura` (slinkyStyles.auraOf). */
export function createShellMaterial(aura, intensity = 1) {
  return new ShaderMaterial({
    uniforms: {
      uTime: toyTime,
      uShell: { value: aura.shell },
      uIntensity: { value: aura.intensity * intensity },
      ...colors(aura.colors),
    },
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

/** The particles' material for aura `aura`, `radius` and `height` its size in metres. */
export function createParticleMaterial(aura, radius, height, size, intensity = 1) {
  return new ShaderMaterial({
    uniforms: {
      uTime: toyTime,
      uMotion: { value: aura.motion },
      uShape: { value: aura.particle },
      uRadius: { value: radius },
      uHeight: { value: height },
      uSize: { value: size },
      uIntensity: { value: aura.intensity * intensity },
      ...colors(aura.colors),
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}
