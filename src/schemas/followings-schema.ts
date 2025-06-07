import { z } from "zod/v4"

import { EthAddressSchema } from "./utils"

export const UserFollowingsSchema = z.array(EthAddressSchema)

// types
export type UserFollowings = z.infer<typeof UserFollowingsSchema>
