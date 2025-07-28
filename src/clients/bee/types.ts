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

export interface RequestUploadOptions extends RequestOptions {
  batchId: BatchId
  pin?: boolean
  encrypt?: boolean
  tag?: number | string
  deferred?: boolean
  /** Upload progress, ranging 0 to 100 */
  onUploadProgress?(completion: number): void
}

export interface RequestDownloadOptions extends RequestOptions {
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
