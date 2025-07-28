import { makeBytes } from "./bytes"

import type { Bytes } from "@/types/utils"

/**
 * Convert bytes data to a number in big endian format.
 *
 * @param bytes The bytes data
 * @returns The number
 */
export function fromBigEndian(bytes: Uint8Array): number {
  if (bytes.length === 0) throw new Error("fromBigEndian got 0 length bytes")
  const numbers: number[] = []
  const lastIndex = bytes.length - 1

  for (let i = 0; i < bytes.length; i++) {
    numbers.push((bytes[lastIndex - i] as number) << (8 * i))
  }

  return numbers.reduce((bigEndian, num) => (bigEndian |= num)) >>> 0
}

/**
 * Convert a uint16 integer to a big endian bytes.
 *
 * @param value The uint16 integer
 * @returns The big endian bytes
 */
export function toBigEndianFromUint16(value: number): Bytes<2> {
  if (value < 0) throw new Error(`toBigEndianFromUint16 got lesser than 0 value: ${value}`)
  const maxValue = (1 << 16) - 1
  if (value > maxValue)
    throw new Error(`toBigEndianFromUint16 got greater value then ${maxValue}: ${value} `)

  const buffer = new ArrayBuffer(2)
  const view = new DataView(buffer)
  view.setUint16(0, value, false)
  return new Uint8Array(buffer) as Bytes<2>
}

/**
 * Convert a uint32 integer to a big endian bytes.
 *
 * @param value The uint32 integer
 * @returns The big endian bytes
 */
export function toBigEndianFromUint32(value: number): Bytes<4> {
  if (value < 0) throw new Error(`toBigEndianFromUint32 got lesser than 0 value: ${value}`)

  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, value, false)
  return new Uint8Array(buffer) as Bytes<4>
}

/**
 * Convert a uint64 integer to a big endian bytes.
 *
 * @param value The uint64 integer
 * @returns The big endian bytes
 */
export function toBigEndianFromBigInt64(value: bigint): Bytes<8> {
  if (value < 0) throw new Error(`toBigEndianFromBigInt64 got lesser than 0 value: ${value}`)

  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setBigUint64(0, value, false)
  return new Uint8Array(buffer) as Bytes<8>
}

/**
 * Convert a uint64 integer to a little endian bytes.
 *
 * @param value The uint64 integer
 * @param bytes The bytes to write to
 * @returns The little endian bytes
 *
 * TODO: handle bigger values than 32 bit
 * For now it's good enough because we only use these functions
 * sequential feed indexes.
 */
export function writeUint64LittleEndian(
  value: number,
  bytes: Uint8Array = makeBytes(8),
): Uint8Array {
  const dataView = new DataView(bytes.buffer)
  const valueLower32 = value & 0xffffffff
  const littleEndian = true

  dataView.setUint32(0, valueLower32, littleEndian)
  dataView.setUint32(4, 0, littleEndian)

  return bytes
}

/**
 * Convert a uint64 integer to a big endian bytes.
 *
 * @param value The uint64 integer
 * @param bytes The bytes to write to
 * @returns The big endian bytes
 */
export function writeUint64BigEndian(value: number, bytes: Uint8Array = makeBytes(8)): Uint8Array {
  const dataView = new DataView(bytes.buffer)
  const valueLower32 = value & 0xffffffff

  dataView.setUint32(0, 0)
  dataView.setUint32(4, valueLower32)

  return bytes
}

/**
 * Read a uint64 integer from a big endian bytes.
 *
 * @param bytes The big endian bytes
 * @returns The uint64 integer
 */
export function readUint64BigEndian(bytes: Uint8Array): number {
  const dataView = new DataView(bytes.buffer)

  return dataView.getUint32(4)
}
