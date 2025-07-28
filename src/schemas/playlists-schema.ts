import { z } from "zod"

import { BeeReferenceSchema } from "./utils"

export const UserPlaylistsSchema = z.array(BeeReferenceSchema)

// types
export type UserPlaylists = z.infer<typeof UserPlaylistsSchema>
