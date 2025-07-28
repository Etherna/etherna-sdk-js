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
      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.get<string>(`${pinsEndpoint}/${reference}`, {
            ...this.instance.prepareAxiosConfig(options),
          })

          return resp.data === reference
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<EthernaGatewayPin>(
            `/resources/${reference}/pin`,
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )

          return resp.data.isPinned
        }
      }
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return false
      }

      throwSdkError(error)
    }
  }

  async download(options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.get<{ references: Reference[] }>(
            `${pinsEndpoint}`,
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )
          return resp.data
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          const resp = await this.instance.apiRequest.get<string[]>(
            `/users/current/pinnedResources`,
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )

          return {
            references: resp.data as Reference[],
          }
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Fetch the users pinning a resource
   *
   * @param reference Hash of the resource
   * @param opts Request options
   * @returns List of addresses
   */
  async downloadPinUsers(reference: string, opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "Fetch pin users is only supported by the etherna gateway",
          )
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<EthAddress[]>(
            `/resources/${reference}/pin/users`,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )

          return resp.data
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async pin(reference: string, options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          return await this.instance.request.post(`${pinsEndpoint}/${reference}`, null, {
            ...this.instance.prepareAxiosConfig(options),
          })
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          return await this.instance.apiRequest.post(`/resources/${reference}/pin`, undefined, {
            ...this.instance.prepareAxiosConfig(options),
          })
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async unpin(reference: string, options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          return await this.instance.request.delete(`${pinsEndpoint}/${reference}`, {
            ...this.instance.prepareAxiosConfig(options),
          })
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          return await this.instance.apiRequest.delete(`/resources/${reference}/pin`, {
            ...this.instance.prepareAxiosConfig(options),
          })
        }
      }
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
