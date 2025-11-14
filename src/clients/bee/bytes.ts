// Forked from: https://github.com/ethersphere/bee

import { extractFileUploadHeaders, wrapBytesWithHelpers } from "./utils"
import { throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { ReferenceResponse, RequestDownloadOptions, RequestUploadOptions } from "./types"

const bytesEndpoint = "/bytes"

export class Bytes {
  constructor(private instance: BeeClient) {}

  url(reference: string) {
    return `${this.instance.url}${bytesEndpoint}/${reference}`
  }

  async download(hash: string, options?: RequestDownloadOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }
      const resp = await this.instance.request.get<ArrayBuffer>(`${bytesEndpoint}/${hash}`, {
        responseType: "arraybuffer",
        ...this.instance.prepareAxiosConfig(options),
        onDownloadProgress: (e) => {
          if (options?.onDownloadProgress) {
            const progress = Math.round((e.progress ?? 0) * 100)
            options.onDownloadProgress(progress)
          }
        },
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
      const resp = await this.instance.request.post<ReferenceResponse>(`${bytesEndpoint}`, data, {
        ...this.instance.prepareAxiosConfig({
          ...options,
          headers: {
            "Content-Type": "application/octet-stream",
            ...options.headers,
            ...extractFileUploadHeaders(options),
          },
        }),
        onUploadProgress: (e) => {
          if (options?.onUploadProgress) {
            const progress = Math.round((e.progress ?? 0) * 100)
            options.onUploadProgress(progress)
          }
        },
      })

      return {
        reference: resp.data.reference,
        tagUid: resp.headers["swarm-tag"],
      }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
