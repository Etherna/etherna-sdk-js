import { ChunkedFile } from "@fairdatasociety/bmt-js"

import { StampCalculator } from "@/classes"
import { bytesReferenceToReference } from "@/utils"

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
  public input: File | Blob | ArrayBuffer | Uint8Array
  protected _processorOutputs: ProcessorOutput[] = []
  protected _isProcessed = false
  protected _stampCalculator = new StampCalculator()
  protected _chunkedFiles: ChunkedFile<4096, 8>[] = []

  constructor(input: File | Blob | ArrayBuffer | Uint8Array) {
    this.input = input
  }

  public get processorOutputs() {
    return this._processorOutputs
  }

  public get isProcessed() {
    return this._isProcessed
  }

  public get stampCalculator() {
    return this._stampCalculator
  }

  public get chunkedFiles() {
    return this._chunkedFiles
  }

  public process(_options?: unknown): Promise<ProcessorOutput[]> {
    this._isProcessed = false
    this._chunkedFiles = []
    this._stampCalculator = new StampCalculator()
    return Promise.resolve([])
  }

  protected appendChunkedFile(chunkedFile: ChunkedFile<4096, 8>) {
    this._chunkedFiles.push(chunkedFile)
    chunkedFile
      .bmt()
      .flat()
      .forEach((chunk) => this.stampCalculator.add(bytesReferenceToReference(chunk.address())))
  }
}
