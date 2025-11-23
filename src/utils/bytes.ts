import type { Bytes } from "@/types/utils"

/**
 * Verify if passed data are Bytes and if the array has "length" number of bytes under given offset.
 *
 * @param data
 * @param offset
 * @param length
 */
export function hasBytesAtOffset(data: unknown, offset: number, length: number): boolean {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError("Data has to an Uint8Array!")
  }

  const offsetBytes = data.slice(offset, offset + length)
  return offsetBytes.length === length
}

/**
 * Finds starting index `searchFor` in `element` Uin8Arrays
 *
 * If `searchFor` is not found in `element` it returns -1
 *
 * @param element
 * @param searchFor
 * @returns starting index of `searchFor` in `element`
 */
export function findIndexOfArray(element: Uint8Array, searchFor: Uint8Array): number {
  for (let i = 0; i <= element.length - searchFor.length; i++) {
    let j = 0
    while (j < searchFor.length) {
      if (element[i + j] !== searchFor[j++]) break
    }

    if (j === searchFor.length) return i
  }

  return -1
}

/**
 * It returns the common bytes of the two given byte arrays until the first byte difference
 *
 * @param a
 * @param b
 * @returns
 */
export function commonBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  let c = new Uint8Array(0)

  for (let i = 0; i < a.length && i < b.length && a[i] === b[i]; i++) {
    c = new Uint8Array([...c, a[i] as number])
  }

  return c
}

/**
 * Returns a new byte array filled with zeroes with the specified length
 *
 * @param length The length of data to be returned
 */
export function makeBytes(length: number): Uint8Array {
  return new Uint8Array(length)
}

/**
 * Helper function for serialize byte arrays
 *
 * @param arrays Any number of byte array arguments
 */
export function serializeBytes(...arrays: Uint8Array[]): Uint8Array {
  const length = arrays.reduce((prev, curr) => prev + curr.length, 0)
  const buffer = new Uint8Array(length)
  let offset = 0
  arrays.forEach((arr) => {
    buffer.set(arr, offset)
    offset += arr.length
  })

  return buffer
}

/**
 * Returns true if two byte arrays are equal
 *
 * @param a Byte array to compare
 * @param b Byte array to compare
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/**
 * Overwrites `a` bytearrays elements with elements of `b` starts from `i`
 *
 * @param a Byte array to overwrite
 * @param b Byte array to copy
 * @param i Start index
 */
export function overwriteBytes(a: Uint8Array, b: Uint8Array, i = 0): void {
  if (a.length < b.length + i) {
    throw new Error(
      `Cannot copy bytes because the base byte array length is lesser (${a.length}) than the others (${b.length})`,
    )
  }

  for (let index = 0; index < b.length; index++) {
    const byte = b[index]
    if (byte !== undefined) {
      a[index + i] = byte
    }
  }
}

/**
 * Flattens the given array that consist of Uint8Arrays.
 */
export function flattenBytesArray(bytesArray: Uint8Array[]): Uint8Array {
  if (bytesArray.length === 0) return new Uint8Array(0)

  const bytesLength = bytesArray.map((v) => v.length).reduce((sum, v) => (sum += v))
  const flattenBytes = new Uint8Array(bytesLength)
  let nextWriteIndex = 0
  for (const b of bytesArray) {
    overwriteBytes(flattenBytes, b, nextWriteIndex)
    nextWriteIndex += b.length
  }

  return flattenBytes
}

/**
 * Checks if the given bytes array has the specified length.
 *
 * @param bytes The bytes array to check
 * @param length The expected length of the bytes array
 */
export function checkBytes<Length extends number>(
  bytes: unknown,
  length: number,
): asserts bytes is Bytes<Length> {
  if (!(bytes instanceof Uint8Array))
    throw new Error("Cannot set given bytes, because is not an Uint8Array type")

  if (bytes.length !== 32) {
    throw new Error(
      `Cannot set given bytes, because it does not have ${length} length. Got ${bytes.length}`,
    )
  }
}
