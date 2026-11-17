import { CylinderGeometry, SphereGeometry, TorusGeometry } from 'three'

import {
  COURT_BACK_X,
  COURT_HALF,
  PAD_COUNT,
  PAD_HEIGHT,
  PAD_RADIUS,
  PAD_X,
  padCenterZ,
  SHOP_SIGN,
  SHOP_SIGN_FACING,
  SHOP_STAGES,
  TABLE_NEAR_X,
} from '@shared/world'

import { STYLE } from '../materials'
import { PRACTICE_HALF, PRACTICE_RISE, PRACTICE_RUN, PRACTICE_STEPS, PRACTICE_TOP, PRACTICE_X0, THROW_TARGET_X } from '../practice'
import { addSlinky } from '../slinkyStyles'
import { venueOf } from '../sceneStyle'

/**
 * Static lobby structures, added to the world's shared BlockSet and prop builder so they
 * render in the same few draw calls as the grandstands.
 */

/**
 * Per-pad look, in pad order (matches PADS in shared/balance.js): the mat's base, top,
 * glowing ring and centre emblem, the board's frame and screen, the floor round the
 * stairs, and the colour of its labels. `beach` ones (Palm Beach's surf stairs) have a
 * surfboard and palm on top of their board.
 */
export const PAD_THEMES = [
  { base: '#0f8a7a', top: '#2fd6b8', ring: '#bffff0', emblem: '#ffffff', rail: '#0f9a88', court: '#127a6c', screen: '#bffff0', text: '#5fffe0' },
  { base: '#c85a10', top: '#ff8a2a', ring: '#ffe0a0', emblem: '#1d1f22', rail: '#d86a1a', court: '#a84e12', screen: '#ffe0a0', text: '#ffb06a' },
  { base: '#4a9a1a', top: '#7fe03a', ring: '#f0ffb8', emblem: '#ffffff', rail: '#5aa82a', court: '#3f8418', screen: '#f0ffb8', text: '#b8ff7a' },
  { base: '#1a5aa8', top: '#3a8dff', ring: '#bfe0ff', emblem: '#ffd21f', rail: '#1f66c0', court: '#174f94', screen: '#bfe0ff', text: '#8fc4ff' },
  { base: '#a8145a', top: '#ff3a8a', ring: '#ffc0dc', emblem: '#ffffff', rail: '#c01f68', court: '#8e124c', screen: '#ffc0dc', text: '#ff8ac0' },
  { base: '#5a3ad8', top: '#b8a0ff', ring: '#ffffff', emblem: '#2fc6ff', rail: '#6a4ae8', court: '#4a30b8', screen: '#ffffff', text: '#d0c0ff', style: STYLE.GLOW },
  { base: '#14183f', top: '#1a1240', ring: '#ff7a1a', emblem: '#2fc6ff', rail: '#1a1240', court: '#14183f', screen: '#ff7a1a', text: '#ffb06a', style: STYLE.GALAXY },
  // Palm Beach's beach bars: sand and surf, then a deep-sea wave.
  { base: '#e8c27a', top: '#ffe29a', ring: '#3fd8ff', emblem: '#ff7a3a', rail: '#2fb8e0', court: '#d9b46a', screen: '#3fd8ff', text: '#5fe6ff', beach: true },
  { base: '#0b4f8a', top: '#1a8fd8', ring: '#7ff6ff', emblem: '#ffffff', rail: '#0a6fb8', court: '#0b3f72', screen: '#7ff6ff', text: '#7ff6ff', style: STYLE.GLOW, beach: true },
]

const LINE = '#f4f7fb'
const LEG = '#3a3f4a'
/** The multiplier backboard: high above the bar, and compact. Labels centre on it (lobbyLabels). */
export const BOARD_BOTTOM = 4.8
export const BOARD_HEIGHT = 3.6

const DISC = new CylinderGeometry(1, 1, 1, 24)
const RING = new TorusGeometry(1, 0.08, 4, 28)
const CYL = new CylinderGeometry(1, 1, 1, 12)
const BALL = new SphereGeometry(1, 12, 8)

/**
 * A pad's lane floor, east of its mat: a coloured floor with white lines and a low barrier
 * at the back. Boxes go in `blocks`: no draw calls of their own.
 */
