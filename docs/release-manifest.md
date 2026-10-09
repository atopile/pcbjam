# Web IDE release metadata

Every new asset release contains `/pcbjam-assets/release.json`. This file is
generated, never maintained by hand.

`docker/build.sh` exports the PCB editor's generated `kicad_build_version.h`
and the synced KiCad source commit (`kicad_source_revision.txt`) with the compiled
artifact. Source mirrors exclude `.git`, so KiCad may compile a zero commit hash;
the separately recorded commit supplies that provenance. Both files travel with
the WASM output cache and the tested `wasm-output` artifact.

The publish job runs `scripts/deploy/release-manifest.mjs` against that artifact.
It verifies the release checkout and pinned KiCad commit, reads KiCad's compiled
version, normalizes the editor filenames and JS WASM reference, then hashes all
five final assets. The resulting `release-assets` directory is the asset image's
named build context. The manifest contains:

- `schema_version`: currently 1.
- `pcbjam`: release `version` and full source `revision`.
- `kicad`: compiled `version` and full source `revision`.
- `assets`: final asset basenames mapped to SHA-256 digests.

Required metadata and assets must exist and agree; packaging fails otherwise.
The release version comes from the workflow's release tag, not a second constant.
Do not rename or modify packaged files without regenerating the manifest.

Run the packaging tests with
`node --test scripts/deploy/release-manifest.test.mjs`. The reusable build workflow
also runs them before compiling.
