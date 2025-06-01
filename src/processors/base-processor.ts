import { ChunksUploader, EthernaSdkError, StampCalculator } from "@/classes"

import type { BeeClient, RequestUploadOptions } from "@/clients"
import type { BatchId, Reference } from "@/types/swarm"

export interface BaseProcessorUploadOptions extends Omit<RequestUploadOptions, "batchId"> {
  beeClient: BeeClient
  batchId: BatchId
  deferred?: boolean
  concurrentChunks?: number
}

export interface ProcessorOutput {
  path: string
  entryAddress: Reference
  metadata: { filename: string; contentType: string }
}

export class BaseProcessor {
  protected input: File | Blob | ArrayBuffer | Uint8Array
  protected uploadOptions?: BaseProcessorUploadOptions
  protected _uploader?: ChunksUploader
  protected _processorOutputs: ProcessorOutput[] = []
  protected _isProcessed = false
  protected _isFullyUploaded = false
  protected _stampCalculator = new StampCalculator()

  constructor(input: File | ArrayBuffer | Uint8Array) {
    this.input = input
  }

  public get uploader() {
    return this._uploader
  }

  public get processorOutputs() {
    return this._processorOutputs
  }

  public get isProcessed() {
    return this._isProcessed
  }

  public get isFullyUploaded() {
    return this._isFullyUploaded
  }

  public get stampCalculator() {
    return this._stampCalculator
  }

  public process(_options?: unknown): Promise<ProcessorOutput[]> {
    return Promise.resolve([])
  }

  public async upload(options: BaseProcessorUploadOptions): Promise<void> {
    this.uploadOptions = options
    this._uploader = new ChunksUploader({
      beeClient: options.beeClient,
      concurrentChunks: options.concurrentChunks,
    })
    this._uploader.on("done", () => {
      this._isFullyUploaded = true
    })

    const batchId =
      options.batchId ??
      (await this.uploadOptions.beeClient.stamps.fetchBestBatchId({
        collisions: this.stampCalculator.bucketCollisions,
      }))

    if (!batchId) {
      throw new EthernaSdkError("MISSING_BATCH_ID", "No batchId found")
    }

    this.uploadOptions.batchId = batchId

    this._uploader.resume(options)

    return await this._uploader.drain()
  }

  public async resume(): Promise<void> {
    if (!this.uploadOptions || !this.uploader) {
      throw new EthernaSdkError("BAD_REQUEST", ".resume() must be called after .upload()")
    }

    if (!this.uploadOptions.batchId) {
      throw new EthernaSdkError("MISSING_BATCH_ID", "Cannot resume upload without a batchId")
    }

    this.uploader.resume({
      batchId: this.uploadOptions.batchId,
    })
  }
}
