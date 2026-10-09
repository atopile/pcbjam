# syntax=docker/dockerfile:1

# Package the already-built and tested PCBnew output. This Dockerfile does not
# compile KiCad; release.yml downloads wasm-build.yml's exact artifact first.
FROM docker.io/library/debian:bookworm-slim@sha256:60eac759739651111db372c07be67863818726f754804b8707c90979bda511df AS prepare

WORKDIR /pcbjam-assets

# release.yml creates this directory from the tested artifact, normalizing
# filenames before hashing. Copy the manifest and its exact files together.
COPY --from=wasm-output /kicad_editor.wasm ./kicad_editor.wasm
COPY --from=wasm-output /kicad_editor.js ./kicad_editor.js
COPY --from=wasm-output /wx.js ./wx.js
COPY --from=wasm-output /wx-dom.js ./wx-dom.js
COPY --from=wasm-output /images.tar.gz ./images.tar.gz
COPY --from=wasm-output /release.json ./release.json

RUN set -eu; \
    for file in release.json kicad_editor.wasm kicad_editor.js wx.js wx-dom.js images.tar.gz; do \
        test -s "$file" || { echo "missing or empty asset: $file" >&2; exit 1; }; \
    done; \
    wasm_bytes="$(stat -c %s kicad_editor.wasm)"; \
    # The JSPI PCB-only build is about 44 MiB (the old Asyncify floor was 50 MiB).
    test "$wasm_bytes" -ge 33554432 || { \
        echo "kicad_editor.wasm is unexpectedly small: $wasm_bytes bytes" >&2; \
        exit 1; \
    }; \
    test "$(od -An -tx1 -N4 kicad_editor.wasm | tr -d ' \n')" = "0061736d" || { \
        echo "kicad_editor.wasm has invalid magic" >&2; \
        exit 1; \
    }

FROM scratch

ARG PCBJAM_VERSION
ARG PCBJAM_REVISION

LABEL org.opencontainers.image.title="PCBjam web-IDE assets" \
      org.opencontainers.image.description="PCB-only KiCad WebAssembly bundle for atopile web IDE" \
      org.opencontainers.image.source="https://github.com/atopile/pcbjam" \
      org.opencontainers.image.version="${PCBJAM_VERSION}" \
      org.opencontainers.image.revision="${PCBJAM_REVISION}" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"

COPY --from=prepare /pcbjam-assets/ /pcbjam-assets/
