import { bytesToHex } from "@noble/hashes/utils"
import { etc, getPublicKey, signAsync, Signature } from "@noble/secp256k1"

import { signMessage } from "./ethereum"
import { hexToBytes, keccak256Hash, makeHexString } from "./hex"

import type { EthAddress } from "@/types/eth"
import type { Signer } from "@/types/signer"

const UNCOMPRESSED_RECOVERY_ID = 27

/**
 * Creates a singer object that can be used when the private key is known.
 *
 * @param privateKey The private key
 */
export function makePrivateKeySigner(privateKey: string): Signer {
  const pubKey = getPublicKey(privateKey, false)
  const address = publicKeyToAddress(pubKey)

  return {
    sign: (digest) => defaultSign(digest, hexToBytes(privateKey)),
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
          throw error
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
  // fix nodejs crypto
  if (typeof window === "undefined") {
    const hmac = await import("@noble/hashes/hmac").then((mod) => mod.hmac)
    const sha256 = await import("@noble/hashes/sha256").then((mod) => mod.sha256)

    const hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) =>
      hmac(sha256, k, etc.concatBytes(...m))

    etc.hmacSha256Sync = hmacSha256Sync
    etc.hmacSha256Async = (k, ...m) => Promise.resolve(hmacSha256Sync(k, ...m))
  }

  const hashedDigest = hashWithEthereumPrefix(
    typeof data === "string" ? new TextEncoder().encode(data) : data,
  )
  const sig = await signAsync(hashedDigest, privateKey, {})
  const rawSig = sig.toCompactRawBytes()

  const signature = new Uint8Array([...rawSig, sig.recovery + UNCOMPRESSED_RECOVERY_ID])

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
  const r = etc.bytesToNumberBE(signature.slice(0, 32))
  const s = etc.bytesToNumberBE(signature.slice(32, 64))
  const sign = new Signature(r, s, recoveryParam)
  const recPubKey = sign.recoverPublicKey(hash)
  const address = makeHexString(publicKeyToAddress(recPubKey.toRawBytes(false)))

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
