import { wrapBytesWithHelpers } from "./utils/bytes"
import { extractUploadHeaders } from "./utils/headers"

import type { BeeClient } from "."
import type { RequestOptions } from ".."
import type { ReferenceResponse, RequestUploadOptions } from "./types"

const chunkEndpoint = "/chunks"

export class Chunk {
  constructor(private instance: BeeClient) {}

  async download(hash: string, options?: RequestOptions) {
    const resp = await this.instance.request.get<ArrayBuffer>(`${chunkEndpoint}/${hash}`, {
      responseType: "arraybuffer",
      headers: options?.headers,
      timeout: options?.timeout,
      signal: options?.signal,
    })

    return wrapBytesWithHelpers(new Uint8Array(resp.data))
  }

  async upload(data: Uint8Array, options: RequestUploadOptions) {
    const resp = await this.instance.request.post<ReferenceResponse>(`${chunkEndpoint}`, data, {
      headers: {
        "Content-Type": "application/octet-stream",
        ...extractUploadHeaders(options),
      },
      timeout: options?.timeout,
      signal: options?.signal,
    })

    return {
      reference: resp.data.reference,
    }
  }
}
