import type { BatchId, BeeClient, Reference } from "../clients"

export interface WriterOptions {
  beeClient: BeeClient
}

export interface WriterUploadOptions {
  signal?: AbortSignal
  pin?: boolean
  deferred?: boolean
  encrypt?: boolean
  tag?: string
  batchId?: BatchId
  onUploadProgress?(completion: number): void
}

export abstract class BaseWriter<I> {
  constructor(item: I, opts: WriterOptions) {}

  abstract upload(opts?: WriterUploadOptions): Promise<Reference>
}
