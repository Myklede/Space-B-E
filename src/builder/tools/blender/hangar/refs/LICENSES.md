# Asset provenance

All shipped meshes, UVs, baked AO, layout data and sandbox geometry were generated specifically for SpaceB&E. No downloaded models, trademarks or NASA logos are shipped.

## CC0 texture sources (detail pass, 2026-11-08)

| Source page | Licence | Use |
|---|---|---|
| https://polyhaven.com/a/blue_metal_plate | CC0 1.0 | Painted steel scratch/roughness/normal source; tinted grey, white, yellow and red by our original geometry colours. |
| https://polyhaven.com/a/hangar_concrete_floor | CC0 1.0 | Concrete albedo, roughness and OpenGL normal. |
| https://polyhaven.com/a/metal_plate | CC0 1.0 | Initial experiment, source files retained for provenance; not used in final export. |
| https://polyhaven.com/a/small_hangar_01 | CC0 1.0 | Existing game HDRI, referenced read-only from `/assets/polyhaven/hdri/small_hangar_01_1k.hdr`; not copied into the kit. |

Poly Haven's asset licence: https://polyhaven.com/license and https://creativecommons.org/publicdomain/zero/1.0/ . Source metadata with download URLs and checksums is retained in `../textures/*.json`. Only the 1K JPEG diffuse, roughness and OpenGL normal maps were downloaded. Export normals are resized to 512 square; colour and linear ORM atlases are our own Cycles bakes at 512 or 1024. Steel grating holes and bolts are original geometry, not sampled from photographs.

Local reference photos remain in the human's Downloads directory. They were inspected only. In particular the Alamy image is copyrighted and is not copied into this project or used as a texture. The licence of `images.jpg` and the supplied render is not established, so they are reference-only as well.

NASA factual sources are linked in NOTES.md. They inform dimensions and construction cues; no NASA photograph is redistributed. Screenshots in refs/shots are original renders of this kit.
