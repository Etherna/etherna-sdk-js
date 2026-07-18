/**
 * Pure-JS image decode/resize for Node. ffmpeg.wasm reliably crashes on some Node versions (e.g. v24)
 * with `RuntimeError: memory access out of bounds`; Jimp avoids WASM entirely for still images.
 */

export async function resizeImageWithJimp(
  imageBlob: Blob,
  toWidth: number,
  quality: number,
): Promise<Blob> {
  const { Jimp } = await import("jimp")
  const buffer = Buffer.from(await imageBlob.arrayBuffer())
  const image = await Jimp.read(buffer)
  const resized = image.resize({ w: toWidth })

  const mime = resized.mime ?? "image/jpeg"

  if (mime === "image/png") {
    const out = await resized.getBuffer("image/png")
    return new Blob([new Uint8Array(out)], { type: "image/png" })
  }

  if (mime === "image/gif") {
    const out = await resized.getBuffer("image/gif")
    return new Blob([new Uint8Array(out)], { type: "image/gif" })
  }

  if (mime === "image/bmp" || mime === "image/x-ms-bmp") {
    const out = await resized.getBuffer("image/bmp")
    return new Blob([new Uint8Array(out)], { type: "image/bmp" })
  }

  const out = await resized.getBuffer("image/jpeg", { quality: Math.min(100, Math.max(1, Math.round(quality))) })
  return new Blob([new Uint8Array(out)], { type: "image/jpeg" })
}

export async function getBlurhashImageDataWithJimp(imageData: Uint8Array): Promise<{
  data: Uint8ClampedArray
  width: number
  height: number
}> {
  const { Jimp } = await import("jimp")
  const image = await Jimp.read(Buffer.from(imageData))
  const scaled = image.scaleToFit({ w: 128, h: 128 })
  const { data, width, height } = scaled.bitmap

  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width,
    height,
  }
}
