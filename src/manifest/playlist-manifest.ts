import { BaseMantarayManifest } from "./base-manifest"
import { EthernaSdkError, throwSdkError } from "@/classes"
import {
  EmptyAddress,
  MANIFEST_DETAILS_PATH,
  MantarayEntryMetadataContentTypeKey,
  MantarayEntryMetadataFilenameKey,
} from "@/consts"
import { PlaylistDetailsSchema, PlaylistPreviewSchema } from "@/schemas/playlist-schema"
import {
  bytesReferenceToReference,
  dateToTimestamp,
  decryptData,
  encodePath,
  encryptData,
  fetchAddressFromEns,
  isEmptyReference,
  isEnsAddress,
  isEthAddress,
  isValidReference,
  structuredClone,
  textToReference,
  timestampToDate,
} from "@/utils"

import type {
  BaseManifestOptions,
  BaseManifestUploadOptions,
  BaseMantarayManifestDownloadOptions,
} from "./base-manifest"
import type { Video } from "./video-manifest"
import type { FeedInfo } from "@/clients"
import type {
  PlaylistDetails,
  PlaylistPreview,
  PlaylistType,
  PlaylistVideo,
} from "@/schemas/playlist-schema"
import type { EnsAddress, EthAddress } from "@/types/eth"
import type { BatchId, Reference } from "@/types/swarm"

export interface PlaylistManifestUploadOptions extends BaseManifestUploadOptions {
  password?: string
}

export type PlaylistIdentification = Reference | { id: string; owner: EthAddress | EnsAddress }

export interface Playlist {
  reference: Reference
  rootManifest: Reference
  preview: PlaylistPreview
  details: PlaylistDetails
  isEncrypted: boolean
  encryptedDetails?: string
}

export const CHANNEL_PLAYLIST_ID = "Channel"
export const SAVED_PLAYLIST_ID = "Saved"

export const createPlaylistTopicName = (id: string) => `EthernaPlaylist:${id}`

/**
 * This class is used to fetch/update a playlist
 */
export class PlaylistManifest extends BaseMantarayManifest {
  private _ensName: EnsAddress | null = null
  protected override _preview: PlaylistPreview = {
    id: "",
    type: "public",
    name: "",
    owner: EmptyAddress,
    thumb: null,
    createdAt: dateToTimestamp(new Date()),
    updatedAt: dateToTimestamp(new Date()),
  }
  protected override _details: PlaylistDetails = {
    videos: [],
  }
  private _encryptedDetails?: string
  private _isEncrypted = false

  /**
   * Load a playlist from identification (rootManifest or id + owner)
   * @param identification Playlist identification (rootManifest or id + owner)
   * @param options Manifest options
   */
  constructor(identification: PlaylistIdentification, options: BaseManifestOptions)
  /**
   * Load a playlist from existing data for updating
   * @param playlist Playlist existing data
   * @param options Manifest options
   */
  constructor(playlist: Playlist, options: BaseManifestOptions)
  /**
   * Create new playlist
   * @param options Manifest options
   */
  constructor(options: BaseManifestOptions)
  constructor(
    input: PlaylistIdentification | Playlist | BaseManifestOptions,
    options?: BaseManifestOptions,
  ) {
    const init = typeof input === "object" && "beeClient" in input ? undefined : input
    const opts = options ?? (input as BaseManifestOptions)

    super(init, opts)

    if (typeof init === "string" && isValidReference(init)) {
      this._rootManifest = init
    } else if (init && "id" in init && "owner" in init) {
      this._preview = {
        id: init.id,
        owner: isEthAddress(init.owner) ? init.owner : EmptyAddress,
        name: "",
        thumb: null,
        type: "public",
        createdAt: dateToTimestamp(new Date()),
        updatedAt: dateToTimestamp(new Date()),
      }

      if (isEnsAddress(init.owner)) {
        this._ensName = init.owner
      }
    } else {
      if (!opts.beeClient.signer) {
        throw new EthernaSdkError("MISSING_SIGNER", "Signer is required to upload")
      }

      if (init) {
        if (opts.beeClient.signer.address.toLowerCase() !== init.preview.owner.toLowerCase()) {
          throw new EthernaSdkError("PERMISSION_DENIED", "You can't update other user's playlist")
        }

        this._preview = init.preview
        this._details = init.details
        this._encryptedDetails = init.encryptedDetails
        this._isEncrypted = init.isEncrypted
        this._reference = init.reference
        this._rootManifest = init.rootManifest
      } else {
        this._preview.id = crypto.randomUUID()
        this._preview.owner = opts.beeClient.signer.address
      }
    }

    this.setPreviewProxy(this._preview)
    this.setDetailsProxy(this._details)
  }

