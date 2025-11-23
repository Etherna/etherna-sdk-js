import { beforeAll, describe, expect, it } from "vitest"

import { BeeClient } from "@/clients"
import { UserPlaylistsManifest } from "@/manifest"

import type { BatchId, EthAddress, Reference } from "@/types"

describe("users playlists manifest read", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId

  beforeAll(async () => {
    const userPlaylists = new UserPlaylistsManifest({ beeClient })
    userPlaylists.addPlaylist("0".repeat(64) as Reference)
    userPlaylists.addPlaylist("1".repeat(64) as Reference)
    userPlaylists.addPlaylist("2".repeat(64) as Reference)
    await userPlaylists.upload({ batchId })
  })

  it("should get the user playlists owner", () => {
    const userPlaylists = new UserPlaylistsManifest({ beeClient })
    expect(userPlaylists.owner).toBe(owner)
  })

  it("should download the user playlists", async () => {
    const userPlaylists = new UserPlaylistsManifest({ beeClient })
    await userPlaylists.download()
    expect(userPlaylists.playlists).toStrictEqual(["2".repeat(64), "1".repeat(64), "0".repeat(64)])
  })
})

describe("users playlists manifest write", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
  })

  it("should add a playlist", async () => {
    const userPlaylists = new UserPlaylistsManifest({ beeClient })
    userPlaylists.addPlaylist("0".repeat(64) as Reference)

    expect(userPlaylists.playlists).toStrictEqual(["0".repeat(64)])
  })

  it("should remove a playlist", async () => {
    const userPlaylists = new UserPlaylistsManifest({ beeClient })
    userPlaylists.addPlaylist("0".repeat(64) as Reference)
    userPlaylists.addPlaylist("1".repeat(64) as Reference)
    userPlaylists.addPlaylist("2".repeat(64) as Reference)
    userPlaylists.removePlaylist("1".repeat(64) as Reference)

    expect(userPlaylists.playlists).toStrictEqual(["2".repeat(64), "0".repeat(64)])
  })

  it("should upload the user playlists", async () => {
    const userPlaylists = new UserPlaylistsManifest({ beeClient })
    userPlaylists.addPlaylist("0".repeat(64) as Reference)
    userPlaylists.addPlaylist("1".repeat(64) as Reference)
    userPlaylists.addPlaylist("2".repeat(64) as Reference)
    expect(async () => await userPlaylists.upload({ batchId })).not.toThrow()
  })

  it("should update the user playlists", async () => {
    const createPlaylist = new UserPlaylistsManifest({ beeClient })
    createPlaylist.addPlaylist("0".repeat(64) as Reference)
    createPlaylist.addPlaylist("1".repeat(64) as Reference)
    createPlaylist.addPlaylist("2".repeat(64) as Reference)
    await createPlaylist.upload({ batchId })

    const editPlaylist = new UserPlaylistsManifest(createPlaylist.playlists, { beeClient })
    await editPlaylist.download()
    editPlaylist.removePlaylist("1".repeat(64) as Reference)
    await editPlaylist.upload({ batchId })

    const readPlaylist = new UserPlaylistsManifest({ beeClient })
    await readPlaylist.download()
    expect(readPlaylist.playlists).toStrictEqual(["2".repeat(64), "0".repeat(64)])
  })
})
