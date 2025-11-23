# Etherna SDK JS

Use this SDK to interact with the Etherna network.

## Installation

```bash
npm install @etherna/sdk-js
// or
yarn add @etherna/sdk-js
// or
pnpm add @etherna/sdk-js
```

## Usage

### Bee client instance

```ts
import { BeeClient } from "@etherna/sdk-js"

const beeClient = new BeeClient("https://gateway.etherna.io", {
  type: "etherna", // or "bee" for native instances
  signer: "<64-length-private-key>",
  chain: { name: "custom", blockTime: 5 }, // defaults to "gnosis",
  accessToken: "<access-token>", // required for the 'etherna' type. Check out [oidc-client-ts](https://github.com/authts/oidc-client-ts) to get one.
  apiPath: "/api/v0.3", // required for the 'etherna' type
})
```

### Fetch a user's profile

```ts
import { ProfileManifest } from "@etherna/sdk-js"

const profile = await new ProfileManifest("0x4E8BeF8fEBbA90636a3b3B8A3622a8c479444C05", {
  beeClient,
}).download({ mode: "full" }) // you can download only preview or details too.

const {
  reference, // bee reference of the manifest
  address, // user's eth address
  ensName, // user's ens name if available
  preview, // profile preview information
  details, // profile details information
} = profile
```

### Update your profile

```ts
import { ProfileManifest, ImageProcessor } from "@etherna/sdk-js"

// make sure beeClient has a valid signer
const profileManifest = new ProfileManifest({ beeClient })

// load bee mantaray node
await profileManifest.loadNode()

// get or create a new batchId
const batchId = await beeClient.stamps.fetchBestBatchId({ labelQuery: "default" })
const batchId = await beeClient.stamps.create(17, 60 * 60 * 24 * 365) // use string or bigint to specify a custom amount

// create an avatar
const avatarImageProcessor = new ImageProcessor(imageFileOrBytes)
await avatarImageProcessor.process({ sizes: "avatar" })
// optional: upload and wait to finish
await avatarImageProcessor.upload({ beeClient, batchId })

// add avatar
profileManifest.addAvatar(avatarImageProcessor)

// add profile details
profileManifest.name = "John Doe"
profileManifest.description = "This is a **markdown** bio of John Doe"
profileManifest.website = "https://johndoe.com"
profileManifest.birthday = "1990-01-01"

// save the profile
await profileManifest.upload({ batchId })
```

### Fetch a video

```ts
import { VideoManifest } from "@etherna/sdk-js"

const video = await new VideoManifest("<bee-reference-of-manifest>", {
  beeClient,
}).download({ mode: "full" }) // you can download only preview or details too.

const {
  reference, // bee reference of the manifest
  preview, // video preview information
  details, // video details information
} = video
```

### Create a new video

