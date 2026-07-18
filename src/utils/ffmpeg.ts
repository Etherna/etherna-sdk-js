import { fileToBuffer } from "./buffer"

import type * as FFmpegWasmMain from "@ffmpeg.wasm/main"

type NodeWasmFFmpeg = Awaited<ReturnType<(typeof FFmpegWasmMain.FFmpeg)["create"]>>

/**
 * One shared Node FFmpeg instance: each `FFmpeg.create({ core: "@ffmpeg.wasm/core-mt" })` spins up
 * pthread workers. Creating dozens per thumbnail (meta + blurhash + resizes × videos) exhausts
 * workers and hangs. Reusing one instance avoids that.
 *
 * Still-image resizing on Node uses Jimp (`resizeImageWithJimp`) first so typical Node versions that
 * break ffmpeg.wasm (e.g. Node 24) can seed avatars/thumbnails without touching WASM.
 */
let sharedNodeFFmpeg: NodeWasmFFmpeg | null = null
let sharedNodeFFmpegPending: Promise<NodeWasmFFmpeg> | null = null

async function getSharedNodeFFmpeg(): Promise<NodeWasmFFmpeg> {
  if (sharedNodeFFmpeg) {
    return sharedNodeFFmpeg
  }
  if (!sharedNodeFFmpegPending) {
    const { FFmpeg } = await import("@ffmpeg.wasm/main")
    sharedNodeFFmpegPending = FFmpeg.create({ core: "@ffmpeg.wasm/core-mt" })
  }
  sharedNodeFFmpeg = await sharedNodeFFmpegPending
  return sharedNodeFFmpeg
}

export async function loadNodeFFmpeg(
  input: Uint8Array | ArrayBuffer | File | Blob,
  inputFilename: string,
) {
  const ffmpeg = await getSharedNodeFFmpeg()

  const bufferPromise =
    input instanceof File || input instanceof Blob ? fileToBuffer(input) : Promise.resolve(input)
  ffmpeg.fs.writeFile(inputFilename, new Uint8Array(await bufferPromise))

  return ffmpeg
}
