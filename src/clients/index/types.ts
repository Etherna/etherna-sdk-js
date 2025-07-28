import type { Image, VideoCaption, VideoQuality, VideoSource } from "@/schemas"
import type { EthAddress } from "@/types/eth"
import type { BatchId, Reference } from "@/types/swarm"

export interface PaginatedResult<T> {
  elements: T[]
  currentPage: number
  maxPage: number
  pageSize: number
  totalElements: number
}

export interface IndexUser {
  address: EthAddress
  creationDateTime: string
  identityManifest: string
}

export interface IndexCurrentUser {
  address: EthAddress
  isSuperModerator: boolean
}

export interface IndexUserVideos extends IndexUser {
  videos: IndexVideo[]
}

export interface IndexVideo {
  id: string
  creationDateTime: string
  ownerAddress: EthAddress
  lastValidManifest: IndexVideoManifest | null
  currentVoteValue: VoteValue | null
  totDownvotes: number
  totUpvotes: number
}

export interface IndexVideoPreview {
  id: string
  title: string
  hash: Reference
  duration: number
  ownerAddress: EthAddress
  thumbnail: Image | null
  createdAt: number
  updatedAt: number
  indexUrl: string // added by index-aggregator
}

export interface IndexVideoManifest extends Omit<IndexVideoPreview, "id"> {
  batchId: BatchId | null
  aspectRatio: number | null
  hash: Reference
  description: string | null
  originalQuality: VideoQuality | null
  personalData: string | null
  sources: VideoSource[]
  captions?: VideoCaption[]
}

export interface IndexVideoCreation {
  id: string
  creationDateTime: string
  encryptionKey: string | null
  encryptionType: IndexEncryptionType
  manifestHash: string
}

export interface IndexVideoValidation {
  errorDetails: Array<{ errorMessage: string; errorNumber: string | number }>
  hash: string
  isValid: boolean | null
  validationTime: string
  videoId: string | null
}

export interface IndexVideoComment {
  id: string
  isFrozen: boolean
  isEditable: boolean
  ownerAddress: EthAddress
  textHistory: Record<string, string>
  videoId: string
}

export type VoteValue = "Up" | "Down" | "Neutral"

export type IndexEncryptionType = "AES256" | "Plain"

export interface IndexParameters {
  commentMaxLength: number
  videoDescriptionMaxLength: number
  videoTitleMaxLength: number
}
