import { BaseManifest } from "./base-manifest"
import { EthernaSdkError, throwSdkError } from "@/classes"
import { EmptyAddress } from "@/consts"
import { UserFollowings, UserFollowingsSchema } from "@/schemas/followings-schema"

import type {
  BaseManifestDownloadOptions,
  BaseManifestOptions,
  BaseManifestUploadOptions,
} from "./base-manifest"
import type { EthAddress } from "@/types/eth"
import type { BatchId } from "@/types/swarm"

export const USER_FOLLOWINGS_TOPIC = "EthernaUserFollowings"

/**
 * This class is used to fetch/update the following users of the current user
 */
export class UserFollowingsManifest extends BaseManifest {
  private _owner = EmptyAddress
  private _followings: UserFollowings = []

  /**
   * Initialize a new UserFollowingsManifest instance from existing data
   * @param init List of all user followings
   * @param options BeeClient and batch options
   */
  constructor(init: UserFollowings, options: BaseManifestOptions)
  /**
   * Load followings from beeClient signer address
   * @param options BeeClient and batch options
   */
  constructor(options: BaseManifestOptions)
  constructor(init: UserFollowings | BaseManifestOptions, options?: BaseManifestOptions) {
    const input = "beeClient" in init ? undefined : init
    const opts = options ?? (init as BaseManifestOptions)

    super(input, opts)

    if (input) {
      this._followings = input
    }

    if (!opts.beeClient.signer) {
      throw new EthernaSdkError("MISSING_SIGNER", "Signer is required to upload")
    }

    this._owner = opts.beeClient.signer.address
  }

  public get owner(): EthAddress {
    return this._owner
  }

  public get followings(): UserFollowings {
    return this._followings
  }

  public override async download(options?: BaseManifestDownloadOptions): Promise<UserFollowings> {
    try {
      const feed = this.beeClient.feed.makeFeed(USER_FOLLOWINGS_TOPIC, this.owner, "epoch")
      const reader = this.beeClient.feed.makeReader(feed)
      const { reference } = await reader.download({
        headers: {
          // "x-etherna-reason": "users-followings-feed",
          ...options?.headers,
        },
        signal: options?.signal,
        timeout: options?.timeout,
      })
      const data = await this.beeClient.bzz.download(reference, {
        headers: {
          // "x-etherna-reason": "users-followings",
          ...options?.headers,
        },
        signal: options?.signal,
        timeout: options?.timeout,
      })
      const rawFollowings = data.data.json()
      this._followings = UserFollowingsSchema.parse(rawFollowings)

      return this._followings
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async upload(options?: BaseManifestUploadOptions): Promise<UserFollowings> {
    try {
      await this.prepareForUpload(options?.batchId, options?.batchLabelQuery)

      // after 'prepareForUpload' batchId must be defined
      const batchId = this.batchId as BatchId

      // ensure followings are not malformed
      this._followings = UserFollowingsSchema.parse(this._followings)

      const { reference } = await this.beeClient.bzz.upload(JSON.stringify(this._followings), {
        batchId,
        deferred: options?.deferred,
        encrypt: options?.encrypt,
        pin: options?.pin,
        tag: options?.tag,
        headers: {
          "Content-Type": "application/json",
          // "x-etherna-reason": "user-followings-upload",
          ...options?.headers,
        },
        signal: options?.signal,
        onUploadProgress: options?.onUploadProgress,
      })

      const feed = this.beeClient.feed.makeFeed(USER_FOLLOWINGS_TOPIC, this.owner, "epoch")
      const writer = this.beeClient.feed.makeWriter(feed)
      await writer.upload(reference, {
        batchId,
        deferred: options?.deferred,
        encrypt: options?.encrypt,
        pin: options?.pin,
        tag: options?.tag,
        headers: {
          // "x-etherna-reason": "user-followings-feed-update",
          ...options?.headers,
        },
        signal: options?.signal,
      })

      this._reference = reference

      return this.followings
    } catch (error) {
      throwSdkError(error)
    }
  }

  public override async resume(options?: BaseManifestUploadOptions): Promise<UserFollowings> {
    throw new EthernaSdkError(
      "NOT_IMPLEMENTED",
      ".resume() is not implemented for data manifests with little data",
    )
  }

  public addFollowing(address: EthAddress) {
    if (this._followings.includes(address)) {
      throw new EthernaSdkError("DUPLICATE", "You are already following this user")
    }

    this._followings.unshift(address)
    this._isDirty = true
  }

  public removeFollowing(address: EthAddress) {
    this._followings = this._followings.filter((following) => following !== address)
    this._isDirty = true
  }
}
