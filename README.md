# CVify

**Computer vision games in the browser.** Play with your face—no controllers, no backend. All camera and face processing runs locally via MediaPipe.

## Games

### SnakeCV

New version of the classic snake game, but instead with head direction inputs. The goal is to grow longer by eating apples, avoiding walls and your own body. 

### Slither

Inspired heavily by Slither.io.
The goal is to grow by eating pellets, avoiding other snakes. The last snake standing wins. 
Open your mouth to activate a speed boost. 
Currently buggy because of toroidal map rendering...
(Multiplayer coming soon??)

## Tech stack

- **React** + **Vite** — Frontend and build.
- **MediaPipe Tasks Vision** — Face Landmarker runs in the browser (WebAssembly) for facial landmarks (e.g. nose, eyes, mouth)
- **No backend** — TODO (multiplayer??? maybe)

## Prerequisites

- A modern browser with camera access (Chrome, Firefox, Safari, Edge).

## Running Locally:

```bash
cd frontend
npm install
npm run dev
```

Open the URL in the terminal (usually http://localhost:5173). From the landing page, play a game (more coming soon??). 

Optional env for custom MediaPipe assets (e.g. self-hosted):

- `VITE_MEDIAPIPE_WASM_URL` — WASM base URL
- `VITE_FACE_LANDMARKER_MODEL_URL` — Face Landmarker model URL

## Privacy

Video and face landmarks are processed only in your browser by MediaPipe. Nothing is recorded or sent to any server (trust me). 

## Accessibility

Both games are playable with the keyboard; head tracking is optional. If the camera is unavailable or the Face toggle is off, you can still play SnakeCV with arrows/WASD (though less fun). 

## License

See [LICENSE](LICENSE) in this repository.
