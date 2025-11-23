// Forked from: https://github.com/ethersphere/bee

import { extractUploadHeaders, wrapBytesWithHelpers } from "./utils"
import { throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { ReferenceResponse, RequestUploadOptions } from "./types"
import type { RequestOptions } from "@/types/clients"

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
}
