import { EthernaSdkError } from "./sdk-error"
import { bytesEqual, fromHexString, keccak256Hash, toHexString } from "@/utils"

import type { EpochIndex } from "./epoch-index"
import type { Reference } from "@/types/swarm"

// extend UInt8Array / Date / BigInt
declare global {
  interface Uint8Array {
    toUnixTimestamp(): bigint
    toUnixDate(): Date
  }
  interface Date {
    toUnixTimestamp(): bigint
    toBytes(): Uint8Array
  }
  interface BigInt {
    toDate(): Date
    normalized(): bigint
  }
}

Uint8Array.prototype.toUnixTimestamp = function () {
  if (this.length !== EpochFeedChunk.TimeStampByteSize) {
    throw new EthernaSdkError("INVALID_ARGUMENT", "Invalid date time byte array length")
  }

  const fixedDateTimeByteArray = new Uint8Array(this.length)
  fixedDateTimeByteArray.set(this, 0)
  if (new DataView(new ArrayBuffer(1)).getUint8(0) === 0) {
    fixedDateTimeByteArray.reverse()
  }

  const dataView = new DataView(fixedDateTimeByteArray.buffer)

  return dataView.getBigUint64(0, true) * 1000n
}
Uint8Array.prototype.toUnixDate = function () {
  return new Date(Number(this.toUnixTimestamp()))
}
Date.prototype.toBytes = function () {
  const timestamp = BigInt(Math.floor(this.getTime() / 1000))
  const timestampBytes = new Uint8Array(EpochFeedChunk.TimeStampByteSize)
  const dataView = new DataView(timestampBytes.buffer)

  dataView.setBigUint64(0, timestamp, true)

  if (new DataView(new ArrayBuffer(1)).getUint8(0) === 0) {
    timestampBytes.reverse()
  }

  return timestampBytes
}
Date.prototype.toUnixTimestamp = function () {
  return BigInt(this.getTime())
}
BigInt.prototype.toDate = function () {
  return new Date(Number(this))
}
BigInt.prototype.normalized = function () {
  // get swarm payload timestamp supposed this is a unix timestamp
  return this.valueOf() / 1000n
}

export class EpochFeedChunk {
  public static readonly AccountBytesLength = 20
  public static readonly IdentifierBytesLength = 32
  public static readonly IndexBytesLength = 32
  public static readonly MaxPayloadBytesSize = 3991 //4kB - identifier - signature - span
  public static readonly ReferenceHashRegex = /^[A-Fa-f0-9]{64}$/
  public static readonly TimeStampByteSize = 8
  public static readonly TopicBytesLength = 32
  public static readonly MinPayloadByteSize = this.TimeStampByteSize
  public static readonly MaxContentPayloadBytesSize =
    this.MaxPayloadBytesSize - this.TimeStampByteSize //creation timestamp

  public timestamp: Date | null = null

  constructor(
    public index: EpochIndex,
    public payload: Uint8Array,
    public reference: Reference,
  ) {
    if (payload.length < EpochFeedChunk.MinPayloadByteSize) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Payload can't be shorter than ${EpochFeedChunk.TimeStampByteSize} bytes`,
      )
    }
    if (payload.length > EpochFeedChunk.MaxPayloadBytesSize) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Payload can't be longer than ${EpochFeedChunk.MaxPayloadBytesSize} bytes`,
      )
    }
    if (!EpochFeedChunk.ReferenceHashRegex.test(reference)) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "Not a valid swarm hash")
    }

    const timestampBytes = payload.slice(0, EpochFeedChunk.TimeStampByteSize)
    const date = timestampBytes.toUnixDate()

    this.timestamp = isNaN(date.getTime()) ? null : date
  }

  // Methods.
  public isEqual(chunk: EpochFeedChunk) {
    return (
      this.reference === chunk.reference &&
      this.index.isEqual(chunk.index) &&
      bytesEqual(this.payload, chunk.payload)
    )
  }

  public getContentPayload() {
    return this.payload.slice(EpochFeedChunk.TimeStampByteSize)
  }

  // Static helpers.
  public static buildChunkPayload(contentPayload: Uint8Array, at?: Date): Uint8Array {
    if (contentPayload.length > this.MaxContentPayloadBytesSize) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Content payload can't be longer than ${this.MaxContentPayloadBytesSize} bytes`,
      )
    }

    const timestamp = at ?? new Date()

    const chunkPayload = new Uint8Array([...timestamp.toBytes(), ...contentPayload])

    return chunkPayload
  }

  public static buildIdentifier(topic: Uint8Array, index: EpochIndex): Uint8Array {
    if (topic.length !== this.TopicBytesLength)
      throw new EthernaSdkError("INVALID_ARGUMENT", "Invalid topic length")

    const newArray = new Uint8Array(this.TopicBytesLength + this.IndexBytesLength)
    newArray.set(topic, 0)
    newArray.set(index.marshalBinary, topic.length)

    return keccak256Hash(newArray)
  }

  public static buildReferenceHash(
    account: string,
    identifier: Uint8Array,
    index?: EpochIndex,
  ): Reference
  public static buildReferenceHash(
    account: string,
    topicOrIdentifier: Uint8Array,
    index?: EpochIndex,
  ): Reference {
    if (!index) {
      // check if address is an eth address
      if (!/^0x[0-9a-f]{40}$/i.test(account)) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Value is not a valid ethereum account")
      }

      const accountBytes = fromHexString(account.replace(/^0x/, ""))

      if (accountBytes.length != this.AccountBytesLength) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Invalid account length")
      }
      if (topicOrIdentifier.length != this.IdentifierBytesLength) {
        throw new EthernaSdkError("INVALID_ARGUMENT", "Invalid identifier length")
      }

      const newArray = new Uint8Array(this.IdentifierBytesLength + this.AccountBytesLength)
      newArray.set(topicOrIdentifier, 0)
      newArray.set(accountBytes, this.IdentifierBytesLength)

      return toHexString(keccak256Hash(newArray)) as Reference
    } else {
      return this.buildReferenceHash(account, this.buildIdentifier(topicOrIdentifier, index))
    }
  }
}