function buildCourt(blocks, z, theme) {
  const courtLength = COURT_BACK_X - (TABLE_NEAR_X - 0.4)
  const courtX = (TABLE_NEAR_X - 0.4 + COURT_BACK_X) / 2
  blocks.addOn(courtX, 0, z, courtLength, 0.05, COURT_HALF * 2, theme.court, STYLE.SMOOTH)
  // Its lines stand 4 cm proud of the floor (nothing within 3 cm of another surface).
  for (const s of [-1, 1]) blocks.addOn(courtX, 0.05, z + s * (COURT_HALF - 0.15), courtLength - 0.3, 0.04, 0.12, LINE, STYLE.SMOOTH)
  blocks.addOn(COURT_BACK_X - 0.3, 0.05, z, 0.12, 0.04, COURT_HALF * 2 - 0.42, LINE, STYLE.SMOOTH)

  // The barrier across the back: panels in two colours with a glowing top.
  for (let i = 0; i < 3; i += 1) {
    const pz = z - COURT_HALF + (i + 0.5) * ((COURT_HALF * 2) / 3)
    blocks.addOn(COURT_BACK_X, 0, pz, 0.22, 0.75, (COURT_HALF * 2) / 3 - 0.06, i % 2 ? theme.top : '#1f2a5c', STYLE.SMOOTH)
  }
  blocks.addOn(COURT_BACK_X, 0.75, z, 0.26, 0.08, COURT_HALF * 2, theme.ring, STYLE.GLOW)
}

/** Spare slinkies in each pad's crate, in their colours. */
const CRATE_SLINKIES = ['#3a6bff', '#ff5a7a', '#2fc6ff', '#ffd21f']

/**
 * A pad's practice staircase (the tosser stands on the mat facing east and tosses onto its
 * landing, practice.js): a glowing toss line on the mat, a crate of spare slinkies beside
 * the spot, the staircase itself - a landing and PRACTICE_STEPS steps down, in the pad's
 * colours with glowing noses - and at its foot the target, red and white rings with a
 * glowing bullseye, where the practice slinkies end up; then the big backboard the pad's
 * multiplier label (labels/lobbyLabels.js) hangs in front of.
 *
 * Everything east of x = TABLE_NEAR_X stays inside the pad's static collider
 * (shared/world.js): the stairs are for slinkies, not for walking down.
 */
