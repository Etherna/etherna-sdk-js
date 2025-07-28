import { EthernaSdkError, getSdkError, throwSdkError } from "./sdk-error"
import { PlaylistManifest } from "@/manifest"
import { isEmptyReference } from "@/utils"

import type { BeeClient, EthernaIndexClient } from "@/clients"
import type { Playlist, Video } from "@/manifest"
import type { BatchId, Reference } from "@/types"

export interface VideoPublisherOptions {
  video: Video
  videoInitialReference?: Reference
  beeClient: BeeClient
  batchId: BatchId
  sources: PublishSource[]
}

export interface PublishSourcePlaylist {
  type: "playlist"
  playlist: Playlist
}

export interface PublishSourceIndex {
  type: "index"
  indexClient: EthernaIndexClient
  indexVideoId?: string
}

export interface PublishResultStatus {
  sourceType: "playlist" | "index"
  sourceId: string
  success: boolean
  error: EthernaSdkError | null
  videoId: string
}

export interface VideoPublisherSyncResult {
  publishResult: PublishResultStatus[]
  unpublishResult: PublishResultStatus[]
}

export type PublishSource = PublishSourcePlaylist | PublishSourceIndex

export interface VideoPublisherUploadOptions {
  signal?: AbortSignal
}

export class VideoPublisher {
  private video: Video
  private videoInitialReference?: Reference
  private batchId: BatchId
  private beeClient: BeeClient
  public sources: PublishSource[]
  public results: VideoPublisherSyncResult | undefined

  constructor(options: VideoPublisherOptions) {
    this.video = options.video
    this.videoInitialReference = options.videoInitialReference
    this.sources = options.sources
    this.batchId = options.batchId
    this.beeClient = options.beeClient
  }

  async sync(publishTo: PublishSource[], options?: VideoPublisherUploadOptions) {
    const unpublishFrom = this.sources.filter(
      (source) => !publishTo.some((newSource) => this.isEqualSource(source, newSource)),
    )

    return await this.internal_sync(publishTo, unpublishFrom, options)
  }

  async retry(options?: VideoPublisherUploadOptions) {
    const erroredPublishSources = this.sources.filter((source) =>
      this.results?.publishResult.some(
        (result) =>
          result.error &&
          (source.type === "playlist"
            ? result.sourceId === source.playlist.preview.id
            : result.sourceId === source.indexClient.baseUrl),
      ),
    )
    const erroredUnpublishSources = this.sources.filter((source) =>
      this.results?.unpublishResult.some(
        (result) =>
          result.error &&
          (source.type === "playlist"
            ? result.sourceId === source.playlist.preview.id
            : result.sourceId === source.indexClient.baseUrl),
      ),
    )

    if (erroredPublishSources.length === 0 && erroredUnpublishSources.length === 0) {
      throw new EthernaSdkError("BAD_REQUEST", "No errored sources to retry")
    }
    return await this.internal_sync(erroredPublishSources, erroredUnpublishSources, options)
  }

