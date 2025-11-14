import { BaseMantarayManifest } from "./base-manifest"
import { EthernaSdkError, getSdkError, throwSdkError } from "@/classes"
import {
  EmptyAddress,
  EmptyReference,
  MANIFEST_DETAILS_PATH,
  MantarayEntryMetadataContentTypeKey,
  MantarayEntryMetadataFilenameKey,
} from "@/consts"
import { VideoDetailsSchema, VideoPreviewSchema } from "@/schemas/video-schema"
import {
  bytesReferenceToReference,
  dateToTimestamp,
  encodePath,
  getBzzNodeInfo,
  getReferenceFromData,
  getVideoMeta,
  isValidReference,
  structuredClone,
  timestampToDate,
} from "@/utils"

import type {
  BaseManifestOptions,
  BaseManifestUploadOptions,
  BaseMantarayManifestDownloadOptions,
} from "./base-manifest"
import type { ImageProcessor } from "@/processors/image-processor"
import type { VideoProcessor } from "@/processors/video-processor"
import type { ImageSource } from "@/schemas/image-schema"
import type { VideoDetails, VideoPreview, VideoSource } from "@/schemas/video-schema"
import type { EthAddress } from "@/types/eth"
import type { Reference } from "@/types/swarm"

export interface Video {
  reference: Reference
  preview: VideoPreview
  details: VideoDetails
}

export type ProfileManifestInit = Reference | { owner: EthAddress } | Video

export const CURRENT_VIDEO_MANIFEST_VERSION = "2.1" as const
const THUMB_QUEUE_KEY = "thumb"
const VIDEO_QUEUE_KEY = "video"

/**
 * This class is used to fetch any video data or update a video of the current user
 */
export class VideoManifest extends BaseMantarayManifest {
  protected override _preview: VideoPreview = {
    v: CURRENT_VIDEO_MANIFEST_VERSION,
    title: "",
    duration: 0,
    ownerAddress: EmptyAddress,
    thumbnail: null,
    createdAt: dateToTimestamp(new Date()),
    updatedAt: dateToTimestamp(new Date()),
  }
  protected override _details: VideoDetails = {
    description: "",
    aspectRatio: 0,
    sources: [],
    captions: [],
    batchId: EmptyReference,
  }

  /**
   * Fetch a video data
   * @param init Video reference
   * @param options Manifest options
   */
  constructor(init: Reference, options: BaseManifestOptions)
  /**
   * Update a user video from existing data
   * @param init Video existing data
   * @param options Manifest options
   */
  constructor(init: Video, options: BaseManifestOptions)
  /**
   * Create a new video for the current user
   * @param options Manifest options
   */
  constructor(options: BaseManifestOptions)
  constructor(input: Reference | Video | BaseManifestOptions, options?: BaseManifestOptions) {
    const init = typeof input === "object" && "beeClient" in input ? undefined : input
    const opts = options ?? (input as BaseManifestOptions)

    super(init, opts)

    if (typeof init === "string") {
      this._reference = init
    } else {
      if (!opts.beeClient.signer) {
        throw new EthernaSdkError("MISSING_SIGNER", "Signer is required to upload")
      }

      if (init) {
        if (
          opts.beeClient.signer.address.toLowerCase() !== init.preview.ownerAddress.toLowerCase()
        ) {
          throw new EthernaSdkError("PERMISSION_DENIED", "You can't update other user's videos")
        }

        this._reference = init.reference
        this._preview = init.preview
        this._details = init.details
      } else {
        this._preview.ownerAddress = opts.beeClient.signer.address
      }
    }

    this.setPreviewProxy(this._preview)
    this.setDetailsProxy(this._details)
  }

  public override get serialized(): Video {
    return structuredClone({
      reference: this.reference,
      preview: this._preview,
      details: this._details,
    })
  }

  public get v(): string {
    return this._preview.v ?? "1.0"
  }

  public get title() {
    return this._preview.title
  }
  public set title(value: string) {
    this._preview.title = value
  }