  public get id() {
    return this._preview.id
  }

  public get owner() {
    return this._preview.owner
  }

  public get type() {
    return this._preview.type
  }
  public set type(value: PlaylistType) {
    if (value === "private") {
      throw new EthernaSdkError(
        "NOT_IMPLEMENTED",
        "Private playlists are not implemented yet. Use 'protected' with password instead.",
      )
    }

    this._preview.type = value

    if (this.isEncryptableType) {
      this._details.name = this._preview.name
      this._preview.name = ""
    } else {
      this._preview.name = this._details.name ?? this._preview.name
    }
  }

  public get isEncrypted() {
    return this._isEncrypted
  }

  public get isEncryptableType() {
    switch (this.type) {
      case "public":
        return false
      case "private":
      case "protected":
        return true
    }
  }

  public get previewName() {
    return this._preview.name
  }
  public set previewName(value: string) {
    if (!this.isEncryptableType) {
      throw new EthernaSdkError(
        "BAD_REQUEST",
        "Only private and protected playlists can have a preview name",
      )
    }
    this._preview.name = value
  }

  public get name() {
    return this.hasLoadedDetails ? (this._details.name ?? this._preview.name) : this._preview.name
  }
  public set name(value: string) {
    if (this.isEncryptableType) {
      this._details.name = value
    } else {
      this._preview.name = value
    }
  }

  public get description() {
    return this._details.description
  }
  public set description(value: string | undefined) {
    this._details.description = value
  }

  public get thumb() {
    return this._preview.thumb
  }

  public get passwordHint() {
    return this._preview.passwordHint
  }
  public set passwordHint(value: string | undefined) {
    this._preview.passwordHint = value
  }

  public get createdAt() {
    return timestampToDate(this._preview.createdAt)
  }

  public get updatedAt() {
    return timestampToDate(this._preview.updatedAt)
  }

  public get videos() {
    return this._details.videos.map((v) => ({
      title: v.t,
      reference: v.r,
      addedAt: timestampToDate(v.a),
      publishedAt: v.p ? timestampToDate(v.p) : null,
    }))
  }

  public override get serialized(): Playlist {
    return structuredClone({
      reference: this.reference,
      rootManifest: this._rootManifest,
      preview: this._preview,
      details: this._details,
      isEncrypted: this._isEncrypted,
      encryptedDetails: this._encryptedDetails,
    })
  }

