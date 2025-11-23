import { anyReference } from "test/utils/test-consts"
import uuid from "uuid-random"
import { beforeAll, describe, expect, it } from "vitest"

import { BeeClient } from "@/clients"
import { EmptyAddress } from "@/consts"
import { PlaylistManifest } from "@/manifest"

import type { Video } from "@/manifest"
import type { BatchId, EthAddress, Reference } from "@/types"

const mockVideo: Video = {
  reference: anyReference,
  preview: {
    title: "My first video",
    thumbnail: null,
    duration: 0,
    ownerAddress: EmptyAddress,
    createdAt: 0,
  },
  details: { description: "", aspectRatio: 1, sources: [] },
}

describe("playlist manifest read", () => {
  const publicPlaylistId = "1608f15c-8a65-45db-aee5-13cc391ed164"
  const protectedPlaylistId = "cfd4100c-b386-4e8a-bd1a-bf26664b6218"
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  const protectedPassword = "password"
  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId

  beforeAll(async () => {
    const publicPlaylist = new PlaylistManifest({ id: publicPlaylistId, owner }, { beeClient })
    publicPlaylist.name = "My Public Playlist"
    publicPlaylist.description = "This is my public playlist"
    publicPlaylist.addVideo(mockVideo)

    const protectedPlaylist = new PlaylistManifest(
      { id: protectedPlaylistId, owner },
      { beeClient },
    )
    protectedPlaylist.type = "protected"
    protectedPlaylist.name = "My Protected Playlist"
    protectedPlaylist.previewName = "Hello World"
    protectedPlaylist.description = "This is my protected playlist"
    protectedPlaylist.addVideo(mockVideo)

    await Promise.all([
      publicPlaylist.upload({ batchId }),
      protectedPlaylist.upload({ batchId, password: protectedPassword }),
    ])
  })

  it("should get the playlist Id", () => {
    const playlist = new PlaylistManifest({ id: publicPlaylistId, owner }, { beeClient })
    expect(playlist.id).toBe(publicPlaylistId)
  })

  it("should get the playlist owner", () => {
    const playlist = new PlaylistManifest({ id: publicPlaylistId, owner }, { beeClient })
    expect(playlist.owner).toBe(owner)

    const playlist2 = new PlaylistManifest({ beeClient })
    expect(playlist2.owner).toBe(owner)
  })

  it("should download the full playlist", async () => {
    const playlist = new PlaylistManifest({ id: publicPlaylistId, owner }, { beeClient })
    await playlist.download({ mode: "full" })
    expect(playlist.hasLoadedPreview).toBe(true)
    expect(playlist.hasLoadedDetails).toBe(true)
    expect(playlist.name).toBe("My Public Playlist")
    expect(playlist.owner).toBe(owner)
    expect(playlist.description).toBe("This is my public playlist")
    expect(playlist.videos).toHaveLength(1)
    expect(playlist.videos[0]?.reference).toBe(
      "0123456789010123456789010123456789010123456789010123456789012345",
    )
    expect(playlist.videos[0]?.title).toBe("My first video")
  })

  it("should download the playlist preview", async () => {
    const playlist = new PlaylistManifest({ id: publicPlaylistId, owner }, { beeClient })
    await playlist.download({ mode: "preview" })
    expect(playlist.hasLoadedPreview).toBe(true)
    expect(playlist.hasLoadedDetails).toBe(false)
    expect(playlist.name).toBe("My Public Playlist")
    expect(playlist.owner).toBe(owner)
    expect(playlist.description).toBe(undefined)
    expect(playlist.videos).toHaveLength(0)
  })

  it("should download the playlist details", async () => {
    const playlist = new PlaylistManifest({ id: publicPlaylistId, owner }, { beeClient })
    await playlist.download({ mode: "details" })
    expect(playlist.hasLoadedPreview).toBe(false)
    expect(playlist.hasLoadedDetails).toBe(true)
    expect(playlist.name).toBe("")
    expect(playlist.owner).toBe(owner)
    expect(playlist.description).toBe("This is my public playlist")
    expect(playlist.videos).toHaveLength(1)
    expect(playlist.videos[0]?.reference).toBe(
      "0123456789010123456789010123456789010123456789010123456789012345",
    )
    expect(playlist.videos[0]?.title).toBe("My first video")
  })

  it("should decrypt a protected playlist", async () => {
    const playlist = new PlaylistManifest({ id: protectedPlaylistId, owner }, { beeClient })
    await playlist.download({ mode: "full" })
    expect(playlist.hasLoadedPreview).toBe(true)
    expect(playlist.hasLoadedDetails).toBe(true)
    expect(playlist.name).toBe("Hello World")
    expect(playlist.owner).toBe(owner)
    expect(playlist.description).toBe(undefined)
    expect(playlist.videos).toHaveLength(0)
    playlist.decrypt(protectedPassword)
    expect(playlist.name).toBe("My Protected Playlist")
    expect(playlist.description).toBe("This is my protected playlist")
    expect(playlist.videos).toHaveLength(1)
    expect(playlist.videos[0]?.reference).toBe(
      "0123456789010123456789010123456789010123456789010123456789012345",
    )
    expect(playlist.videos[0]?.title).toBe("My first video")
  })
})

