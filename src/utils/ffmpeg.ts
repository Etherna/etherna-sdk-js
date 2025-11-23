import { fileToBuffer } from "./buffer"

export async function loadNodeFFmpeg(
  input: Uint8Array | ArrayBuffer | File | Blob,
  inputFilename: string,
) {
  const { FFmpeg } = await import("@ffmpeg.wasm/main")
  const ffmpeg = await FFmpeg.create({ core: "@ffmpeg.wasm/core-mt" })

  const bufferPromise =
    input instanceof File || input instanceof Blob ? fileToBuffer(input) : Promise.resolve(input)
  ffmpeg.fs.writeFile(inputFilename, new Uint8Array(await bufferPromise))

  return ffmpeg
}
