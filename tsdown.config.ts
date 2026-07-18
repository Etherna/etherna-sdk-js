import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  fixedExtension: false,
  dts: true,
  sourcemap: false,
  clean: true,
  minify: false,
  deps: {
    neverBundle: [
      "@ffmpeg/ffmpeg",
      "@ffmpeg/util",
      "@ffmpeg.wasm/main",
      "@ffmpeg.wasm/core-mt",
      "axios",
      "jimp",
      "zod",
    ],
  },
})