  public get description() {
    return this._details.description
  }
  public set description(value: string) {
    this._details.description = value
  }

  public get duration() {
    return this._preview.duration
  }

  public get ownerAddress() {
    return this._preview.ownerAddress
  }

  public get thumbnail() {
    return this._preview.thumbnail
  }

  public get createdAt() {
    return timestampToDate(this._preview.createdAt)
  }

  public get updatedAt() {
    return this._preview.updatedAt ? timestampToDate(this._preview.updatedAt) : null
  }

  public get aspectRatio() {
    return this._details.aspectRatio
  }

  public get sources() {
    return structuredClone(this._details.sources)
  }

  public get captions() {
    return structuredClone(this._details.captions)
  }

  public override async download(options: BaseMantarayManifestDownloadOptions): Promise<Video> {
    try {
      if (this._reference === EmptyReference) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Manifest reference is not set")
      }

      const shouldDownloadPreview = options.mode === "preview" || options.mode === "full"
      const shouldDownloadDetails = options.mode === "details" || options.mode === "full"

      const previewPromise = shouldDownloadPreview
        ? this.beeClient.bzz
            .download(this._reference, {
              headers: {
                // "x-etherna-reason": "video-preview",
                ...options.headers,
              },
              signal: options.signal,
              timeout: options.timeout,
              onDownloadProgress: options.onDownloadProgress,
            })
            .then((resp) => VideoPreviewSchema.parse(resp.data.json()))
        : Promise.resolve(this._preview)
      const detailsPromise = shouldDownloadDetails
        ? this.beeClient.bzz
            .downloadPath(this._reference, MANIFEST_DETAILS_PATH, {
              headers: {
                // "x-etherna-reason": "video-preview",
                ...options.headers,
              },
              signal: options.signal,
              timeout: options.timeout,
              onDownloadProgress: options.onDownloadProgress,
            })
            .then((resp) => VideoDetailsSchema.parse(resp.data.json()))
            .catch((err) => {
              const error = getSdkError(err)
              if (error.code === "NOT_FOUND") {
                // probably v < 2.0, download from root

                return this.beeClient.bzz
                  .download(this._reference, {
                    headers: {
                      // "x-etherna-reason": "video-fallback-meta",
                      ...options.headers,
                    },
                    signal: options.signal,
                    timeout: options.timeout,
                    onDownloadProgress: options.onDownloadProgress,
                  })
                  .then((resp) => VideoDetailsSchema.parse(resp.data.json()))
              } else {
                throw new Error()
              }
            })
        : Promise.resolve(this._details)

      this._preview = await previewPromise
      this._details = await detailsPromise
      this._hasLoadedPreview = shouldDownloadPreview || this._hasLoadedPreview
      this._hasLoadedDetails = shouldDownloadDetails || this._hasLoadedDetails
      this._isDirty = false

      return this.serialized
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async upload(options?: BaseManifestUploadOptions): Promise<Video> {
    if (this.ownerAddress.toLowerCase() !== this.beeClient.signer?.address.toLowerCase()) {
      throw new EthernaSdkError("PERMISSION_DENIED", "You can't update other user's videos")
    }

    if (+this.v < +CURRENT_VIDEO_MANIFEST_VERSION) {
      throw new EthernaSdkError(
        "UNSUPPORTED_OPERATION",
        "Outdate manifest version. Run '.migrate()' first",
      )
    }
    if (this.v !== CURRENT_VIDEO_MANIFEST_VERSION) {
      throw new EthernaSdkError("UNSUPPORTED_OPERATION", "Unsupported manifest version.")
    }

    try {
      await this.prepareForUpload(options?.batchId, options?.batchLabelQuery)

      // after 'prepareForUpload' batchId must be defined

      // WIP: remove batchId since it mutates the final buckets collisions
      // const batchId = this.batchId as BatchId
      // this._details.batchId = batchId

      // ensure data is not malformed
      this._preview = VideoPreviewSchema.parse(this._preview)
      this._details = VideoDetailsSchema.parse(this._details)

      // update data
      this.updateNodeDefaultEntries()
      this.enqueueData(new TextEncoder().encode(JSON.stringify(this._preview)))
      this.enqueueData(new TextEncoder().encode(JSON.stringify(this._details)))

      // save mantary node
      this._reference = await this.node
        .save(async (data) => {
          return this.enqueueData(data)
        })
        .then(bytesReferenceToReference)

      return await this.resume(options)
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async resume(options?: BaseManifestUploadOptions): Promise<Video> {
    if (options?.batchId) {
      this._batchId = options.batchId
    }

    if (!this.batchId) {
      throw new EthernaSdkError("MISSING_BATCH_ID", "batchId is missing")
    }

    try {
      // resume upload
      if (options?.onUploadProgress) {
        this.chunksUploader.on("progress", options.onUploadProgress)
      }

      this.chunksUploader.resume({
        batchId: this.batchId,
        ...options,
      })
      await this.chunksUploader.drain()

      if (options?.onUploadProgress) {
        this.chunksUploader.off("progress", options.onUploadProgress)
      }

      this._hasLoadedPreview = true
      this._hasLoadedDetails = true

      return this.serialized
    } catch (error) {
      if (options?.onUploadProgress) {
        this.chunksUploader.off("progress", options.onUploadProgress)
      }
      throwSdkError(error)
    }
  }

  public async migrate(options?: { signal?: AbortSignal }): Promise<Video> {
    if (this.v === CURRENT_VIDEO_MANIFEST_VERSION) {
      throw new EthernaSdkError(
        "UNSUPPORTED_OPERATION",
        `Manifest is already in version ${CURRENT_VIDEO_MANIFEST_VERSION}`,
      )
    }

    try {
      const mp4Sources = this._details.sources.filter(
        (source) => source.type === "mp4" && isValidReference(source.reference ?? ""),
      ) as (VideoSource & { type: "mp4"; reference: Reference })[]
      const firstSource = mp4Sources[0]

      if (!this.aspectRatio && firstSource) {
        const videoUrl = this.beeClient.bzz.url(firstSource.reference)
        const { width, height } = await getVideoMeta(videoUrl).catch(() => ({
          width: 16,
          height: 9,
        }))
        this._details.aspectRatio = width / height
      }

      // get raw references from each sources
      const videoSourcesNodeInfos = await Promise.all(
        mp4Sources.map(async (source) => ({
          reference: source.reference,
          ...(await getBzzNodeInfo(source.reference, this.beeClient, options?.signal)),
        })),
      )
      const thumbnailSourcesNodeInfos = await Promise.all(
        (
          (this.thumbnail?.sources ?? []).filter(
            (s) => s.reference && isValidReference(s.reference),
          ) as (ImageSource & { reference: Reference })[]
        ).map(async (source) => ({
          reference: source.reference,
          ...(await getBzzNodeInfo(source.reference, this.beeClient, options?.signal)),
        })),
      )

      // update reference based source to path based source
      this._details.sources = this._details.sources.map((source) => {
        if (source.path || source.type !== "mp4") return source

        const nodeInfo = videoSourcesNodeInfos.find((ref) => ref.reference === source.reference)

        if (!nodeInfo?.entry) {
          throw new EthernaSdkError(
            "NOT_FOUND",
            `Could not find raw reference for video source: '${source.reference}'`,
          )
        }

        const path = `sources/${source.quality}`

        this.node.addFork(encodePath(path), nodeInfo.entry, {
          [MantarayEntryMetadataContentTypeKey]: "video/mp4",
          [MantarayEntryMetadataFilenameKey]: `source-${source.quality}.mp4`,
        })

        return {
          type: "mp4",
          quality: source.quality,
          size: source.size,
          bitrate: source.bitrate,
          path,
        }
      })

      // update thumbnail sources
      if (this._preview.thumbnail) {
        this._preview.thumbnail.sources = this._preview.thumbnail.sources.map((source) => {
          if (source.path) return source

          const nodeInfo = thumbnailSourcesNodeInfos.find(
            (ref) => ref.reference === source.reference,
          )

          if (!nodeInfo?.entry) {
            throw new EthernaSdkError(
              "NOT_FOUND",
              `Could not find raw reference for image source: '${source.reference}'`,
            )
          }

          const path = `thumb/${source.width}-${source.type}`

          this.node.addFork(encodePath(path), nodeInfo.entry, {
            [MantarayEntryMetadataContentTypeKey]: `image/${source.type}`,
            [MantarayEntryMetadataFilenameKey]: `thumb-${source.width}.${source.type}`,
          })

          return {
            type: source.type,
            width: source.width,
            path,
          }
        })
      }

      return this.serialized
    } catch (error) {
      throwSdkError(error)
    }
  }

  public addThumbnail(imageProcessor: ImageProcessor) {
    this.removeThumbnail()
    this.importImageProcessor(imageProcessor, THUMB_QUEUE_KEY)
    this._preview.thumbnail = imageProcessor.image
  }

  public removeThumbnail() {
    this.dequeueData(THUMB_QUEUE_KEY)
    for (const source of this._preview.thumbnail?.sources ?? []) {
      if (source.path) {
        this.removeFile(source.path)
      }
    }
    this._preview.thumbnail = null
  }

  public addVideo(videoProcessor: VideoProcessor) {
    this.removeVideo()
    this.importVideoProcessor(videoProcessor, VIDEO_QUEUE_KEY)

    if (!videoProcessor.video) {
      return
    }

    this._preview.duration = videoProcessor.video.duration
    this._details.aspectRatio = videoProcessor.video.aspectRatio
    this._details.sources = videoProcessor.video.sources
  }

  public removeVideo() {
    this.dequeueData(VIDEO_QUEUE_KEY)
    for (const source of this._details.sources ?? []) {
      if (source.path) {
        this.removeFile(source.path)
      }
    }
  }

  public addCaption(reference: Reference, lang: string, label: string): void
  public addCaption(text: string | Uint8Array, lang: string, label: string): void
  public addCaption(
    textOrReference: string | Uint8Array | Reference,
    lang: string,
    label: string,
  ): void {
    this.removeCaption(lang)

    const data =
      textOrReference instanceof Uint8Array
        ? textOrReference
        : !isValidReference(textOrReference)
          ? new TextEncoder().encode(textOrReference)
          : null
    const reference =
      typeof textOrReference === "string" && isValidReference(textOrReference)
        ? textOrReference
        : data
          ? getReferenceFromData(data)
          : null

    if (!reference) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "Coudn't get reference from data")
    }

    if (typeof textOrReference !== "string" || !isValidReference(textOrReference)) {
      const header = new TextEncoder().encode(`WEBVTT\n`)

      if (!data) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Coudn't get data from textOrReference")
      }

      // check if valid vtt
      if (
        data.length < header.length ||
        !data.slice(0, header.length).every((v, i) => v === header[i])
      ) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Invalid Web VTT file")
      }
    }

    const name = this.getCaptionName(lang)
    const key = this.getCaptionKey(lang)
    const path = this.getCaptionPath(lang)

    this._details.captions.push({
      lang,
      label,
      path,
    })

    this.addFile(reference, path, {
      filename: `${name}.vtt`,
      contentType: "text/vtt",
    })

    if (data) {
      this.enqueueData(data, key)
    }
  }

  public removeCaption(lang: string): void {
    const key = this.getCaptionKey(lang)
    const path = this.getCaptionPath(lang)

    this._details.captions = this._details.captions.filter((caption) => caption.lang !== lang)
    this.dequeueData(key)
    this.removeFile(path)
  }

  private getCaptionPath(lang: string) {
    return `captions/${this.getCaptionName(lang)}.vtt`
  }

  private getCaptionKey(lang: string) {
    return `caption-${this.getCaptionName(lang)}`
  }

  private getCaptionName(lang: string) {
    if (!lang) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "Language code is required")
    }
    return lang
  }
}
