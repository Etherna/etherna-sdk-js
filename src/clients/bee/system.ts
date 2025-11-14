import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { RequestOptions } from "@/types/clients"
import type { BatchId } from "@/types/swarm"

export class System {
  constructor(private instance: BeeClient) {}

  /**
   * Get the current byte price
   *
   * @param opts Request options
   * @returns Dollar price per single byte
   */
  async fetchCurrentBytePrice(opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<string>(`/system/byteprice2`, {
            ...this.instance.prepareAxiosConfig(opts),
          })

          if (typeof resp.data !== "string") {
            throw new EthernaSdkError("VALIDATION_ERROR", "Cannot fetch byte price")
          }

          return resp.data
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Fetch creation batch id
   *
   * @param referenceId Reference id of the batch
   * @returns The created batch id if completed
   */
  async fetchPostageBatchRef(referenceId: string, opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<BatchId>(
            `/system/postagebatchref/${referenceId}`,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )

          const batchId = resp.data

          if (!batchId || typeof resp.data !== "string") {
            return null
          }

          return batchId
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
