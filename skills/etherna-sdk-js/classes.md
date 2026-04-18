# Classes

## Overview

The `classes` barrel holds the SDK's stateful building blocks and orchestration helpers. Import them from the package root:

```ts
import {
  ChunksUploader,
  EpochFeed,
  EpochFeedChunk,
  EpochIndex,
  EthernaSdkError,
  FolderBuilder,
  FolderExplorer,
  MantarayNode,
  Queue,
  StampCalculator,
  VideoPublisher,
} from "@etherna/sdk-js"
```

## Errors

### Public exports

- `ErrorCodes`
- `ErrorCode`
- `EthernaSdkError`
- `getSdkError()`
- `throwSdkError()`

### Role

This is the SDK-wide error model. Use it when normalizing unknown failures, checking error codes, or propagating consistent domain-specific failures from network, validation, or media flows.

### Basic usage

```ts
import { getSdkError } from "@etherna/sdk-js"

try {
  // sdk work
} catch (err) {
  const sdkError = getSdkError(err)
  console.error(sdkError.code, sdkError.message)
}
```

## Stamp Calculation

### Public exports

- `BucketCollisions`
- `StampCalculator`

### Role

`StampCalculator` tracks postage-bucket collisions for content references. Use it when a task needs to estimate or reason about batch depth requirements and bucket utilization.

### When to use

- Manifest upload planning.
- Chunked media processing.
- Any task that needs to merge bucket usage from several upload sources.

## Chunk Uploads

### Public exports

- `ChunksUploaderOptions`
- `ChunksUploader`

### Role

`ChunksUploader` is the chunk-upload orchestrator. It queues chunked files, uploads them through `BeeClient.chunk`, and emits progress, error, and completion events.

### Basic usage

```ts
import { ChunksUploader } from "@etherna/sdk-js"

const uploader = new ChunksUploader({ beeClient, concurrentChunks: 10 })
await uploader.drain({ batchId })
```

### When to use

- High-volume manifest or processor uploads.
- Any task that already has BMT chunked files and needs a coordinated Bee upload flow.

## Epoch Feed Helpers

### Public exports

- `EpochIndex`
- `EpochFeed`
- `EpochFeedChunk`

### Role

These classes model Swarm epoch feeds.

### `EpochIndex`

- Pure time/index math.
- Use it to navigate epoch windows, compute parents and children, or compare feed positions.

### `EpochFeed`

- High-level Bee-backed epoch-feed reader and writer helper.
- Use it when the task is about discovering the latest feed chunk, resolving chunks near a point in time, or building the next epoch entry.

### `EpochFeedChunk`

- Low-level representation of one epoch feed chunk.
- Use it for payload, reference, identifier, and timestamp handling.

### Caveat

- Importing `EpochFeedChunk` augments global prototypes for `Uint8Array`, `Date`, and `BigInt`. That side effect matters in low-level debugging.

## Mantaray Primitives

### Public exports

- `MantarayIndexBytes`
- `MantarayFork`
- `MetadataMapping`
- `ForkMapping`
- `MarshalVersion`
- `StorageLoader`
- `StorageSaver`
- `StorageHandler`
- `RecursiveSaveReturnType`
- `MantarayNode`

### Role

These classes implement the Mantaray trie and its serialization model.

### `MantarayNode`

- Main tree structure for manifest and folder content.
- Use it to add or remove paths, save a node, load a node from bytes, or inspect a manifest tree.

### `MantarayFork`

- One branch inside the trie.
- Mostly useful when debugging serialized structure or custom traversal logic.

### `MantarayIndexBytes`

- Low-level fork bitmap helper used by the serializer.
- Usually only needed when debugging the wire format.

## Folder Helpers

### Public exports

- `FolderBuilderConfig`
- `FolderBuilder`
- `FolderExplorerOptions`
- `FolderEntryFile`
- `FolderEntryDirectory`
- `FolderExplorerEntry`
- `FolderExplorer`

### Role

These helpers build or inspect directory-like Mantaray trees.

### `FolderBuilder`

- Use it to upload many files as a Mantaray-backed folder or website manifest.
- Supports custom concurrency, upload hooks, and optional index/error document metadata.

### `FolderExplorer`

- Use it to load a folder manifest and inspect entries by path.
- Good for read-only exploration of an existing uploaded tree.

## Queue

### Public exports

- `QueueOptions`
- `Queue`

### Role

`Queue` is a small async concurrency primitive used by higher-level upload helpers such as `FolderBuilder`.

### When to use

- Background or manual draining of async jobs.
- Throttling work without pulling in a heavier external queue.

## Video Publishing

### Public exports

- `VideoPublisherOptions`
- `PublishSourcePlaylist`
- `PublishSourceIndex`
- `PublishResultStatus`
- `VideoPublisherSyncResult`
- `PublishSource`
- `VideoPublisherUploadOptions`
- `VideoPublisher`

### Role

`VideoPublisher` is the highest-level orchestration class in the SDK. It syncs one video manifest to playlist sources and Index sources.

### Basic usage

```ts
import { VideoPublisher } from "@etherna/sdk-js"

const publisher = new VideoPublisher({
  beeClient,
  batchId,
  video,
  sources: [],
})
```

### When to use

- Publish or unpublish a video across playlists and the Index API.
- Retry failed publication actions after partial success.
- Keep playlist publication and index publication in sync from one orchestration layer.

### Related APIs

- `VideoManifest` and `PlaylistManifest`
- `EthernaIndexClient`
- `BeeClient`

## Common Mistakes

- Treating Mantaray primitives as everyday consumer APIs when a manifest class already solves the task.
- Re-implementing chunk upload or bucket logic instead of using `ChunksUploader` and `StampCalculator`.
- Forgetting that `VideoPublisher` is the bridge between manifest storage and Index publication.
