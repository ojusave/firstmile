import { build } from "esbuild";

// A single-file IIFE build for plain-HTML users who add the SDK with one <script> tag.
// It exposes a global `firstmile(...)` function. The npm/ESM build is emitted by tsc.
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/firstmile.global.js",
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "__firstmile",
  footer: { js: "window.firstmile=__firstmile.firstmile;" },
  target: ["es2020"],
  platform: "browser",
});

console.log("built dist/firstmile.global.js");
