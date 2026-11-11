# Credits

This slice uses only assets that can be redistributed. Each one keeps the license it shipped with.

## Characters

Realistic rigged humans, generated with [MakeHuman](https://static.makehumancommunity.org/) / MPFB 2 and the CC0 system-asset pack (skin, eyes, suit, shoes).

- Meshes and textures: **CC0 1.0**. The packed files are `public/assets/models/inmate.glb` (adult male), `civilian.glb` (adult female), and `detective.glb` (suited male).
- Source export used as the starting point: the sample library in [kunalkushwaha/vsim](https://github.com/kunalkushwaha/vsim) (`packages/assets/library/man.glb`, `human.glb`, `suited.glb`), which documents the same CC0 MakeHuman origin.
- Included motion: `walk` is retargeted motion capture from the [CMU Graphics Lab Motion Capture Database](https://mocap.cs.cmu.edu/) (subject 07, trial 01), free for research and commercial use; please keep this acknowledgement. `idle`, `run`, and `wave` were keyed for that sample library and are used under the library's MIT terms. The melee and flashlight poses in this project are original clips built on top of the idle arm orientation.
- The Ancient One and the body in the hall are the male mesh with a scar/blood overlay, wet clearcoat, and a thickness/attenuation skin term. The woman on the sidewalk is the female mesh. Alex Morgan's mirror body and first-person arms are the suited mesh.

They are compressed with **Meshopt** (geometry and animation) and **KTX2 / Basis** (textures) via [glTF Transform](https://gltf-transform.dev/). Draco was not used on the skinned files: it does not compress the animation tracks, and quantizing joint weights on these rigs is a poor trade. The runtime still ships the three.js Basis transcoder (`public/basis/`).

## Environment

[Poly Haven](https://polyhaven.com), **CC0**:

- asphalt_04, brick_wall_001, concrete_floor_worn_001, rusty_metal_02 (1k diffuse / normal / roughness)
- painted_plaster_wall (1k) for the rotting hallway
- cobblestone_street_night (1k HDRI, image-based lighting only)

Ivy cards, blood/grime overlays, posters, the docket, and the clock face are drawn in the page. Rain, the drone, footsteps, strikes, and the fragment chime are WebAudio. No sampled music.

Direct texture URLs are repeated in [public/assets/CREDITS.txt](public/assets/CREDITS.txt).
