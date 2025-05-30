import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { EthernaGatewayChainState } from "./types"
import type { RequestOptions } from "@/types/clients"

const chainstateEndpoint = "/chainstate"

export class ChainState {
  private lateBytePrice: number | null = null

  constructor(private instance: BeeClient) {}

  async getCurrentPrice(options?: RequestOptions): Promise<number> {
    if (this.lateBytePrice !== null) {
      return this.lateBytePrice
    }

    try {
      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.get(chainstateEndpoint, {
            ...this.instance.prepareAxiosConfig(options),
          })
          const price = resp.data.price ?? 4
          this.lateBytePrice = price
          return price
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<EthernaGatewayChainState>(
            `/system/chainstate`,
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )
          const price = resp.data.currentPrice ?? 4
          this.lateBytePrice = price
          return price
        }
        default:
          throw new EthernaSdkError("BAD_REQUEST", "Invalid client type")
      }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
