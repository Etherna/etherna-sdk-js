// Forked from: https://github.com/fairDataSociety/bmt-js

import { serializeBytes } from "./bytes"
import { keccak256Hash } from "./hex"
import {
  HASH_SIZE,
  MAX_PAYLOAD_SIZE,
  MAX_SPAN_LENGTH,
  SEGMENT_PAIR_SIZE,
  SEGMENT_SIZE,
} from "@/consts"
import { SPAN_SIZE } from "@/consts"
import { MAX_CHUNK_PAYLOAD_SIZE } from "@/consts"

import type { Bytes } from "@/types/utils"

export interface Chunk<
  MaxPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
> extends Flavor<"Chunk"> {
  readonly payload: FlexBytes<0, MaxPayloadLength>
  maxPayloadLength: MaxPayloadLength
  spanLength: SpanLength
  data(): ValidChunkData
  span(): Bytes<SpanLength>
  address(): ChunkAddress
  inclusionProof(segmentIndex: number): Uint8Array[]
  bmt(): Uint8Array[]
}

export interface ChunkedFile<
  MaxChunkPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
> extends Flavor<"ChunkedFile"> {
  // zero level data chunks
  leafChunks(): Chunk<MaxChunkPayloadLength, SpanLength>[]
  rootChunk(): Chunk<MaxChunkPayloadLength, SpanLength>
  payload: Uint8Array
  address(): ChunkAddress
  span(): Span<SpanLength>
  bmt(): Chunk<MaxChunkPayloadLength, SpanLength>[][]
}

export type ChunkAddress = Uint8Array

export type ValidChunkData = Uint8Array & Flavor<"ValidChunkData">

export type Flavor<Name> = { __tag__?: Name }

export interface FlexBytes<Min extends number, Max extends number> extends Uint8Array {
  readonly __min__?: Min
  readonly __max__?: Max
}

export interface Span<Length extends number = typeof SPAN_SIZE>
  extends Bytes<Length>, Flavor<"Span"> {}

/**
 * Create a span for storing the length of the chunk
 *
 * The length is encoded in 64-bit little endian.
 *
 * @param value The length of the span
 */
export function makeSpan<Length extends number>(value: number, length?: Length): Span<Length> {
  const spanLength = length || SPAN_SIZE

  if (value < 0) {
    throw new Error(`invalid length for span: ${value}`)
  }

  if (value > MAX_SPAN_LENGTH) {
    throw new Error(`invalid length (> ${MAX_SPAN_LENGTH}) ${value}`)
  }

  const span = new Uint8Array(spanLength)
  const dataView = new DataView(span.buffer)
  const littleEndian = true
  const lengthLower32 = value & 0xffffffff

  dataView.setUint32(0, lengthLower32, littleEndian)

  return span as Bytes<Length>
}

export function getSpanValue<Length extends number = 8>(span: Span<Length>): number {
  const dataView = new DataView(span.buffer)

  return dataView.getUint32(0, true)
}

/**
 * Calculate a Binary Merkle Tree hash for a chunk
 *
 * The BMT chunk address is the hash of the 8 byte span and the root
 * hash of a binary Merkle tree (BMT) built on the 32-byte segments
 * of the underlying data.
 *
 * If the chunk content is less than 4k, the hash is calculated as
 * if the chunk was padded with all zeros up to 4096 bytes.
 *
 * @param chunkContent Chunk data including span and payload as well
 *
 * @returns the keccak256 hash in a byte array
 */
export function bmtHash(chunkContent: Uint8Array): Uint8Array {
  const span = chunkContent.slice(0, 8)
  const payload = chunkContent.slice(8)
  const rootHash = bmtRootHash(payload)
  const chunkHashInput = new Uint8Array([...span, ...rootHash])
  const chunkHash = keccak256Hash(chunkHashInput)

  return chunkHash
}

/**
 * Creates a content addressed chunk and verifies the payload size.
 *
 * @param payloadBytes the data to be stored in the chunk
 */
export function makeChunk<
  MaxPayloadSize extends number = typeof MAX_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
