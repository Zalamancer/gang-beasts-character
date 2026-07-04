# Gang Beasts Character

An interactive 3D character viewer built with Three.js, featuring a gummy Beast with spring-based physics animation, facial expressions, and click-to-interact mechanics.

## Features

- Three.js WebGL rendering with soft shadows and PBR materials
- Physics-based jelly spring system for body lean, head bobble, and squash/stretch
- Multiple character design variants (a, b, c) accessible via URL query params
- Interactive poke mechanic (click the beast to push it around)
- Orbit controls to rotate and zoom the character
- Breathing and idle animation
- Procedurally-built character using geometric primitives (spheres, capsules, lathe)

## Run

1. Install dependencies: `npm install`
2. Start a static server in the project root: `npx http-server` (or `python -m http.server 8000`, etc.)
3. Open `http://localhost:8000` in your browser
4. Switch variants with keys `1`/`2`/`3` (variants a/b/c) or `0` (final merged design)
5. Click the beast to poke it; drag to orbit the camera

## Structure

- **index.html** — Canvas and HUD UI, import map for Three.js modules
- **main.js** — Scene setup, lighting, ground, character loading, interaction handlers, animation loop
- **character.js** — Final merged character design with spring physics and animation system
- **variants/a.js, b.js, c.js** — Three separate design explorations (different head mechanics and stance variations)
- **package.json** — Dependencies (Three.js only)

## Notes

`node_modules/` and any build artifacts are not committed; run `npm install` to restore dependencies before running the project.
