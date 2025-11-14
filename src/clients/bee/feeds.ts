// Forked from: https://github.com/ethersphere/bee

import { AxiosError } from "axios"

import { extractUploadHeaders } from "./utils"
import {
  EpochFeed,
  EpochFeedChunk,
  EpochIndex,
  EthernaSdkError,
  MantarayNode,
  throwSdkError,
} from "@/classes"
import {
  MantarayEntryMetadataFeedOwnerKey,
  MantarayEntryMetadataFeedTopicKey,
  MantarayEntryMetadataFeedTypeKey,
  ZeroHashReference,
} from "@/consts"
import {
  bytesReferenceToReference,
  bytesToHex,
  dateToTimestamp,
  encodePath,
  getReferenceFromData,
  hexToBytes,
  keccak256Hash,
  makeBytes,
  makeBytesReference,
  makeHexString,
  referenceToBytesReference,
  serializeBytes,
  toEthAccount,
  writeUint64BigEndian,
} from "@/utils"

import type { BeeClient } from "."
import type {
  FeedInfo,
  FeedType,
  FeedUpdateOptions,
  FeedUploadOptions,
  ReferenceResponse,
  RequestUploadOptions,
} from "./types"
import type { RequestOptions } from "@/types/clients"
import type { EthAddress } from "@/types/eth"
import type { FeedUpdateHeaders, Index, Reference } from "@/types/swarm"
import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios"

const feedEndpoint = "/feeds"

export class Feed {
  constructor(private instance: BeeClient) {}

  makeFeed(topicName: string, owner: EthAddress, type: FeedType = "sequence"): FeedInfo {
    return this.makeFeedFromHex(bytesToHex(keccak256Hash(topicName)), owner, type)
  }

  makeFeedFromHex(topicHex: string, owner: EthAddress, type: FeedType = "sequence"): FeedInfo {
    return {
      topic: topicHex,
      owner: makeHexString(owner).toLowerCase(),
      type,
    }
  }

  makeReader(feed: FeedInfo) {
    const instance = this.instance
    return {
      ...feed,
      async download(options?: FeedUpdateOptions) {
        try {
          const at = options?.at ?? new Date()

          if (feed.type === "epoch") {
            const epochFeed = new EpochFeed(instance)
            const chunk = await epochFeed.tryFindEpochFeed(
              toEthAccount(feed.owner),
              hexToBytes(feed.topic),
              at,
              options?.index ? EpochIndex.fromString(options.index) : undefined,
            )

            if (!chunk) {
              throw new EthernaSdkError(
                "NOT_FOUND",
                `No epoch feed found: '${feed.topic}', '0x${feed.owner}'`,
              )
            }

            const reference = bytesToHex(chunk.getContentPayload()) as Reference

            return {
              reference,
            }
          } else {
            if (instance.type === "etherna") {
              await instance.awaitAccessToken()
            }

            const { data } = await instance.request.get<ReferenceResponse>(
              `${feedEndpoint}/${feed.owner}/${feed.topic}`,
              {
                params: {
                  type: feed.type,
                  at: at.getTime(),
                },
                ...instance.prepareAxiosConfig(options),
              },
            )

            return {
              reference: data.reference,
            }
          }
        } catch (error) {
          throwSdkError(error)
        }
      },
    }
  }

