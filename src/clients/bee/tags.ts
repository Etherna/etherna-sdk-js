import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { RequestOptions } from "@/types/clients"
import type { Tag } from "@/types/swarm"

const tagsEndpoint = "/tags"

export class Tags {
  constructor(private instance: BeeClient) {}

  async downloadAll(offset = 0, limit = 100, options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.get<{ tags: Tag[] }>(tagsEndpoint, {
            ...this.instance.prepareAxiosConfig(options),
            params: {
              offset,
              limit,
            },
          })
          return resp.data
        }
        case "etherna": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by the etherna gateway",
          )
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async download(uid: number, options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.get<Tag>(`${tagsEndpoint}/${uid}`, {
            ...this.instance.prepareAxiosConfig(options),
          })
          return resp.data
        }
        case "etherna": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by the etherna gateway",
          )
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async create(address: string, options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.post<Tag>(
            tagsEndpoint,
            {
              address,
            },
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )
          return resp.data
        }
        case "etherna": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by the etherna gateway",
          )
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async delete(uid: number, options?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          return await this.instance.request.delete(`${tagsEndpoint}/${uid}`, {
            ...this.instance.prepareAxiosConfig(options),
          })
        }
        case "etherna": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by the etherna gateway",
          )
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
