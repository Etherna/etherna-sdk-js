import { anyReference } from "test/utils/test-consts"
import { beforeAll, describe, expect, it } from "vitest"

import { mockedAvatarProcessor, mockedCoverProcessor } from "../utils/processor-mocks"
import { BeeClient } from "@/clients"
import { ProfileManifest } from "@/manifest"

import type { BatchId, EthAddress, Reference } from "@/types"

describe("profile manifest read", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })

  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId

  beforeAll(async () => {
    const profile = new ProfileManifest({ beeClient })
    profile.name = "My Profile"
    profile.description = "This is my profile"
    profile.website = "https://example.com"
    profile.birthday = "01-01-1990"
    profile.location = "New York"
    profile.addPlaylist(anyReference)
    profile.addAvatar(mockedAvatarProcessor)
    profile.addCover(mockedCoverProcessor)

    await profile.upload({ batchId })
  })

  it("should get the profile address", () => {
    const profile = new ProfileManifest(owner, { beeClient })
    expect(profile.address).toBe(owner)

    const profile2 = new ProfileManifest({ beeClient })
    expect(profile2.address).toBe(owner)
  })

  it("should download the full profile", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    await profile.download({ mode: "full" })
    expect(profile.hasLoadedPreview).toBe(true)
    expect(profile.hasLoadedDetails).toBe(true)
    expect(profile.name).toBe("My Profile")
    expect(profile.address).toBe(owner)
    expect(profile.description).toBe("This is my profile")
    expect(profile.website).toBe("https://example.com")
    expect(profile.birthday).toBe("01-01-1990")
    expect(profile.location).toBe("New York")
    expect(profile.playlists).toHaveLength(1)
    expect(profile.playlists[0]).toBe(
      "0123456789010123456789010123456789010123456789010123456789012345",
    )
  })

  it("should download the profile preview", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    await profile.download({ mode: "preview" })
    expect(profile.hasLoadedPreview).toBe(true)
    expect(profile.hasLoadedDetails).toBe(false)
    expect(profile.name).toBe("My Profile")
    expect(profile.address).toBe(owner)
    expect(profile.description).toBe(undefined)
    expect(profile.website).toBe(undefined)
    expect(profile.birthday).toBe(undefined)
    expect(profile.location).toBe(undefined)
    expect(profile.playlists).toHaveLength(0)
  })

  it("should download the profile details", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    await profile.download({ mode: "details" })
    expect(profile.hasLoadedPreview).toBe(false)
    expect(profile.hasLoadedDetails).toBe(true)
    expect(profile.name).toBe("")
    expect(profile.address).toBe(owner)
    expect(profile.description).toBe("This is my profile")
    expect(profile.website).toBe("https://example.com")
    expect(profile.birthday).toBe("01-01-1990")
    expect(profile.location).toBe("New York")
    expect(profile.playlists).toHaveLength(1)
    expect(profile.playlists[0]).toBe(
      "0123456789010123456789010123456789010123456789010123456789012345",
    )
  })
})

describe("profile manifest write", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
  })

  it("should set the profile name", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    profile.name = "My New Profile"
    expect(profile.name).toBe("My New Profile")
  })

  it("should set the profile description", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    profile.description = "This is my new profile"
    expect(profile.description).toBe("This is my new profile")
  })

  it("should set the profile website", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    profile.website = "https://new.example.com"
    expect(profile.website).toBe("https://new.example.com")
  })

  it("should set the profile birthday", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    profile.birthday = "1990-01-02"
    expect(profile.birthday).toBe("1990-01-02")
  })

  it("should set the profile location", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    profile.location = "Los Angeles"
    expect(profile.location).toBe("Los Angeles")
  })

  it("should set the profile playlists", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    profile.addPlaylist(anyReference)
    expect(profile.playlists).toHaveLength(1)
    expect(profile.playlists[0]).toBe(
      "0123456789010123456789010123456789010123456789010123456789012345",
    )

    profile.removePlaylist(anyReference)
    expect(profile.playlists).toHaveLength(0)
  })

  it("should edit the profile", async () => {
    const profile = await new ProfileManifest({ beeClient }).download({ mode: "full" })

    // edit
    const profileEdit = new ProfileManifest(profile, { beeClient })
    await profileEdit.loadNode()
    profileEdit.name = "My Edited Profile"
    profileEdit.description = "This is my edited profile"
    await profileEdit.upload({ batchId })

    // read
    const profileRead = new ProfileManifest(owner, { beeClient })
    await profileRead.download({ mode: "full" })

    expect(profileRead.serialized).toStrictEqual(profileEdit.serialized)
  })

  it("should move a playlist", async () => {
    const profile = new ProfileManifest(owner, { beeClient })
    const playlistA = anyReference as Reference
    const playlistB = "b".repeat(64) as Reference
    const playlistC = "c".repeat(64) as Reference
    profile.addPlaylist(playlistA)
    profile.addPlaylist(playlistB)
    profile.addPlaylist(playlistC)
    // Initial order: [playlistA, playlistB, playlistC]
    expect(profile.playlists).toStrictEqual([playlistA, playlistB, playlistC])
    // Move playlistB to the end
    profile.movePlaylist(playlistB, 2)
    expect(profile.playlists).toStrictEqual([playlistA, playlistC, playlistB])
    // Move playlistB to the start
    profile.movePlaylist(playlistB, 0)
    expect(profile.playlists).toStrictEqual([playlistB, playlistA, playlistC])
  })
})
