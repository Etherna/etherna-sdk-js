import { etc } from "@noble/secp256k1"
import { keccak256 } from "js-sha3"

import type { EthAddress } from "@/types/eth"
import type { Bytes } from "@/types/utils"
import type { Message } from "js-sha3"

const { bytesToHex, hexToBytes } = etc

export { bytesToHex, hexToBytes }

export function keccak256Hash(...messages: Message[]): Bytes<32> {
  const hasher = keccak256.create()

  messages.forEach((bytes) => hasher.update(bytes))

  return Uint8Array.from(hasher.digest()) as Bytes<32>
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
export function makeHexString(input: string | number | Uint8Array | EthAddress): string {
  if (typeof input === "number") {
    return input.toString(16)
  }

  if (input instanceof Uint8Array) {
    return etc.bytesToHex(input)
  }

  if (typeof input === "string") {
    return input.replace(/^0x/, "")
  }

  throw new TypeError("Not HexString compatible type!")
}
