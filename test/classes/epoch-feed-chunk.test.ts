import { describe, expect, it } from "vitest"

import { EpochFeedChunk, EpochIndex } from "@/classes"
import { toEthAccount } from "@/utils/address"

import type { Reference } from "@/types"

describe("epoch feed chunk", () => {
  it.concurrent("should return the coorect content payload", () => {
    const chunk = new EpochFeedChunk(
      new EpochIndex(0n, 0),
      new Uint8Array([0, 0, 0, 1, 2, 3, 4, 5, 6, 7]),
      "aeef03dde6685d5a1c9ae5af374cce84b25aab391222801d8c4dc5d108929592" as Reference,
    )

    expect(chunk.getContentPayload()).toEqual(new Uint8Array([6, 7]))
  })

  it.concurrent("should return the correct timestamp", () => {
    const chunk = new EpochFeedChunk(
      new EpochIndex(0n, 0),
      new Uint8Array([0, 0, 0, 1, 2, 3, 4, 5, 6, 7]),
      "aeef03dde6685d5a1c9ae5af374cce84b25aab391222801d8c4dc5d108929592" as Reference,
    )

    expect(chunk.timestamp).toEqual(new Date("2107-03-04T22:02:45.000Z"))
  })

  it.concurrent("should throw when payload exeeds the limit", () => {
    const contentPayload = new Uint8Array(EpochFeedChunk.MaxContentPayloadBytesSize + 1)

    expect(() => EpochFeedChunk.buildChunkPayload(contentPayload)).toThrow()
  })

  it.concurrent("should build the chunk payload", async () => {
    const contentPayload = new Uint8Array([4, 2, 0])

    const beforeTimeStamp = new Date()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const chunkPayload = EpochFeedChunk.buildChunkPayload(contentPayload)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const afterTimeStamp = new Date()

    const chunkTimestamp = chunkPayload.slice(0, EpochFeedChunk.TimeStampByteSize).toUnixDate()

    expect(chunkTimestamp.getTime()).toBeGreaterThanOrEqual(beforeTimeStamp.getTime())
    expect(chunkTimestamp.getTime()).toBeLessThanOrEqual(afterTimeStamp.getTime())
    expect(chunkPayload.slice(EpochFeedChunk.TimeStampByteSize)).toEqual(contentPayload)
  })

  it.concurrent("should throw when topic length is wrong", () => {
    const topic = new Uint8Array([1, 2, 3])
    const index = new EpochIndex(0n, 0)

    expect(() => EpochFeedChunk.buildIdentifier(topic, index)).toThrow()
  })

  it.concurrent("should build the identifier", () => {
    const topic = new Uint8Array([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      26, 27, 28, 29, 30, 31,
    ])
    const index = new EpochIndex(2n, 1)

    const result = EpochFeedChunk.buildIdentifier(topic, index)

    expect(result).toEqual(
      new Uint8Array([
        229, 116, 252, 141, 32, 73, 147, 48, 181, 92, 124, 96, 74, 217, 20, 163, 90, 16, 124, 66,
        174, 221, 76, 184, 135, 58, 193, 210, 235, 104, 138, 215,
      ]),
    )
  })

  it.concurrent("should throw when account length is wrong", () => {
    const account = toEthAccount(new Uint8Array([0, 1, 2, 3]))
    const identifier = new Uint8Array([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      26, 27, 28, 29, 30, 31,
    ])

    expect(() => EpochFeedChunk.buildReferenceHash(account, identifier)).toThrow()
  })

  it.concurrent("should throw when identifier length is wrong", () => {
    const account = toEthAccount(
      new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    )
    const identifier = new Uint8Array([0, 1, 2, 3])

    expect(() => EpochFeedChunk.buildReferenceHash(account, identifier)).toThrow()
  })

  it.concurrent("should build the reference hash", () => {
    const account = toEthAccount(
      new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    )
    const identifier = new Uint8Array([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      26, 27, 28, 29, 30, 31,
    ])

    const result = EpochFeedChunk.buildReferenceHash(account, identifier)

    expect(result).toEqual(
      "854f1dd0c708a544e282b25b9f9c1d353dca28e352656993ab3c2c17b384a86f" as Reference,
    )
  })
})
