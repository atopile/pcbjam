import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageRelease } from "./release-manifest.mjs";

const revision = "1".repeat(40);
const kicadRevision = "2".repeat(40);

function fixture(t) {
  const sourceDir = mkdtempSync(join(tmpdir(), "pcbjam-manifest-"));
  t.after(() => rmSync(sourceDir, { recursive: true, force: true }));
  writeFileSync(join(sourceDir, "kicad_build_version.h"),
    `#define KICAD_VERSION_FULL "10.0.0-dev-build"\n#define KICAD_COMMIT_HASH "${kicadRevision}"\n`);
  writeFileSync(join(sourceDir, "kicad_source_revision.txt"), kicadRevision + "\n");
  for (const name of ["pcbnew.wasm", "wx.js", "wx-dom.js", "images.tar.gz"]) {
    writeFileSync(join(sourceDir, name), name);
  }
  writeFileSync(join(sourceDir, "pcbnew.js"), 'load("pcbnew.wasm"); load("pcbnew.wasm");');
  return { sourceDir, destinationDir: join(sourceDir, "release"), version: "v0.1.12", revision, kicadRevision };
}

test("manifest describes the compiled KiCad build and hashes normalized release bytes", (t) => {
  const options = fixture(t);
  const manifest = packageRelease(options);
  assert.deepEqual(manifest.pcbjam, { version: options.version, revision });
  assert.deepEqual(manifest.kicad, { version: "10.0.0-dev-build", revision: kicadRevision });
  assert.equal(readFileSync(join(options.destinationDir, "kicad_editor.js"), "utf8"),
    'load("kicad_editor.wasm"); load("kicad_editor.wasm");');
  for (const [name, expected] of Object.entries(manifest.assets)) {
    const bytes = readFileSync(join(options.destinationDir, name));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  }
  assert.deepEqual(JSON.parse(readFileSync(join(options.destinationDir, "release.json"))), manifest);
  assert.deepEqual(packageRelease(options), manifest);
});

test("rejects a compiled artifact from a different KiCad revision", (t) => {
  const options = fixture(t);
  assert.throws(() => packageRelease({ ...options, kicadRevision: "3".repeat(40) }), /does not match/);
});

test("does not guess missing or unknown compiled version metadata", (t) => {
  const options = fixture(t);
  for (const header of ["", `#define KICAD_VERSION_FULL ""\n`,
    `#define KICAD_VERSION_FULL "10.0"\n#define KICAD_COMMIT_HASH "unknown"\n`]) {
    writeFileSync(join(options.sourceDir, "kicad_build_version.h"), header);
    assert.throws(() => packageRelease(options));
  }
});

test("source mirrors without .git use build-time source provenance", (t) => {
  const options = fixture(t);
  writeFileSync(join(options.sourceDir, "kicad_build_version.h"),
    `#define KICAD_VERSION_FULL "10.0.0"\n#define KICAD_COMMIT_HASH "${"0".repeat(40)}"\n`);
  assert.equal(packageRelease(options).kicad.revision, kicadRevision);
  rmSync(join(options.sourceDir, "kicad_source_revision.txt"));
  assert.throws(() => packageRelease(options), /ENOENT/);
});

test("rejects invalid release tags and missing or empty assets", (t) => {
  const options = fixture(t);
  assert.throws(() => packageRelease({ ...options, version: "main" }), /release tag/);
  assert.throws(() => packageRelease({ ...options, revision: "0".repeat(40) }), /commit hashes/);
  writeFileSync(join(options.sourceDir, "wx.js"), "");
  assert.throws(() => packageRelease(options), /Empty release asset/);
  rmSync(join(options.sourceDir, "wx.js"));
  assert.throws(() => packageRelease(options), /ENOENT/);
});
