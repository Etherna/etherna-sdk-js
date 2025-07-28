import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: false,
  dts: true,
  sourcemap: false,
  clean: true,
  minify: false,
  external: [
    "@ffmpeg/ffmpeg",
    "@ffmpeg/util",
    "@ffmpeg.wasm/main",
    "@ffmpeg.wasm/core-mt",
    "axios",
    "zod",
  ],
})