function buildThrowLane(blocks, props, z, theme) {
  const top = PAD_HEIGHT
  blocks.addOn(PAD_X + 1.55, top + 0.01, z, 0.2, 0.05, 3.4, '#ffffff', STYLE.GLOW)
  // The crate of spare slinkies, behind and to the left of where you stand.
  const cx = PAD_X - 1.3
  const cz = z - 1.75
  blocks.addOn(cx, top, cz, 1.2, 0.5, 0.8, '#c98f52', STYLE.SMOOTH)
  // Bands round the crate, standing well proud of its sides.
  for (const dz of [-0.37, 0.37]) blocks.addOn(cx, top + 0.1, cz + dz, 1.3, 0.08, 0.14, '#8a5a32', STYLE.SMOOTH)
  // Each a short stack of coils as boxes (a dozen triangles a coil: nine crates of them).
  CRATE_SLINKIES.forEach((color, i) => {
    const px = cx - 0.39 + i * 0.26
    const pz = cz + (i % 2 ? 0.12 : -0.1)
    for (let k = 0; k < 3; k += 1) blocks.addOn(px, top + 0.5 + k * 0.07, pz, 0.2, 0.05, 0.2, k % 2 ? '#ffffff' : color, STYLE.SMOOTH, 0.4 * k)
  })
  // The staircase: a landing, then the steps down to the floor, each a solid block in the
  // pad's colours with a glowing strip along its nose, a rail either side.
  // Steps meet exactly (overlapping, their sides would share a plane and flicker); each
  // nose stands 5 cm proud of its riser and 6 cm over its tread, its ends buried in the
  // rails, and the rails stand 5 cm in from the sides.
  for (let i = 0; i <= PRACTICE_STEPS; i += 1) {
    const x = PRACTICE_X0 - i * PRACTICE_RUN
    const h = PRACTICE_TOP - i * PRACTICE_RISE
    blocks.addOn(x, 0, z, PRACTICE_RUN, h, PRACTICE_HALF * 2, i % 2 ? theme.top : theme.base, i === 0 ? STYLE.PLATE : STYLE.STUDS)
    blocks.addOn(x - PRACTICE_RUN / 2 + 0.07, h - 0.14, z, 0.24, 0.2, (PRACTICE_HALF - 0.12) * 2, theme.ring, STYLE.GLOW)
    for (const side of [-1, 1]) blocks.addOn(x, h, z + side * (PRACTICE_HALF - 0.13), PRACTICE_RUN - 0.04, 0.3, 0.16, theme.rail, STYLE.SMOOTH)
  }
  // The target at the foot of the stairs: rings stepping up a little each, the bullseye glowing.
  const tx = THROW_TARGET_X
  // Each ring 4 cm over the one under it: any closer and they flicker seen from afar.
  props.add(DISC, { position: [tx, 0.07, z], scale: [0.55, 0.04, 0.55], color: '#ffffff' })
  props.add(DISC, { position: [tx, 0.11, z], scale: [0.43, 0.04, 0.43], color: '#ff3b3b' })
  props.add(DISC, { position: [tx, 0.15, z], scale: [0.3, 0.04, 0.3], color: '#ffffff' })
  props.add(DISC, { position: [tx, 0.19, z], scale: [0.17, 0.04, 0.17], color: theme.ring, style: STYLE.GLOW })

  // The backboard behind it, kept small and high so the follow camera behind the trainee
  // (west of the mat, looking east) sees it over their head rather than a wall of it: a
  // navy panel in a rail-coloured frame with a glowing border in the bar's ring colour,
  // on two thin posts, a gold dumbbell on top.
  const bx = PAD_X + 5.6
  const by = BOARD_BOTTOM
  const bh = BOARD_HEIGHT
  for (const s of [-1, 1]) blocks.addOn(bx, 0, z + s * 1.5, 0.25, by, 0.25, LEG, STYLE.SMOOTH)
  blocks.addOn(bx, by, z, 0.4, bh, 4.2, theme.rail, STYLE.SMOOTH)
  blocks.addOn(bx - 0.23, by + 0.2, z, 0.08, bh - 0.4, 3.8, '#141a3a', STYLE.SMOOTH)
  blocks.addOn(bx - 0.28, by + 0.12, z, 0.06, 0.1, 3.9, theme.ring, STYLE.GLOW)
  blocks.addOn(bx - 0.28, by + bh - 0.22, z, 0.06, 0.1, 3.9, theme.ring, STYLE.GLOW)
  // The upright strips a step proud of the crossbars, and clear of the panel's top and foot.
  for (const s of [-1, 1]) blocks.addOn(bx - 0.32, by + 0.26, z + s * 1.9, 0.06, bh - 0.52, 0.1, theme.ring, STYLE.GLOW)
  if (theme.beach) {
    // A surfboard standing on end on top, and a little palm beside it.
    props.add(BALL, { position: [bx, by + bh + 1.0, z - 0.7], scale: [0.14, 0.95, 0.34], color: theme.ring })
    props.add(BALL, { position: [bx, by + bh + 1.0, z - 0.7], scale: [0.15, 0.8, 0.07], color: '#ffffff' })
    blocks.addOn(bx, by + bh, z + 0.9, 0.22, 1.5, 0.22, '#9a6a3a', STYLE.SMOOTH)
    blocks.add(bx, by + bh + 1.62, z + 0.9, 1.6, 0.18, 0.5, '#2fae4a', STYLE.SMOOTH, 0.4)
    blocks.add(bx, by + bh + 1.66, z + 0.9, 0.5, 0.16, 1.6, '#4cd36a', STYLE.SMOOTH, 0.4)
  } else {
    // A big rainbow slinky standing on top of the board.
    addSlinky(props, 'pizza', { position: [bx, by + bh, z], scale: 1.3, rings: 9, low: true })
  }
}

/**
 * The practice stairs: round two-tier mats in the pad's colours with a glowing ring round
 * the top, each with its little staircase and target beyond. The rounded parts go
 * into the world's props, the rest into its blocks: no draw calls of their own.
 */