  makeWriter(feed: FeedInfo) {
    if (!this.instance.signer) {
      throw new EthernaSdkError("MISSING_SIGNER", "No signer provided")
    }

    if (makeHexString(this.instance.signer.address).toLowerCase() !== feed.owner.toLowerCase()) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "Signer address does not match feed owner")
    }

    const upload = async (reference: string, options: FeedUploadOptions) => {
      try {
        const canonicalReference = makeBytesReference(reference)

        if (feed.type === "epoch") {
          const epochFeed = new EpochFeed(this.instance)
          const chunk = await epochFeed.createNextEpochFeedChunk(
            toEthAccount(feed.owner),
            hexToBytes(feed.topic),
            canonicalReference,
            options.index ? EpochIndex.fromString(options.index) : undefined,
          )

          const identifier = EpochFeedChunk.buildIdentifier(hexToBytes(feed.topic), chunk.index)
          const { reference } = await this.instance.soc.upload(identifier, chunk.payload, options)

          return {
            reference,
            index: chunk.index.toString(),
          }
        } else {
          const nextIndex =
            options.index && options.index !== "latest"
              ? options.index
              : await this.findNextIndex(feed)

          const at = dateToTimestamp(options.at ?? new Date())
          const timestamp = writeUint64BigEndian(at)
          const payloadBytes = serializeBytes(timestamp, canonicalReference)
          const identifier = this.makeFeedIdentifier(feed.topic, nextIndex)
          const { reference } = await this.instance.soc.upload(identifier, payloadBytes, options)

          return {
            reference,
            index: nextIndex,
          }
        }
      } catch (error) {
        throwSdkError(error)
      }
    }

    return {
      upload,
    }
  }

  async createRootManifest(feed: FeedInfo, options: FeedUploadOptions) {
    try {
      if (feed.type === "epoch") {
        // epoch not yet supported in bee
        const epochRoot = await this.makeRootManifest(feed)
        await epochRoot.save(options)

        return epochRoot.reference
      }

      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const response = await this.instance.request.post<ReferenceResponse>(
        `${feedEndpoint}/${feed.owner}/${feed.topic}`,
        null,
        {
          params: {
            type: feed.type,
          },
          ...this.instance.prepareAxiosConfig({
            ...options,
            headers: {
              ...options?.headers,
              ...extractUploadHeaders(options),
            },
          }),
        },
      )

      return response.data.reference
    } catch (error) {
      throwSdkError(error)
    }
  }

  async makeRootManifest(feed: FeedInfo) {
    const node = new MantarayNode()
    node.addFork(encodePath("/"), ZeroHashReference, {
      [MantarayEntryMetadataFeedOwnerKey]: feed.owner.toLowerCase(),
      [MantarayEntryMetadataFeedTopicKey]: feed.topic,
      [MantarayEntryMetadataFeedTypeKey]: feed.type.replace(/^./, (c) => c.toUpperCase()),
    })
    node.getForkAtPath(encodePath("/")).node["makeValue"]()
    node.getForkAtPath(encodePath("/")).node.entry = ZeroHashReference

    const reference = await node.save(async (data) => {
      return referenceToBytesReference(getReferenceFromData(data))
    })

    return {
      reference: bytesReferenceToReference(reference),
      save: async (options: RequestUploadOptions) => {
        node.makeDirty()
        await node.save(async (data) => {
          const { reference } = await this.instance.bytes.upload(data, options)
          return referenceToBytesReference(reference)
        })
      },
    }
  }

  async parseFeedFromRootManifest(reference: Reference, opts?: RequestOptions) {
    const node = new MantarayNode()
    await node.load(async (reference) => {
      try {
        const data = await this.instance.bytes.download(bytesReferenceToReference(reference), {
          signal: opts?.signal,
          timeout: opts?.timeout,
          headers: opts?.headers,
        })
        return data
      } catch (error) {
        const node = new MantarayNode()
        node.entry = ZeroHashReference
        return node.serialize()
      }
    }, referenceToBytesReference(reference))

    if (opts?.signal?.aborted) {
      throw new EthernaSdkError("ABORTED_BY_USER", "Aborted by user")
    }

    const fork = node.getForkAtPath(encodePath("/"))
    const owner = fork.node.metadata?.[MantarayEntryMetadataFeedOwnerKey]
    const topic = fork.node.metadata?.[MantarayEntryMetadataFeedTopicKey]
    const type = fork.node.metadata?.[MantarayEntryMetadataFeedTypeKey]?.replace(/^./, (c) =>
      c.toLowerCase(),
    )

    if (!owner || owner.length !== 40) {
      throw new EthernaSdkError("NOT_FOUND", `Invalid feed owner: '${owner}'`)
    }
    if (!topic || topic.length !== 64) {
      throw new EthernaSdkError("NOT_FOUND", `Invalid feed topic: '${topic}'`)
    }
    if (!type || !["epoch", "sequence"].includes(type)) {
      throw new EthernaSdkError("NOT_FOUND", `Invalid feed type: '${type}'`)
    }

    return {
      owner,
      topic,
      type: type as FeedType,
    } as FeedInfo
  }

  // Utils
  async fetchLatestFeedUpdate(feed: FeedInfo) {
    if (this.instance.type === "etherna") {
      await this.instance.awaitAccessToken()
    }

    const resp = await this.instance.request.get<ReferenceResponse>(
      `${feedEndpoint}/${feed.owner}/${feed.topic}`,
      {
        params: {
          type: feed.type,
        },
        ...this.instance.prepareAxiosConfig(),
      },
    )

    return {
      reference: resp.data.reference,
      ...this.readFeedUpdateHeaders(resp.headers),
    }
  }

  async findNextIndex(feed: FeedInfo) {
    try {
      const feedUpdate = await this.fetchLatestFeedUpdate(feed)

      return makeHexString(feedUpdate.feedIndexNext)
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 404) {
          return bytesToHex(makeBytes(8))
        }
      }

      throw throwSdkError(err)
    }
  }

  private readFeedUpdateHeaders(
    headers: RawAxiosResponseHeaders | AxiosResponseHeaders | Partial<Record<string, string>>,
  ): FeedUpdateHeaders {
    const feedIndex = headers["swarm-feed-index"]
    const feedIndexNext = headers["swarm-feed-index-next"]

    if (!feedIndex) {
      throw new EthernaSdkError(
        "SERVER_ERROR",
        "Response did not contain expected swarm-feed-index!",
      )
    }

    if (!feedIndexNext) {
      throw new EthernaSdkError(
        "SERVER_ERROR",
        "Response did not contain expected swarm-feed-index-next!",
      )
    }

    return {
      feedIndex,
      feedIndexNext,
    }
  }

  private makeFeedIdentifier(topic: string, index: Index | EpochIndex): Uint8Array {
    if (typeof index === "number") {
      return this.makeSequentialFeedIdentifier(topic, index)
    } else if (typeof index === "string") {
      const indexBytes = this.makeFeedIndexBytes(index)
      return this.hashFeedIdentifier(topic, indexBytes)
    } else if (index instanceof EpochIndex) {
      return EpochFeedChunk.buildIdentifier(hexToBytes(topic), index)
    }

    return this.hashFeedIdentifier(topic, index)
  }

  private hashFeedIdentifier(topic: string, index: Uint8Array): Uint8Array {
    return keccak256Hash(hexToBytes(topic), index)
  }

  private makeSequentialFeedIdentifier(topic: string, index: number): Uint8Array {
    const indexBytes = writeUint64BigEndian(index)

    return this.hashFeedIdentifier(topic, indexBytes)
  }

  private makeFeedIndexBytes(s: string): Uint8Array {
    const hex = makeHexString(s)

    return hexToBytes(hex)
  }
}
