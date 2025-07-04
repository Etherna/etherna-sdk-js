import { BaseManifest } from "./base-manifest"
import { EthernaSdkError, throwSdkError } from "@/classes"
import { EmptyAddress } from "@/consts"
import { UserPlaylistsSchema } from "@/schemas/playlists-schema"

import type {
  BaseManifestDownloadOptions,
  BaseManifestOptions,
  BaseManifestUploadOptions,
} from "./base-manifest"
import type { UserPlaylists } from "@/schemas/playlists-schema"
import type { EthAddress } from "@/types/eth"
import type { BatchId, Reference } from "@/types/swarm"

export const USER_PLAYLISTS_TOPIC = "EthernaUserPlaylists"

/**
 * This class is used to fetch/update the personal playlists of the current user
 */
export class UserPlaylistsManifest extends BaseManifest {
  private _owner = EmptyAddress
  private _playlists: UserPlaylists = []

  /**
   * Initialize a new UserPlaylistsManifest instance from existing data
   * @param init List of all user playlists
   * @param options BeeClient and batch options
   */
  constructor(init: UserPlaylists, options: BaseManifestOptions)
  /**
   * Load playlists from beeClient signer address
   * @param options BeeClient and batch options
   */
  constructor(options: BaseManifestOptions)
  constructor(init: UserPlaylists | BaseManifestOptions, options?: BaseManifestOptions) {
    const input = "beeClient" in init ? undefined : init
    const opts = options ?? (init as BaseManifestOptions)

    super(input, opts)

    if (input) {
      this._playlists = input
    }

    if (!opts.beeClient.signer) {
      throw new EthernaSdkError("MISSING_SIGNER", "Signer is required to upload")
    }

    this._owner = opts.beeClient.signer.address
  }

  public get owner(): EthAddress {
    return this._owner
  }

  public get playlists(): UserPlaylists {
    return this._playlists
  }

  public override async download(options?: BaseManifestDownloadOptions): Promise<UserPlaylists> {
    try {
      const feed = this.beeClient.feed.makeFeed(USER_PLAYLISTS_TOPIC, this.owner, "epoch")
      const reader = this.beeClient.feed.makeReader(feed)
      const { reference } = await reader.download({
        headers: {
          // "x-etherna-reason": "users-playlists-feed",
          ...options?.headers,
        },
        signal: options?.signal,
        timeout: options?.timeout,
      })
      const data = await this.beeClient.bzz.download(reference, {
        headers: {
          // "x-etherna-reason": "users-playlists",
          ...options?.headers,
        },
        signal: options?.signal,
        timeout: options?.timeout,
      })
      const rawPlaylists = data.data.json()
      this._playlists = UserPlaylistsSchema.parse(rawPlaylists)

      return this._playlists
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async upload(options?: BaseManifestUploadOptions): Promise<UserPlaylists> {
    try {
      await this.prepareForUpload(options?.batchId, options?.batchLabelQuery)

      // after 'prepareForUpload' batchId must be defined
      const batchId = this.batchId as BatchId

      // ensure playlists are not malformed
      this._playlists = UserPlaylistsSchema.parse(this._playlists)

      const { reference } = await this.beeClient.bzz.upload(JSON.stringify(this._playlists), {
        batchId,
        deferred: options?.deferred,
        encrypt: options?.encrypt,
        pin: options?.pin,
        tag: options?.tag,
        headers: {
          "Content-Type": "application/json",
          // "x-etherna-reason": "user-playlists-upload",
          ...options?.headers,
        },
        signal: options?.signal,
        onUploadProgress: options?.onUploadProgress,
      })

      const feed = this.beeClient.feed.makeFeed(USER_PLAYLISTS_TOPIC, this.owner, "epoch")
      const writer = this.beeClient.feed.makeWriter(feed)
      await writer.upload(reference, {
        batchId,
        deferred: options?.deferred,
        encrypt: options?.encrypt,
        pin: options?.pin,
        tag: options?.tag,
        headers: {
          // "x-etherna-reason": "user-playlists-feed-update",
          ...options?.headers,
        },
        signal: options?.signal,
      })

      this._reference = reference

      return this.playlists
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async resume(options?: BaseManifestUploadOptions): Promise<UserPlaylists> {
    throw new EthernaSdkError(
      "NOT_IMPLEMENTED",
      ".resume() is not implemented for data manifests with little data",
    )
  }

  public addPlaylist(playlistRootManifest: Reference) {
    this._playlists.unshift(playlistRootManifest)
    this._isDirty = true
  }

  public removePlaylist(playlistRootManifest: Reference) {
    this._playlists = this._playlists.filter((playlist) => playlist !== playlistRootManifest)
    this._isDirty = true
  }
}
