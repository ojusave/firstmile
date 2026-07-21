import { build } from "esbuild";

// A single-file IIFE build for plain-HTML users who add the SDK with one <script> tag.
// It exposes a global `calibrate(...)` function. The npm/ESM build is emitted by tsc.
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/calibrate.global.js",
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "__calibrate",
  footer: { js: "window.calibrate=__calibrate.calibrate;" },
  target: ["es2020"],
  platform: "browser",
});

console.log("built dist/calibrate.global.js");
