import { anyReference } from "./test-consts"
import { ImageProcessor, VideoProcessor } from "@/processors"

// VideoProcessor
const mockedVideoProcessor = new VideoProcessor(new Uint8Array(0))
Object.defineProperty(mockedVideoProcessor, "video", {
  value: {
    aspectRatio: 1.7,
    duration: 60,
    sources: [
      {
        type: "hls",
        size: 0,
        path: "sources/hls/master.m3u8",
      },
      {
        type: "hls",
        size: 100_000,
        path: "sources/hls/480p/playlist.m3u8",
      },
    ],
  } satisfies typeof mockedVideoProcessor.video,
})
Object.defineProperty(mockedVideoProcessor, "processorOutputs", {
  value: [
    {
      path: "sources/hls/master.m3u8",
      entryAddress: anyReference,
      metadata: {
        filename: "master.m3u8",
        contentType: "application/x-mpegURL",
      },
    },
    {
      path: "sources/hls/480p/playlist.m3u8",
      entryAddress: anyReference,
      metadata: {
        filename: "480p.m3u8",
        contentType: "application/x-mpegURL",
      },
    },
    {
      path: "sources/hls/480p/1.ts",
      entryAddress: anyReference,
      metadata: {
        filename: "1.ts",
        contentType: "video/mp2t",
      },
    },
  ] satisfies typeof mockedVideoProcessor.processorOutputs,
})

// ImageProcessor
const mockedAvatarProcessor = new ImageProcessor(new Uint8Array(0))
Object.defineProperty(mockedAvatarProcessor, "image", {
  value: {
    aspectRatio: 1,
    blurhash: "UJHk%1kC9G%LxvRjxvRjxvRjxvRj",
    sources: [
      {
        type: "jpeg",
        width: 128,
        path: "avatar/128.jpeg",
      },
      {
        type: "jpeg",
        width: 256,
        path: "avatar/256.jpeg",
      },
    ],
  } satisfies typeof mockedAvatarProcessor.image,
})
Object.defineProperty(mockedAvatarProcessor, "processorOutputs", {
  value: [
    {
      path: "avatar/128.jpeg",
      entryAddress: anyReference,
      metadata: {
        filename: "128.jpeg",
        contentType: "image/jpeg",
      },
    },
    {
      path: "avatar/256.jpeg",
      entryAddress: anyReference,
      metadata: {
        filename: "256.jpeg",
        contentType: "image/jpeg",
      },
    },
  ] satisfies typeof mockedAvatarProcessor.processorOutputs,
})

const mockedCoverProcessor = new ImageProcessor(new Uint8Array(0))
Object.defineProperty(mockedCoverProcessor, "image", {
  value: {
    aspectRatio: 2,
    blurhash: "UJHk%1kC9G%LxvRjxvRjxvRjxvRj",
    sources: [
      {
        type: "jpeg",
        width: 480,
        path: "cover/480.jpeg",
      },
      {
        type: "jpeg",
        width: 768,
        path: "cover/768.jpeg",
      },
    ],
  } satisfies typeof mockedCoverProcessor.image,
})
Object.defineProperty(mockedCoverProcessor, "processorOutputs", {
  value: [
    {
      path: "cover/480.jpeg",
      entryAddress: anyReference,
      metadata: {
        filename: "480.jpeg",
        contentType: "image/jpeg",
      },
    },
    {
      path: "cover/768.jpeg",
      entryAddress: anyReference,
      metadata: {
        filename: "768.jpeg",
        contentType: "image/jpeg",
      },
    },
  ] satisfies typeof mockedCoverProcessor.processorOutputs,
})

const mockedThumbnailProcessor = new ImageProcessor(new Uint8Array(0))
Object.defineProperty(mockedThumbnailProcessor, "image", {
  value: {
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
  } satisfies typeof mockedThumbnailProcessor.image,
})
Object.defineProperty(mockedThumbnailProcessor, "processorOutputs", {
  value: [
    {
      path: "thumb/480.jpeg",
      entryAddress: anyReference,
      metadata: {
        filename: "480.jpeg",
        contentType: "image/jpeg",
      },
    },
    {
      path: "thumb/960.jpeg",
      entryAddress: anyReference,
      metadata: {
        filename: "960.jpeg",
        contentType: "image/jpeg",
      },
    },
  ] satisfies typeof mockedThumbnailProcessor.processorOutputs,
})

export {
  mockedVideoProcessor,
  mockedAvatarProcessor,
  mockedCoverProcessor,
  mockedThumbnailProcessor,
}