describe("playlist manifest write", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  const playlistId = "cdabae65-f751-433a-9fe9-7388088c99c9"
  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
  })

  it("should set and get the playlist type", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.type = "protected"
    expect(playlist.type).toBe("protected")
  })

  it("should set and get the playlist name", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.name = "My Playlist"
    expect(playlist.name).toBe("My Playlist")
  })

  it("should set and get the playlist preview name", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.type = "protected"
    playlist.previewName = "My Playlist"
    expect(playlist.previewName).toBe("My Playlist")
  })

  it("should throw when setting preview name on a public playlist", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    expect(() => (playlist.previewName = "My Playlist")).toThrowError(
      "Only private and protected playlists can have a preview name",
    )
  })

  it("should set and get the playlist description", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.description = "This is my playlist"
    expect(playlist.description).toBe("This is my playlist")
  })

  it("should set and get the playlist password hint", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.passwordHint = "My password hint"
    expect(playlist.passwordHint).toBe("My password hint")
  })

  it("should add a video to the playlist", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.addVideo(mockVideo)

    const hasVideo = playlist.videos.some((video) => video.reference === mockVideo.reference)
    expect(hasVideo).toBe(true)
  })

  it("should replace a video in the playlist", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    const oldVideo = mockVideo
    const newVideo = { ...mockVideo, reference: mockVideo.reference.replace("0", "f") as Reference }
    playlist.addVideo(oldVideo)
    playlist.replaceVideo(oldVideo.reference, newVideo)

    const hasOldVideo = playlist.videos.some((video) => video.reference === oldVideo.reference)
    const hasNewVideo = playlist.videos.some((video) => video.reference === newVideo.reference)

    expect(hasOldVideo).toBe(false)
    expect(hasNewVideo).toBe(true)
  })

  it("should remove a video from the playlist", () => {
    const playlist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    playlist.addVideo(mockVideo)
    playlist.removeVideo(mockVideo.reference)

    const hasVideo = playlist.videos.some((video) => video.reference === mockVideo.reference)
    expect(hasVideo).toBe(false)
  })

  it("should upload the playlist", async () => {
    const playlistId = uuid()
    const uploadedPlaylist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    uploadedPlaylist.name = "My Playlist"
    uploadedPlaylist.description = "This is my playlist"
    uploadedPlaylist.addVideo(mockVideo)
    await uploadedPlaylist.upload({ batchId })

    const downloadedPlaylist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    await downloadedPlaylist.download({ mode: "full" })

    expect(downloadedPlaylist.serialized).toStrictEqual(uploadedPlaylist.serialized)
  })

  it("should edit a playlist", async () => {
    const playlistId = uuid()

    // creation
    const createdPlaylist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    createdPlaylist.name = "My Playlist"
    createdPlaylist.description = "This is my playlist"
    createdPlaylist.addVideo(mockVideo)
    await createdPlaylist.upload({ batchId })

    // edit
    const editedPlaylist = new PlaylistManifest(createdPlaylist.serialized, { beeClient })
    await editedPlaylist.loadNode()
    editedPlaylist.name = "My Edited Playlist"
    editedPlaylist.description = "This is my edited playlist"
    await editedPlaylist.upload({ batchId })

    // read
    const downloadedPlaylist = new PlaylistManifest({ id: playlistId, owner }, { beeClient })
    await downloadedPlaylist.download({ mode: "full" })

    expect(downloadedPlaylist.serialized).toStrictEqual(editedPlaylist.serialized)
  })
})
