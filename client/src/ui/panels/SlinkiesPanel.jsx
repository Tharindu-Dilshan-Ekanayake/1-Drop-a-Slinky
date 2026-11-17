import { useMemo } from 'react'
import { Color } from 'three'

import { RARITIES, TIRES, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { outline2D } from '../../game/ringShapes'
import { ringColor, slinkyLook, slinkyStyle } from '../../game/slinkyStyles'
import { standState } from '../../game/labels/lobbyLabels'
import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const RINGS = 8
const _c = new Color()

/** One ring of `shape` seen from a little above: its outline squashed flat, turned by `turn`. */
function ringPath(points, cx, cy, rx, ry, turn) {
  const c = Math.cos(turn)
  const sn = Math.sin(turn)
  let d = ''
  points.forEach(([x, y, z], i) => {
    const px = x * c - y * sn
    const py = x * sn + y * c
    d += `${i ? 'L' : 'M'}${(cx + px * rx).toFixed(1)} ${(cy + py * ry - z * rx * 0.55).toFixed(1)}`
  })
  return `${d}Z`
}

/**
 * Slinky `id` as a little picture: its rings in its own shape and colours, stacked and
 * twisted as on its stand, its glowing caps, in front of its aura (the aura's three
 * colours, softly pulsing - .pp-aura in index.css).
 */
function SlinkyPicture({ id, size = 120, dim = false }) {
  const look = useMemo(() => slinkyLook(id), [id])
  const rings = useMemo(() => {
    const points = outline2D(look.shape, look.shape === 'spiky' ? 72 : 48)
    const r = 25 * Math.min(1.1, look.size)
    return Array.from({ length: RINGS }, (_, i) => {
      const end = look.caps && (i === 0 || i === RINGS - 1)
      const k = end ? 1.08 : 1
      return {
        d: ringPath(points, 50, 76 - i * 7, r * k, r * 0.34 * k, i * look.twist),
        color: end ? look.caps : `#${ringColor(id, i, RINGS, _c).getHexString()}`,
      }
    })
  }, [id, look])
  const [a, b, c] = slinkyStyle(id).aura.colors
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: u(size), height: u(size) }}>
      <span
        className="pp-aura absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${b}cc 0%, ${a}88 38%, ${c}33 62%, transparent 72%)`, opacity: dim ? 0.6 : 1 }}
      />
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ position: 'relative', filter: dim ? 'brightness(0.8)' : undefined }}>
        {rings.map((ring, i) => (
          <g key={i}>
            <path d={ring.d} fill="none" stroke="#111" strokeWidth="6.5" strokeLinejoin="round" />
            <path d={ring.d} fill="none" stroke={ring.color} strokeWidth="3.2" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
    </span>
  )
}

const RARE_TEXT = new Set(['secret', 'divine', 'celestial'])

/**
 * Every slinky in the game - all thirty-six, in shop order - with its look and aura, its
 * Power and its rarity: equip any you own, buy the next one from here (or at its stand in
 * the slinky shop). The twelve Palm Beach slinkies say where to go for them.
 */
export function SlinkiesPanel() {
  const profile = useGame((s) => s.profile)
  const owned = profile.ownedTires
  const count = owned.length
  return (
    <Panel title="SLINKIES" icon="tire" width={1160}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: u(10), marginBottom: u(12) }}>
        <span style={{ fontSize: u(34) }}>
          <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
            {`Collected ${count} / ${TIRES.length}`}
          </StrokeText>
        </span>
        <span style={{ fontSize: u(24) }}>
          <StrokeText stroke={u(5)} fill="#bfe6ff">
            Every slinky has its own aura!
          </StrokeText>
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(196)}, 1fr))`, gap: u(12) }}>
        {TIRES.map((tire, index) => {
          const state = standState(profile, index)
          const rarity = RARITIES[tire.rarity]
          const elsewhere = tire.world !== undefined && (profile.world || 0) !== tire.world
          const mine = state === 'equipped' || state === 'owned'
          let button
          if (state === 'equipped') {
            button = (
              <ChunkyButton gradient={GRADIENTS.greenButton} disabled className="w-full" style={{ height: u(56) }}>
                <span style={{ fontSize: u(26) }}>
                  <StrokeText stroke={u(5)}>EQUIPPED</StrokeText>
                </span>
              </ChunkyButton>
            )
          } else if (mine) {
            button = (
              <ChunkyButton gradient={GRADIENTS.blueButton} onClick={() => actions.equipTire(tire.id)} className="w-full" style={{ height: u(56) }}>
                <span style={{ fontSize: u(28) }}>
                  <StrokeText stroke={u(5)}>EQUIP</StrokeText>
                </span>
              </ChunkyButton>
            )
          } else if (elsewhere) {
            button = (
              <ChunkyButton gradient={GRADIENTS.slate} disabled className="w-full" style={{ height: u(56) }}>
                <span style={{ fontSize: u(20) }}>
                  <StrokeText stroke={u(4)}>{`${WORLDS[tire.world].name.toUpperCase()} ONLY`}</StrokeText>
                </span>
              </ChunkyButton>
            )
          } else if (state === 'buy') {
            const afford = profile.wins >= tire.cost
            button = (
              <ChunkyButton gradient={afford ? GRADIENTS.goldButton : GRADIENTS.greyButton} disabled={!afford} onClick={() => actions.buyTire(tire.id)} className="w-full" style={{ height: u(56) }}>
                <Price amount={tire.cost} size={28} afford={afford} />
              </ChunkyButton>
            )
          } else {
            button = (
              <ChunkyButton gradient={GRADIENTS.greyButton} disabled className="w-full" style={{ height: u(56) }}>
                <span style={{ fontSize: u(20) }}>
                  <StrokeText stroke={u(4)}>{`LOCKED · ${formatNumber(tire.cost)}`}</StrokeText>
                </span>
              </ChunkyButton>
            )
          }
          return (
            <div
              key={tire.id}
              className="flex flex-col items-center text-center"
              style={{
                padding: u(10),
                borderRadius: u(10),
                border: `${u(5)} solid ${state === 'equipped' ? '#3fdc4a' : '#111'}`,
                background: mine ? 'linear-gradient(180deg, #2c3446 0%, #1c2230 100%)' : 'linear-gradient(180deg, #262a33 0%, #17191e 100%)',
                boxShadow: `inset 0 0 ${u(18)} ${rarity.color}55`,
              }}
            >
              <SlinkyPicture id={tire.id} size={124} dim={!mine && state === 'locked'} />
              <span style={{ fontSize: u(tire.name.length > 13 ? 24 : 28), lineHeight: 1.1 }}>
                <StrokeText stroke={u(6)} style={{ whiteSpace: 'normal' }}>
                  {tire.name}
                </StrokeText>
              </span>
              <span style={{ fontSize: u(20), margin: `${u(2)} 0` }}>
                <StrokeText stroke={u(4)} gradient={RARE_TEXT.has(tire.rarity) ? GRADIENTS.rainbow : `linear-gradient(180deg, #ffffff, ${rarity.color})`}>
                  {rarity.name.toUpperCase()}
                </StrokeText>
              </span>
              <span style={{ fontSize: u(24), marginBottom: u(6) }}>
                <StrokeText stroke={u(5)} gradient={GRADIENTS.gold}>{`+${formatNumber(tire.power)} Power`}</StrokeText>
              </span>
              {button}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export default SlinkiesPanel
