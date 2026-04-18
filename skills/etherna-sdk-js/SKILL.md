---
name: etherna-sdk-js
description:
  Use when the task mentions `@etherna/sdk-js`, bee-client, index-client,
  image/video/playlist/followings/user-playlists manifest, media processors, Mantaray, swarm, bee,
  signer helpers, postage batches, or video publishing in this package.
---

# Etherna SDK JS

## Overview

`@etherna/sdk-js` is a single-root ESM package. The intended stable surface is the root import from
`@etherna/sdk-js`, which re-exports `classes`, `clients`, `manifest`, `processors`, `types`,
`schemas`, `utils`, and `consts`.

## When to Use

- Working in this repository or consuming the published SDK.
- Figuring out which public symbol to import for Bee, Index, Credit, SSO, manifests, processors,
  Mantaray, references, signing, or postage batches.
- Checking whether a symbol is public API or just a source-level implementation detail.

## Load The Right Reference

- Bee, Index, Credit, SSO, gateway, auth, comments, search, videos, users, payments:
  [clients.md](clients.md)
- Profile, video, playlist, followings, user playlists, feed topics, manifest lifecycle:
  [manifests.md](manifests.md)
- Image and video preparation, thumbnails, HLS outputs, FFmpeg expectations:
  [processors.md](processors.md)
- Mantaray, epoch feeds, folder helpers, chunk uploads, queues, stamp calculation, video publishing,
  SDK errors: [classes.md](classes.md)
- References, signing, ENS, batches, bytes, hex, image/media helpers, time, URL, and string helpers:
  [utils.md](utils.md)

Load multiple references for cross-cutting tasks:

- Publish or edit a video: `processors` + `manifests` + `classes` + `clients`
- Edit profiles or playlists with media: `manifests` + `processors` + `clients` + `utils`
- Debug feeds or Mantaray paths: `classes` + `utils` + `manifests`

## Other Exported Surfaces

- `schemas`: Zod schemas for image, mantaray, playlist, playlists, profile, and video payloads.
- `types`: shared TypeScript types for clients, Ethereum, signer, swarm, and utility primitives.
- `consts`: chain timing, chunk layout, manifest paths, redundancy values, topics, and stamp limits.

Use those exports when the task is about DTO shapes, runtime validation, or constants rather than
client or manifest behavior.

## Starter Combinations

- Bee upload or download flow: `clients` + `utils`
- Profile, playlist, or video editing: `manifests` + `clients`
- Media preparation before upload: `processors` + `manifests`
- End-to-end video publishing: `processors` + `manifests` + `classes` + `clients`
- Feed, Mantaray, or path debugging: `classes` + `utils`

## Public API Rules

- Prefer root imports from `@etherna/sdk-js`.
- There is no separate public subpath export map; the root import is the intended stable package
  surface.
- Treat files that are not re-exported by `src/index.ts` as internal unless the task explicitly
  targets source internals.
- Client submodules such as `bzz`, `stamps`, `videos`, `users`, or `payments` are usually instance
  properties on the main client classes, not first-class root imports.

## Easy To Miss

- Helpful source files that are not public root exports include `src/clients/base-client.ts`,
  `src/clients/bee/utils.ts`, `src/utils/ffmpeg.ts`, `src/utils/axios.ts`, and
  `src/schemas/followings-schema.ts`.
- Reference helpers are split across `reference.ts` and `mantaray.ts`.
- Source code is more trustworthy than the README when examples drift from current implementation.

## Common Mistakes

- Importing `IndexVideos`, `Bzz`, `SSOAuth`, or other nested helpers from the package root instead
  of through their parent clients.
- Assuming every file under `src/utils` or `src/schemas` is public just because it exists on disk.
- Ignoring `schemas`, `types`, or `consts` when the real task is about payload shapes or constants.
