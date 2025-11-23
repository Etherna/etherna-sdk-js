import { anyReference } from "test/utils/test-consts"
import { beforeAll, describe, expect, it } from "vitest"

import { mockedThumbnailProcessor, mockedVideoProcessor } from "../utils/processor-mocks"
import { BeeClient } from "@/clients"
import { EmptyAddress } from "@/consts"
import { VideoManifest } from "@/manifest"
import { encodePath } from "@/utils"

import type { BatchId, EthAddress, Reference } from "@/types"

describe("video manifest read", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId
  let videoReference: Reference

  beforeAll(async () => {
    const video = new VideoManifest({ beeClient })
    video.title = "My Video"
    video.description = "This is my video"
    video.addVideo(mockedVideoProcessor)
    video.addThumbnail(mockedThumbnailProcessor)
    video.addCaption(anyReference, "en-US", "English")
    video.addCaption(anyReference, "it", "Italian")

    videoReference = (await video.upload({ batchId })).reference
  })

  it("should get the video address", () => {
    const video = new VideoManifest({ beeClient })
    expect(video.ownerAddress).toBe(owner)
  })

  it("should download the full video", async () => {
    const video = new VideoManifest(videoReference, { beeClient })
    await video.download({ mode: "full" })
    expect(video.hasLoadedPreview).toBe(true)
    expect(video.hasLoadedDetails).toBe(true)
    expect(video.title).toBe("My Video")
    expect(video.ownerAddress).toBe(owner)
    expect(video.description).toBe("This is my video")
    expect(video.aspectRatio).toBe(1.7)
    expect(video.duration).toBe(60)
    expect(video.thumbnail).toStrictEqual({
      aspectRatio: 16 / 9,
      blurhash: "UJHk%1kC9G%LxvRjxvRjxvRjxvRj",
      sources: [
        {
          type: "jpeg",
          width: 480,
          path: "thumb/480.jpeg",
        },
        {
          type: "jpeg",
          width: 960,
          path: "thumb/960.jpeg",
        },
      ],
    })
    expect(video.sources).toHaveLength(2)
    expect(video.sources[0]).toEqual({
      type: "hls",
      size: 0,
      path: "sources/hls/master.m3u8",
    })
    expect(video.sources[1]).toEqual({
      type: "hls",
      size: 100_000,
      path: "sources/hls/480p/playlist.m3u8",
    })
  })

  it("should load the mantary node", async () => {
    const video = new VideoManifest(videoReference, { beeClient })

    await video.loadNode()

    expect(video.node.hasForkAtPath(encodePath("sources/hls/master.m3u8"))).toBe(true)
    expect(video.node.hasForkAtPath(encodePath("sources/hls/480p/playlist.m3u8"))).toBe(true)
    expect(video.node.hasForkAtPath(encodePath("sources/hls/480p/1.ts"))).toBe(true)
    expect(video.node.hasForkAtPath(encodePath("thumb/480.jpeg"))).toBe(true)
    expect(video.node.hasForkAtPath(encodePath("thumb/960.jpeg"))).toBe(true)
  })

  it("should download the video preview", async () => {
    const video = new VideoManifest(videoReference, { beeClient })
    await video.download({ mode: "preview" })
    expect(video.hasLoadedPreview).toBe(true)
    expect(video.hasLoadedDetails).toBe(false)
    expect(video.title).toBe("My Video")
    expect(video.ownerAddress).toBe(owner)
    expect(video.description).toBe("")
    expect(video.aspectRatio).toBe(0)
    expect(video.duration).toBe(60)
    expect(video.thumbnail).toStrictEqual({
      aspectRatio: 16 / 9,
      blurhash: "UJHk%1kC9G%LxvRjxvRjxvRjxvRj",
      sources: [
        {
          type: "jpeg",
          width: 480,
          path: "thumb/480.jpeg",
        },
        {
          type: "jpeg",
          width: 960,
          path: "thumb/960.jpeg",
        },
      ],
    })
    expect(video.sources).toHaveLength(0)
    expect(video.captions).toHaveLength(0)
  })

  it("should download the video details", async () => {
    const video = new VideoManifest(videoReference, { beeClient })
    await video.download({ mode: "details" })
    expect(video.hasLoadedPreview).toBe(false)
    expect(video.hasLoadedDetails).toBe(true)
    expect(video.title).toBe("")
    expect(video.ownerAddress).toBe(EmptyAddress)
    expect(video.description).toBe("This is my video")
    expect(video.aspectRatio).toBe(1.7)
    expect(video.duration).toBe(0)
    expect(video.thumbnail).toStrictEqual(null)
    expect(video.sources).toHaveLength(2)
    expect(video.sources[0]).toEqual({
      type: "hls",
      size: 0,
      path: "sources/hls/master.m3u8",
    })
    expect(video.sources[1]).toEqual({
      type: "hls",
      size: 100_000,
      path: "sources/hls/480p/playlist.m3u8",
    })
    expect(video.captions).toHaveLength(2)
    expect(video.captions[0]).toEqual({
      label: "English",
      lang: "en-US",
      path: "captions/en-US.vtt",
    })
    expect(video.captions[1]).toEqual({
      label: "Italian",
      lang: "it",
      path: "captions/it.vtt",
    })
  })
})

