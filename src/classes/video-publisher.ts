import { getSdkError, throwSdkError } from "./sdk-error"
import { PlaylistManifest } from "@/manifest"

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

  constructor(options: VideoPublisherOptions) {
    this.video = options.video
    this.videoInitialReference = options.videoInitialReference
    this.sources = options.sources
    this.batchId = options.batchId
    this.beeClient = options.beeClient
  }

  async sync(publishTo: PublishSource[], options: VideoPublisherUploadOptions) {
    const unpublishFrom = this.sources.filter(
      (source) => !publishTo.some((newSource) => this.isEqualSource(source, newSource)),
    )

    const [publishResult, unpublishResult] = await Promise.all([
      Promise.allSettled(publishTo.map((source) => this.publish(source, options))),
      Promise.allSettled(unpublishFrom.map((source) => this.unpublish(source, options))),
    ])

    return {
      publishResult: publishResult.map((result) =>
        result.status === "fulfilled"
          ? { success: true, error: null }
          : { success: false, error: getSdkError(result.reason) },
      ),
      unpublishResult: unpublishResult.map((result) =>
        result.status === "fulfilled"
          ? { success: true, error: null }
          : { success: false, error: getSdkError(result.reason) },
      ),
    }
  }

  async publish(source: PublishSource, options: VideoPublisherUploadOptions): Promise<boolean> {
    try {
      switch (source.type) {
        case "playlist": {
          const playlistManifest = new PlaylistManifest(source.playlist, {
            beeClient: this.beeClient,
          })

          await playlistManifest.loadNode()

          // add or replace video
          if (this.videoInitialReference) {
            playlistManifest.replaceVideo(this.videoInitialReference, this.video)
          } else {
            playlistManifest.addVideo(this.video)
          }

          await playlistManifest.upload({
            batchId: this.batchId,
            signal: options.signal,
          })

          break
        }
        case "index": {
          const indexClient = source.indexClient

          if (source.indexVideoId) {
            await indexClient.videos.updateVideo(source.indexVideoId, this.video.reference, {
              signal: options.signal,
            })
          } else {
            await indexClient.videos.createVideo(this.video.reference, {
              signal: options.signal,
            })
          }

          break
        }
      }

      return true
    } catch (error) {
      throwSdkError(error)
    }
  }

  async unpublish(source: PublishSource, options: VideoPublisherUploadOptions): Promise<boolean> {
    try {
      switch (source.type) {
        case "playlist": {
          if (!this.videoInitialReference) {
            return true
          }
          if (!source.playlist.details.videos.some((v) => v.r === this.videoInitialReference)) {
            return true
          }

          const playlistManifest = new PlaylistManifest(source.playlist, {
            beeClient: this.beeClient,
          })

          await playlistManifest.loadNode()

          playlistManifest.removeVideo(this.videoInitialReference)

          await playlistManifest.upload({
            batchId: this.batchId,
            signal: options.signal,
          })

          break
        }
        case "index": {
          if (!source.indexVideoId) {
            return true
          }

          const indexClient = source.indexClient
          await indexClient.videos.deleteVideo(source.indexVideoId, { signal: options.signal })

          break
        }
      }

      return true
    } catch (error) {
      throwSdkError(error)
    }
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
