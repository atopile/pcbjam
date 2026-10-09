#!/usr/bin/env node
// Package the tested PCB editor artifact. Version data comes from its generated
// KiCad header and the release checkout; hashes describe the final shipped bytes.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const assets = {
  "kicad_editor.wasm": "pcbnew.wasm",
  "kicad_editor.js": "pcbnew.js",
  "wx.js": "wx.js",
  "wx-dom.js": "wx-dom.js",
  "images.tar.gz": "images.tar.gz",
};
const revisionPattern = /^[0-9a-f]{40}$/;

export function packageRelease({ sourceDir, destinationDir, version, revision, kicadRevision }) {
  if (!/^v\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("PCBJam release version must be a release tag such as v1.2.3");
  }
  if (!revisionPattern.test(revision) || !revisionPattern.test(kicadRevision)
      || /^0+$/.test(revision) || /^0+$/.test(kicadRevision)) {
    throw new Error("Release and KiCad revisions must be full Git commit hashes");
  }
  if (resolve(sourceDir) === resolve(destinationDir)) {
    throw new Error("Release assets must be packaged separately from the tested artifact");
  }
  const header = readFileSync(join(sourceDir, "kicad_build_version.h"), "utf8");
  const define = (name) => {
    const match = header.match(new RegExp(`^#define\\s+${name}\\s+("(?:[^"\\\\]|\\\\.)*")\\s*$`, "m"));
    if (!match) throw new Error(`Compiled KiCad metadata is missing ${name}`);
    const value = JSON.parse(match[1]);
    if (!value) throw new Error(`Compiled KiCad metadata has an empty ${name}`);
    return value;
  };
  const kicadVersion = define("KICAD_VERSION_FULL");
  const compiledRevision = define("KICAD_COMMIT_HASH");
  const sourceRevision = readFileSync(join(sourceDir, "kicad_source_revision.txt"), "utf8").trim();
  if (sourceRevision !== kicadRevision || !revisionPattern.test(sourceRevision)
      || (!/^0{40}$/.test(compiledRevision) && compiledRevision !== sourceRevision)) {
    throw new Error("Compiled KiCad revision does not match the release's pinned KiCad source");
  }

  const manifest = {
    schema_version: 1,
    pcbjam: { version, revision },
    kicad: { version: kicadVersion, revision: sourceRevision },
    assets: {},
  };
  // Validate every input before writing any release output.
  const contents = Object.entries(assets).map(([name, source]) => {
    let bytes = readFileSync(join(sourceDir, source));
    if (!bytes.length) throw new Error(`Empty release asset: ${source}`);
    if (name === "kicad_editor.js") {
      bytes = Buffer.from(bytes.toString("utf8").replaceAll("pcbnew.wasm", "kicad_editor.wasm"));
    }
    manifest.assets[name] = createHash("sha256").update(bytes).digest("hex");
    return [name, bytes];
  });
  mkdirSync(destinationDir, { recursive: true });
  for (const [name, bytes] of contents) writeFileSync(join(destinationDir, name), bytes);
  writeFileSync(join(destinationDir, "release.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceDir, destinationDir, version, expectedRevision] = process.argv.slice(2);
  if (!sourceDir || !destinationDir || !version || !expectedRevision) {
    throw new Error("Usage: release-manifest.mjs <artifact-dir> <release-dir> <release-tag> <release-commit>");
  }
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const revision = git("rev-parse", "HEAD");
  if (revision !== expectedRevision) throw new Error("Release checkout does not match the build workflow's commit");
  packageRelease({ sourceDir, destinationDir, version, revision, kicadRevision: git("rev-parse", "HEAD:kicad") });
}