Checkout the [encoding requirements](#encoding-requirements) first.

```ts
import { VideoManifest, ImageProcessor, VideoProcessor } from "@etherna/sdk-js"

// make sure beeClient has a valid signer
const videoManifest = new VideoManifest({ beeClient })

// load bee mantaray node (only if you want to update an existing video)
await videoManifest.loadNode()

// get or create a new batchId
const batchId = await beeClient.stamps.fetchBestBatchId({ labelQuery: "default" })
const batchId = await beeClient.stamps.create(17, 60 * 60 * 24 * 365) // use string or bigint to specify a custom amount

// create a thumbnail
const thumbnailImageProcessor = new ImageProcessor(imageFileOrBytes)
await thumbnailImageProcessor.process({ sizes: "thumbnail" })

// encode a video
const videoProcessor = new VideoProcessor(videoFileOrBytes)
await videoProcessor.process({ ffmpegBaseUrl: "https://yourserver.com/ffmpeg.js" }) // default is: "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm"

// add thumbnail and video
videoManifest.addThumbnail(thumbnailImageProcessor)
videoManifest.addVideo(videoProcessor)

// add video details
videoManifest.title = "My first video"
videoManifest.description = "This is a **markdown** description of my first video"

// save the video
await videoManifest.upload({ batchId })
```

### Fetch a playlist

```ts
import { PlaylistManifest } from "@etherna/sdk-js"

const playlistIdentification = playlistFeedRootManifest ?? {
  owner: "0x4E8BeF8fEBbA90636a3b3B8A3622a8c479444C05",
  id: "441f1e8a-390e-4964-8bfc-478e38e08092",
}
const playlist = await new PlaylistManifest(playlistIdentification, {
  beeClient,
}).download({ mode: "full" }) // you can download only preview or details too.

const {
  reference, // bee reference of the manifest
  rootManifest, // bee rootManifest of the feed
  preview, // playlist preview information
  details, // playlist details information
} = playlist
```

### Create a new playlist

```ts
import { PlaylistManifest } from "@etherna/sdk-js"

// make sure beeClient has a valid signer
const playlistManifest = new PlaylistManifest({ beeClient })

// load bee mantaray node (only if you want to update an existing playlist)
await playlistManifest.loadNode()

// get or create a new batchId
const batchId = await beeClient.stamps.fetchBestBatchId({ labelQuery: "default" })
const batchId = await beeClient.stamps.create(17, 60 * 60 * 24 * 365) // use string or bigint to specify a custom amount

// add playlist details
playlistManifest.name = "My first playlist"
playlistManifest.description = "This is a **markdown** description of my first playlist"

// add a video
playlistManifest.addVideo(videoWithPreviewInfos)

// save the playlist
await playlistManifest.upload({ batchId })
```

### Create a password protected playlist

_Password protected playlists encrypt playlists details but not the preview._
_To hide the playlist name you can set `previewName` as un-encrypted name and `name` as encrypted name._

```ts
// ...

playlistManifest.type = "protected"
playlistManifest.previewName = "Visible playlist name"
playlistManifest.name = "Encrypted playlist name"

// save the playlist
await playlistManifest.upload({ batchId, password: "my-secret })

// ...
```

### Fetch your personal playlists

```ts
import { UserPlaylistsManifest } from "@etherna/sdk-js"

const userPlaylists = await new UserPlaylistsManifest({
  beeClient,
}).download()
```

### Update your personal playlists

```ts
import { UserPlaylistsManifest } from "@etherna/sdk-js"

const userPlaylistsManifest = new UserPlaylistsManifest(currentPlaylists, {
  beeClient,
})

// add a playlist
userPlaylistsManifest.addPlaylist(playlistRootManifest)

// remove a playlist
userPlaylistsManifest.removePlaylist(playlistRootManifest)

// save the playlists
await userPlaylistsManifest.upload({ batchId })
```

### Publish a video

```ts
import {
  CHANNEL_PLAYLIST_ID,
  EthernaIndexClient,
  PlaylistManifest,
  ProfileManifest,
  VideoPublisher,
} from "@etherna/sdk-js"

// load channel playlists
const profile = await new ProfileManifest({ beeClient }).download({ mode: "details" })
const playlists = await Promise.all([
  PlaylistManifest.channelPlaylist(
    { id: CHANNEL_PLAYLIST_ID, owner: beeClient.signer!.address },
    {
      beeClient,
    },
  ).download({ mode: "full" }),
  ...profile.playlists.map((playlistRootManifest) =>
    new PlaylistManifest(playlistRootManifest, {
      beeClient,
    }).download({ mode: "full" }),
  ),
])

// init all index clients you need
const ethernaIndexClient = new EthernaIndexClient("https://index.etherna.io", {
  apiPath: "/api/v0.3",
  accessToken: "<access-token>",
})

// create a video publisher
const videoPublisher = new VideoPublisher({
  video, // new video serialized information (`videoManifest.serialized`)
  videoInitialReference, // required when editing a video
  beeClient,
  batchId,
  sources: [
    {
      type: "index",
      indexClient: ethernaIndexClient,
      indexVideoId: "<index-video-id>", // required when editing a video
    },
    ...playlists.map((playlist) => ({
      type: "playlist",
      playlist,
    })),
  ],
})

// sync video publishing (publish/unpublish)
const { publishResult, unpublishResult } = await videoPublisher.sync([
  // select only the sources you want to publish to
  videoPublisher.sources[0],
  videoPublisher.sources[2],
])

const { error, success } = publishResult[0]
// ...
```

## Encoding requirements

1. Make sure ffmpeg is installed on your machine: https://www.ffmpeg.org/download.html
2. Install the ffmpeg.wasm peer dependecies: `npm install @ffmpeg/ffmpeg @ffmpeg/util`
3. Make sure your server enables `SharedArrayBuffer` by setting the proper headers:

- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Embedder-Policy: require-corp

## Issue reports

If you've discovered a bug, or have an idea for a new feature, please report it to our issue manager based on Jira https://etherna.atlassian.net/projects/ESJ.

## License

![LGPL Logo](https://www.gnu.org/graphics/lgplv3-with-text-154x68.png)

We use the GNU Lesser General Public License v3 (LGPL-3.0) for this project.
If you require a custom license, you can contact us at [license@etherna.io](mailto:license@etherna.io).
