import { beeReference } from "../../schemas/base"
import {
  VideoDetailsRawSchema,
  VideoPreviewRawSchema,
  VideoSourceRawSchema,
} from "../../schemas/video"
import { VideoDeserializer } from "../../serializers"
import { dateToTimestamp } from "../../utils"
import { BaseReader } from "../base-reader"

import type { Profile, Video, VideoDetailsRaw, VideoPreviewRaw, VideoRaw } from "../.."
import type {
  BeeClient,
  EthernaIndexClient,
  IndexVideo,
  IndexVideoManifest,
  Reference,
} from "../../clients"
import type { IndexVideoPreview } from "../../clients/index/types"
import type { VideoPreview } from "../../schemas/video"
import type { ReaderDownloadOptions, ReaderOptions } from "../base-reader"

interface VideoReaderOptions extends ReaderOptions {
  indexClient?: EthernaIndexClient
  owner?: Profile
  prefetchedVideo?: Video
}

interface VideoReaderDownloadOptions extends ReaderDownloadOptions {
  mode: "preview" | "details" | "full"
  previewData?: VideoPreview
}

export class VideoReader extends BaseReader<Video | null, string, VideoRaw | IndexVideo> {
  reference: Reference
  indexReference?: string

  private beeClient: BeeClient
  private indexClient?: EthernaIndexClient
  private prefetchedVideo?: Video

  constructor(reference: string, opts: VideoReaderOptions) {
    super(reference, opts)

    const safeSwarmReference = beeReference.safeParse(reference)
    if (safeSwarmReference.success) {
      this.reference = safeSwarmReference.data as Reference
    } else {
      if (!opts.indexClient) throw new Error("Index client is required")

      this.reference = "" as Reference // temporary
      this.indexReference = reference
    }

    this.beeClient = opts.beeClient
    this.indexClient = opts.indexClient
    this.prefetchedVideo = opts.prefetchedVideo
  }

  async download(opts: VideoReaderDownloadOptions): Promise<Video | null> {
    if (this.prefetchedVideo) return this.prefetchedVideo

    if (opts.mode === "details" && !opts.previewData) {
      throw new Error("Missing option 'previewData' when mode is 'details'")
    }

    let videoRaw: VideoRaw | null = null
    let indexVideo: IndexVideo | null = null

    if (this.indexReference) {
      indexVideo = await this.fetchIndexVideo(opts)
      const reference = indexVideo?.lastValidManifest?.hash as Reference

      if (reference) {
        videoRaw = VideoReader.indexVideoToRaw(indexVideo!)
        this.reference = reference
      }
    }

    if (!videoRaw) {
      videoRaw = await this.fetchSwarmVideo(opts)
    }

    if (!videoRaw) return null

    const deserializer = new VideoDeserializer(this.beeClient.url)
    const preview = deserializer.deserializePreview(
      JSON.stringify(videoRaw.preview ?? opts.previewData ?? VideoReader.emptyVideoPreview),
      {
        reference: this.reference,
      },
    )
    const details = videoRaw.details
      ? deserializer.deserializeDetails(JSON.stringify(videoRaw.details), {
          reference: this.reference,
        })
      : undefined

    this.rawResponse = indexVideo ?? videoRaw

    return {
      reference: this.reference,
      preview,
      details,
    }
  }

  static indexVideoToRaw(video: IndexVideo): VideoRaw {
    if (!video.lastValidManifest || VideoReader.isValidatingManifest(video.lastValidManifest)) {
      return {
        preview: VideoReader.emptyVideoPreview(),
        details: VideoReader.emptyVideoDetails(),
      }
    }

    const videoPreviewRaw = VideoReader.indexVideoPreviewToRaw(video)
    videoPreviewRaw.v = video.lastValidManifest.batchId ? "2.1" : "1.2"

    const videoDetailsRaw = VideoReader.emptyVideoDetails()
    videoDetailsRaw.captions = video.lastValidManifest.captions?.map((c) => ({
      ...c,
      path: c.path?.replace(/^[0-9a-f]{64}\/(.+)/, "$1").replace(/\/$/, "") ?? "",
    }))
    videoDetailsRaw.aspectRatio = video.lastValidManifest.aspectRatio
    videoDetailsRaw.batchId = video.lastValidManifest.batchId
    videoDetailsRaw.description = video.lastValidManifest.description ?? ""
    videoDetailsRaw.sources = video.lastValidManifest.sources
      .map((s) => VideoSourceRawSchema.parse(s))
      .map((source) => ({
        ...source,
        path: source.path?.replace(/^[0-9a-f]{64}\/(.+)/, "$1").replace(/\/$/, "") ?? "",
      }))

    return {
      preview: videoPreviewRaw,
      details: videoDetailsRaw,
    }
  }

