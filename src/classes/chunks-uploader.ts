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

interface ChunkWithKey extends Chunk<4096, 8> {
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

    // tag is required for deferred uploads of chunks (but not for etherna)
    const tagPromise =
      deferred && !this.tag && this.beeClient.type !== "etherna"
        ? this.beeClient.tags.create(this.tagReference ?? EmptyReference).then((res) => res.uid)
        : Promise.resolve(this.tag)

    tagPromise
      .then((tag) => {
        this.tag = tag

        let stop = false

        while (this.activeTasks < this.concurrentChunks && this.chunks.length > 0 && !stop) {
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
                stop = true

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
