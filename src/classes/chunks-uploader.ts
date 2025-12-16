import { makeChunkedFile } from "@fairdatasociety/bmt-js"

import { EthernaSdkError, getSdkError } from "./sdk-error"
import { EmptyReference } from "@/consts"
import { bytesReferenceToReference } from "@/utils"

import type { BeeClient, RequestUploadOptions } from "@/clients"
import type { BytesReference, Reference } from "@/types/swarm"
import type { Chunk, ChunkedFile } from "@fairdatasociety/bmt-js"

export interface ChunksUploaderOptions {
  beeClient: BeeClient
  concurrentChunks?: number
}

interface ChunksUploadOptions extends RequestUploadOptions {
  deferred?: boolean
}

interface ChunkWithKey extends Chunk {
  key: string
}

export class ChunksUploader {
  private chunks: ChunkWithKey[] = []
  private chunksCount = 0
  private beeClient: BeeClient
  private concurrentChunks: number
  private tagReference?: Reference
  private tag?: number
  private activeTasks = 0
  private uploadOptions?: ChunksUploadOptions
  private stop = false
  private drainPromiseResolver?: () => void
  private drainPromiseRejecter?: (error: Error) => void

  private progressListeners: ((progress: number) => void)[] = []
  private errorListeners: ((error: EthernaSdkError) => void)[] = []
  private doneListeners: (() => void)[] = []

  constructor(options: ChunksUploaderOptions) {
    this.beeClient = options.beeClient
    this.concurrentChunks = options.concurrentChunks ?? 10
  }

  on(event: "progress", listener: (progress: number) => void): this
  on(event: "error", listener: (error: EthernaSdkError) => void): this
  on(event: "done", listener: () => void): this
  on(
    event: "progress" | "error" | "done",
    listener: ((progress: number) => void) | ((error: EthernaSdkError) => void) | (() => void),
  ): this {
    switch (event) {
      case "progress":
        this.progressListeners.push(listener as (progress: number) => void)
        break
      case "error":
        this.errorListeners.push(listener as (error: EthernaSdkError) => void)
        break
      case "done":
        this.doneListeners.push(listener as () => void)
        break
    }

    return this
  }

  off(event: "progress", listener: (progress: number) => void): this
  off(event: "error", listener: (error: EthernaSdkError) => void): this
  off(event: "done", listener: () => void): this
  off(
    event: "progress" | "error" | "done",
    listener: ((progress: number) => void) | ((error: EthernaSdkError) => void) | (() => void),
  ): this {
    switch (event) {
      case "progress":
        this.progressListeners = this.progressListeners.filter((l) => l !== listener)
        break
      case "error":
        this.errorListeners = this.errorListeners.filter((l) => l !== listener)
        break
      case "done":
        this.doneListeners = this.doneListeners.filter((l) => l !== listener)
        break
    }

    return this
  }

  append(chunkedFile: ChunkedFile<4096, 8>, key?: string): Reference
  append(data: Uint8Array, key?: string): Reference
  append(input: ChunkedFile<4096, 8> | Uint8Array, key?: string): Reference {
    const chunkedFile = "payload" in input ? input : makeChunkedFile(input)
    const chunks = chunkedFile.bmt().flat() as ChunkWithKey[]

    key ??= ""

    chunks.forEach((chunk) => {
      chunk.key = key
    })

    this.chunks.push(...chunks)
    this.chunksCount = this.chunks.length

    const reference = bytesReferenceToReference(chunkedFile.address() as BytesReference)
    this.tagReference = reference

    return reference
  }

  pop(key: string) {
    const removedChunks = this.chunks.filter((chunk) => chunk.key === key)
    this.chunks = this.chunks.filter((chunk) => chunk.key !== key)
    this.chunksCount = this.chunks.length
    return removedChunks
  }

  resume(options: ChunksUploadOptions) {
    this.uploadOptions = options
    this._internal_resume()
  }

