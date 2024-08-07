import { UserPlaylistsSerializer } from "../../serializers"
import { EmptyReference } from "../../utils"
import { BaseWriter } from "../base-writer"
import { PlaylistReader } from "../playlist/reader"
import { USER_PLAYLISTS_TOPIC } from "./reader"

import type { UserPlaylists } from "../.."
import type { BeeClient, EthAddress, Reference } from "../../clients"
import type { WriterOptions, WriterUploadOptions } from "../base-writer"

interface UserPlaylistsWriterOptions extends WriterOptions {}

interface UserPlaylistsWriterUploadOptions extends WriterUploadOptions {}

export class UserPlaylistsWriter extends BaseWriter<UserPlaylists> {
  private playlists: UserPlaylists
  private beeClient: BeeClient

  constructor(playlists: UserPlaylists, opts: UserPlaylistsWriterOptions) {
    super(playlists, opts)

    this.playlists = playlists
    this.beeClient = opts.beeClient
  }

  async upload(opts?: UserPlaylistsWriterUploadOptions): Promise<Reference> {
    const batchId = opts?.batchId ?? (await this.beeClient.stamps.fetchBestBatchId())
    const playlistsRaw = new UserPlaylistsSerializer().serialize(this.playlists)

    const { reference } = await this.beeClient.bzz.upload(playlistsRaw, {
      batchId,
      deferred: opts?.deferred,
      encrypt: opts?.encrypt,
      pin: opts?.pin,
      tag: opts?.tag,
      headers: {
        "Content-Type": "application/json",
        // "x-etherna-reason": "user-playlists-upload",
      },
      signal: opts?.signal,
      onUploadProgress: opts?.onUploadProgress,
    })

    const feed = this.beeClient.feed.makeFeed(
      USER_PLAYLISTS_TOPIC,
      this.beeClient.signer!.address,
      "epoch",
    )
    const writer = this.beeClient.feed.makeWriter(feed)
    await writer.upload(reference, {
      batchId,
      deferred: opts?.deferred,
      encrypt: opts?.encrypt,
      pin: opts?.pin,
      tag: opts?.tag,
      headers: {
        // "x-etherna-reason": "user-playlists-feed-update",
      },
      signal: opts?.signal,
    })

    return reference
  }
}