describe("video manifest write", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
  })

  it("should set the video title", async () => {
    const video = new VideoManifest({ beeClient })
    video.title = "My New Video"
    expect(video.title).toBe("My New Video")
  })

  it("should set the video description", async () => {
    const video = new VideoManifest({ beeClient })
    video.description = "This is my new video"
    expect(video.description).toBe("This is my new video")
  })

  it("should add a caption", async () => {
    const video = new VideoManifest({ beeClient })
    video.addCaption(anyReference, "en-US", "English")
    video.addCaption(anyReference, "it", "Italian")

    expect(video.captions).toHaveLength(2)
    expect(video.captions[0]).toEqual({
      label: "English",
      lang: "en-US",
      path: "captions/en-US.vtt",
    })
  })

  it("should remove a caption", async () => {
    const video = new VideoManifest({ beeClient })
    video.addCaption(anyReference, "en-US", "English")
    video.addCaption(anyReference, "it", "Italian")
    video.removeCaption("it")

    expect(video.captions).toHaveLength(1)
    expect(video.captions[0]).toEqual({
      label: "English",
      lang: "en-US",
      path: "captions/en-US.vtt",
    })

    const nodeHasPath = video.node.hasForkAtPath(encodePath("captions/it.vtt"))

    expect(nodeHasPath).toBe(false)
  })

  it("should set the thumbnail", async () => {
    const video = new VideoManifest({ beeClient })
    video.addThumbnail(mockedThumbnailProcessor)

    expect(video.thumbnail).toStrictEqual({
      aspectRatio: 16 / 9,
      blurhash: "UJHk%1kC9G%LxvRjxvRjxvRjxvRj",
      sources: [
        {
          type: "jpeg",
          width: 480,
          path: "thumb/480.jpeg",
        },
        {
          type: "jpeg",
          width: 960,
          path: "thumb/960.jpeg",
        },
      ],
    })
  })

  it("should set the video", async () => {
    const video = new VideoManifest({ beeClient })
    video.addVideo(mockedVideoProcessor)

    expect(video.aspectRatio).toBe(1.7)
    expect(video.duration).toBe(60)
    expect(video.sources).toHaveLength(2)
    expect(video.sources[0]).toEqual({
      type: "hls",
      size: 0,
      path: "sources/hls/master.m3u8",
    })
    expect(video.sources[1]).toEqual({
      type: "hls",
      size: 100_000,
      path: "sources/hls/480p/playlist.m3u8",
    })
  })

  it("should create and edit a video", async () => {
    const videoCreation = new VideoManifest({ beeClient })
    videoCreation.title = "My Video"
    videoCreation.description = "This is my video"
    videoCreation.addVideo(mockedVideoProcessor)
    await videoCreation.upload({ batchId })

    // edit
    const videoEdit = new VideoManifest(videoCreation.serialized, { beeClient })
    await videoEdit.loadNode()
    videoEdit.title = "My Edited Video"
    videoEdit.description = "This is my edited video"
    const { reference } = await videoEdit.upload({ batchId })

    // read
    const videoRead = new VideoManifest(reference, { beeClient })
    await videoRead.download({ mode: "full" })

    expect(videoRead.serialized).toStrictEqual(videoEdit.serialized)
  })
})
