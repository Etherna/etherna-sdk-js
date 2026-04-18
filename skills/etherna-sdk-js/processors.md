# Processors

## Overview

Import processors from the package root:

```ts
import { ImageProcessor, VideoProcessor } from "@etherna/sdk-js"
```

Processors do not own the final upload. They transform source media into chunked outputs plus metadata, and manifest classes import those outputs into the Swarm file graph.

## Base Processor

### Public exports

- `BaseProcessorUploadOptions`
- `ProcessorOutput`
- `BaseProcessor`

### Role

`BaseProcessor` is the shared abstraction for media processors. It tracks input bytes, produced chunked files, output metadata, and postage-bucket accounting.

### When to use

- Use it to understand the common contract shared by `ImageProcessor` and `VideoProcessor`.
- Most consumers do not instantiate it directly.

### Important API

- `process()`: default no-op that subclasses override.
- `processorOutputs`: generated file descriptors with `path`, `entryAddress`, and file metadata.
- `stampCalculator`: used later by manifests to merge processed chunk bucket data.
- `chunkedFiles`: low-level chunked files that `ChunksUploader` will eventually upload.

### Key types

- `BaseProcessorUploadOptions`: Bee-oriented upload options shape aligned with manifest uploads.
- `ProcessorOutput`: one file-path mapping ready to be added to a manifest.

## Image Processor

### Public exports

- `ImageProcessorOptions`
- `AVATAR_SIZES`
- `COVER_SIZES`
- `THUMBNAIL_SIZES`
- `AVATAR_PATH_FORMAT`
- `COVER_PATH_FORMAT`
- `THUMBNAIL_PATH_FORMAT`
- `ImageProcessor`

### Role

`ImageProcessor` resizes one source image into multiple derivatives, computes image metadata such as aspect ratio and blurhash, and produces manifest-ready outputs.

### Basic usage

```ts
import { ImageProcessor } from "@etherna/sdk-js"

const imageProcessor = new ImageProcessor(file)
await imageProcessor.process({ sizes: "avatar" })
```

### When to use

- Profile avatars and covers.
- Video thumbnails.
- Any task that needs multiple image sizes plus manifest metadata.

### Important API

- `process({ sizes, pathFormat })`: generate derivatives and metadata.
- `image`: the processed manifest-ready image payload after `process()`.
- `previewDataURL`: optional UI-friendly data URL built from the source image.

### Options

- `sizes`: either a custom list of pixel sizes or one of `"avatar"`, `"cover"`, or `"thumbnail"`.
- `pathFormat`: optional path template using `$size` and `$type`.

### Presets

- `AVATAR_SIZES`: `[128, 256, 512]`
- `COVER_SIZES`: `[480, 768, 1024, 1280, 1800]`
- `THUMBNAIL_SIZES`: `[480, 960, 1280]`

### Path constants

- `AVATAR_PATH_FORMAT`
- `COVER_PATH_FORMAT`
- `THUMBNAIL_PATH_FORMAT`

### Caveats

- `ImageProcessor` prepares files and metadata; manifests still own the actual upload lifecycle.
- Image type support depends on the image utilities and environment capabilities exposed through root `utils`.

## Video Processor

### Public exports

- `VideoProcessorOutputOptions`
- `VideoProcessorOptions`
- `VideoProcessedOutput`
- `VideoProcessor`

### Role

`VideoProcessor` turns a source video into HLS-oriented outputs plus metadata such as duration, aspect ratio, and encoded sources.

### Basic usage

```ts
import { VideoProcessor } from "@etherna/sdk-js"

const videoProcessor = new VideoProcessor(file)
await videoProcessor.process({ ffmpeg })
```

### When to use

- Creating or updating `VideoManifest` content.
- Importing an already-encoded HLS directory into a manifest.
- Generating a thumbnail frame for a video workflow.

### Important API

- `process({ ffmpeg, resolutions, signal, progressCallback, basePath })`: encode a source file into HLS outputs.
- `loadFromDirectory(directory, opts?)`: import a prebuilt HLS directory from a browser directory handle or a Node path.
- `createThumbnailProcessor(frameTimestamp, opts?)`: extract one frame and return a new `ImageProcessor`.
- `video`: processed manifest-ready video payload after `process()`.

### Options

- `ffmpeg`: required encoder instance from `@ffmpeg/ffmpeg`.
- `basePath`: output base path, defaulting to `sources/hls`.
- `resolutions`: optional target ladder, filtered by source dimensions.
- `signal`: abort support for long-running encodes.
- `progressCallback`: progress hook for UI or logs.

### Caveats

- Current source expects an `ffmpeg` instance, not the older README-style `ffmpegBaseUrl` option.
- The processor uses a module-level FFmpeg reference internally, so overlapping concurrent encode sessions are risky.
- Browser and Node flows differ: Node helpers rely on internal FFmpeg utilities, while browser flows expect an already-loaded `@ffmpeg/ffmpeg` instance.

## How Processors Plug Into Manifests

- `BaseMantarayManifest.importImageProcessor()` and `importVideoProcessor()` consume `processorOutputs`, `stampCalculator`, and `chunkedFiles`.
- `ProfileManifest` uses `ImageProcessor` for avatars and covers.
- `VideoManifest` uses `ImageProcessor` for thumbnails and `VideoProcessor` for sources, duration, and aspect ratio.
- Processors do not directly publish to Index or playlists; that comes later through manifests and `VideoPublisher`.

## Common Mistakes

- Treating processors as upload clients. They only prepare outputs.
- Using README examples that pass `ffmpegBaseUrl` instead of a real `ffmpeg` instance.
- Forgetting to check `image` or `video` only after `process()` has completed successfully.
