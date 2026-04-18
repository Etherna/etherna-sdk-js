# Clients

## Overview

Import public clients from the package root:

```ts
import {
  BeeClient,
  EthernaIndexClient,
  EthernaIndexAggregatorClient,
  EthernaCreditClient,
  EthernaSSOClient,
} from "@etherna/sdk-js"
```

The `clients` barrel only re-exports the top-level client classes and their `types.ts` files. Most concrete helpers such as `Bzz`, `Stamps`, `IndexVideos`, or `CreditUser` are source-level classes that you usually access through instance properties instead of importing directly from the root package.

## Bee Client

### Root exports

- `BeeClient`
- `BeeClientOptions`

### Role

`BeeClient` is the main Swarm/Bee and Etherna gateway HTTP client. Use it for raw bytes, BZZ paths, feeds, chunks, postage batches, pins, SOCs, and Etherna-specific gateway endpoints.

### Basic usage

```ts
import { BeeClient } from "@etherna/sdk-js"

const beeClient = new BeeClient("https://gateway.etherna.io", {
  type: "etherna",
  apiPath: "/api/v0.3",
  accessToken: "<token>",
})

const data = await beeClient.bzz.download("reference")
```

### Main instance modules

- `auth`: gateway or Bee authentication flows.
- `bytes`: raw `/bytes` upload and download.
- `bzz`: manifest and file upload/download over `/bzz`.
- `chainstate`: chain and pricing state.
- `chunk`: chunk upload/download.
- `feed`: feed readers, writers, and higher-level epoch feed helpers.
- `offers`: Etherna storage offers.
- `pins`: pin management.
- `soc`: single-owner chunks.
- `stamps`: postage batches, best-batch selection, top-up, dilute, and batch-related helpers.
- `tags`: upload tag operations.
- `user`: Etherna gateway user operations.
- `system`: Etherna gateway system operations.

### Important public Bee types

- Feed and chunk shapes:
  - `FeedType`
  - `FeedInfo`
  - `ContentAddressedChunk`
  - `SingleOwnerChunk`
  - `Data`
- Redundancy and upload/download options:
  - `RedundancyStrategy`
  - `RedundancyLevel`
  - `RequestUploadOptions`
  - `RequestDownloadOptions`
  - `FileUploadOptions`
  - `FileDownloadOptions`
  - `FeedUpdateOptions`
  - `FeedUploadOptions`
  - `AuthenticationOptions`
- Common responses and Etherna gateway DTOs:
  - `ReferenceResponse`
  - `EthernaGatewayCurrentUser`
  - `EthernaGatewayCredit`
  - `EthernaGatewayBatchPreview`
  - `EthernaGatewayBatch`
  - `EthernaGatewayChainState`
  - `EthernaGatewayPin`
  - `EthernaGatewayWelcomeStatus`

### When to use

- Use `BeeClient` whenever the task needs Swarm reads or writes.
- Use `beeClient.stamps` before large uploads or manifest writes.
- Use `beeClient.feed` for profile, playlist, followings, and user-playlists topic resolution.
- Use `beeClient.bzz` and `beeClient.bytes` when working directly with manifest content or Mantaray data.

### Caveats

- `BeeClientOptions.type` controls behavior: some modules are Etherna-only and some are Bee-only.
- `updateSigner()` accepts a signer object, address, or private key string and normalizes through root-exported signer utilities.
- `src/clients/bee/utils.ts` exports helpers such as `prepareData()` and `makeContentAddressedChunk()`, but they are not part of the public root barrel.

## Etherna Index Client

### Root exports

- `EthernaIndexClient`
- `IndexClientOptions`
- `IIndexClientInterface`

### Role

`EthernaIndexClient` is the main client for a single Etherna Index API. Use it for videos, users, comments, moderation, search, and system parameters.

### Basic usage

```ts
import { EthernaIndexClient } from "@etherna/sdk-js"

const indexClient = new EthernaIndexClient("https://index.etherna.io", {
  apiPath: "/api/v0.3",
  accessToken: "<token>",
})

const results = await indexClient.search.fetchVideos({ text: "etherna" })
```

### Main instance modules

- `comments`: edit or delete comments.
- `moderation`: moderation endpoints.
- `search`: full-text or filtered video search.
- `system`: index parameters and limits.
- `videos`: read, create, validate, vote, and report videos.
- `users`: read users and user-owned videos.

### Important public Index types

