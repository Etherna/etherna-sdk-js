// Forked from: https://github.com/ethersphere/bee

import { AxiosError } from "axios"

import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { EthernaGatewayPin } from "./types"
import type { RequestOptions } from "@/types/clients"
import type { EthAddress } from "@/types/eth"
import type { Reference } from "@/types/swarm"

const pinsEndpoint = "/pins"

export class Pins {
  constructor(private instance: BeeClient) {}

  async isPinned(reference: string, options?: RequestOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const resp = await this.instance.request.get<string>(`${pinsEndpoint}/${reference}`, {
        ...this.instance.prepareAxiosConfig(options),
      })

      return resp.data === reference
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return false
      }

      throwSdkError(error)
    }
  }

  async download(options?: RequestOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const resp = await this.instance.request.get<{ references: Reference[] }>(`${pinsEndpoint}`, {
        ...this.instance.prepareAxiosConfig(options),
      })
      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  async pin(reference: string, options?: RequestOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      return await this.instance.request.post(`${pinsEndpoint}/${reference}`, null, {
        ...this.instance.prepareAxiosConfig(options),
      })
    } catch (error) {
      throwSdkError(error)
    }
  }

  async unpin(reference: string, options?: RequestOptions) {
    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      return await this.instance.request.delete(`${pinsEndpoint}/${reference}`, {
        ...this.instance.prepareAxiosConfig(options),
      })
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Check if pinning is enabled on the current host
   *
   * @returns True if pinning is enabled
   */
  async pinEnabled() {
    if (this.instance.type === "etherna") {
      return true
    }

    try {
      const controller = new AbortController()
      await this.instance.request.get(pinsEndpoint, {
        ...this.instance.prepareAxiosConfig({
          signal: controller.signal,
          headers: {
            Range: "bytes=0-1",
          },
        }),
        onDownloadProgress: () => {
          controller.abort()
        },
      })
      return true
    } catch {
      return false
    }
  }
}
