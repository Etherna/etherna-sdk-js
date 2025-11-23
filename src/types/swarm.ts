import type { Bytes, HexString } from "./utils"
import type { BATCH_ID_HEX_LENGTH, REFERENCE_HEX_LENGTH } from "@/consts"

export type Index = number | Uint8Array | string

export type BatchId = HexString<typeof BATCH_ID_HEX_LENGTH>

export type BucketId = number

export type PostageBatchBucketsData = {
  depth: number
  bucketDepth: number
  bucketUpperBound: number
  buckets: PostageBatchBucket[]
}

export type PostageBatchBucket = {
  bucketID: number
  collisions: number
}

export type Reference = HexString<typeof REFERENCE_HEX_LENGTH>

export type BeeAddress = Reference | `${Reference}/${string}`

export type BytesReference = Bytes<32 | 64>

export type PostageBatch = {
  batchID: BatchId
  utilization: number
  usable: boolean
  label: string
  depth: number
  amount: string
  bucketDepth: number
  blockNumber: number
  immutableFlag: boolean
  /**
   * The time (in seconds) remaining until the batch expires;
   * -1 signals that the batch never expires;
   * 0 signals that the batch has already expired.
   */
  batchTTL: number
  exists: boolean
}

export type Tag = {
  uid: number
  startedAt: string
  split: number
  seen: number
  stored: number
  sent: number
  synced: number
}

export type FeedUpdateHeaders = {
  /**
   * The current feed's index
   */
  feedIndex: string
  /**
   * The feed's index for next update.
   * Only set for the latest update. If update is fetched using previous index, then this is an empty string.
   */
  feedIndexNext: string
}
