# CVified

**Computer vision games in the browser.** Play with your face—no controllers, no backend. All camera and face processing runs locally via MediaPipe.

## Games

### SnakeCV

Classic Snake controlled by your head. Move your face (or use the keyboard) to steer. Eat pellets, avoid walls and your own tail.

- **Head steering** — Nose/face movement maps to direction; the view is mirrored so it feels natural.
- **Keyboard** — Arrow keys or WASD work as full alternatives.
- **Recalibrate** — Reset the head-tracking center if the snake drifts.
- **Face toggle** — Turn head tracking on or off; keyboard still works when off.

### Slither

Continuous snake: grow by eating pellets, avoid other snakes and walls. Last snake standing wins. Bot opponents only for now.

- **Head steering** — Same face-tracking as SnakeCV; sensitivity slider to tune responsiveness.
- **Speed boost** — Open your mouth to trigger a short speed burst (with cooldown).
- **Pre-game calibration** — A short countdown before each game so you can get your face in frame.
- **Recalibrate** — Recenter head tracking anytime.
- **Pause / Resume** — Pause the simulation without losing progress.

## Tech stack

- **React** + **Vite** — Frontend and build.
- **React Router** — Landing page and game routes.
- **MediaPipe Tasks Vision** — Face Landmarker runs in the browser (WebAssembly) for nose position, head angle, and mouth openness.
- **No backend** — Camera and face data stay in your browser; nothing is recorded or sent to a server.

## Prerequisites

- **Node.js** 18+
- A modern browser with camera access (Chrome, Firefox, Safari, Edge).
- **HTTPS or localhost** — Browsers require a secure context for `getUserMedia`; plain HTTP is blocked except on localhost.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open the URL in the terminal (usually http://localhost:5173). From the landing page, pick **SnakeCV** or **Slither**.

## Scripts

| Command           | Description                |
|-------------------|----------------------------|
| `npm run dev`     | Start Vite dev server      |
| `npm run build`   | Production build → `dist/` |
| `npm run preview` | Serve production build     |
| `npm run lint`    | Run ESLint                 |
| `npm run format`  | Prettier on `src/`         |
| `npm run test`    | Run Vitest                 |

## Build & deployment

The app builds to `frontend/dist/`. Serve that directory with any static host (e.g. nginx, GitHub Pages, Netlify, Vercel). For a subpath (e.g. `https://example.com/cvified/`), set `base: '/cvified/'` in `frontend/vite.config.js` and rebuild.

Optional env for custom MediaPipe assets (e.g. self-hosted):

- `VITE_MEDIAPIPE_WASM_URL` — WASM base URL
- `VITE_FACE_LANDMARKER_MODEL_URL` — Face Landmarker model URL

## Privacy

Video and face landmarks are processed only in your browser by MediaPipe. Nothing is recorded or sent to any server.

## Accessibility

Both games are playable with the keyboard; head tracking is optional. If the camera is unavailable or the Face toggle is off, you can still play SnakeCV with arrows/WASD. Overlays (Game Over, calibration, errors) use appropriate roles and labels for screen readers.

## License

See [LICENSE](LICENSE) in this repository.
