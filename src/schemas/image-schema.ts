import { z } from "zod"

import { BeeReferenceSchema, NonEmptyRecordSchema } from "./utils"

import type { Reference } from "@/types/swarm"

export const ImageSizeSchema = z.custom<`${number}w`>((val) => /^\d+w$/g.test(val as string))

export const ImageTypeSchema = z.enum(["jpeg", "png", "webp", "avif", "jpeg-xl"]).default("jpeg")

export const ImageLegacySourcesSchema = NonEmptyRecordSchema(
  /** Image size with related bee reference */
  ImageSizeSchema,
  /** Bee reference or path */
  z.string(),
).transform((data) => {
  const sources: ImageSource[] = []
  for (const [size, reference] of Object.entries(data)) {
    sources.push({ width: parseInt(size), type: "jpeg", reference: reference as Reference })
  }
  return sources
})

export const ImageSourceBaseSchema = z.object({
  /** Image scaled width */
  width: z.number(),
  /** Image type */
  type: ImageTypeSchema.nullable(),
  /** Image path */
  path: z.string().optional(),
  /** Image reference */
  reference: BeeReferenceSchema.optional(),
})

const rawSourceBaseTransform = <T extends z.infer<typeof ImageSourceBaseSchema>>(data: T) => {
  if ("reference" in data && data.path) {
    delete data.reference
  }
  if ("path" in data && BeeReferenceSchema.safeParse(data.path).success) {
    data.reference = BeeReferenceSchema.parse(data.path)
    delete data.path
  }

  return {
    ...data,
    type: data.type ?? "jpeg",
  }
}

export const ImageSourceSchema = ImageSourceBaseSchema.transform(rawSourceBaseTransform)

export const ImageSourcesSchema = z.array(
  ImageSourceSchema.check((ctx) => {
    if (!ctx.value.reference && !ctx.value.path) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value.path,
        path: ["path"],
        message: "Either reference or path must be defined",
      })
    }
  }),
)

export const ImageSchema = z.object({
  /** Image aspect ratio (width / height) */
  aspectRatio: z.number(),
  /** Blurhash value  */
  blurhash: z.string(),
  /** References of image in different resolutions */
  sources: ImageSourcesSchema.or(ImageLegacySourcesSchema),
})

// Types
export type ImageSize = z.infer<typeof ImageSizeSchema>
export type ImageType = z.infer<typeof ImageTypeSchema>
export type ImageSource = z.infer<typeof ImageSourceSchema>
export type ImageLegacySources = z.infer<typeof ImageLegacySourcesSchema>
export type ImageSources = z.infer<typeof ImageSourcesSchema>
export type Image = z.infer<typeof ImageSchema>
