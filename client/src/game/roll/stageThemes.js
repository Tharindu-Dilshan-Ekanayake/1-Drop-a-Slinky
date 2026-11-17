import { STYLE } from '../materials'
import { skyLook } from '../worldLook'

/**
 * The twenty looks a stage of the Great Staircase can have (balance STAGE_THEMES): the
 * steps' colours and surface, the trim on each step's nose, the kerbs either side, the
 * hillside the stairs are cut into, the scenery standing on it, the mountains far off and
 * the sky. Stairs.jsx builds every stage from these; the HUD takes its name colours.
 *
 *   steps   [a, b]   alternate steps
 *   step    surface style of the treads (materials STYLE)
 *   nose    the strip along each step's front edge, `noseStyle` its surface
 *   kerb    the low walls either side
 *   ground  the hillside either side, `groundStyle` its surface
 *   decor   what stands on the hillside (DECOR builders), `leaves` their main colours
 *   far     the far-off mountains' colours
 *   water   true: a sea down the left of the stairs
 *   sky     the sky over the stage (blended in as the slinky reaches it)
 */
const S = STYLE
export const THEMES = {
  meadow: { steps: ['#56d94a', '#7ee86a'], step: S.STUDS, nose: '#ffffff', kerb: '#c9a26a', ground: '#8a5a32', groundStyle: S.HILL, decor: ['tree', 'tree', 'flower', 'bush'], leaves: ['#3fcf3a', '#5fe84a', '#ffd84a'], far: ['#4fbf5a', '#3fa84a'], sky: { top: '#2f7dff', horizon: '#cdeaff', sun: '#fff0c8', glow: 0.6, clouds: 0.9 } },
  beach: { steps: ['#f2d79a', '#ffe8b8'], step: S.STUDS, nose: '#ffffff', kerb: '#16b8c4', ground: '#e8c890', groundStyle: S.SMOOTH, decor: ['palm', 'palm', 'umbrella', 'rock'], leaves: ['#3fcf5a', '#ff6f61', '#16b8c4'], far: ['#e2bd7a', '#d0a86a'], water: true, sky: { top: '#1fa8ff', horizon: '#c8f4ff', sun: '#fff6d0', glow: 0.8, clouds: 0.6 } },
  snow: { steps: ['#f4f8ff', '#d8e8ff'], step: S.STUDS, nose: '#8fd0ff', kerb: '#bfe0ff', ground: '#ffffff', groundStyle: S.SMOOTH, decor: ['pine', 'pine', 'snowman', 'rock'], leaves: ['#2f8a5a', '#ffffff', '#ff8a1a'], far: ['#ffffff', '#dbe8f8'], sky: { top: '#5a8ad8', horizon: '#eef6ff', sun: '#ffffff', glow: 0.5, clouds: 1 } },
  desert: { steps: ['#f0a24a', '#ffc070'], step: S.STUDS, nose: '#fff0d0', kerb: '#c86a2a', ground: '#e8964a', groundStyle: S.MESA, decor: ['cactus', 'cactus', 'rock', 'bush'], leaves: ['#3fae4a', '#5fd05a', '#ff5a8a'], far: ['#d8763a', '#c4622a'], sky: { top: '#3a8aff', horizon: '#ffe8c0', sun: '#fff0a0', glow: 1, clouds: 0.2 } },
  autumn: { steps: ['#ff9a3a', '#ffbf5a'], step: S.STUDS, nose: '#ffffff', kerb: '#8a4a22', ground: '#7a4a2a', groundStyle: S.HILL, decor: ['tree', 'tree', 'pumpkin', 'bush'], leaves: ['#ff6a1a', '#ffb01a', '#d83a1a'], far: ['#d8763a', '#a8542a'], sky: { top: '#4a7ad8', horizon: '#ffe0c0', sun: '#ffd09a', glow: 0.9, clouds: 0.7 } },
  savanna: { steps: ['#d8c05a', '#ecd67a'], step: S.STUDS, nose: '#fff6c8', kerb: '#a8742a', ground: '#c8a04a', groundStyle: S.SMOOTH, decor: ['acacia', 'acacia', 'rock', 'bush'], leaves: ['#7aa83a', '#5a8a2a', '#c8d84a'], far: ['#c89a4a', '#a8823a'], sky: { top: '#3a7ae8', horizon: '#ffe6b0', sun: '#ffd27a', glow: 1.1, clouds: 0.3 } },
  candy: { steps: ['#ff9fd0', '#ffffff'], step: S.STUDS, nose: '#ff3a7a', kerb: '#7affd8', ground: '#ffc8e8', groundStyle: S.MESA, decor: ['lollipop', 'candycane', 'lollipop', 'flower'], leaves: ['#ff5aa8', '#5ad8ff', '#ffe23a'], far: ['#ffb0d8', '#d8a0ff'], sky: { top: '#ff8ad0', horizon: '#ffe8f6', sun: '#ffffff', glow: 0.7, clouds: 1 } },
  volcano: { steps: ['#3a2a2a', '#4a3434'], step: S.STUDS, nose: '#ff7a1a', noseStyle: S.GLOW, kerb: '#ff4a1a', kerbStyle: S.LAVA, ground: '#2a1e1e', groundStyle: S.LAVA, decor: ['lavarock', 'lavarock', 'rock', 'spike'], leaves: ['#ff5a1a', '#ffb01a', '#3a2a2a'], far: ['#3a2424', '#5a2a1a'], sky: { top: '#3a0a0a', horizon: '#ff7a3a', sun: '#ffb04a', glow: 1.3, clouds: 0.5 } },
  jungle: { steps: ['#3fa83a', '#5fc84a'], step: S.STUDS, nose: '#d8ff7a', kerb: '#6a4a22', ground: '#3a5a22', groundStyle: S.HILL, decor: ['bigleaf', 'tree', 'bigleaf', 'flower'], leaves: ['#1f8a2a', '#3fbf3a', '#ff5a3a'], far: ['#2f8a3a', '#1f6a2a'], sky: { top: '#2f8aff', horizon: '#d8ffe0', sun: '#fff6c8', glow: 0.7, clouds: 0.8 } },
  crystal: { steps: ['#7a5ad8', '#9a7aff'], step: S.STUDS, nose: '#e0d0ff', noseStyle: S.GLOW, kerb: '#5a3ab8', ground: '#4a3a7a', groundStyle: S.SMOOTH, decor: ['crystal', 'crystal', 'rock', 'crystal'], leaves: ['#c08aff', '#5ae8ff', '#ff8ae8'], far: ['#5a4aa8', '#3a2a7a'], sky: { top: '#2a1a6a', horizon: '#c8b0ff', sun: '#e0d0ff', glow: 0.8, clouds: 0.3, stars: 0.4 } },
  sakura: { steps: ['#ffd0e4', '#fff0f6'], step: S.STUDS, nose: '#ff7aa8', kerb: '#c83a4a', ground: '#7ad85a', groundStyle: S.HILL, decor: ['sakuratree', 'sakuratree', 'lantern', 'bush'], leaves: ['#ffaad0', '#ff7ab0', '#ffffff'], far: ['#ffc0dc', '#e8a0c8'], sky: { top: '#7aa8ff', horizon: '#ffe8f0', sun: '#fff0f6', glow: 0.7, clouds: 0.8 } },
  mushroom: { steps: ['#a86aff', '#c08aff'], step: S.STUDS, nose: '#ffffff', kerb: '#5a3a8a', ground: '#4a7a3a', groundStyle: S.HILL, decor: ['mushroom', 'mushroom', 'flower', 'mushroom'], leaves: ['#ff3a4a', '#3a8aff', '#ffd23a'], far: ['#6a4a9a', '#4a3a7a'], sky: { top: '#4a3ab8', horizon: '#e8d0ff', sun: '#ffe8ff', glow: 0.8, clouds: 0.6 } },
  reef: { steps: ['#3ad8e8', '#7af0ff'], step: S.STUDS, nose: '#ffffff', kerb: '#ff7a6a', ground: '#f0dca0', groundStyle: S.SMOOTH, decor: ['coral', 'coral', 'rock', 'coral'], leaves: ['#ff6f9a', '#ffb03a', '#a85aff'], far: ['#2aa8c8', '#1a88a8'], water: true, sky: { top: '#0a6ad8', horizon: '#8ae8ff', sun: '#d0fbff', glow: 0.6, clouds: 0.2 } },
  neon: { steps: ['#1a1a2e', '#24243e'], step: S.SMOOTH, nose: '#2fe8ff', noseStyle: S.GLOW, kerb: '#ff3ad8', kerbStyle: S.GLOW, ground: '#14142a', groundStyle: S.WINDOWS, decor: ['neon', 'neon', 'tower', 'neon'], leaves: ['#ff3ad8', '#2fe8ff', '#ffe23a'], far: ['#2a2a4a', '#1a1a3a'], sky: { top: '#0a0a24', horizon: '#5a2a8a', sun: '#ff7ae8', glow: 1, clouds: 0, stars: 0.8 } },
  clouds: { steps: ['#ffffff', '#eef4ff'], step: S.STUDS, nose: '#ffd23a', noseStyle: S.GLOW, kerb: '#ffe27a', ground: '#ffffff', groundStyle: S.SMOOTH, decor: ['cloud', 'pillar', 'cloud', 'cloud'], leaves: ['#ffffff', '#ffe27a', '#bfe6ff'], far: ['#ffffff', '#e8f0ff'], sky: { top: '#5ab8ff', horizon: '#ffffff', sun: '#fff8d8', glow: 0.9, clouds: 1 } },
  rainbow: { steps: ['#ffffff', '#ffffff'], step: S.RAINBOW, nose: '#ffffff', noseStyle: S.GLOW, kerb: '#ffffff', kerbStyle: S.RAINBOW, ground: '#bfe6ff', groundStyle: S.SMOOTH, decor: ['star', 'cloud', 'star', 'star'], leaves: ['#ffe23a', '#ff7ae8', '#7affff'], far: ['#c8b0ff', '#ffb0e0'], sky: { top: '#7a5aff', horizon: '#ffe0f8', sun: '#ffffff', glow: 1, clouds: 0.7, stars: 0.3 } },
  moon: { steps: ['#b8bcc8', '#cfd3dd'], step: S.STUDS, nose: '#ffffff', kerb: '#8a8e9a', ground: '#9a9eaa', groundStyle: S.SMOOTH, decor: ['rock', 'flag', 'rock', 'crater'], leaves: ['#ff3a3a', '#ffffff', '#3a8aff'], far: ['#7a7e8a', '#5a5e6a'], sky: { top: '#02030a', horizon: '#2a2e4a', sun: '#ffffff', glow: 0.4, clouds: 0, stars: 1 } },
  aurora: { steps: ['#bff6ff', '#8ae8ff'], step: S.STUDS, nose: '#7affb8', noseStyle: S.GLOW, kerb: '#5ad8ff', ground: '#e8f8ff', groundStyle: S.SMOOTH, decor: ['icespike', 'pine', 'icespike', 'rock'], leaves: ['#7affd8', '#2f8a5a', '#a85aff'], far: ['#d8f0ff', '#a8d0e8'], sky: { top: '#0a1a3a', horizon: '#3affb8', sun: '#bfffe0', glow: 0.9, clouds: 0.1, stars: 0.8 } },
  space: { steps: ['#ffffff', '#ffffff'], step: S.GALAXY, nose: '#9a7aff', noseStyle: S.GLOW, kerb: '#3a2a8a', kerbStyle: S.GLOW, ground: '#14183f', groundStyle: S.GALAXY, decor: ['planet', 'orb', 'planet', 'star'], leaves: ['#ff7a3a', '#3ad8ff', '#ffe23a'], far: ['#1a1a4a', '#2a1a5a'], sky: { top: '#000004', horizon: '#1a1040', sun: '#bfa8ff', glow: 0.6, clouds: 0, stars: 1 } },
  cosmic: { steps: ['#2a0a4a', '#3a1a6a'], step: S.SMOOTH, nose: '#ff7aff', noseStyle: S.GLOW, kerb: '#7affff', kerbStyle: S.GLOW, ground: '#1a0a2a', groundStyle: S.GALAXY, decor: ['orb', 'crystal', 'orb', 'spike'], leaves: ['#ff7aff', '#7affff', '#ffe27a'], far: ['#2a0a4a', '#4a1a6a'], sky: { top: '#0a0014', horizon: '#7a1a8a', sun: '#ff9aff', glow: 1.2, clouds: 0, stars: 1 } },
}

