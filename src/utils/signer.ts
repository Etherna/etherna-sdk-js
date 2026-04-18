import { bytesToHex } from "@noble/hashes/utils.js"
import { getPublicKey, hashes, Point, recoverPublicKey, signAsync } from "@noble/secp256k1"

import { signMessage } from "./ethereum"
import { hexToBytes, keccak256Hash, makeHexString } from "./hex"

import type { EthAddress } from "@/types/eth"
import type { Signer } from "@/types/signer"

const UNCOMPRESSED_RECOVERY_ID = 27

let nobleHashesWiredForNode: Promise<void> | undefined

async function ensureNobleHashesForNodeSigner(): Promise<void> {
  if (typeof window !== "undefined") {
    return
  }
  nobleHashesWiredForNode ??= (async () => {
    const [{ hmac }, { sha256 }] = await Promise.all([
      import("@noble/hashes/hmac.js"),
      import("@noble/hashes/sha2.js"),
    ])
    hashes.sha256 = sha256
    hashes.hmacSha256 = (key, msg) => hmac(sha256, key, msg)
    hashes.hmacSha256Async = (key, msg) => Promise.resolve(hmac(sha256, key, msg))
  })()
  await nobleHashesWiredForNode
}

/**
 * Creates a singer object that can be used when the private key is known.
 *
 * @param privateKey The private key
 */
export function makePrivateKeySigner(privateKey: string): Signer {
  const privBytes = hexToBytes(makeHexString(privateKey))
  const pubKey = getPublicKey(privBytes, false)
  const address = publicKeyToAddress(pubKey)

  return {
    sign: (digest) => defaultSign(digest, privBytes),
    address,
  }
}

export function makeInjectedWalletSigner(address: EthAddress): Signer {
  return {
    address,
    sign: async (digest) => {
      try {
        return await signMessage(digest, address)
      } catch (err) {
        const error = err as { code: number; message: string }
        if (error.code === -32602) {
          return await signMessage(digest, address)
        } else {
          throw new Error()
        }
      }
    },
  }
}

/**
 * The default signer function that can be used for integrating with
 * other applications (e.g. wallets).
 *
 * @param data The data to be signed
 * @param privateKey  The private key used for signing the data
 */
export async function defaultSign(
  data: Uint8Array | string,
  privateKey: Uint8Array,
): Promise<string> {
  await ensureNobleHashesForNodeSigner()

  const hashedDigest = hashWithEthereumPrefix(
    typeof data === "string" ? new TextEncoder().encode(data) : data,
  )
  const sigBytes = await signAsync(hashedDigest, privateKey, { prehash: false, format: "recovered" })
  const recovery = sigBytes[0] ?? 0
  const compact = sigBytes.subarray(1, 65)
  const signature = new Uint8Array(65)
  signature.set(compact, 0)
  signature[64] = recovery + UNCOMPRESSED_RECOVERY_ID

  return bytesToHex(signature)
}

/**
 * Recovers the ethereum address from a given signature.
 *
 * Can be used for verifying a piece of data when the public key is
 * known.
 *
 * @param signature The signature
 * @param digest The digest of the data
 *
 * @returns the recovered address
 */
export function recoverAddress(signature: Uint8Array, digest: Uint8Array): Uint8Array {
  const recoveryParam = (signature[64] ?? 0) - UNCOMPRESSED_RECOVERY_ID
  const hash = hashWithEthereumPrefix(digest)
  const recSig = new Uint8Array(65)
  recSig[0] = recoveryParam
  recSig.set(signature.subarray(0, 32), 1)
  recSig.set(signature.subarray(32, 64), 33)
  const pubCompressed = recoverPublicKey(recSig, hash, { prehash: false })
  const pubKey = Point.fromBytes(pubCompressed).toBytes(false)
  const address = makeHexString(publicKeyToAddress(pubKey))

  return hexToBytes(address)
}

function publicKeyToAddress(pubKey: Uint8Array): EthAddress {
  const addressBytes = keccak256Hash(pubKey.slice(1)).slice(12)
  const address = bytesToHex(addressBytes).replace(/^0x/, "")
  return `0x${address}`
}

function hashWithEthereumPrefix(data: Uint8Array): Uint8Array {
  const ethereumSignedMessagePrefix = `\x19Ethereum Signed Message:\n${data.length}`
  const prefixBytes = new TextEncoder().encode(ethereumSignedMessagePrefix)

  return keccak256Hash(prefixBytes, data)
}
