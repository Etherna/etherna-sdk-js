// Forked from: https://github.com/ethersphere/bee

import { extractFileUploadHeaders, readFileHeaders, wrapBytesWithHelpers } from "./utils"
import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { FileDownloadOptions, FileUploadOptions, ReferenceResponse } from "./types"

const bzzEndpoint = "/bzz"

export class Bzz {
  constructor(private instance: BeeClient) {}

  url(reference: string, path = "") {
    const safeReference = reference.replace(/(^\/|\/$)/g, "")
    const safePath = path.replace(/(^\/|\/$)/g, "")

    let url = [this.instance.url, bzzEndpoint.replace("/", ""), safeReference, safePath]
      .filter(Boolean)
      .join("/")

    // add trailing slash to root to avoid CORS errors due to redirects
    if (!safePath) {
      url = url.replace(/\/?$/, "/")
    }
    return url
  }

  async download(hash: string, options?: FileDownloadOptions) {
    try {
      return await this.downloadPath(hash, "", options)
    } catch (error) {
      throwSdkError(error)
    }
  }

  async downloadPath(hash: string, path = "", options?: FileDownloadOptions) {
    try {
      const abortController = new AbortController()
      const signal = abortController.signal
      if (options?.signal) {
        options.signal.onabort = () => abortController.abort()
      }

      const resp = await this.instance.request.get<ArrayBuffer>(
        `${bzzEndpoint}/${hash}/${path.replace(/^\//, "")}`,
        {
          responseType: "arraybuffer",
          ...this.instance.prepareAxiosConfig({
            ...options,
            signal,
          }),
          onDownloadProgress: (e) => {
            if (options?.onDownloadProgress) {
              const progress = Math.round((e.progress ?? 0) * 100)
              options.onDownloadProgress(progress)
            }
            if (options?.maxResponseSize && e.loaded > options.maxResponseSize) {
              abortController.abort("Response size exceeded")
            }
          },
        },
      )

      const file = {
        ...readFileHeaders(resp.headers),
        data: wrapBytesWithHelpers(new Uint8Array(resp.data)),
      }

      return file
    } catch (error) {
      throwSdkError(error)
    }
  }

  async upload(data: Uint8Array | File | string, options: FileUploadOptions) {
    try {
      const resp = await this.instance.request.post<ReferenceResponse>(`${bzzEndpoint}`, data, {
        ...this.instance.prepareAxiosConfig({
          ...options,
          headers: {
            ...options.headers,
            ...extractFileUploadHeaders(options),
          },
        }),
        params: {
          name: options.filename,
        },
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

  async head(path: string, options?: FileDownloadOptions) {
    try {
      const abortController = new AbortController()
      const signal = abortController.signal
      if (options?.signal) {
        options.signal.onabort = () => abortController.abort()
      }

      const resp = await this.instance.request.head(`${bzzEndpoint}/${path.replace(/^\//, "")}`, {
        ...this.instance.prepareAxiosConfig({
          ...options,
          signal,
        }),
      })

      if (resp.status === 200) {
        const size = resp.headers["content-length"] as string | undefined
        const contentType = resp.headers["content-type"] as string | undefined

        return {
          size,
          contentType,
        }
      }

      throw new EthernaSdkError("NOT_FOUND", "Resource not found")
    } catch (error) {
      throwSdkError(error)
    }
  }
}