/** Each theme's sky, parsed once. */
export const THEME_SKIES = Object.fromEntries(Object.entries(THEMES).map(([id, t]) => [id, skyLook(t.sky)]))
export const themeOf = (id) => THEMES[id] ?? THEMES.meadow

/** The CSS gradient a stage's name is filled with on the HUD: its steps and its nose. */
export function stageNameGradient(themeId) {
  const t = themeOf(themeId)
  if (t.step === S.RAINBOW) return 'linear-gradient(90deg, #ff5a5a, #ffd23a, #5aff8a, #5ad8ff, #c05aff)'
  const light = t.steps[0] === '#ffffff' ? t.nose : t.steps[1]
  return `linear-gradient(180deg, #ffffff 0%, ${light} 45%, ${t.nose} 100%)`
}

/**
 * Scenery builders: each writes its boxes through `box(x, y, z, sx, sy, sz, color, style,
 * rotY)` (centres, sizes) standing on the ground at (x, y, z), `s` its size, `r` a random
 * 0-1 function, `t` the theme. Kept to a handful of boxes each - there are a hundred on
 * screen at once.
 */
export const DECOR = {
  tree(box, x, y, z, s, r, t) {
    box(x, y + 1.1 * s, z, 0.7 * s, 2.2 * s, 0.7 * s, '#8a5a32', S.SMOOTH)
    box(x, y + 3 * s, z, 2.8 * s, 2.2 * s, 2.8 * s, t.leaves[0], S.STUDS, r() * 0.6)
    box(x, y + 4.5 * s, z, 1.7 * s, 1.2 * s, 1.7 * s, t.leaves[1], S.STUDS, r() * 0.6)
  },
  pine(box, x, y, z, s, r, t) {
    box(x, y + 0.8 * s, z, 0.6 * s, 1.6 * s, 0.6 * s, '#7a4a2a', S.SMOOTH)
    box(x, y + 2.2 * s, z, 2.6 * s, 1.4 * s, 2.6 * s, t.leaves[0], S.STUDS)
    box(x, y + 3.4 * s, z, 1.8 * s, 1.2 * s, 1.8 * s, t.leaves[0], S.STUDS)
    box(x, y + 4.4 * s, z, 1 * s, 1 * s, 1 * s, t.leaves[1], S.SMOOTH)
  },
  palm(box, x, y, z, s, r, t) {
    const lean = (r() - 0.5) * 0.6
    box(x, y + 1.4 * s, z, 0.5 * s, 2.8 * s, 0.5 * s, '#b07a42', S.SMOOTH)
    box(x + lean, y + 3.6 * s, z, 0.38 * s, 1.8 * s, 0.38 * s, '#c08a52', S.SMOOTH)
    box(x + lean, y + 4.6 * s, z, 3.6 * s, 0.25 * s, 0.9 * s, t.leaves[0], S.SMOOTH, 0.3)
    box(x + lean, y + 4.68 * s, z, 3.6 * s, 0.25 * s, 0.9 * s, t.leaves[0], S.SMOOTH, 0.3 + Math.PI / 2)
    box(x + lean, y + 4.3 * s, z, 0.5 * s, 0.5 * s, 0.5 * s, '#7a4a22', S.SMOOTH)
  },
  umbrella(box, x, y, z, s, r, t) {
    box(x, y + 1.2 * s, z, 0.15 * s, 2.4 * s, 0.15 * s, '#ffffff', S.SMOOTH)
    box(x, y + 2.4 * s, z, 2.6 * s, 0.3 * s, 2.6 * s, t.leaves[1 + Math.floor(r() * 2)], S.STRIPES, r())
    box(x + 1.2 * s, y + 0.15 * s, z, 1.6 * s, 0.3 * s, 0.8 * s, '#ffffff', S.SMOOTH)
  },
  flower(box, x, y, z, s, r, t) {
    box(x, y + 0.4 * s, z, 0.15 * s, 0.8 * s, 0.15 * s, '#3fae3a', S.SMOOTH)
    box(x, y + 0.9 * s, z, 0.6 * s, 0.4 * s, 0.6 * s, t.leaves[2], S.GLOW, r())
  },
  bush(box, x, y, z, s, r, t) {
    box(x, y + 0.6 * s, z, 1.8 * s, 1.2 * s, 1.6 * s, t.leaves[0], S.STUDS, r())
  },
  rock(box, x, y, z, s, r) {
    const c = r() < 0.5 ? '#8a8e9a' : '#a4a8b2'
    box(x, y + 0.6 * s, z, 1.8 * s, 1.2 * s, 1.5 * s, c, S.SMOOTH, r())
    box(x + 0.5 * s, y + 1.3 * s, z + 0.2 * s, 0.9 * s, 0.6 * s, 0.9 * s, c, S.SMOOTH, r())
  },
  snowman(box, x, y, z, s) {
    box(x, y + 0.6 * s, z, 1.3 * s, 1.2 * s, 1.3 * s, '#ffffff', S.SMOOTH)
    box(x, y + 1.6 * s, z, 0.95 * s, 0.9 * s, 0.95 * s, '#ffffff', S.SMOOTH)
    box(x, y + 2.35 * s, z, 0.7 * s, 0.65 * s, 0.7 * s, '#ffffff', S.SMOOTH)
    box(x, y + 2.35 * s, z + 0.5 * s, 0.14 * s, 0.14 * s, 0.4 * s, '#ff8a1a', S.SMOOTH)
  },
  cactus(box, x, y, z, s, r, t) {
    box(x, y + 1.6 * s, z, 0.8 * s, 3.2 * s, 0.8 * s, t.leaves[0], S.STRIPES)
    box(x + 0.8 * s, y + 1.8 * s, z, 0.9 * s, 0.5 * s, 0.5 * s, t.leaves[0], S.SMOOTH)
    box(x + 0.98 * s, y + 2.4 * s, z, 0.4 * s, 1.1 * s, 0.4 * s, t.leaves[0], S.SMOOTH)
    if (r() < 0.5) box(x, y + 3.35 * s, z, 0.35 * s, 0.35 * s, 0.35 * s, t.leaves[2], S.GLOW)
  },
  pumpkin(box, x, y, z, s) {
    box(x, y + 0.5 * s, z, 1.3 * s, 1 * s, 1.3 * s, '#ff8a1a', S.STRIPES)
    box(x, y + 1.15 * s, z, 0.2 * s, 0.35 * s, 0.2 * s, '#3fae3a', S.SMOOTH)
  },
  acacia(box, x, y, z, s, r, t) {
    box(x, y + 1.5 * s, z, 0.5 * s, 3 * s, 0.5 * s, '#7a5a32', S.SMOOTH)
    box(x, y + 3.2 * s, z, 4.4 * s, 0.6 * s, 3.4 * s, t.leaves[0], S.STUDS, r())
  },
  lollipop(box, x, y, z, s, r, t) {
    box(x, y + 1.3 * s, z, 0.2 * s, 2.6 * s, 0.2 * s, '#ffffff', S.SMOOTH)
    box(x, y + 3 * s, z, 1.6 * s, 1.6 * s, 0.5 * s, t.leaves[Math.floor(r() * 3)], S.RAINBOW, r() * 3)
  },
  candycane(box, x, y, z, s) {
    box(x, y + 1.6 * s, z, 0.45 * s, 3.2 * s, 0.45 * s, '#ff3a5a', S.STRIPES)
    // (Each piece a little slimmer than the one it joins, so no faces are flush.)
    box(x + 0.45 * s, y + 3.2 * s, z, 1.2 * s, 0.45 * s, 0.38 * s, '#ff3a5a', S.STRIPES)
    box(x + 0.9 * s, y + 2.85 * s, z, 0.4 * s, 0.8 * s, 0.31 * s, '#ff3a5a', S.STRIPES)
  },
  lavarock(box, x, y, z, s, r) {
    box(x, y + 0.8 * s, z, 2 * s, 1.6 * s, 1.8 * s, '#2a1e1e', S.LAVA, r())
    box(x, y + 1.7 * s, z, 1.1 * s, 0.4 * s, 1.1 * s, '#ff6a1a', S.GLOW, r())
  },
  spike(box, x, y, z, s, r, t) {
    box(x, y + 1.4 * s, z, 0.7 * s, 2.8 * s, 0.7 * s, t.leaves[0], S.GLOW, r())
    box(x + 0.6 * s, y + 0.8 * s, z + 0.3 * s, 0.5 * s, 1.6 * s, 0.5 * s, t.leaves[1], S.GLOW, r())
  },
  bigleaf(box, x, y, z, s, r, t) {
    box(x, y + 1.8 * s, z, 0.4 * s, 3.6 * s, 0.4 * s, '#5a7a2a', S.SMOOTH)
    box(x, y + 3.6 * s, z, 3.2 * s, 0.2 * s, 1.2 * s, t.leaves[0], S.SMOOTH, r() * 3)
    box(x, y + 3.2 * s, z, 2.6 * s, 0.2 * s, 1 * s, t.leaves[1], S.SMOOTH, r() * 3)
  },
  crystal(box, x, y, z, s, r, t) {
    box(x, y + 1.5 * s, z, 0.8 * s, 3 * s, 0.8 * s, t.leaves[0], S.GLOW, r())
    box(x + 0.7 * s, y + 0.9 * s, z, 0.6 * s, 1.8 * s, 0.6 * s, t.leaves[1], S.GLOW, r())
    box(x - 0.6 * s, y + 0.7 * s, z + 0.4 * s, 0.5 * s, 1.4 * s, 0.5 * s, t.leaves[2], S.GLOW, r())
  },
  sakuratree(box, x, y, z, s, r, t) {
    box(x, y + 1.1 * s, z, 0.6 * s, 2.2 * s, 0.6 * s, '#5a3a2a', S.SMOOTH)
    box(x, y + 2.9 * s, z, 3 * s, 1.8 * s, 3 * s, t.leaves[0], S.STUDS, r())
    box(x + 0.6 * s, y + 4.1 * s, z, 1.8 * s, 1 * s, 1.8 * s, t.leaves[1], S.STUDS, r())
  },
  lantern(box, x, y, z, s) {
    box(x, y + 1.2 * s, z, 0.2 * s, 2.4 * s, 0.2 * s, '#3a2a2a', S.SMOOTH)
    box(x, y + 2.5 * s, z, 0.7 * s, 0.8 * s, 0.7 * s, '#ff5a3a', S.GLOW)
  },
  mushroom(box, x, y, z, s, r, t) {
    box(x, y + 1 * s, z, 0.8 * s, 2 * s, 0.8 * s, '#fff0e0', S.SMOOTH)
    box(x, y + 2.3 * s, z, 3 * s, 0.8 * s, 3 * s, t.leaves[Math.floor(r() * 3)], S.STUDS, r())
    box(x + 0.6 * s, y + 2.75 * s, z + 0.4 * s, 0.5 * s, 0.15 * s, 0.5 * s, '#ffffff', S.SMOOTH)
  },
  coral(box, x, y, z, s, r, t) {
    const c = t.leaves[Math.floor(r() * 3)]
    box(x, y + 1 * s, z, 0.5 * s, 2 * s, 0.5 * s, c, S.SMOOTH)
    box(x + 0.6 * s, y + 1.5 * s, z, 0.4 * s, 1.4 * s, 0.4 * s, c, S.SMOOTH)
    box(x - 0.5 * s, y + 1.7 * s, z + 0.3 * s, 0.35 * s, 1.6 * s, 0.35 * s, c, S.SMOOTH)
  },
  neon(box, x, y, z, s, r, t) {
    box(x, y + 2.5 * s, z, 1 * s, 5 * s, 1 * s, '#2a2a4a', S.SMOOTH)
    box(x, y + 2.5 * s, z, 1.15 * s, 0.25 * s, 1.15 * s, t.leaves[0], S.GLOW)
    box(x, y + 4 * s, z, 1.15 * s, 0.25 * s, 1.15 * s, t.leaves[1], S.GLOW)
  },
  tower(box, x, y, z, s, r, t) {
    box(x, y + 4 * s, z, 3 * s, 8 * s, 3 * s, '#24243e', S.WINDOWS)
    box(x, y + 8.2 * s, z, 3.2 * s, 0.3 * s, 3.2 * s, t.leaves[1], S.GLOW)
  },
  cloud(box, x, y, z, s, r) {
    const h = y + 1.5 * s + r() * 2
    box(x, h, z, 3 * s, 1.2 * s, 2 * s, '#ffffff', S.SMOOTH)
    box(x + 0.9 * s, h + 0.6 * s, z, 1.6 * s, 1.2 * s, 1.6 * s, '#f4f8ff', S.SMOOTH)
  },
  pillar(box, x, y, z, s) {
    box(x, y + 2.2 * s, z, 1 * s, 4.4 * s, 1 * s, '#ffffff', S.STRIPES)
    box(x, y + 4.6 * s, z, 1.5 * s, 0.4 * s, 1.5 * s, '#ffd23a', S.GLOW)
  },
  star(box, x, y, z, s, r, t) {
    const h = y + 2 * s + r() * 2
    box(x, h, z, 1.1 * s, 1.1 * s, 1.1 * s, t.leaves[0], S.GLOW, r() * 3)
    box(x, h, z, 0.92 * s, 0.92 * s, 0.92 * s, t.leaves[0], S.GLOW, r() * 3 + 0.78)
  },
  flag(box, x, y, z, s, r, t) {
    box(x, y + 1.6 * s, z, 0.12 * s, 3.2 * s, 0.12 * s, '#dfe4ec', S.SMOOTH)
    box(x + 0.66 * s, y + 2.8 * s, z, 1.2 * s, 0.7 * s, 0.04 * s, t.leaves[0], S.STRIPES)
  },
  crater(box, x, y, z, s) {
    box(x, y + 0.2 * s, z, 2.6 * s, 0.4 * s, 2.6 * s, '#8a8e9a', S.SMOOTH)
    box(x, y + 0.25 * s, z, 1.6 * s, 0.4 * s, 1.6 * s, '#6a6e7a', S.SMOOTH)
  },
  icespike(box, x, y, z, s, r, t) {
    box(x, y + 1.8 * s, z, 0.7 * s, 3.6 * s, 0.7 * s, '#bff6ff', S.GLOW, r())
    box(x + 0.6 * s, y + 1 * s, z, 0.5 * s, 2 * s, 0.5 * s, t.leaves[0], S.GLOW, r())
  },
  planet(box, x, y, z, s, r, t) {
    const h = y + 3 * s + r() * 3
    box(x, h, z, 2.2 * s, 2.2 * s, 2.2 * s, t.leaves[Math.floor(r() * 3)], S.SMOOTH, r())
    box(x, h, z, 3.6 * s, 0.15 * s, 3.6 * s, '#ffffff', S.GLOW, r())
  },
  orb(box, x, y, z, s, r, t) {
    const h = y + 2 * s + r() * 2.5
    box(x, h, z, 0.9 * s, 0.9 * s, 0.9 * s, t.leaves[Math.floor(r() * 3)], S.GLOW, r())
  },
}

/** The most boxes any one DECOR builder writes (Stairs.jsx sizes its pool by it). */
export const DECOR_MAX_BOXES = 5
