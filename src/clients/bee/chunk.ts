// Forked from: https://github.com/ethersphere/bee

import { extractUploadHeaders, wrapBytesWithHelpers } from "./utils"
import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { ReferenceResponse, RequestUploadOptions } from "./types"
import type { RequestOptions } from "@/types/clients"
import type { Chunk as SwarmChunk } from "@fairdatasociety/bmt-js"

const chunkEndpoint = "/chunks"

export class Chunk {
  constructor(private instance: BeeClient) {}

  async download(hash: string, options?: RequestOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const resp = await this.instance.request.get<ArrayBuffer>(`${chunkEndpoint}/${hash}`, {
        responseType: "arraybuffer",
        ...this.instance.prepareAxiosConfig(options),
      })

      return wrapBytesWithHelpers(new Uint8Array(resp.data))
    } catch (error) {
      throwSdkError(error)
    }
  }

  async upload(data: Uint8Array, options: RequestUploadOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const resp = await this.instance.request.post<ReferenceResponse>(`${chunkEndpoint}`, data, {
        ...this.instance.prepareAxiosConfig({
          ...options,
          headers: {
            ...options.headers,
            "Content-Type": "application/octet-stream",
            ...extractUploadHeaders(options),
          },
        }),
      })

      return {
        reference: resp.data.reference,
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Uploads multiple chunks in a single bulk request.
   *
   * The payload format for each chunk is:
   * [chunk_size (2 bytes, little-endian ushort)][chunk_data (span + payload)][chunk_hash (32 bytes)]
   *
   * The API returns a single reference in the response.
   * This is typically a root reference when uploading chunks that are part
   * of a larger structure (e.g., a chunked file).
   *
   * @param chunks Array of chunk data (each chunk should include span + payload)
   * @param options Upload options including required batchId
   * @returns Object containing the reference returned by the API
   */
  async bulkUpload(chunks: SwarmChunk<4096, 8>[], options: RequestUploadOptions) {
    try {
      if (this.instance.type !== "etherna") {
        throw new EthernaSdkError(
          "BAD_REQUEST",
          "bulkUpload is only available for etherna instance type",
        )
      }

      await this.instance.awaitAccessToken()

      // Build payload according to the bulk upload format:
      // For each chunk: [chunk_size (2 bytes)][chunk_data][chunk_hash (32 bytes)]
      const payloadParts: Uint8Array[] = []

      for (const chunk of chunks) {
        // Get full chunk payload (span + payload)
        const chunkData = new Uint8Array([...chunk.span(), ...chunk.payload])

        // Convert chunk size to 2-byte little-endian ushort
        const chunkSize = chunkData.length
        const chunkSizeBytes = new Uint8Array(2)
        chunkSizeBytes[0] = chunkSize & 0xff
        chunkSizeBytes[1] = (chunkSize >> 8) & 0xff

        // Get chunk hash (32 bytes)
        const chunkHash = chunk.address()

        // Add: size + data + hash
        payloadParts.push(chunkSizeBytes)
        payloadParts.push(chunkData)
        payloadParts.push(chunkHash)
      }

      // Concatenate all parts into a single Uint8Array
      const totalLength = payloadParts.reduce((sum, part) => sum + part.length, 0)
      const concatenated = new Uint8Array(totalLength)
      let offset = 0
      for (const part of payloadParts) {
        concatenated.set(part, offset)
        offset += part.length
      }

      const resp = await this.instance.request.post<ReferenceResponse>(
        "/ev1/chunks/bulk-upload",
        concatenated,
        {
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

      // The API returns a single ChunkReferenceDto with one reference
      // This is the root reference for the bulk upload operation
      return {
        reference: resp.data.reference,
      }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