  async publish(
    source: PublishSource,
    options?: VideoPublisherUploadOptions,
  ): Promise<{ id: string }> {
    try {
      switch (source.type) {
        case "playlist": {
          const playlistManifest = new PlaylistManifest(source.playlist, {
            beeClient: this.beeClient,
          })

          if (!isEmptyReference(playlistManifest.reference)) {
            await playlistManifest.loadNode()
          }

          // add or replace video
          if (this.videoInitialReference) {
            playlistManifest.replaceVideo(this.videoInitialReference, this.video)
          } else {
            playlistManifest.addVideo(this.video)
          }

          await playlistManifest.upload({
            batchId: this.batchId,
            signal: options?.signal,
          })

          source.playlist = playlistManifest.serialized

          return { id: this.video.reference }
        }
        case "index": {
          const indexClient = source.indexClient

          if (source.indexVideoId) {
            await indexClient.videos.updateVideo(source.indexVideoId, this.video.reference, {
              signal: options?.signal,
            })

            return { id: source.indexVideoId }
          } else {
            const videoId = await indexClient.videos.createVideo(this.video.reference, {
              signal: options?.signal,
            })

            return { id: videoId }
          }
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async unpublish(
    source: PublishSource,
    options?: VideoPublisherUploadOptions,
  ): Promise<{ id: string }> {
    try {
      switch (source.type) {
        case "playlist": {
          if (!this.videoInitialReference) {
            return { id: this.video.reference }
          }
          if (!source.playlist.details.videos.some((v) => v.r === this.videoInitialReference)) {
            return { id: this.video.reference }
          }

          const playlistManifest = new PlaylistManifest(source.playlist, {
            beeClient: this.beeClient,
          })

          await playlistManifest.loadNode()

          playlistManifest.removeVideo(this.videoInitialReference)

          await playlistManifest.upload({
            batchId: this.batchId,
            signal: options?.signal,
          })

          source.playlist = playlistManifest.serialized

          return { id: this.video.reference }
        }
        case "index": {
          if (!source.indexVideoId) {
            return { id: this.video.reference }
          }

          const indexClient = source.indexClient
          await indexClient.videos.deleteVideo(source.indexVideoId, { signal: options?.signal })

          return { id: source.indexVideoId }
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  private async internal_sync(
    publishTo: PublishSource[],
    unpublishFrom: PublishSource[],
    options?: VideoPublisherUploadOptions,
  ) {
    const [publishResult, unpublishResult] = await Promise.all([
      Promise.allSettled(publishTo.map((source) => this.publish(source, options))),
      Promise.allSettled(unpublishFrom.map((source) => this.unpublish(source, options))),
    ])

    const getSource = (source: PublishSource | undefined) => {
      if (!source) {
        throw new Error("Source not found")
      }
      return {
        sourceType: source.type,
        sourceId:
          source.type === "playlist" ? source.playlist.preview.id : source.indexClient.baseUrl,
      } as const
    }

    if (this.results) {
      this.results.publishResult = this.results.publishResult.map((result) => {
        if (result.success) {
          return result
        } else {
          const retryResult = publishResult.shift()
          if (!retryResult) {
            throw new EthernaSdkError("SERVER_ERROR", "No retry result found")
          }
          return {
            ...result,
            success: retryResult.status === "fulfilled",
            error: retryResult.status === "fulfilled" ? null : getSdkError(retryResult.reason),
          }
        }
      })

      this.results.unpublishResult = this.results.unpublishResult.map((result) => {
        if (result.success) {
          return result
        } else {
          const retryResult = unpublishResult.shift()
          if (!retryResult) {
            throw new EthernaSdkError("SERVER_ERROR", "No retry result found")
          }
          return {
            ...result,
            success: retryResult.status === "fulfilled",
            error: retryResult.status === "fulfilled" ? null : getSdkError(retryResult.reason),
          }
        }
      })

      return this.results
    } else {
      this.results = {
        publishResult: publishResult.map((result, i) =>
          result.status === "fulfilled"
            ? { success: true, error: null, ...getSource(publishTo[i]), videoId: result.value.id }
            : {
                success: false,
                error: getSdkError(result.reason),
                ...getSource(publishTo[i]),
                videoId: this.video.reference,
              },
        ),
        unpublishResult: unpublishResult.map((result, i) =>
          result.status === "fulfilled"
            ? {
                success: true,
                error: null,
                ...getSource(unpublishFrom[i]),
                videoId: result.value.id,
              }
            : {
                success: false,
                error: getSdkError(result.reason),
                ...getSource(unpublishFrom[i]),
                videoId: this.video.reference,
              },
        ),
      } satisfies VideoPublisherSyncResult
    }

    return this.results
  }

  private isEqualSource(source1: PublishSource, source2: PublishSource): boolean {
    if (source1.type !== source2.type) {
      return false
    }

    if (source1.type === "playlist" && source2.type === "playlist") {
      return (
        source1.playlist.preview.id === source2.playlist.preview.id &&
        source1.playlist.preview.owner === source2.playlist.preview.owner
      )
    }

    if (source1.type === "index" && source2.type === "index") {
      return source1.indexClient.baseUrl === source2.indexClient.baseUrl
    }

    return false
  }
}
