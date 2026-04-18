# Utils

## Overview

The `utils` barrel exports pure helpers and thin environment-aware wrappers. Import them from the package root:

```ts
import {
  isValidReference,
  makePrivateKeySigner,
  getBatchCapacity,
  encodePath,
} from "@etherna/sdk-js"
```

Only files re-exported by `src/utils/index.ts` are part of the public root utility surface.

## Address And ENS

### Exports

- `isEthAddress()`: validate an ETH address string.
- `isEnsAddress()`: validate an ENS-style address.
- `toEthAccount()`: normalize bytes or a string into an ETH address.
- `fetchAddressFromEns()`: resolve ENS to address.
- `fetchEnsFromAddress()`: reverse-resolve an address to ENS.

### When to use

- User input normalization.
- ENS-based manifest lookup or display.

### Caveat

- ENS resolution depends on `viem` mainnet RPC access.

## Arrays

### Exports

- `splitArrayInChunks()`: chunk an array for batching.

## Batches And Postage

### Exports

- `getBatchSpace()`
- `calcBatchMinDepth()`
- `getBatchCapacity()`
- `getBatchPercentUtilization()`
- `getBatchUtilizationRate()`
- `getBatchExpiration()`
- `ttlToAmount()`
- `calcAmountPrice()`
- `calcDilutedTTL()`
- `calcExpandAmount()`

### When to use

- Postage-batch selection UIs.
- Capacity and TTL estimation.
- Predicting batch expansion or dilution cost.

## Blurhash

### Exports

- `blurHashToDataURL()`: preview data URL from a blurhash string.
- `imageToBlurhash()`: generate blurhash data from image bytes.

### When to use

- Media placeholders in profile or video UIs.

## BMT And Chunk Hashing

### Exports

- `makeChunkedFile`
- `bmtHash()`
- `bmtRootHash()`

### When to use

- Swarm chunk-address calculations.
- Preparing data for chunk upload flows.

## Buffers And Files

### Exports

- `fileToBuffer()`
- `fileToUint8Array()`
- `fileToDataURL()`
- `bufferToFile()`
- `bufferToDataURL()`
- `stringToBase64()`

### When to use

- Browser file upload flows.
- Buffer conversions before media processing.

### Caveat

- `fileToDataURL()` is browser-only.

## Bytes

### Exports

- `hasBytesAtOffset()`
- `findIndexOfArray()`
- `commonBytes()`
- `makeBytes()`
- `serializeBytes()`
- `bytesEqual()`
- `overwriteBytes()`
- `flattenBytesArray()`
- `checkBytes()`

### When to use

- Low-level Swarm, chunk, and serialization helpers.

### Caveat

- `checkBytes()` is typed generically, but the current implementation effectively enforces a 32-byte length check.

## Crypto

### Exports

- `encryptData()`: password-based encryption for string payloads.
- `decryptData()`: reverse `encryptData()`.
- `encryptDecrypt()`: XOR-style byte transform used by lower-level Swarm flows.

### When to use

- Protected playlist details.
- Low-level key-based byte transforms.

## Ethereum Wallet Helpers

### Exports

- `signMessage()`
- `addressBytes()`
- `checkIsEthAddress()`
- `shortenEthAddr()`
- `checkUsingInjectedProvider()`
- `fetchAccounts()`
- `switchAccount()`
- `checkWalletLocked()`
- `getNetworkName()`

### When to use

- Browser wallet flows with `window.ethereum`.
- Simple address formatting and network labeling.

### Caveat

- These helpers are browser-oriented and depend on an injected provider.

## Hex

### Exports

- `bytesToHex`
- `hexToBytes`
- `keccak256Hash()`
- `fromHexString()`
- `toHexString()`
- `makeHexString()`

`bytesToHex` and `hexToBytes` are re-exported from `@noble/hashes/utils.js` (Noble 2.x), so callers can rely on one implementation instead of mixing `etc.bytesToHex` / `etc.hexToBytes` from `@noble/secp256k1`.

### When to use

- Swarm reference conversion.
- Ethereum or feed hashing utilities.

## Image Helpers

### Exports

- `resizeImage()`
- `isImageTypeSupported()`
- `getImageMeta()`
- `getImageTypeFromData()`
- `isAvifSupported()`
- `isWebpSupported()`

### When to use

- `ImageProcessor` support work.
- Image validation, type detection, and resizing.

### Caveat

- Some helpers are browser-only, while Node image flows rely on internal FFmpeg support.

## Mantaray And Content References

### Exports

- `equalNodes()`
- `getReferenceFromData()`
- `jsonToReference()`
- `textToReference()`
- `encodePath()`
- `decodePath()`
- `isZeroBytesReference()`
- `getAllPaths()`
- `getNodesWithPrefix()`
- `serializeVersion()`
- `serializeReferenceLength()`
- `checkForSeparator()`
- `getBzzNodeInfo()`

### When to use

- Path handling and traversal of Mantaray trees.
- Computing a Swarm reference from raw content.
- Reading BZZ node information through `BeeClient`.

### Caveat

- This file contains some reference-related helpers that are easy to miss if you only look at `reference.ts`.

## Media

### Exports

- `getVideoMeta()`
- `getBitrate()`
- `BitrateCompressionRate`
- `getHlsBitrate()`

### When to use

- Video metadata inspection.
- Estimating encoding ladders or bitrates for HLS preparation.

### Caveat

- `getVideoMeta()` uses browser video elements in this public utility.

## Object Helpers

### Exports

- `structuredClone()`

### When to use

- JSON-style deep clone of plain data structures.

### Caveat

- This is a custom helper, not the platform's native `structuredClone`.

## Reference Helpers

### Exports

- `isValidReference()`
- `isEmptyReference()`
- `isInvalidReference()`
- `checkBytesReference()`
- `referenceToBytesReference()`
- `bytesReferenceToReference()`
- `makeBytesReference()`
- `getReferenceFromUrl()`

### When to use

- Validating and converting Swarm references.
- Parsing references out of BZZ URLs.

## Signers

### Exports

- `makePrivateKeySigner()`
- `makeInjectedWalletSigner()`
- `defaultSign()`
- `recoverAddress()`

### When to use

- Creating the `Signer` passed into `BeeClient`.
- Signing or recovering EIP-191 style messages.

## Strings

### Exports

- `slugify()`

### When to use

- URL-safe or filename-safe labels.

## Time

### Exports

- `timestampToDate()`
- `dateToTimestamp()`

### When to use

- Converting between `Date` and Swarm or chain timestamp formats.

## UInt64 And Endian Helpers

### Exports

- `fromBigEndian()`
- `toBigEndianFromUint16()`
- `toBigEndianFromUint32()`
- `toBigEndianFromBigInt64()`
- `writeUint64LittleEndian()`
- `writeUint64BigEndian()`
- `readUint64BigEndian()`

### When to use

- Feed, chunk, or serialization code that needs endian-aware integer handling.

### Caveat

- The uint64 helpers are intentionally limited in a few code paths and should be treated as protocol helpers rather than general-purpose bigint utilities.

## URLs

### Exports

- `composeUrl()`
- `safeURL()`
- `isSafeURL()`
- `urlOrigin()`
- `urlHostname()`
- `urlPath()`

### When to use

- Building or validating gateway and API URLs.
- Safely normalizing user-supplied host strings.

## Internal-Only Utilities

These files exist in `src/utils`, but they are not re-exported by the public root barrel:

- `src/utils/ffmpeg.ts`
- `src/utils/axios.ts`

Read them only when the task explicitly needs source-level implementation details.
