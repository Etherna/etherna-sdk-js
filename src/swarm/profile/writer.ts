import { ProfileSerializer } from "../../serializers"
import BaseWriter from "../base-writer"
import { PROFILE_TOPIC, ProfileCache } from "./reader"

import type { Profile } from "../.."
import type { BeeClient, EthAddress, Reference } from "../../clients"
import type { WriterOptions, WriterUploadOptions } from "../base-writer"
import { fetchEnsFromAddress } from "../../utils"

interface ProfileWriterOptions extends WriterOptions {}

export default class ProfileWriter extends BaseWriter<Profile> {
  profile: Profile
  beeClient: BeeClient

  constructor(profile: Profile, opts: ProfileWriterOptions) {
    super(profile, opts)

    this.profile = profile
    this.beeClient = opts.beeClient
  }

  async upload(opts?: WriterUploadOptions): Promise<Reference> {
    if (!this.beeClient.signer) throw new Error("Enable your wallet to update your profile")

    const batchId =
      opts?.batchId ?? this.profile.batchId ?? (await this.beeClient.stamps.fetchBestBatchId())
    const rawProfile = new ProfileSerializer().serialize(this.profile)

    // Upload json
    const { reference } = await this.beeClient.bzz.upload(rawProfile, {
      batchId,
      deferred: opts?.deferred,
      encrypt: opts?.encrypt,
      pin: opts?.pin,
      tag: opts?.tag,
      headers: {
        "Content-Type": "application/json",
        // "x-etherna-reason": "profile-upload",
      },
      signal: opts?.signal,
      onUploadProgress: opts?.onUploadProgress,
    })

    // update feed
    const feed = this.beeClient.feed.makeFeed(
      PROFILE_TOPIC,
      this.profile.address as EthAddress,
      "sequence"
    )
    const writer = this.beeClient.feed.makeWriter(feed)
    await writer.upload(reference, {
      batchId,
      deferred: opts?.deferred,
      encrypt: opts?.encrypt,
      pin: opts?.pin,
      tag: opts?.tag,
      headers: {
        // "x-etherna-reason": "profile-feed-update",
      },
      signal: opts?.signal,
    })

    let ens = ProfileCache.get(this.profile.address as EthAddress)?.ens ?? null

    if (!ens) {
      ens = await fetchEnsFromAddress(this.profile.address)
    }

    // update cache
    ProfileCache.set(this.profile.address as EthAddress, {
      ...this.profile,
      ens,
    })

    return reference
  }
}
