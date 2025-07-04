import { BaseMantarayManifest } from "./base-manifest"
import { EthernaSdkError, throwSdkError } from "@/classes"
import { EmptyAddress, MANIFEST_DETAILS_PATH } from "@/consts"
import { ProfileDetailsSchema, ProfilePreviewSchema } from "@/schemas/profile-schema"
import {
  bytesReferenceToReference,
  fetchAddressFromEns,
  fetchEnsFromAddress,
  isEnsAddress,
  isEthAddress,
  structuredClone,
} from "@/utils"

import type {
  BaseManifestOptions,
  BaseManifestUploadOptions,
  BaseMantarayManifestDownloadOptions,
} from "./base-manifest"
import type { ImageProcessor } from "@/processors/image-processor"
import type { ProfileDetails, ProfilePreview } from "@/schemas/profile-schema"
import type { EnsAddress, EthAddress } from "@/types/eth"
import type { BatchId, Reference } from "@/types/swarm"

export interface Profile {
  reference: Reference
  address: EthAddress
  ensName: EnsAddress | null
  preview: ProfilePreview
  details: ProfileDetails
}

export const PROFILE_TOPIC = "EthernaUserProfile"
const AVATAR_QUEUE_KEY = "avatar"
const COVER_QUEUE_KEY = "cover"

/**
 * This class is used to fetch any user profile data or update the current user profile
 */
export class ProfileManifest extends BaseMantarayManifest {
  private _address: EthAddress = EmptyAddress
  private _ensName: EnsAddress | null = null

  protected override _preview: ProfilePreview = {
    address: EmptyAddress,
    avatar: null,
    name: "",
  }
  protected override _details: ProfileDetails = {
    cover: null,
    playlists: [],
  }

  /**
   * Download a profile of any user / update profile of the current user
   * @param identification Profile address or ENS name
   * @param options Manifest options
   */
  constructor(identification: EthAddress | EnsAddress, options: BaseManifestOptions)
  /**
   * Update the current user profile from existing data
   * @param profile Profile data
   * @param options Manifest options
   */
  constructor(profile: Profile, options: BaseManifestOptions)
  /**
   * Fetch/update the current user profile
   * @param options Manifest options
   */
  constructor(options: BaseManifestOptions)
  constructor(
    input: EthAddress | EnsAddress | Profile | BaseManifestOptions,
    options?: BaseManifestOptions,
  ) {
    const init = typeof input === "object" && "beeClient" in input ? undefined : input
    const opts = options ?? (input as BaseManifestOptions)

    super(init, opts)

    if (typeof init === "string") {
      if (isEthAddress(init)) {
        this._address = init
      } else if (isEnsAddress(init)) {
        this._ensName = init
      }
    } else {
      if (!opts.beeClient.signer) {
        throw new EthernaSdkError("MISSING_SIGNER", "Signer is required to upload")
      }

      if (init) {
        if (opts.beeClient.signer.address.toLowerCase() !== init.address.toLowerCase()) {
          throw new EthernaSdkError("PERMISSION_DENIED", "You can't update other user's profile")
        }

        this._preview = init.preview
        this._details = init.details
        this._address = init.address
        this._ensName = init.ensName
        this._reference = init.reference
      } else {
        this._address = opts.beeClient.signer.address
      }
    }

    this.setPreviewProxy(this._preview)
    this.setDetailsProxy(this._details)
  }

  public override get serialized(): Profile {
    return Object.seal({
      reference: this.reference,
      address: this.address,
      ensName: this.ensName,
      preview: this._preview,
      details: this._details,
    })
  }

  public get address() {
    return this._address
  }

  public get ensName() {
    return this._ensName
  }

  public get name() {
    return this._preview.name
  }
  public set name(value: string) {
    this._preview.name = value
  }

  public get avatar() {
    return structuredClone(this._preview.avatar)
  }

  public get cover() {
    return structuredClone(this._details.cover)
  }

  public get description() {
    return this._details.description
  }
  public set description(value: string | null | undefined) {
    this._details.description = value
  }

  public get website() {
    return this._details.website
  }
  public set website(value: string | undefined) {
    this._details.website = value
  }

  public get birthday() {
    return this._details.birthday
  }
  public set birthday(value: string | undefined) {
    this._details.birthday = value
  }

  public get location() {
    return this._details.location
  }
  public set location(value: string | undefined) {
    this._details.location = value
  }

  public get playlists() {
    return structuredClone(this._details.playlists)
  }

