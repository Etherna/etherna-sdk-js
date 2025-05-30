import { z } from "zod/v4"

import { ImageSchema } from "./image-schema"
import { BeeReferenceSchema, EthAddressSchema, SlicedStringSchema, TimestampSchema } from "./utils"

const quality = z.custom<`${number}p`>((val) => /^\d+p$/g.test(val as string))

/**
 * / --> preview
 * /preview
 * /details
 * /thumb/
 *   /480-png
 *   /1280-png
 *   /480-avif
 *   /1280-avif
 * /sources/
 *   /720p
 *   /1080p
 *   /dash/
 *     /manifest.mpd
 *     /...
 */

export const VideoSourceSchema = z
  .union([
    z.object({
      /** Source type */
      type: z.literal("mp4").optional(),
      /** Video resolution (eg: 1080p) */
      quality: quality,
      /** Path of the video (for folder based video manifest) */
      path: z.string().optional(),
      /** Swarm reference of the video */
      reference: BeeReferenceSchema.optional(),
      /** Video size in bytes */
      size: z.number().min(0),
      /** Video bitrate */
      bitrate: z.number().min(0).optional(),
    }),
    z.object({
      /** Source type */
      type: z.enum(["dash", "hls"]),
      /** Path of the source */
      path: z.string().min(3),
      /** Video size in bytes */
      size: z.number().min(0),
    }),
  ])
  .transform((data) => {
    if (!("type" in data)) {
      // if index doesn't return the type, we can guess it from the path
      if (data.path?.startsWith("sources/hls")) {
        ;(data as unknown as { type: "hls" }).type = "hls"
      } else if (data.path?.startsWith("sources/dash")) {
        ;(data as unknown as { type: "dash" }).type = "dash"
      } else {
        data.type = "mp4"
      }
    }
    if ("reference" in data && data.path) {
      delete data.reference
    }
    if ("path" in data && data.type === "mp4" && BeeReferenceSchema.safeParse(data.path).success) {
      data.reference = BeeReferenceSchema.parse(data.path)
      delete data.path
    }
    return data
  })

export const VideoPreviewSchema = z.object({
  /** Schema version */
  v: z.enum(["1.0", "1.1", "1.2", "2.0", "2.1"]).optional(),
  /** Title of the video */
  title: SlicedStringSchema(150),
  /** Video creation timestamp */
  createdAt: TimestampSchema,
  /** Video creation timestamp */
  updatedAt: TimestampSchema.optional().nullable(),
  /** Address of the owner of the video */
  ownerAddress: EthAddressSchema,
  /** Duration of the video in seconds */
  duration: z.number().min(0),
  /** Thumbnail  image */
  thumbnail: ImageSchema.nullable(),
})

export const VideoCaptionSchema = z.object({
  label: z.string().min(1),
  lang: z.string().min(2),
  path: z.string().min(3),
})

export const VideoDetailsSchema = z.object({
  /** Description of the video */
  description: SlicedStringSchema(5000),
  /** Video aspect ratio (width / height) */
  aspectRatio: z.number().min(0),
  /** List of available qualities of the video */
  sources: z.array(VideoSourceSchema).min(1),
  /** List of available video captions */
  captions: z.array(VideoCaptionSchema).default([]),
  /** batch id used */
  batchId: BeeReferenceSchema.nullable().optional(),
  /** Optional extra data */
  personalData: z.string().max(200).optional(),
})

// Types
export type VideoQuality = z.infer<typeof quality>
export type VideoSource = z.infer<typeof VideoSourceSchema>
export type VideoPreview = z.infer<typeof VideoPreviewSchema>
export type VideoDetails = z.infer<typeof VideoDetailsSchema>
export type VideoCaption = z.infer<typeof VideoCaptionSchema>