>(
  payloadBytes: Uint8Array,
  options?: {
    maxPayloadSize?: MaxPayloadSize
    spanLength?: SpanLength
    startingSpanValue?: number
  },
): Chunk<MaxPayloadSize, SpanLength> {
  // assertion for the sizes are required because
  // typescript does not recognise subset relation on union type definition
  const maxPayloadLength = (options?.maxPayloadSize || MAX_PAYLOAD_SIZE) as MaxPayloadSize
  const spanLength = (options?.spanLength || SPAN_SIZE) as SpanLength
  const spanValue = options?.startingSpanValue || payloadBytes.length

  assertFlexBytes(payloadBytes, 0, maxPayloadLength)
  const paddingChunkLength = new Uint8Array(maxPayloadLength - payloadBytes.length)
  const span = () => makeSpan(spanValue, spanLength)
  const data = () =>
    serializeBytes(payloadBytes, new Uint8Array(paddingChunkLength)) as ValidChunkData
  const inclusionProof = (segmentIndex: number) => inclusionProofBottomUp(data(), segmentIndex)
  const address = () => chunkAddress(payloadBytes, spanLength, span())
  const bmtFn = () => bmt(data())

  return {
    payload: payloadBytes,
    spanLength,
    maxPayloadLength,
    data,
    span,
    address,
    inclusionProof,
    bmt: bmtFn,
  }
}

/**
 * Creates object for performing BMT functions on payload data
 *
 * @param payload byte array of the data
 * @param options settings for the used chunks
 * @returns ChunkedFile object with helper methods
 */
export function makeChunkedFile<
  MaxChunkPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
>(
  payload: Uint8Array,
  options?: {
    maxPayloadLength?: MaxChunkPayloadLength
    spanLength?: SpanLength
  },
): ChunkedFile<MaxChunkPayloadLength, SpanLength> {
  const maxPayloadLength = (options?.maxPayloadLength ||
    MAX_CHUNK_PAYLOAD_SIZE) as MaxChunkPayloadLength
  const spanLength = (options?.spanLength || SPAN_SIZE) as SpanLength

  //splitter
  const leafChunks = () => {
    const chunks: Chunk<MaxChunkPayloadLength, SpanLength>[] = []
    if (payload.length === 0) {
      chunks.push(makeChunk(new Uint8Array(), options))
    } else {
      for (let offset = 0; offset < payload.length; offset += maxPayloadLength) {
        chunks.push(makeChunk(payload.slice(offset, offset + maxPayloadLength), options))
      }
    }

    return chunks
  }
  const span = () => makeSpan(payload.length, spanLength)
  const address = () => bmtRootChunk(leafChunks()).address()
  const rootChunk = () => bmtRootChunk(leafChunks())
  const bmtFn = () =>
    bmt(leafChunks() as unknown as Uint8Array) as unknown as Chunk<
      MaxChunkPayloadLength,
      SpanLength
    >[][]

  return {
    payload,
    span,
    leafChunks,
    address,
    rootChunk,
    bmt: bmtFn,
  }
}

export function bmtRootHash(
  payload: Uint8Array,
  maxPayloadLength: number = MAX_PAYLOAD_SIZE, // default 4096
): Uint8Array {
  if (payload.length > maxPayloadLength) {
    throw new Error(`invalid data length ${payload.length}`)
  }
  // create an input buffer padded with zeros
  let input = new Uint8Array([...payload, ...new Uint8Array(maxPayloadLength - payload.length)])
  while (input.length !== HASH_SIZE) {
    const output = new Uint8Array(input.length / 2)

    // in each round we hash the segment pairs together
    for (let offset = 0; offset < input.length; offset += SEGMENT_PAIR_SIZE) {
      const hashNumbers = keccak256Hash(input.slice(offset, offset + SEGMENT_PAIR_SIZE))
      output.set(hashNumbers, offset / 2)
    }

    input = output
  }

  return input
}

/**
 * Gives back required segments for inclusion proof of a given payload byte index
 *
 * @param payloadBytes chunk data initialised in Uint8Array object
 * @param segmentIndex segment index in the data array that has to be proofed for inclusion
 * @param options function configuraiton
 * @returns Required segments for inclusion proof starting from the data level
 * until the BMT root hash of the payload
 */
export function inclusionProofBottomUp(
  payloadBytes: Uint8Array,
  segmentIndex: number,
): Uint8Array[] {
  if (segmentIndex * SEGMENT_SIZE >= payloadBytes.length) {
    throw new Error(
      `The given segment index ${segmentIndex} is greater than ${Math.floor(
        payloadBytes.length / SEGMENT_SIZE,
      )}`,
    )
  }

  const tree = bmt(payloadBytes)
  const sisterSegments: Array<Uint8Array> = []
  const rootHashLevel = tree.length - 1
  for (let level = 0; level < rootHashLevel; level++) {
    const mergeCoefficient = segmentIndex % 2 === 0 ? 1 : -1
    const sisterSegmentIndex = segmentIndex + mergeCoefficient
    const sisterSegment =
      tree[level]?.slice(
        sisterSegmentIndex * SEGMENT_SIZE,
        (sisterSegmentIndex + 1) * SEGMENT_SIZE,
      ) ?? new Uint8Array(0)
    sisterSegments.push(sisterSegment)
    //segmentIndex for the next iteration
    segmentIndex >>>= 1
  }

  return sisterSegments
}

