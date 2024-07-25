import { BytesReference } from "@/types/swarm"

export const marshalVersionValues = ["0.1", "0.2"] as const

export type MarshalVersion = (typeof marshalVersionValues)[number]

export enum NodeType {
  value = 2,
  edge = 4,
  withPathSeparator = 8,
  withMetadata = 16,
  mask = 255,
}

export type MetadataMapping = { [key: string]: string }

export type StorageLoader = (reference: BytesReference) => Promise<Uint8Array>

export type StorageSaver = (
  data: Uint8Array,
  options?: { ecrypt?: boolean },
) => Promise<BytesReference>

export type StorageHandler = {
  load: StorageLoader
  save: StorageSaver
}
