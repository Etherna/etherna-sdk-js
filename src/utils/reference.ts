import { etc } from "@noble/secp256k1"

import { fromHexString, makeHexString, toHexString } from "./hex"
import { EthernaSdkError } from "@/classes"

import type { BytesReference, Reference } from "@/types/swarm"
import type { ChunkAddress } from "@fairdatasociety/bmt-js"

/**
 * Check if the given string is a valid swarm reference
 *
 * @param reference The reference to check
 * @returns True if the reference is valid
 */
export function isValidReference(reference: string): reference is Reference {
  return /^[0-9a-f]{64}$/.test(reference)
}

/**
 * Check if the given reference is an empty reference
 *
 * @param ref The reference to check
 * @returns True if the reference is empty
 */
export function isEmptyReference(ref: Reference): boolean {
  return Array.from(ref).every((char) => char === "0")
}

/**
 * Check if the given reference is an invalid reference
 *
 * @param ref The reference to check
 * @returns True if the reference is invalid
 */
export function isInvalidReference(ref: string): boolean {
  return !isValidReference(ref) || isEmptyReference(ref as Reference)
}

/**
 * Check if the given bytes reference are valid
 *
 * @param ref The bytes reference to check
 * @returns True if the reference is valid
 */
export function checkBytesReference(ref: BytesReference): void | never {
  if (!(ref instanceof Uint8Array)) {
    throw new EthernaSdkError("INVALID_ARGUMENT", "Given referennce is not an Uint8Array instance.")
  }

  if (ref.length !== 32 && ref.length !== 64) {
    throw new EthernaSdkError(
      "INVALID_ARGUMENT",
      `Wrong reference length. Entry only can be 32 or 64 length in bytes`,
    )
  }
}

/**
 * Convert a reference to a bytes reference
 *
 * @param ref The reference
 * @returns The bytes reference
 */
export function referenceToBytesReference(ref: Reference): BytesReference {
  return fromHexString(ref) as BytesReference
}

/**
 * Convert a bytes reference to a reference
 *
 * @param ref The bytes reference
 * @returns The reference
 */
export function bytesReferenceToReference(ref: BytesReference | ChunkAddress): Reference {
  return toHexString(ref) as Reference
}

/**
 * Make a bytes reference from a reference
 *
 * @param reference The reference
 * @returns The bytes reference
 */
export function makeBytesReference(reference: string): Uint8Array {
  const hexReference = makeHexString(reference)
  return etc.hexToBytes(hexReference)
}

/**
 * Parse a swarm url and return the reference
 *
 * @param bzzUrl The swarm url
 * @returns The reference
 */
export function getReferenceFromUrl(bzzUrl: string): Reference {
  if (isValidReference(bzzUrl)) return bzzUrl

  const reference = bzzUrl.match(/\/bzz\/([A-Fa-f0-9]{64})/)?.[1]

  if (!reference) {
    throw new EthernaSdkError("INVALID_ARGUMENT", `Invalid bzz URL: ${bzzUrl}`)
  }

  return reference as Reference
}