- `PaginatedResult<T>`
- `IndexUser`
- `IndexCurrentUser`
- `IndexUserVideos`
- `IndexVideo`
- `IndexVideoPreview`
- `IndexVideoManifest`
- `IndexVideoCreation`
- `IndexVideoValidation`
- `IndexVideoComment`
- `VoteValue`
- `IndexEncryptionType`
- `IndexParameters`

### When to use

- Use this client when the task targets one known index base URL.
- Pair it with `VideoManifest` and `VideoPublisher` when publishing or validating videos.
- Use `IndexVideoManifest` and related DTOs when mapping manifest data into index payloads.

### Caveats

- `IndexVideos`, `IndexUsers`, `IndexSearch`, and related classes exist in source but are normally used through the `EthernaIndexClient` instance.
- Some index DTOs depend on schema-level shapes from the root `schemas` export.

## Etherna Index Aggregator Client

### Root exports

- `EthernaIndexAggregatorClient`
- `IndexAggregatorClientOptions`
- `IndexAggregatorRequestOptions`
- `AggregatedPaginatedResult<T>`

### Role

`EthernaIndexAggregatorClient` fans requests out across multiple index servers while still exposing the same high-level interface shape as `EthernaIndexClient`.

### Basic usage

```ts
import { EthernaIndexAggregatorClient } from "@etherna/sdk-js"

const aggregator = new EthernaIndexAggregatorClient({
  indexes: [{ url: "https://index-a.example", apiPath: "/api/v0.3" }],
})

const page = await aggregator.videos.fetchVideos()
```

### Main instance modules

- `comments`
- `moderation`
- `search`
- `system`
- `videos`
- `users`

### Important methods

- `getIndexClientByRequest(opts)`: resolve the concrete index client for a targeted request.
- `fetchAggregatedPaginatedData(page, take, fetcher, opts?)`: merge paginated results from multiple indexes.

### When to use

- Use it when the task needs a unified read path across multiple index servers.
- Use `IndexAggregatorRequestOptions` with `indexUrl` when a method must target one concrete index.

### Caveats

- Aggregated methods do not all behave the same way. Some merge multiple results, while others effectively route to one chosen client.
- `comments.editComment()` and `comments.deleteComment()` need a targeted request with `indexUrl`.

## Etherna Credit Client

### Root exports

- `EthernaCreditClient`
- `CreditClientOptions`

### Role

`EthernaCreditClient` is the billing and balance client for Etherna credit operations.

### Basic usage

```ts
import { EthernaCreditClient } from "@etherna/sdk-js"

const creditClient = new EthernaCreditClient("https://credit.example", {
  apiPath: "/api/v0.3",
  accessToken: "<token>",
})

const balance = await creditClient.user.fetchBalance()
```

### Main instance modules

- `user`: balance and credit logs.
- `payments`: available currencies and deposit wallet information.

### Important public Credit types

- `CreditLog`
- `CreditBalance`
- `PaymentCrypto`
- `CryptoTx`
- `CryptoWallet`
- `CallbackPaymentRequestFiat`
- `CallbackPaymentRequestStatus`
- `CallbackPaymentRequestFeePolicy`
- `CallbackTransactionInput`
- `CallbackPaymentRequestInput`

### When to use

- Use it when the task is about balances, deposit flows, or credit payment callbacks.

## Etherna SSO Client

### Root exports

- `EthernaSSOClient`
- `SSOClientOptions`
- `SSOIdentity`

### Role

`EthernaSSOClient` is the SDK facade for SSO authentication and identity endpoints.

### Basic usage

```ts
import { EthernaSSOClient } from "@etherna/sdk-js"

const ssoClient = new EthernaSSOClient("https://sso.example", {
  apiPath: "/api/v0.3",
})

await ssoClient.auth.signin("username.password")
const me = await ssoClient.identity.fetchCurrentIdentity()
```

### Main instance modules

- `auth`: sign-in and token update flow.
- `identity`: read the current identity profile.

### Important public SSO types

- `SSOIdentity`: the public response shape exported from `src/clients/sso/types.ts`

### Caveats

- There is also a source-level class named `SSOIdentity` in `src/clients/sso/identity.ts`. The public root export named `SSOIdentity` is the interface from `types.ts`.

## Internal-Only Caveats

- `BaseClient` and `BaseClientOptions` live in `src/clients/base-client.ts`, but they are not re-exported through the public `clients` barrel.
- `RequestOptions` is public, but it comes from the root `types` export rather than the `clients` barrel.
- If the task is about a nested module implementation rather than public consumption, inspect the source file directly after identifying the correct parent client here.
