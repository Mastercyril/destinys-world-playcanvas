# Destiny's World: Lost Society in Time

A browser vertical slice of Act I. You are Detective Alex Morgan, on foot in Thornhaven after the city has already been emptied.

The streets are too quiet for a missing-persons case. Evacuation notices are stamped **YESTERDAY**. You were not told. Clocks disagree by hours. In the shop glass, your coat is half a second behind you. Two pieces of temporal residue are still on the boulevard: the evidence-locker fragment, and the storm-drain time bruise. Something with too many joints is walking the same street.

This is a web vertical slice (Vite, TypeScript, Three.js). It is one city block, not the Unity game, not a PlayCanvas/VIVERSE build, and not AAA fidelity. Mood, investigation, and a single hostile are the point.

**Play it:** [https://mastercyril.github.io/destinys-world-playcanvas/](https://mastercyril.github.io/destinys-world-playcanvas/)

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

The dev server and the preview both use the GitHub Pages base path `/destinys-world-playcanvas/`. No accounts, API keys, or backend.

## Controls

| Input | Action |
| --- | --- |
| Click | Enter the street and capture the mouse |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| C | Toggle crouch |
| Ctrl | Hold crouch |
| E | Examine, Read, or Collect |
| Left click or F | Melee (windup, then a short hit) |
| B | Cycle hands / barricade / portable lamp / crate |
| Click (while a prop is selected) | Place it on valid ground. Five of each. |
| Tab | Field journal |
| Esc | Pause |

Death reloads at the spawn, or at the last fragment you collected. Placed props stay for the session.

## What is on the block

Empty Boulevard, night. Wet asphalt, worn brick shells, street lamps, fog, rain. The precinct lobby is open. The Ancient One patrols, then hunts by sight and proximity. Barricades stop it. A placed lamp is a real light.

## Credits

Textures and the night HDRI are [Poly Haven](https://polyhaven.com) assets under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Copies live in `public/assets/`.

- [asphalt_04](https://polyhaven.com/a/asphalt_04) — diffuse, normal, roughness (1k)
- [brick_wall_001](https://polyhaven.com/a/brick_wall_001) — diffuse, normal, roughness (1k)
- [concrete_floor_worn_001](https://polyhaven.com/a/concrete_floor_worn_001) — diffuse, normal, roughness (1k)
- [rusty_metal_02](https://polyhaven.com/a/rusty_metal_02) — diffuse, normal, roughness (1k)
- [cobblestone_street_night](https://polyhaven.com/a/cobblestone_street_night) — 1k HDRI, image-based lighting only

Posters, the docket, the clock face, and the wood grain are generated in the page. Rain, the drone, footsteps, the strike, and the fragment chime are synthesized with WebAudio. No account is required to hear them; the browser must be allowed to start audio from your click.

Direct downloads used at build time are listed in [public/assets/CREDITS.txt](public/assets/CREDITS.txt).
