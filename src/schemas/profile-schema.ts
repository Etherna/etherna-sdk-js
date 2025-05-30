import { z } from "zod/v4"

import { ImageSchema } from "./image-schema"
import { UserPlaylistsSchema } from "./playlists-schema"
import { BirthdaySchema, EthAddressSchema, SlicedStringSchema } from "./utils"

/**
 * / --> preview
 * /preview
 * /details
 * /avatar/
 *   /480-png
 *   /1280-png
 *   /480-avif
 *   /1280-avif
 * /cover/
 *   /480-png
 *   /1280-png
 *   /480-avif
 *   /1280-avif
 */

export const ProfilePreviewSchema = z.object({
  /**  Profile address */
  address: EthAddressSchema,
  /**  Name of the Profile */
  name: SlicedStringSchema(100, 0),
  /**  User's  avatar image */
  avatar: ImageSchema.nullable(),
})

export const ProfileDetailsSchema = z.object({
  /**  Description of the Profile */
  description: z.string().nullable().optional(),
  /**  User's  cover image */
  cover: ImageSchema.nullable(),
  /** User's location */
  location: z.string().optional(),
  /** User's website */
  website: z.string().optional(),
  /** User's birthday */
  birthday: BirthdaySchema.optional(),
  /** Channel public playlists */
  playlists: UserPlaylistsSchema.catch([]),
})

// types
export type ProfilePreview = z.infer<typeof ProfilePreviewSchema>
export type ProfileDetails = z.infer<typeof ProfileDetailsSchema>
