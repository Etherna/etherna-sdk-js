// Forked from: https://github.com/ethersphere/bee

import { etc } from "@noble/secp256k1"

import { extractUploadHeaders, makeContentAddressedChunk } from "./utils"
import { EthernaSdkError, throwSdkError } from "@/classes"
import {
  IDENTIFIER_SIZE,
  SIGNATURE_SIZE,
  SOC_IDENTIFIER_OFFSET,
  SOC_PAYLOAD_OFFSET,
  SOC_SIGNATURE_OFFSET,
  SOC_SPAN_OFFSET,
  SPAN_SIZE,
} from "@/consts"
import {
  bmtHash,
  bytesEqual,
  bytesToHex,
  hexToBytes,
  keccak256Hash,
  makeHexString,
  recoverAddress,
  serializeBytes,
} from "@/utils"

import type { BeeClient } from "."
import type {
  ContentAddressedChunk,
  ReferenceResponse,
  RequestUploadOptions,
  SingleOwnerChunk,
} from "./types"
import type { RequestOptions } from "@/types/clients"
import type { EthAddress } from "@/types/eth"

const socEndpoint = "/soc"

export class Soc {
  constructor(private instance: BeeClient) {}

  async download(identifier: Uint8Array, ownerAddress: EthAddress, options?: RequestOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const addressBytes = hexToBytes(makeHexString(ownerAddress))
      const address = this.makeSOCAddress(identifier, addressBytes)
      const data = await this.instance.chunk.download(bytesToHex(address), options)

      return this.makeSingleOwnerChunkFromData(data, address)
    } catch (error) {
      throwSdkError(error)
    }
  }

  async upload(identifier: Uint8Array, data: Uint8Array, options: RequestUploadOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const cac = makeContentAddressedChunk(data)
      const soc = await this.makeSingleOwnerChunk(cac, identifier)

      const owner = bytesToHex(soc.owner())
      const signature = bytesToHex(soc.signature())
      const payload = serializeBytes(soc.span(), soc.payload())
      const hexIdentifier = bytesToHex(identifier)

      const resp = await this.instance.request.post<ReferenceResponse>(
        `${socEndpoint}/${owner}/${hexIdentifier}`,
        payload,
        {
          params: { sig: signature },
          ...this.instance.prepareAxiosConfig({
            ...options,
            headers: {
              ...options.headers,
              "Content-Type": "application/octet-stream",
              ...extractUploadHeaders(options),
            },
          }),
        },
      )

      return {
        reference: resp.data.reference,
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  // Utils

  /**
   * Creates a single owner chunk object
   *
   * @param chunk       A chunk object used for the span and payload
   * @param identifier  The identifier of the chunk
   */
  async makeSingleOwnerChunk(
    chunk: ContentAddressedChunk,
    identifier: Uint8Array,
  ): Promise<SingleOwnerChunk> {
    if (!this.instance.signer) {
      throw new EthernaSdkError("MISSING_SIGNER", "No signer provided")
    }

    const chunkAddress = chunk.address()

    const digest = keccak256Hash(identifier, chunkAddress)
    const signature = etc.hexToBytes(makeHexString(await this.instance.signer.sign(digest)))
    const data = serializeBytes(identifier, signature, chunk.span(), chunk.payload())
    const signerAddress = etc.hexToBytes(makeHexString(this.instance.signer.address))
    const address = this.makeSOCAddress(identifier, signerAddress)

    return {
      data,
      identifier: () => identifier,
      signature: () => signature,
      span: () => chunk.span(),
      payload: () => chunk.payload(),
      address: () => address,
      owner: () => signerAddress,
    }
  }

  private makeSOCAddress(identifier: Uint8Array, address: Uint8Array) {
    return keccak256Hash(identifier, address)
  }

  private makeSingleOwnerChunkFromData(data: Uint8Array, address: Uint8Array): SingleOwnerChunk {
    const ownerAddress = this.recoverChunkOwner(data)
    const identifier = data.slice(SOC_IDENTIFIER_OFFSET, SOC_IDENTIFIER_OFFSET + IDENTIFIER_SIZE)
    const socAddress = keccak256Hash(identifier, ownerAddress)

    if (!bytesEqual(address, socAddress)) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "SOC Data does not match given address!")
    }

    const signature = () => data.slice(SOC_SIGNATURE_OFFSET, SOC_SIGNATURE_OFFSET + SIGNATURE_SIZE)
    const span = () => data.slice(SOC_SPAN_OFFSET, SOC_SPAN_OFFSET + SPAN_SIZE)
    const payload = () => data.slice(SOC_PAYLOAD_OFFSET)

    return {
      data,
      identifier: () => identifier,
      signature,
      span,
      payload,
      address: () => socAddress,
      owner: () => ownerAddress,
    }
  }

  private recoverChunkOwner(data: Uint8Array): Uint8Array {
    const cacData = data.slice(SOC_SPAN_OFFSET)
    const chunkAddress = bmtHash(cacData)
    const signature = data.slice(SOC_SIGNATURE_OFFSET, SOC_SIGNATURE_OFFSET + SIGNATURE_SIZE)
    const identifier = data.slice(SOC_IDENTIFIER_OFFSET, SOC_IDENTIFIER_OFFSET + IDENTIFIER_SIZE)
    const digest = keccak256Hash(identifier, chunkAddress)
    const ownerAddress = recoverAddress(signature, digest)

    return ownerAddress
  }
}
