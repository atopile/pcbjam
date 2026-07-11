# KiCad WebAssembly Port

Forked from [emergence-engineering/pcbjam](https://github.com/emergence-engineering/pcbjam) to add atopile specific changes on top.
Goal is to upstream all the generic changes to the original repository.

Changes:
- remove all features that are not related to PCB design (e.g. schematic, 3D viewer, etc.)
- custom color theme support
- bidirectional sync support

## Web-IDE asset image

Tagged releases build and test the standalone PCB editor, then publish the
tested files as `ghcr.io/atopile/pcbjam-assets`. The image is a static artifact:
it has no entrypoint or runtime and exposes its bundle at `/pcbjam-assets` for
the atopile web-IDE Dockerfile to copy by immutable digest.

The packager takes the tested `output/` directory as an explicit BuildKit named
context, so those large generated files remain excluded from ordinary Docker
source contexts.

Local web-IDE development continues to consume `output/` directly. Build it
with:

```sh
./docker/build.sh pcbnew --build-deps
```
