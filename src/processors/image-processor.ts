import { makeChunkedFile } from "@fairdatasociety/bmt-js"

import { BaseProcessor } from "./base-processor"
import { ImageTypeSchema } from "@/schemas/image-schema"
import {
  bufferToDataURL,
  fileToBuffer,
  fileToDataURL,
  getImageMeta,
  getReferenceFromData,
  imageToBlurhash,
  resizeImage,
} from "@/utils"

import type { ProcessorOutput } from "./base-processor"
import type { Image } from "@/schemas/image-schema"

export interface ImageProcessorOptions {
  sizes: number[] | "avatar" | "cover" | "thumbnail"
  /**
   * The path format for the image
   *
   * - `$size` will be replaced by the image size
   * - `$type` will be replaced by the image type
   *
   * Example: `avatar/$size.$type`
   */
  pathFormat?: string
}

export const AVATAR_SIZES = [128, 256, 512]
export const COVER_SIZES = [480, 768, 1024, 1280, 1800]
export const THUMBNAIL_SIZES = [480, 960, 1280]

export const AVATAR_PATH_FORMAT = "avatar/$size.$type"
export const COVER_PATH_FORMAT = "cover/$size.$type"
export const THUMBNAIL_PATH_FORMAT = "thumb/$size.$type"

export class ImageProcessor extends BaseProcessor {
  private _image: Image | null = null
  public previewDataURL: string | null = null

  constructor(input: File | Blob | ArrayBuffer | Uint8Array) {
    super(input)

    const promise =
      input instanceof File || input instanceof Blob ? fileToDataURL(input) : bufferToDataURL(input)
    promise
      .then((dataURL) => {
        this.previewDataURL = dataURL
      })
      .catch(console.error)
  }

  public get image() {
    return this._image
  }

  public override async process(options: ImageProcessorOptions): Promise<ProcessorOutput[]> {
    super.process()

    const originalImageData = new Uint8Array(
      this.input instanceof File || this.input instanceof Blob
        ? await fileToBuffer(this.input)
        : this.input,
    )

    const imageMeta = await getImageMeta(originalImageData)
    const originalImageBlob = new Blob([originalImageData], {
      type: `image/${imageMeta.type}`,
    })

    const blurhash = await imageToBlurhash(originalImageData, imageMeta.width, imageMeta.height)
    const aspectRatio = imageMeta.width / imageMeta.height

    const pathFormat =
      options.pathFormat ??
      (() => {
        switch (options.sizes) {
          case "avatar":
            return AVATAR_PATH_FORMAT
          case "cover":
            return COVER_PATH_FORMAT
          case "thumbnail":
            return THUMBNAIL_PATH_FORMAT
          default:
            return "image/$size.$type"
        }
      })()

    const parsePath = (width: number, type: string) =>
      pathFormat.replace(/\$size/g, width.toString()).replace(/\$type/g, type)
    const parseFilename = (width: number, type: string) =>
      `${typeof options.sizes === "string" ? options.sizes : "image"}-${width}w.${type}`

    const output = [
      {
        type: ImageTypeSchema.parse(imageMeta.type),
        width: imageMeta.width,
        filename: parseFilename(imageMeta.width, imageMeta.type),
        entryAddress: getReferenceFromData(originalImageData),
        path: parsePath(imageMeta.width, imageMeta.type),
      },
    ]
    this.appendChunkedFile(makeChunkedFile(originalImageData))

    const sizes = Array.isArray(options.sizes)
      ? options.sizes
      : (() => {
          switch (options.sizes) {
            case "avatar":
              return AVATAR_SIZES
            case "cover":
              return COVER_SIZES
            case "thumbnail":
              return THUMBNAIL_SIZES
          }
        })()

    const inferiorSizes = sizes.filter((size) => size < imageMeta.width)
    if (inferiorSizes.length < 2 && inferiorSizes[0] !== imageMeta.width) {
      inferiorSizes.push(imageMeta.width)
    }

    for (const size of inferiorSizes) {
      const blob = await resizeImage(originalImageBlob, size, 95)
      const data = new Uint8Array(await blob.arrayBuffer())
      const chunkedFile = makeChunkedFile(data)

      this.appendChunkedFile(chunkedFile)

      const type = blob.type.split("/")[1] as string

      output.push({
        type: ImageTypeSchema.parse(type),
        width: size,
        filename: parseFilename(size, type),
        entryAddress: getReferenceFromData(data),
        path: parsePath(size, type),
      })
    }

    const image = {
      blurhash,
      aspectRatio,
      sources: output.map(({ type, width, path }) => ({
        type,
        width,
        path,
      })),
    } satisfies Image

    this._image = image
    this._isProcessed = true

    this._processorOutputs = output.map(({ path, entryAddress, type, filename }) => ({
      path,
      entryAddress,
      metadata: {
        filename,
        contentType: `image/${type}`,
      },
    }))

    return this.processorOutputs
  }
}
