# Destiny's World: Lost Society in Time

A browser vertical slice of Acts I–II. You are Detective Alex Morgan, on foot in Thornhaven after the city has already been emptied.

The streets are too quiet for a missing-persons case. Evacuation notices are stamped **YESTERDAY**. You were not told. Clocks disagree by hours. In the shop glass, your coat is half a second behind you. Four pieces of temporal residue remain: two on the boulevard, two below it in the Neon Underpass — and at the end of the tunnel, the Heart.

This is a web vertical slice (Vite, TypeScript, Three.js). It is one city block plus a neon metro underpass, not the Unity game, not a PlayCanvas/VIVERSE build, and not AAA fidelity. Mood, investigation, and a single hostile are the point.

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
| N | Camcorder night vision (green) |
| M | AI builder mode — generate NPCs into the world, design new game concepts |
| E (near a survivor) | Talk — Mirella, Ghost, Warden Kael, Sable, and anyone the AI spawns |

| Tab | Field journal |
| Esc | Pause |

## The game loop

Collect **4 temporal fragments** — two on the boulevard, two in the Neon Underpass. At two fragments the north gate loses power and the **underpass** opens: wet concrete, Japanese neon, Ghost's hacker den, and the **Heart** portal at the end. Enter the Heart with all four fragments to close Act I. The Ancient One patrols the boulevard the whole time: fight it, hide from it, or die and respawn at your last checkpoint.

The camcorder light stays on. Night vision is the green grade, the way a tape camera washes a hallway.

## AI builder mode

Press **M** in game. The same deterministic generator that runs daily in the [AI-Alien-Horror-Game repo](https://github.com/Mastercyril/AI-Alien-Horror-Game) works inside the slice: seed it with a prompt and spawn a fully-dressed NPC with dialogue, or synthesize a complete new game concept (genre, core loop, mechanics, antagonist, art direction) filed to your journal. No API keys — it runs entirely in your browser.

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

Character meshes, the decaying plaster, and the rest of the third-party files are credited in [CREDITS.md](CREDITS.md). Direct texture URLs are also listed in [public/assets/CREDITS.txt](public/assets/CREDITS.txt).
