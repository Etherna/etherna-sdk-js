# Manifests

## Overview

Import manifest classes from the package root:

```ts
import {
  PlaylistManifest,
  ProfileManifest,
  UserFollowingsManifest,
  UserPlaylistsManifest,
  VideoManifest,
} from "@etherna/sdk-js"
```

Manifest classes model Etherna content stored on Swarm. They sit on top of `BeeClient`, Mantaray classes, schema validation, and optional media processors.

## Foundation

### `BaseManifest`

#### Public exports

- `BaseManifestOptions`
- `BaseManifestDownloadOptions`
- `BaseManifestUploadOptions`
- `BaseManifest`

#### Role

`BaseManifest` is the shared base for manifest classes that need a `BeeClient`, optional `batchId`, dirty tracking, and stamp-bucket accounting through `StampCalculator`.

#### When to use

- Use it as the base mental model for upload/download flows.
- Most consumers do not instantiate it directly; concrete manifests build on top of it.

### `BaseMantarayManifest`

#### Public exports

- `BaseMantarayManifestDownloadOptions`
- `BaseMantarayManifest`

#### Role

`BaseMantarayManifest` adds a `MantarayNode`, JSON preview/details handling, file-path registration, chunk queue integration, and processor import helpers.

#### When to use

- Use it to understand how profile, playlist, and video manifests store preview and details inside a Mantaray tree.
- It is the right conceptual entry point for tasks involving `loadNode()`, `addFile()`, processor imports, or path-based manifest files.

#### Key behavior

- `download({ mode })` style flows can load `preview`, `details`, or both depending on the concrete manifest.
- `upload()` prepares queue entries, serializes the Mantaray node, and drains chunk uploads.
- `importImageProcessor()` and `importVideoProcessor()` connect processed media outputs to the manifest file graph.

## Playlist Manifest

### Public exports

- `PlaylistManifestUploadOptions`
- `PlaylistIdentification`
- `Playlist`
- `CHANNEL_PLAYLIST_ID`
- `SAVED_PLAYLIST_ID`
- `createPlaylistTopicName()`
- `PlaylistManifest`

### Role

`PlaylistManifest` is the playlist content model. It stores preview and details payloads, can resolve itself from either a direct manifest reference or a feed-based playlist identifier, and can optionally encrypt playlist details.

### Basic usage

```ts
import { PlaylistManifest } from "@etherna/sdk-js"

const playlist = await new PlaylistManifest(
  { id: "playlist-id", owner: "0x..." },
  { beeClient },
).download({ mode: "full" })
```

### When to use

- Use it for channel playlists, saved playlists, or user-defined playlists.
- Use `PlaylistIdentification` when the task starts from `{ id, owner }` instead of a direct manifest reference.
- Use `createPlaylistTopicName(id)` whenever the task needs the exact feed topic naming convention.

### Important behaviors

- `upload({ password })` supports protected playlists by encrypting details while leaving preview data readable.
- `addVideo()`, `replaceVideo()`, and `removeVideo()` update the playlist entry list.
- `CHANNEL_PLAYLIST_ID` and `SAVED_PLAYLIST_ID` are the canonical IDs used by product flows.

### Caveats

- Private playlist mode is not implemented; protected playlists are the supported encrypted path.
- `resume()` is not implemented for playlist manifests.

## Profile Manifest

### Public exports

- `Profile`
- `PROFILE_TOPIC`
- `ProfileManifest`

### Role

`ProfileManifest` is the user profile model. It stores preview and details data in a Mantaray tree and can be resolved from an ETH address or ENS name.

### Basic usage

```ts
import { ProfileManifest } from "@etherna/sdk-js"

const profile = await new ProfileManifest("0x...", { beeClient }).download({
  mode: "full",
})
```

### When to use

- Use it for reading or editing a user's public profile.
- Use it with `ImageProcessor` when the task adds or replaces avatars and covers.
- Use it with `PlaylistManifest` references when the task updates the playlist list inside profile details.

### Important behaviors

- `PROFILE_TOPIC` is the canonical epoch feed topic for user profiles.
- `addAvatar()` and `addCover()` import processed image derivatives into the manifest.
- `setPlaylists()`, `addPlaylist()`, `removePlaylist()`, and `movePlaylist()` maintain playlist references in the profile details payload.

### Caveats

- Editing requires a signer that matches the profile owner.
- `resume()` is not implemented for profile manifests.

## User Followings Manifest

### Public exports

- `USER_FOLLOWINGS_TOPIC`
- `UserFollowingsManifest`

### Role

`UserFollowingsManifest` stores the signer's followings as a plain JSON payload uploaded through `BeeClient.bzz`, with a feed entry pointing to the latest reference.

### When to use

- Use it when the task is about following or unfollowing users.
- Prefer it over profile details when the intent is specifically the followings list.

### Important behaviors

- `addFollowing()` and `removeFollowing()` mutate the in-memory list before upload.
- The owner is the active `beeClient.signer.address`.

### Caveats

- The underlying `UserFollowingsSchema` exists in `src/schemas/followings-schema.ts`, but that schema file is not re-exported from the public `schemas` barrel.

## User Playlists Manifest

### Public exports

- `USER_PLAYLISTS_TOPIC`
- `UserPlaylistsManifest`

### Role

`UserPlaylistsManifest` stores the ordered list of playlist root-manifest references for the current user.

### When to use

- Use it when the task is about a user's personal playlist list rather than one specific playlist body.

### Important behaviors

- `addPlaylist()` prepends the reference to the list.
- `removePlaylist()` removes a root-manifest reference from the list.
- Like followings, it stores a JSON payload and uses a feed topic for discovery.

## Video Manifest

### Public exports

- `Video`
- `ProfileManifestInit`
- `CURRENT_VIDEO_MANIFEST_VERSION`
- `VideoManifest`

### Role

`VideoManifest` is the video content model. It stores preview and details payloads, media file paths, captions, thumbnails, and HLS sources inside a Mantaray tree.

### Basic usage

```ts
import { VideoManifest } from "@etherna/sdk-js"

const video = await new VideoManifest("reference", { beeClient }).download({
  mode: "full",
})
```

### When to use

- Use it for reading, creating, updating, or migrating Etherna video manifests.
- Pair it with `VideoProcessor` and `ImageProcessor` when generating video sources and thumbnails.
- Pair it with `VideoPublisher` when synchronizing manifest data to playlists or the Index API.

### Important behaviors

- `CURRENT_VIDEO_MANIFEST_VERSION` is the version gate enforced on upload.
- `migrate()` upgrades older manifest layouts to the current path-based structure.
- `addThumbnail()` imports processed image outputs.
- `addVideo()` imports processed HLS outputs and copies duration, aspect ratio, and source metadata into the manifest details payload.
- `addCaption()` and `removeCaption()` manage caption files and manifest metadata.

### Caveats

- `details.batchId` is stripped during upload; the manifest itself should not persist upload-batch bookkeeping.
- Old manifests can fall back to a legacy layout during download, which is why `migrate()` matters.

## Related APIs

- `BeeClient`: all manifest classes rely on it for bytes, BZZ, feed, and stamps behavior.
- `ImageProcessor` and `VideoProcessor`: used by profile, playlist thumbnails, and video manifests to register generated files.
- `MantarayNode`, `ChunksUploader`, `StampCalculator`: internal orchestration classes that explain how manifest uploads work.
- Root `schemas` exports: use them when you need exact preview or details payload shapes.