export function buildPads(blocks, props) {
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const theme = PAD_THEMES[i]
    const z = padCenterZ(i)
    const r = PAD_RADIUS
    props.add(DISC, { position: [PAD_X, PAD_HEIGHT * 0.4, z], scale: [r + 0.45, PAD_HEIGHT * 0.8, r + 0.45], color: theme.base })
    props.add(DISC, { position: [PAD_X, PAD_HEIGHT - 0.06, z], scale: [r, 0.14, r], color: theme.top, style: theme.style ?? STYLE.STUDS })
    props.add(RING, { position: [PAD_X, PAD_HEIGHT + 0.02, z], rotation: [Math.PI / 2, 0, 0], scale: [r - 0.25, r - 0.25, 1], color: theme.ring, style: STYLE.GLOW })
    // The mat's emblem: a glowing disc either side of where you stand.
    for (const s of [-1, 1]) {
      props.add(CYL, { position: [PAD_X - 1.9, PAD_HEIGHT + 0.03, z + s * 1.6], scale: [0.46, 0.04, 0.46], color: theme.emblem === '#1d1f22' ? '#ffffff' : theme.emblem })
      props.add(CYL, { position: [PAD_X - 1.9, PAD_HEIGHT + 0.08, z + s * 1.6], scale: [0.26, 0.04, 0.26], color: theme.ring, style: STYLE.GLOW })
    }
    buildThrowLane(blocks, props, z, theme)
    buildCourt(blocks, z, theme)
  }
}

const WHITE = '#f4f7fb'

/**
 * The slinky shop: two open display stages (the stands on them are SlinkyShop's) and the
 * big SLINKY SHOP sign behind, built like the start arch - white decks on a yellow band with
 * gold light strips round the edges. `detail` (off on LOW) adds the sign's bulbs.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on.
 */
export function buildShop(blocks, { detail = true, world = 0 } = {}) {
  const { band: YELLOW, strip: PALE, post: GOLD, panel: NAVY } = venueOf(world).shop
  for (const s of SHOP_STAGES) {
    const w = s.maxX - s.minX
    const d = s.maxZ - s.minZ
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    blocks.addOn(cx, -0.1, cz, w, s.height + 0.1, d, WHITE)
    blocks.addOn(cx, 0, cz, w + 0.3, s.height * 0.5, d + 0.3, YELLOW)
    // Light strips along all four top edges, and a gold post at each corner.
    for (const side of [-1, 1]) {
      blocks.addOn(cx + side * (w / 2 - 0.25), s.height, cz, 0.35, 0.08, d - 1.4, PALE, STYLE.GLOW)
      blocks.addOn(cx, s.height, cz + side * (d / 2 - 0.25), w - 1.4, 0.08, 0.35, PALE, STYLE.GLOW)
      for (const end of [-1, 1]) {
        blocks.addOn(cx + side * (w / 2 - 0.35), s.height, cz + end * (d / 2 - 0.35), 0.6, 0.7, 0.6, GOLD, STYLE.GLOW)
      }
    }
  }

  // The sign: two striped legs, a navy panel in a yellow frame, a gold cap, its face
  // turned to the plaza (`f`).
  const { x, minZ, maxZ, top } = SHOP_SIGN
  const f = SHOP_SIGN_FACING
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const bottom = top - 8.2
  for (const z of [minZ + 1.5, maxZ - 1.5]) blocks.addOn(x - 0.1 * f, 0, z, 0.9, bottom + 0.3, 0.9, YELLOW, STYLE.STRIPES)
  blocks.addOn(x, bottom, midZ, 0.6, top - bottom, length, YELLOW)
  blocks.addOn(x + 0.1 * f, bottom + 0.5, midZ, 0.6, top - bottom - 1, length - 1, NAVY, STYLE.SMOOTH)
  blocks.addOn(x, top, midZ, 0.9, 0.4, length + 0.4, GOLD, STYLE.GLOW)
  if (detail) {
    for (let z = minZ + 1; z <= maxZ - 0.99; z += 1.5) {
      blocks.add(x + 0.42 * f, bottom + 0.25, z, 0.16, 0.3, 0.3, Math.round(z) % 2 ? '#ffffff' : GOLD, STYLE.GLOW)
      blocks.add(x + 0.42 * f, top - 0.25, z + 0.75, 0.16, 0.3, 0.3, Math.round(z) % 2 ? GOLD : '#ffffff', STYLE.GLOW)
    }
  }
}