  public override async download(options: BaseMantarayManifestDownloadOptions): Promise<Playlist> {
    try {
      if (this._preview.owner === EmptyAddress && this._ensName) {
        this._preview.owner = (await fetchAddressFromEns(this._ensName)) ?? EmptyAddress
      }

      if (isEmptyReference(this._rootManifest) && this._preview.owner === EmptyAddress) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Playlist owner or root manifest is required")
      }

      if (isEmptyReference(this._reference) || isEmptyReference(this._rootManifest)) {
        const feed = await this.getPlaylistFeed()
        const reader = this.beeClient.feed.makeReader(feed)
        this._reference = isEmptyReference(this._reference)
          ? (await reader.download({ ...options })).reference
          : this._reference
        this._rootManifest = isEmptyReference(this._rootManifest)
          ? (await this.beeClient.feed.makeRootManifest(feed)).reference
          : this._rootManifest
      }

      const shouldDownloadPreview = options.mode === "preview" || options.mode === "full"
      const shouldDownloadDetails = options.mode === "details" || options.mode === "full"

      const previewData = shouldDownloadPreview
        ? await this.beeClient.bzz
            .download(this._reference, {
              headers: {
                // "x-etherna-reason": "playlist-preview",
              },
            })
            .then((res) => res.data.text())
        : await Promise.resolve(JSON.stringify(this._preview))
      const detailsData = shouldDownloadDetails
        ? await this.beeClient.bzz
            .downloadPath(this._reference, MANIFEST_DETAILS_PATH, {
              headers: {
                // "x-etherna-reason": "playlist-details",
              },
            })
            .then((res) => res.data.text())
        : await Promise.resolve(JSON.stringify(this._details))

      this._preview = PlaylistPreviewSchema.parse(JSON.parse(previewData))
      this._details =
        this.type === "public"
          ? PlaylistDetailsSchema.parse(JSON.parse(detailsData))
          : this._details
      this._encryptedDetails = this.isEncryptableType ? detailsData : undefined
      this._isEncrypted = this.isEncryptableType
      this._hasLoadedPreview = shouldDownloadPreview || this._hasLoadedPreview
      this._hasLoadedDetails = shouldDownloadDetails || this._hasLoadedDetails
      this._isDirty = false

      return this.serialized
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async upload(options?: PlaylistManifestUploadOptions): Promise<Playlist> {
    if (this.owner.toLowerCase() !== this.beeClient.signer?.address.toLowerCase()) {
      throw new EthernaSdkError("PERMISSION_DENIED", "You can't update other user's playlist")
    }

    if (this.isEncryptableType && !options?.password) {
      throw new EthernaSdkError("BAD_REQUEST", "Password is required for protected playlists")
    }

    try {
      await this.prepareForUpload(options?.batchId, options?.batchLabelQuery)

      // after 'prepareForUpload' batchId must be defined
      const batchId = this.batchId as BatchId

      // ensure data is not malformed
      this._preview = PlaylistPreviewSchema.parse(this._preview)
      this._details = PlaylistDetailsSchema.parse(this._details)
      this._encryptedDetails = this.isEncryptableType
        ? encryptData(JSON.stringify(this._details), options?.password ?? "")
        : undefined

      // update data
      this.updateNodeDefaultEntries()
      this.enqueueData(new TextEncoder().encode(JSON.stringify(this._preview)))
      const serializedDetails = this.isEncryptableType
        ? this._encryptedDetails
        : JSON.stringify(this._details)
      this.enqueueData(new TextEncoder().encode(serializedDetails))

      // save mantary node
      this._reference = await this.node
        .save(async (data) => {
          return this.enqueueData(data)
        })
        .then(bytesReferenceToReference)

      this.chunksUploader.resume({
        batchId,
        ...options,
      })
      await this.chunksUploader.drain()

      // update feed
      const feed = this.beeClient.feed.makeFeed(
        createPlaylistTopicName(this.id),
        this.owner,
        "epoch",
      )
      const writer = this.beeClient.feed.makeWriter(feed)
      await Promise.all([
        writer.upload(this.reference, {
          batchId,
          deferred: options?.deferred,
          encrypt: options?.encrypt,
          pin: options?.pin,
          tag: options?.tag,
          signal: options?.signal,
          headers: {
            // "x-etherna-reason": "playlist-feed-update",
          },
        }),
        this.beeClient.feed.createRootManifest(feed, { batchId }),
      ])

      if (isEmptyReference(this._rootManifest)) {
        this._rootManifest = (await this.beeClient.feed.makeRootManifest(feed)).reference
      }

      this._hasLoadedPreview = true
      this._hasLoadedDetails = true

      return this.serialized
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async resume(options?: BaseManifestUploadOptions): Promise<Playlist> {
    throw new EthernaSdkError(
      "NOT_IMPLEMENTED",
      ".resume() is not implemented for data manifests with little data",
    )
  }

  public decrypt(password: string) {
    if (!this.isEncrypted) {
      return
    }

    if (!this._encryptedDetails) {
      throw new EthernaSdkError(
        "BAD_REQUEST",
        "No encrypted data found. Try to download this playlist with mode set to 'full' or 'details'.",
      )
    }

    try {
      const decryptedData = decryptData(this._encryptedDetails, password)
      this._details = PlaylistDetailsSchema.parse(JSON.parse(decryptedData))
      this._preview.name = this._details.name ?? this._preview.name
      this._encryptedDetails = undefined
      this._isEncrypted = false
    } catch (error) {
      throwSdkError(error)
    }
  }

  public addVideo(video: Video, publishAt?: Date) {
    this._details.videos.unshift(
      structuredClone({
        r: video.reference,
        t: video.preview.title,
        a: dateToTimestamp(new Date()),
        p: publishAt ? dateToTimestamp(publishAt) : undefined,
      }),
    )

    if (video.preview.thumbnail) {
      this.updateThumb(video)
    }
  }

  public replaceVideo(oldReference: Reference, newVideo: Video) {
    const playlistVideo = {
      r: newVideo.reference,
      t: newVideo.preview.title,
      a: dateToTimestamp(new Date()),
    } satisfies PlaylistVideo

    const videoIndex = this._details.videos.findIndex((video) => video.r === oldReference)

    if (videoIndex >= 0) {
      this._details.videos[videoIndex] = playlistVideo

      const shouldUpdateThumb = this._preview.thumb?.path.startsWith(`/${oldReference}`)
      if (shouldUpdateThumb) {
        this.updateThumb(newVideo)
      }
    } else {
      this.addVideo(newVideo)
    }
  }

  public removeVideo(videoReference: Reference) {
    this._details.videos = this._details.videos.filter((video) => video.r !== videoReference)
  }

  protected override updateNodeDefaultEntries(): void {
    super.updateNodeDefaultEntries()

    if (this.isEncryptableType) {
      this.node.addFork(
        encodePath(MANIFEST_DETAILS_PATH),
        textToReference(this._encryptedDetails ?? ""),
        {
          [MantarayEntryMetadataContentTypeKey]: "application/octet-stream",
          [MantarayEntryMetadataFilenameKey]: `${MANIFEST_DETAILS_PATH}.json`,
        },
      )
    }
  }

  private updateThumb(video: Video) {
    if (!video.preview.thumbnail) {
      return
    }

    const smallerThumb = video.preview.thumbnail.sources.sort((a, b) => a.width - b.width)[0]

    if (smallerThumb) {
      const smallerThumbPath = smallerThumb.path
        ? `/${video.reference}/${smallerThumb.path}`
        : `/${smallerThumb.reference}`

      this._preview.thumb = {
        blurhash: video.preview.thumbnail.blurhash,
        path: smallerThumbPath,
      }
    }
  }

  private async getPlaylistFeed(): Promise<FeedInfo> {
    if ((!this.id || this.owner === EmptyAddress) && isEmptyReference(this.rootManifest)) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "id + owner or rootManifest must be provided")
    }

    const topicName = createPlaylistTopicName(this.id)
    const feed = this.beeClient.feed.makeFeed(topicName, this.owner, "epoch")

    if (!this.id || this.owner === "0x0") {
      const playlistFeed = await this.beeClient.feed.parseFeedFromRootManifest(this.rootManifest)
      this._preview.owner = `0x${playlistFeed.owner}`

      feed.owner = playlistFeed.owner
      feed.topic = playlistFeed.topic
    }

    return feed
  }
}
