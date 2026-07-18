import { keccak_256 as keccak256 } from "@noble/hashes/sha3.js"
import { bytesToHex, hexToBytes, type TArg } from "@noble/hashes/utils.js"

import type { EthAddress } from "@/types/eth"
import type { Bytes } from "@/types/utils"

export { bytesToHex, hexToBytes }

export type Keccak256Message = string | number[] | ArrayBuffer | Uint8Array

function keccak256MessageToBytes(message: Keccak256Message): TArg<Uint8Array> {
  if (typeof message === "string") {
    const utf8 = new TextEncoder()
    return utf8.encode(message)
  }
  if (message instanceof ArrayBuffer) {
    return new Uint8Array(message)
  }
  if (Array.isArray(message)) {
    return Uint8Array.from(message)
  }
  return message
}

export function keccak256Hash(...messages: Keccak256Message[]): Bytes<32> {
  const h = keccak256.create()
  for (const m of messages) {
    h.update(keccak256MessageToBytes(m))
  }
  return h.digest() as Bytes<32>
}

export function fromHexString(hexString: string): Uint8Array {
  const matches = hexString.match(/.{1,2}/g)
  if (!matches) {
    throw new Error(`Invalid hex string: ${hexString}`)
  }
  return Uint8Array.from(matches.map((byte) => parseInt(byte, 16)))
}

export function toHexString(bytes: Uint8Array): string {
  return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
}

/**
 * Creates unprefixed hex string from wide range of data.
 *
 * @param input
 */
export function makeHexString(input: (string & {}) | number | Uint8Array | EthAddress): string {
  if (typeof input === "number") {
    return input.toString(16)
  }

  if (input instanceof Uint8Array) {
    return bytesToHex(input)
  }

  if (typeof input === "string") {
    return input.replace(/^0x/, "")
  }

  throw new TypeError("Not HexString compatible type!")
}
