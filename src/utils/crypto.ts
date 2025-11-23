import { AES, enc } from "crypto-ts"

import { bytesEqual } from "./bytes"
import { EthernaSdkError } from "@/classes"

/**
 * Encrypts the given data using the provided password.
 *
 * @param data The data to be encrypted.
 * @param password The password used for encryption.
 * @returns The encrypted data as a string.
 */
export function encryptData(data: string, password: string): string {
  try {
    const encryptedData = AES.encrypt(data, password)
    return encryptedData.toString()
  } catch (error) {
    throw new EthernaSdkError("ENCRYPTION_ERROR", `Encryption error: ${(error as Error).message}`)
  }
}

/**
 * Decrypts the given data using the provided password.
 *
 * @param data The data to be decrypted.
 * @param password The password used for decryption.
 * @returns The decrypted data as a string.
 */
export function decryptData(data: string, password: string): string {
  try {
    const decryptedData = AES.decrypt(data, password).toString(enc.Utf8)
    return decryptedData
  } catch (error) {
    throw new EthernaSdkError(
      "DECRYPTION_ERROR",
      "Cannot unlock playlist. Make sure the password is correct.",
    )
  }
}

/**
 *
 * runs a XOR operation on data, encrypting it if it
 * hasn't already been, and decrypting it if it has, using the key provided.
 *
 * @param key
 * @param data
 * @param startIndex
 * @param endIndex
 * @returns
 */
export function encryptDecrypt(
  key: Uint8Array,
  data: Uint8Array,
  startIndex = 0,
  endIndex?: number,
): void {
  // FIXME: in Bee
  if (bytesEqual(key, new Uint8Array(32))) return

  endIndex ||= data.length

  for (let i = startIndex; i < endIndex; i += key.length) {
    const maxChunkIndex = i + key.length
    const encryptionChunkEndIndex = maxChunkIndex <= data.length ? maxChunkIndex : data.length
    const encryptionChunk = data.slice(i, encryptionChunkEndIndex)
    for (let j = 0; j < encryptionChunk.length; j++) {
      encryptionChunk[j] = Number(encryptionChunk[j]) ^ Number(key[j % key.length])
    }
    data.set(encryptionChunk, i)
  }
}