  public override async download(options: BaseMantarayManifestDownloadOptions): Promise<Profile> {
    try {
      if (this.address === EmptyAddress && this.ensName) {
        this._address = (await fetchAddressFromEns(this.ensName)) ?? EmptyAddress
      }

      if (this.address === EmptyAddress) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Address or ENS name is required")
      }

      const ensPromise = this.ensName
        ? Promise.resolve(this.ensName)
        : fetchEnsFromAddress(this.address)

      const feed = this.beeClient.feed.makeFeed(PROFILE_TOPIC, this.address, "epoch")
      const reader = this.beeClient.feed.makeReader(feed)
      const { reference } = await reader.download({
        headers: {
          // "x-etherna-reason": "profile-feed",
          ...options.headers,
        },
        signal: options.signal,
        timeout: options.timeout,
      })

      const shouldDownloadPreview = options.mode === "preview" || options.mode === "full"
      const shouldDownloadDetails = options.mode === "details" || options.mode === "full"

      const previewPromise = shouldDownloadPreview
        ? this.beeClient.bzz
            .download(reference, {
              headers: {
                // "x-etherna-reason": "profile-preview",
                ...options.headers,
              },
              signal: options.signal,
              timeout: options.timeout,
              onDownloadProgress: options.onDownloadProgress,
            })
            .then((resp) => ProfilePreviewSchema.parse(resp.data.json()))
        : Promise.resolve(this._preview)
      const detailsPromise = shouldDownloadDetails
        ? this.beeClient.bzz
            .downloadPath(reference, MANIFEST_DETAILS_PATH, {
              headers: {
                // "x-etherna-reason": "profile-preview",
                ...options.headers,
              },
              signal: options.signal,
              timeout: options.timeout,
              onDownloadProgress: options.onDownloadProgress,
            })
            .then((resp) => ProfileDetailsSchema.parse(resp.data.json()))
        : Promise.resolve(this._details)

      this._reference = reference
      this._preview = await previewPromise
      this._details = await detailsPromise
      this._ensName = await ensPromise
      this._hasLoadedPreview = shouldDownloadPreview || this._hasLoadedPreview
      this._hasLoadedDetails = shouldDownloadDetails || this._hasLoadedDetails
      this._isDirty = false

      return this.serialized
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async upload(options?: BaseManifestUploadOptions): Promise<Profile> {
    if (this.address.toLowerCase() !== this.beeClient.signer?.address.toLowerCase()) {
      throw new EthernaSdkError("PERMISSION_DENIED", "You can't update other user's profile")
    }

    this._preview.address = this.address

    try {
      await this.prepareForUpload(options?.batchId, options?.batchLabelQuery)

      // after 'prepareForUpload' batchId must be defined
      const batchId = this.batchId as BatchId

      // ensure data is not malformed
      this._preview = ProfilePreviewSchema.parse(this._preview)
      this._details = ProfileDetailsSchema.parse(this._details)

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

      this.chunksUploader.resume({
        batchId,
        ...options,
      })
      await this.chunksUploader.drain()

      // update feed
      const feed = this.beeClient.feed.makeFeed(PROFILE_TOPIC, this.address, "epoch")
      const writer = this.beeClient.feed.makeWriter(feed)
      await writer.upload(this.reference, {
        batchId,
        deferred: options?.deferred,
        encrypt: options?.encrypt,
        pin: options?.pin,
        tag: options?.tag,
        signal: options?.signal,
        headers: {
          // "x-etherna-reason": "profile-feed-update",
        },
      })

      this._hasLoadedPreview = true
      this._hasLoadedDetails = true

      return this.serialized
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async resume(options?: BaseManifestUploadOptions): Promise<Profile> {
    throw new EthernaSdkError(
      "NOT_IMPLEMENTED",
      ".resume() is not implemented for data manifests with little data",
    )
  }

  public addPlaylist(playlistRootManifest: Reference) {
    this._details.playlists.push(playlistRootManifest)
  }

  public removePlaylist(playlistRootManifest: Reference) {
    const index = this._details.playlists.indexOf(playlistRootManifest)
    if (index >= 0) {
      this._details.playlists.splice(index, 1)
    }
  }

  public movePlaylist(playlistRootManifest: Reference, newIndex: number) {
    const index = this._details.playlists.indexOf(playlistRootManifest)
    if (index >= 0) {
      this._details.playlists.splice(index, 1)
      this._details.playlists.splice(newIndex, 0, playlistRootManifest)
    }
  }

  public addAvatar(imageProcessor: ImageProcessor) {
    this.removeAvatar()
    this.importImageProcessor(imageProcessor, AVATAR_QUEUE_KEY)
    this._preview.avatar = imageProcessor.image
  }

  public addCover(imageProcessor: ImageProcessor) {
    this.removeCover()
    this.importImageProcessor(imageProcessor, COVER_QUEUE_KEY)
    this._details.cover = imageProcessor.image
  }

  public removeAvatar() {
    this.dequeueData(AVATAR_QUEUE_KEY)
    for (const source of this._preview.avatar?.sources ?? []) {
      if (source.path) {
        this.removeFile(source.path)
      }
    }
    this._preview.avatar = null
  }

  public removeCover() {
    this.dequeueData(COVER_QUEUE_KEY)
    for (const source of this._details.cover?.sources ?? []) {
      if (source.path) {
        this.removeFile(source.path)
      }
    }
    this._details.cover = null
  }
}
