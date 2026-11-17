# Coil Cascade - client

Drop your slinky down the Great Staircase: React 19 + React Three Fiber + three.js, built
with Vite. Game rules and data live in `../shared` (also used by the server).

```sh
npm ci
npm run dev            # http://localhost:5173 (?offline plays without a server)
npm run build          # production build in dist/
npm run lint
```

Useful URL flags: `?offline` (local authority, no server), `?debug` (exposes `window.__pp`,
including `__pp.testDrop(stairs)` to play a drop of any length), `?perf` (dev only: the
r3f-perf overlay).

Where things are:

| What | File |
|------|------|
| Slinkies, stages, prices, worlds | `../shared/balance.js` |
| Each slinky's colours and aura | `src/game/slinkyStyles.js` |
| Aura shaders (shell + particles) | `src/game/fx/auraMaterial.js`, `src/game/fx/Aura.jsx` |
| The staircase (streamed window) | `src/game/roll/Stairs.jsx` |
| Stage looks (20 themes) | `src/game/roll/stageThemes.js` |
| Drop timeline and flips | `src/game/roll/stairsPath.js` |
| The slinky walking the stairs | `src/game/roll/Slinky.jsx` |
| Drop camera, trophies, speed lines | `src/game/roll/Roll.jsx` |
| Practice stairs | `src/game/practice.js`, `src/game/PracticeThrows.jsx`, `src/game/world/structures.js` |
| Slinky shop / Slinkies panel | `src/game/world/SlinkyShop.jsx`, `src/ui/panels/SlinkiesPanel.jsx` |
| Quality presets | `src/store/quality.js` |
