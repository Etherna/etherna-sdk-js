import { RedundancyLevels, RedundancyStrategies } from "@/consts"

import type { RequestOptions } from "@/types/clients"
import type { BatchId, PostageBatch, Reference } from "@/types/swarm"
import type { HexString } from "@/types/utils"

export type FeedType = "sequence" | "epoch"

export interface FeedInfo {
  topic: string
  owner: string
  type: FeedType
}

export interface ContentAddressedChunk {
  readonly data: Uint8Array
  /** span bytes (8) */
  span(): Uint8Array
  /** payload bytes (1-4096) */
  payload(): Uint8Array
  address(): Uint8Array
}

export interface SingleOwnerChunk extends ContentAddressedChunk {
  identifier(): Uint8Array
  signature(): Uint8Array
  owner(): Uint8Array
}

export interface Data extends Uint8Array {
  /**
   * Converts the binary data using UTF-8 decoding into string.
   */
  text(): string
  /**
   * Converts the binary data into hex-string.
   */
  hex(): HexString
  /**
   * Converts the binary data into string which is then parsed into JSON.
   */
  json<T extends Record<string, unknown> | unknown[]>(): T
}

export type RedundancyStrategy = (typeof RedundancyStrategies)[keyof typeof RedundancyStrategies]

export type RedundancyLevel = (typeof RedundancyLevels)[keyof typeof RedundancyLevels]

export interface RequestUploadOptions extends RequestOptions {
  batchId: BatchId

  /**
   * If set to true, an ACT will be created for the uploaded data.
   */
  act?: boolean

  actHistoryAddress?: Reference | string

  /**
   * Will pin the data locally in the Bee node as well.
   *
   * Locally pinned data is possible to reupload to network if it disappear.
   *
   * @see [Bee docs - Pinning](https://docs.ethswarm.org/docs/develop/access-the-swarm/pinning)
   * @see [Bee API reference - `POST /bzz`](https://docs.ethswarm.org/api/#tag/BZZ/paths/~1bzz/post)
   */
  pin?: boolean

  /**
   * Will encrypt the uploaded data and return longer hash which also includes the decryption key.
   *
   * @see [Bee docs - Store with Encryption](https://docs.ethswarm.org/docs/develop/access-the-swarm/store-with-encryption)
   * @see [Bee API reference - `POST /bzz`](https://docs.ethswarm.org/api/#tag/BZZ/paths/~1bzz/post)
   * @see Reference
   */
  encrypt?: boolean

  /**
   * Tags keep track of syncing the data with network. This option allows attach existing Tag UUID to the uploaded data.
   *
   * @see [Bee API reference - `POST /bzz`](https://docs.ethswarm.org/api/#tag/BZZ/paths/~1bzz/post)
   * @see [Bee docs - Syncing / Tags](https://docs.ethswarm.org/docs/develop/access-the-swarm/syncing)
   * @link Tag
   */
  tag?: number

  /**
   * Determines if the uploaded data should be sent to the network immediately (eq. deferred=false) or in a deferred fashion (eq. deferred=true).
   *
   * With deferred style client uploads all the data to Bee node first and only then Bee node starts push the data to network itself. The progress of this upload can be tracked with tags.
   * With non-deferred style client uploads the data to Bee which immediately starts pushing the data to network. The request is only finished once all the data was pushed through the Bee node to the network.
   *
   * In future there will be move to the non-deferred style and even the support for deferred upload will be removed from Bee itself.
   *
   * @default true
   */
  deferred?: boolean
  /** Upload progress, ranging 0 to 100 */
  onUploadProgress?(completion: number): void
}

export interface RequestDownloadOptions extends RequestOptions {
  /**
   * Specify the retrieve strategy on redundant data.
   */
  redundancyStrategy?: RedundancyStrategy
  /**
   * Specify if the retrieve strategies (chunk prefetching on redundant data) are used in a fallback cascade. The default is true.
   */
  fallback?: boolean
  /**
   * Specify the timeout for chunk retrieval. The default is 30 seconds.
   */
  timeoutMs?: number

  // actPublisher?: PublicKey | Uint8Array | string

  actHistoryAddress?: Reference | string

  actTimestamp?: string | number

  gasLimit?: number

  gasPrice?: number

  /** Download progress, ranging 0 to 100 */
  onDownloadProgress?(completion: number): void
}

export interface FileUploadOptions extends RequestUploadOptions {
  size?: number
  contentType?: string
  filename?: string
}

export interface FileDownloadOptions extends RequestDownloadOptions {
  maxResponseSize?: number
}

export interface FeedUpdateOptions extends RequestOptions {
  index?: string
  at?: Date
}

export interface FeedUploadOptions extends RequestUploadOptions {
  index?: string
  at?: Date
}

export interface AuthenticationOptions extends RequestOptions {
  role?: "maintainer" | "creator" | "auditor" | "consumer"
  expiry?: number
}

export interface ReferenceResponse {
  reference: Reference
}

export interface EthernaGatewayCurrentUser {
  etherAddress: string
  etherPreviousAddresses: string[]
  username: string
}

export interface EthernaGatewayCredit {
  isUnlimited: boolean
  balance: number
}

export interface EthernaGatewayBatchPreview {
  batchId: BatchId
  ownerNodeId: string
}

export interface EthernaGatewayBatch extends Omit<PostageBatch, "batchID"> {
  id: BatchId
  amountPaid: number
  normalisedBalance: number
}

export interface EthernaGatewayChainState {
  block: number
  currentPrice: number
  sourceNodeId: string
  timeStamp: string
  totalAmount: number
}

export interface EthernaGatewayPin {
  freePinningEndOfLife: string
  isPinned: boolean
  isPinningInProgress: boolean
  isPinningRequired: boolean
}

export interface EthernaGatewayWelcomeStatus {
  isFreePostageBatchConsumed: boolean
}
