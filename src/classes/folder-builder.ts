import { AxiosError } from "axios"

import { MantarayNode } from "./mantaray-node"
import { Queue } from "./queue"
import { EthernaSdkError } from "./sdk-error"
import {
  MantarayEntryMetadataContentTypeKey,
  MantarayEntryMetadataFilenameKey,
  MantarayRootPath,
  MantarayWebsiteErrorDocumentPathKey,
  MantarayWebsiteIndexDocumentPathKey,
  ZeroHashReference,
} from "@/consts"
import {
  bytesReferenceToReference,
  encodePath,
  getReferenceFromData,
  referenceToBytesReference,
} from "@/utils"

import type { BeeClient } from "@/clients"
import type { BatchId, BytesReference } from "@/types/swarm"

export interface FolderBuilderConfig {
  beeClient: BeeClient
  batchId: BatchId
  concurrentTasks?: number
  indexDocument?: string
  errorDocument?: string
}

export class FolderBuilder {
  protected node = new MantarayNode()
  protected queue: Queue
  protected bytesTotal = 0
  protected bytesProgress = 0
  protected abortController = new AbortController()
  protected errored = false

  public onProgress?: (percent: number) => void
  public onEnqueueData?: (data: Uint8Array, queue: Queue) => BytesReference

  constructor(protected config: FolderBuilderConfig) {
    this.queue = new Queue({
      maxConcurrentTasks: config.concurrentTasks ?? 10,
    })
  }

  addFile(data: Uint8Array, filename: string, path: string, contentType: string | null) {
    const entry = this.enqueueData(data)
    this.node.addFork(encodePath(path), entry, {
      [MantarayEntryMetadataFilenameKey]: filename,
      ...(contentType ? { [MantarayEntryMetadataContentTypeKey]: contentType } : {}),
    })
  }

  async save() {
    const metadata: Record<string, string> = {}

    if (this.config.indexDocument) {
      metadata[MantarayWebsiteIndexDocumentPathKey] = this.config.indexDocument
    }
    if (this.config.errorDocument) {
      metadata[MantarayWebsiteErrorDocumentPathKey] = this.config.errorDocument
    }

    if (Object.keys(metadata).length > 0) {
      this.node.addFork(encodePath(MantarayRootPath), ZeroHashReference, metadata)
    }

    const reference = await this.node.save(async (data) => {
      return this.enqueueData(data)
    })
    await this.queue.drain()

    if (this.errored) {
      throw new EthernaSdkError("SERVER_ERROR", "Upload failed")
    }

    return bytesReferenceToReference(reference)
  }

  private enqueueData(data: Uint8Array) {
    if (this.onEnqueueData) {
      return this.onEnqueueData(data, this.queue)
    }

    const reference = getReferenceFromData(data)
    this.queue.enqueue(async () => {
      if (this.abortController.signal.aborted) return

      try {
        await this.config.beeClient.bytes.upload(data, {
          batchId: this.config.batchId,
          signal: this.abortController.signal,
          onUploadProgress: (completion) => {
            this.bytesProgress += (completion / 100) * data.length

            const progress =
              this.bytesTotal === 0 ? 0 : (this.bytesProgress / this.bytesTotal) * 100
            this.onProgress?.(progress)
          },
        })
      } catch (error) {
        this.errored = true

        if (error instanceof AxiosError) {
          const statusCode = error.response?.status ?? 400
          if (statusCode >= 400) {
            // Unauthorized, kill the queue
            this.kill()
          }
        }
      }
    })
    return referenceToBytesReference(reference)
  }

  private kill() {
    this.abortController.abort()
  }
}