/** Calculates the BMT root hash from the provided inclusion proof segments and its corresponding segment index */
export function rootHashFromInclusionProof(
  proofSegments: Uint8Array[],
  proveSegment: Uint8Array,
  proveSegmentIndex: number,
): Uint8Array {
  let calculatedHash = proveSegment
  for (const proofSegment of proofSegments) {
    const mergeSegmentFromRight = proveSegmentIndex % 2 === 0
    calculatedHash = mergeSegmentFromRight
      ? keccak256Hash(calculatedHash, proofSegment)
      : keccak256Hash(proofSegment, calculatedHash)
    proveSegmentIndex >>>= 1
  }

  return calculatedHash
}

/**
 * Gives back all level of the bmt of the payload
 *
 * @param payload any data in Uint8Array object
 * @returns array of the whole bmt hash level of the given data.
 * First level is the data itself until the last level that is the root hash itself.
 */
function bmt(payload: Uint8Array): Uint8Array[] {
  if (payload.length > MAX_PAYLOAD_SIZE) {
    throw new Error(`invalid data length ${payload.length}`)
  }

  // create an input buffer padded with zeros
  let input = new Uint8Array([...payload, ...new Uint8Array(MAX_PAYLOAD_SIZE - payload.length)])
  const tree: Uint8Array[] = []
  while (input.length !== HASH_SIZE) {
    tree.push(input)
    const output = new Uint8Array(input.length / 2)

    // in each round we hash the segment pairs together
    for (let offset = 0; offset < input.length; offset += SEGMENT_PAIR_SIZE) {
      const hashNumbers = keccak256Hash(input.slice(offset, offset + SEGMENT_PAIR_SIZE))
      output.set(hashNumbers, offset / 2)
    }

    input = output
  }
  //add the last "input" that is the bmt root hash of the application
  tree.push(input)

  return tree
}

/**
 * Calculate the chunk address from the Binary Merkle Tree of the chunk data
 *
 * The BMT chunk address is the hash of the 8 byte span and the root
 * hash of a binary Merkle tree (BMT) built on the 32-byte segments
 * of the underlying data.
 *
 * If the chunk content is less than 4k, the hash is calculated as
 * if the chunk was padded with all zeros up to 4096 bytes.
 *
 * @param payload Chunk data Uint8Array
 * @param spanLength dedicated byte length for serializing span value of chunk
 * @param chunkSpan constucted Span uint8array object of the chunk
 * @param options function configurations
 *
 * @returns the Chunk address in a byte array
 */
function chunkAddress<SpanLength extends number = typeof SPAN_SIZE>(
  payload: Uint8Array,
  spanLength?: SpanLength,
  chunkSpan?: Span<SpanLength>,
): ChunkAddress {
  const span = chunkSpan || makeSpan(payload.length, spanLength)
  const rootHash = bmtRootHash(payload, MAX_PAYLOAD_SIZE)
  const chunkHashInput = new Uint8Array([...span, ...rootHash])
  const chunkHash = keccak256Hash(chunkHashInput)

  return chunkHash
}

function isFlexBytes<Min extends number, Max extends number = Min>(
  b: unknown,
  min: Min,
  max: Max,
): b is FlexBytes<Min, Max> {
  return b instanceof Uint8Array && b.length >= min && b.length <= max
}

/**
 * Verifies if a byte array has a certain length between min and max
 *
 * @param b       The byte array
 * @param min     Minimum size of the array
 * @param max     Maximum size of the array
 */
function assertFlexBytes<Min extends number, Max extends number = Min>(
  b: unknown,
  min: Min,
  max: Max,
): asserts b is FlexBytes<Min, Max> {
  if (!isFlexBytes(b, min, max)) {
    throw new TypeError(
      `Parameter is not valid FlexBytes of  min: ${min}, max: ${max}, length: ${(b as Uint8Array).length}`,
    )
  }
}

function bmtRootChunk<
  MaxChunkPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
