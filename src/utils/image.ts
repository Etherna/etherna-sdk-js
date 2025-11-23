import { bufferToDataURL } from "./buffer"
import { loadNodeFFmpeg } from "./ffmpeg"
import { EthernaSdkError } from "@/classes"

import type { ImageType } from "../schemas/image-schema"

declare global {
  interface HTMLCanvasElement {
    msToBlob(): Blob
  }
}

/**
 * Resize an image
 *
 * @param imageBlob Image file to resize
 * @param toWidth Scaled width
 * @param quality Image quality (0-100)
 * @returns The resized image blob
 */
export async function resizeImage(
  imageBlob: File | Blob,
  toWidth: number,
  quality = 90,
): Promise<Blob> {
  if (typeof window !== "undefined") {
    const image = await createImage(imageBlob)

    const ratio = toWidth / image.width
    const width = Math.floor(toWidth)
    const height = Math.floor(image.height * ratio)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height)

    URL.revokeObjectURL(image.src)

    if (typeof canvas.toBlob !== "undefined") {
      return new Promise((res) =>
        canvas.toBlob((blob) => res(blob as Blob), imageBlob.type, quality / 100),
      )
    } else if (typeof canvas.msToBlob !== "undefined") {
      return canvas.msToBlob()
    }

    throw new EthernaSdkError("SERVER_ERROR", "Cannot create blob from canvas")
  } else {
    const ffmpeg = await loadNodeFFmpeg(imageBlob, "image")
    await ffmpeg.run(`-i`, "image", `-vf`, `"scale=${toWidth}:-1"`, `output`)
    const data = ffmpeg.fs.readFile("output")
    const type = getImageTypeFromData(data)

    return new Blob([data as BlobPart], { type })
  }
}

/**
 * Get the image type from the file name
 *
 * @param fileName The file name
 * @returns The image type
 */
export function isImageTypeSupported(type: ImageType) {
  switch (type) {
    case "jpeg":
    case "png":
      return true
    case "webp":
      return isWebpSupported()
    case "avif":
      return isAvifSupported()
    default:
      return false
  }
}

/**
 * Get the image metadata from the image data
 *
 * @param data The image data
 * @returns The image metadata
 */
export async function getImageMeta(data: Uint8Array | ArrayBuffer) {
  if (typeof window !== "undefined") {
    return new Promise<{
      width: number
      height: number
      type: ReturnType<typeof getImageTypeFromData>
    }>((resolve, reject) => {
      bufferToDataURL(data).then((dataURL) => {
        const img = new Image()
        img.onload = function () {
          resolve({
            width: img.width,
            height: img.height,
            type: getImageTypeFromData(data),
          })
        }
        img.onerror = reject
        img.src = dataURL
      })
    })
  } else {
    let width = 0
    let height = 0

    const ffmpeg = await loadNodeFFmpeg(data, "image")
    ffmpeg.setLogging(true)
    ffmpeg.setLogger((_, message) => {
      if (!message || typeof message !== "string") return
      // check resolution
      const parsedSize = message.match(/\d{3,}x\d{3,}/)?.[0]

      if (parsedSize) {
        const [w, h] = parsedSize.split("x").map(Number)
        if (w && h && !isNaN(w) && !isNaN(h)) {
          height = h
          width = w
        }
      }
    })

    await ffmpeg.run(`-i`, "image", `-f`, `null`)

    if (width && height) {
      return { width, height, type: getImageTypeFromData(data) }
    } else {
      throw new EthernaSdkError("ENCODING_ERROR", "Failed to load image metadata")
    }
  }
}

/**
 * Get the image type from the image data
 *
 * @param data The image data
 * @returns The image type
 */
export function getImageTypeFromData(data: Uint8Array | ArrayBuffer) {
  const formats = {
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    gif: [0x47, 0x49, 0x46, 0x38],
    avif: [0x00, 0x00, 0x00, 0x18, 0x61, 0x76, 0x69, 0x66],
    webp: [0x52, 0x49, 0x46, 0x46],
    svg: [0x3c, 0x73, 0x76, 0x67],
  } as const

  const header = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer, 0, 8)
  const headerArray = Array.from(header)

  for (const [format, magic] of Object.entries(formats)) {
    if (magic.every((v, i) => v === headerArray[i])) {
      return format as keyof typeof formats
    }
  }

  return "jpeg" as const
}

/**
 * Check if the browser supports the AVIF image format
 *
 * @returns true if AVIF is supported, false otherwise
 */
export function isAvifSupported() {
  const canvas = document.createElement("canvas")
  return canvas.toDataURL("image/avif").indexOf("data:image/avif") === 0
}

/**
 * Check if the browser supports the WebP image format
 *
 * @returns true if WebP is supported, false otherwise
 */
export function isWebpSupported() {
  const canvas = document.createElement("canvas")
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0
}

function createImage(blob: File | Blob) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const image = new Image()
    image.src = URL.createObjectURL(blob)
    image.onload = () => res(image)
    image.onerror = (error) => rej(error)
  })
}