  static indexVideoPreviewToRaw(videoPreview: IndexVideoPreview | IndexVideo): VideoPreviewRaw {
    const data = "lastValidManifest" in videoPreview ? videoPreview.lastValidManifest : videoPreview
    return {
      v: undefined,
      title: data?.title ?? "",
      duration: data?.duration ?? 0,
      ownerAddress: videoPreview.ownerAddress,
      thumbnail: data?.thumbnail
        ? {
            ...data?.thumbnail,
            sources: data?.thumbnail.sources.map((source) => ({
              ...source,
              path: source.path?.replace(/^[0-9a-f]{64}\/(.+)/, "$1").replace(/\/$/, "") ?? "",
            })),
          }
        : null,
      createdAt: data?.createdAt ?? dateToTimestamp(new Date()),
      updatedAt: data?.updatedAt ? dateToTimestamp(new Date(data.updatedAt)) : null,
    } satisfies VideoPreviewRaw
  }

  static emptyVideoPreview(): VideoPreviewRaw {
    return {
      title: "",
      duration: 0,
      thumbnail: null,
      ownerAddress: "0x0",
      createdAt: dateToTimestamp(new Date()),
      updatedAt: dateToTimestamp(new Date()),
      v: "2.1",
    }
  }

  static emptyVideoDetails(): VideoDetailsRaw {
    return {
      description: "",
      aspectRatio: null,
      sources: [],
      batchId: undefined,
    }
  }

  // Private methods

  private async fetchIndexVideo(opts: VideoReaderDownloadOptions): Promise<IndexVideo | null> {
    if (!this.indexClient) return null
    try {
      const indexVideo = this.indexReference
        ? await this.indexClient.videos.fetchVideoFromId(this.indexReference, {
            signal: opts.signal,
          })
        : await this.indexClient.videos.fetchVideoFromHash(this.reference, {
            signal: opts.signal,
          })

      if (VideoReader.isValidatingManifest(indexVideo.lastValidManifest)) return null

      return indexVideo
    } catch (error) {
      console.error(error)
      return null
    }
  }

  private async fetchSwarmVideo(opts: VideoReaderDownloadOptions): Promise<VideoRaw | null> {
    if (!this.reference) return null
    try {
      const downloadPreview = opts.mode === "preview" || opts.mode === "full"
      const downloadDetails = opts.mode === "details" || opts.mode === "full"

      const [previewResp, detailsResp] = await Promise.allSettled([
        downloadPreview
          ? this.beeClient.bzz.download(this.reference, {
              headers: {
                // "x-etherna-reason": "video-preview-meta",
              },
              maxResponseSize: opts?.maxResponseSize,
              signal: opts?.signal,
              onDownloadProgress: opts?.onDownloadProgress,
            })
          : Promise.resolve(null),
        downloadDetails
          ? this.beeClient.bzz.downloadPath(this.reference, "details", {
              headers: {
                // "x-etherna-reason": "video-details-meta",
              },
              maxResponseSize: opts?.maxResponseSize,
              signal: opts?.signal,
              onDownloadProgress: opts?.onDownloadProgress,
            })
          : Promise.resolve(null),
      ])

      const previewValue =
        previewResp.status === "fulfilled" && previewResp.value ? previewResp.value : undefined
      let detailsValue =
        detailsResp.status === "fulfilled" && detailsResp.value ? detailsResp.value : undefined

      if (downloadDetails && !detailsValue && !previewValue) {
        // manifest version < 2.0, download root manifest
        detailsValue = await this.beeClient.bzz.download(this.reference, {
          headers: {
            // "x-etherna-reason": "video-preview-meta",
          },
          maxResponseSize: opts?.maxResponseSize,
          signal: opts?.signal,
          onDownloadProgress: opts?.onDownloadProgress,
        })
      }

      if (downloadPreview && previewResp.status === "rejected") {
        throw previewResp.reason
      }
      if (downloadDetails && !detailsValue && !previewValue) {
        throw previewResp.status === "rejected"
          ? previewResp.reason
          : detailsResp.status === "rejected"
            ? detailsResp.reason
            : new Error("Unknown error")
      }

      const preview = previewValue
        ? VideoPreviewRawSchema.parse(previewValue.data.json())
        : undefined
      const details = detailsValue
        ? VideoDetailsRawSchema.parse(detailsValue.data.json())
        : downloadDetails && previewValue
          ? VideoDetailsRawSchema.parse(previewValue.data.json())
          : undefined

      return {
        preview,
        details,
      }
    } catch (error) {
      console.error(error)
      return null
    }
  }

  static isValidatingManifest(manifest: IndexVideoManifest | null): boolean {
    if (!manifest) return true
    return (
      manifest.title === null &&
      manifest.description === null &&
      manifest.duration === null &&
      manifest.thumbnail === null &&
      manifest.sources.length === 0
    )
  }
}
