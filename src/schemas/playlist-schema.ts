import { z } from "zod/v4"

import { BeeReferenceSchema, EthAddressSchema, TimestampSchema } from "./utils"

export const PlaylistTypeEncryptedSchema = z.enum(["private", "protected"])

export const PlaylistReservedIdsSchema = z.enum(["Channel", "Saved"])

export const PlaylistTypeVisibleSchema = z.literal("public")

export const PlaylistTypeSchema = z.union([PlaylistTypeEncryptedSchema, PlaylistTypeVisibleSchema])

export const PlaylistIdSchema = z.string().uuid().or(PlaylistReservedIdsSchema)

export const PlaylistThumbSchema = z.object({
  blurhash: z.string(),
  path: z.string(),
})

export const PlaylistVideoSchema = z.object({
  /** Video reference */
  r: BeeReferenceSchema,
  /** Video Title */
  t: z.string().min(1),
  /** Timestamp of when the videos has been added to playlist */
  a: TimestampSchema,
  /** Timestamp of when the video should be visible */
  p: TimestampSchema.optional(),
})

export const PlaylistPreviewSchema = z.object({
  /** Playlist id (used for feed update) */
  id: PlaylistIdSchema,
  /** Playlist visibility: public (visibile by anyone), private (visibible by owner), protected (visible by anyone with the password) */
  type: PlaylistTypeSchema,
  /** Private type password hint */
  passwordHint: z.string().optional(),
  /** Playlist name (empty for __channel & __saved) */
  name: z.string(),
  /** Playlist owner */
  owner: EthAddressSchema,
  /** Preview image */
  thumb: PlaylistThumbSchema.nullable(),
  /** Playlist creation timestamp */
  createdAt: TimestampSchema,
  /** Playlist update timestamp */
  updatedAt: TimestampSchema,
})

export const PlaylistDetailsSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  videos: z.array(PlaylistVideoSchema),
})

// types
export type PlaylistType = z.infer<typeof PlaylistTypeSchema>
export type PlaylistId = z.infer<typeof PlaylistIdSchema>
export type PlaylistThumb = z.infer<typeof PlaylistThumbSchema>
export type PlaylistVideo = z.infer<typeof PlaylistVideoSchema>
export type PlaylistPreview = z.infer<typeof PlaylistPreviewSchema>
export type PlaylistDetails = z.infer<typeof PlaylistDetailsSchema>
