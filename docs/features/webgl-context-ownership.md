# WebGL preview context ownership

Opening pad properties creates a second WebGL canvas. The WASM wxGLContext
constructor ignores its context-sharing argument, but WEBGL_GAL previously
shared a static font texture across renderers. The preview bound a texture from
the board canvas, producing GL_INVALID_OPERATION (1282). The subsequent error
check threw `setting bitmap font sampler as shader parameter: invalid operation`.
Graphics recovery created another renderer which repeated the same failure.

The font atlas must be owned by each WEBGL_GAL and deleted while that renderer's
context is current. This is separate from the pad dialog's display-options
lifetime fix: keeping those options alive prevents invalid access during recovery,
but does not make cross-context texture binding valid.

Fixing the font atlas also exposed the global FULLSCREEN_QUAD. Its vertex arrays
and buffers belonged to the first context, leaving the preview black when used
in another context. WEBGL_COMPOSITOR now owns its fullscreen geometry; both blit
and SMAA passes use that instance. Compositor destruction occurs with the owning
renderer context current.

## Validation

Built the PCB editor using the cached Docker toolchain and the repository's
finalize/Asyncify/optimization pipeline. Tested in headed Firefox with software
WebGL on a workspace board, using browser-local asset overrides rather than
replacing the served assets.

- Original binary: reproduced two foreign texture bindings, GL error 1282 in
  both the original and recovery canvases, followed by runtime failures.
- Display-options lifetime fix alone: still reproduced both foreign texture
  bindings and GL errors.
- Font ownership alone: eliminated the foreign texture binding but exposed
  fullscreen geometry errors and a black preview.
- Font and geometry ownership: preview visibly rendered, four alternating
  Cancel/OK close-and-reopen cycles passed, and drag selection worked afterward.
  Browser instrumentation recorded no foreign texture/buffer/vertex-array/program
  uses, no nonzero glGetError results, and no runtime exceptions.

The test intercepted board-save POSTs in its browser to keep the workspace board
unchanged. This was an interactive regression check, not a full E2E-suite run.
Native OpenGL rendering and other browsers were not tested.

SHA-256 of the tested WASM binaries:

| Build | SHA-256 |
| --- | --- |
| Original | `e4c3b2a5cbe33cd3b29290f34e4c6603fb59c32dda23d1777463067e6362a7c9` |
| Lifetime fix alone | `0ae25bc1cd6c78e7e21f3db5e552fcb1e5679e6f80f375c1ab71e8d2c7c2c08c` |
| Lifetime and WebGL ownership fixes | `0be3fbdc3d678576e0ffc9cf882cf067b02764276ad12191bcdd7fb1e60cd386` |