  private _internal_resume() {
    if (!this.uploadOptions) {
      throw new EthernaSdkError("BAD_REQUEST", "Call .resume() before .drain()")
    }

    const { deferred, ...options } = this.uploadOptions

    // For etherna instances, use bulk upload instead of parallel individual uploads
    if (this.beeClient.type === "etherna") {
      // Only proceed if there are chunks and no active bulk upload task
      if (this.chunks.length === 0 || this.activeTasks > 0 || this.stop) {
        if (this.chunks.length === 0 && this.activeTasks === 0) {
          this.doneListeners.forEach((l) => l())
          this.drainPromiseResolver?.()
        }
        return
      }

      // Collect chunks in batches of concurrentChunks size for bulk upload
      const chunksToUpload: ChunkWithKey[] = []
      const batchSize = this.concurrentChunks
      while (this.chunks.length > 0 && chunksToUpload.length < batchSize && !this.stop) {
        const chunk = this.chunks.shift()
        if (chunk) {
          chunksToUpload.push(chunk)
        }
      }

      if (chunksToUpload.length === 0) {
        if (this.chunks.length === 0 && this.activeTasks === 0) {
          this.doneListeners.forEach((l) => l())
          this.drainPromiseResolver?.()
        }
        return
      }

      this.activeTasks++
      this.beeClient.chunk
        .bulkUpload(chunksToUpload, options)
        .then(() => {
          const progress = ((this.chunksCount - this.chunks.length) / this.chunksCount) * 100
          this.progressListeners.forEach((l) => l(progress))

          // Continue processing remaining chunks (next batch)
          if (this.chunks.length > 0) {
            this._internal_resume()
          } else if (this.activeTasks === 0) {
            this.doneListeners.forEach((l) => l())
            this.drainPromiseResolver?.()
          }
        })
        .catch((err) => {
          this.stop = true

          // Put chunks back in the queue on error
          this.chunks.unshift(...chunksToUpload)

          const error = getSdkError(err)
          this.errorListeners.forEach((l) => l(error))
          this.drainPromiseRejecter?.(error)
        })
        .finally(() => {
          this.activeTasks--
          this.resume(options)
        })

      return
    }

    // For non-etherna instances, use the original parallel upload logic
    // tag is required for deferred uploads of chunks
    const tagPromise =
      deferred && !this.tag
        ? this.beeClient.tags.create(this.tagReference ?? EmptyReference).then((res) => res.uid)
        : Promise.resolve(this.tag)

    tagPromise
      .then((tag) => {
        this.tag = tag

        while (this.activeTasks < this.concurrentChunks && this.chunks.length > 0 && !this.stop) {
          const chunk = this.chunks.shift()
          if (chunk) {
            this.activeTasks++
            this.beeClient.chunk
              .upload(Uint8Array.from([...chunk.span(), ...chunk.payload]), {
                ...options,
                tag: this.tag,
              })
              .then(() => {
                const progress = ((this.chunksCount - this.chunks.length) / this.chunksCount) * 100
                this.progressListeners.forEach((l) => l(progress))
              })
              .catch((err) => {
                this.stop = true

                this.chunks.unshift(chunk)

                const error = getSdkError(err)
                this.errorListeners.forEach((l) => l(error))
                this.drainPromiseRejecter?.(error)
              })
              .finally(() => {
                this.activeTasks--
                this.resume(options)
              })
          }
        }

        if (this.chunks.length === 0 && this.activeTasks === 0) {
          this.doneListeners.forEach((l) => l())
          this.drainPromiseResolver?.()
        }
      })
      .catch((err) => {
        const error = getSdkError(err)
        this.errorListeners.forEach((l) => l(error))
      })
  }

  drain(): Promise<void> {
    this.stop = false

    return new Promise((resolve, reject) => {
      if (this.activeTasks === 0 && this.chunks.length > 0) {
        this._internal_resume()
      }

      if (this.chunks.length === 0) {
        resolve()
      } else {
        this.drainPromiseResolver = resolve
        this.drainPromiseRejecter = reject
      }
    })
  }
}