>(chunks: Chunk<MaxChunkPayloadLength, SpanLength>[]): Chunk<MaxChunkPayloadLength, SpanLength> {
  if (chunks.length === 0) {
    throw new Error(`given chunk array is empty`)
  }

  // zero level assign
  let levelChunks = chunks
  let carrierChunk = popCarrierChunk(levelChunks)

  while (levelChunks.length !== 1 || carrierChunk) {
    const { nextLevelChunks, nextLevelCarrierChunk } = nextBmtLevel(levelChunks, carrierChunk)
    levelChunks = nextLevelChunks
    carrierChunk = nextLevelCarrierChunk
  }

  // oxlint-disable-next-line typescript/no-non-null-assertion
  return levelChunks[0]!
}

function nextBmtLevel<
  MaxChunkPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
>(
  chunks: Chunk<MaxChunkPayloadLength, SpanLength>[],
  carrierChunk: Chunk<MaxChunkPayloadLength, SpanLength> | null,
): {
  nextLevelChunks: Chunk<MaxChunkPayloadLength, SpanLength>[]
  nextLevelCarrierChunk: Chunk<MaxChunkPayloadLength, SpanLength> | null
} {
  if (chunks.length === 0) {
    throw new Error("The given chunk array is empty")
  }
  // oxlint-disable-next-line typescript/no-non-null-assertion
  const maxPayloadLength = chunks[0]!.maxPayloadLength
  // oxlint-disable-next-line typescript/no-non-null-assertion
  const spanLength = chunks[0]!.spanLength
  // max segment count in one chunk. the segment size have to be equal to the chunk addresses
  const maxSegmentCount = maxPayloadLength / SEGMENT_SIZE //128 by default
  const nextLevelChunks: Chunk<MaxChunkPayloadLength, SpanLength>[] = []

  for (let offset = 0; offset < chunks.length; offset += maxSegmentCount) {
    const childrenChunks = chunks.slice(offset, offset + maxSegmentCount)
    nextLevelChunks.push(createIntermediateChunk(childrenChunks, spanLength, maxPayloadLength))
  }

  //edge case handling when there is carrierChunk
  let nextLevelCarrierChunk = carrierChunk

  if (carrierChunk) {
    // try to merge carrier chunk if it first to its parents payload
    if (nextLevelChunks.length % maxSegmentCount !== 0) {
      nextLevelChunks.push(carrierChunk)
      nextLevelCarrierChunk = null //merged
    } // or nextLevelCarrierChunk remains carrierChunk
  } else {
    // try to pop carrier chunk if it exists on the level
    nextLevelCarrierChunk = popCarrierChunk(nextLevelChunks)
  }

  return {
    nextLevelChunks,
    nextLevelCarrierChunk,
  }
}

/**
 * Removes carrier chunk of a the given chunk array and gives it back
 *
 * @returns carrier chunk or undefined
 */
function popCarrierChunk<
  MaxChunkPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
>(
  chunks: Chunk<MaxChunkPayloadLength, SpanLength>[],
): Chunk<MaxChunkPayloadLength, SpanLength> | null {
  // chunks array has to be larger than 1 (a carrier count)
  if (chunks.length <= 1) return null
  // oxlint-disable-next-line typescript/no-non-null-assertion
  const maxDataLength = chunks[0]!.maxPayloadLength
  // max segment count in one chunk. the segment size have to be equal to the chunk addresses
  const maxSegmentCount = maxDataLength / SEGMENT_SIZE

  return chunks.length % maxSegmentCount === 1 ? chunks.pop() || null : null
}

function createIntermediateChunk<
  MaxChunkPayloadLength extends number = typeof MAX_CHUNK_PAYLOAD_SIZE,
  SpanLength extends number = typeof SPAN_SIZE,
>(
  childrenChunks: Chunk<MaxChunkPayloadLength, SpanLength>[],
  spanLength: SpanLength,
  maxPayloadSize: MaxChunkPayloadLength,
) {
  const chunkAddresses = childrenChunks.map((chunk) => chunk.address())
  const chunkSpanSumValues = childrenChunks
    .map((chunk) => getSpanValue(chunk.span()))
    .reduce((prev, curr) => prev + curr)
  const nextLevelChunkBytes = serializeBytes(...chunkAddresses)

  return makeChunk(nextLevelChunkBytes, {
    spanLength,
    startingSpanValue: chunkSpanSumValues,
    maxPayloadSize,
  })
}
