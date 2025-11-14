import { throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { RequestOptions } from "@/types/clients"

const chainstateEndpoint = "/chainstate"

const FALLBACK_PRICE = "1"

export class ChainState {
  private lateBytePrice: string | null = null

  constructor(private instance: BeeClient) {}

  async getCurrentPrice(options?: RequestOptions): Promise<string> {
    if (this.lateBytePrice !== null) {
      return this.lateBytePrice
    }

    try {
      if (this.instance.type === "etherna") {
        await this.instance.awaitAccessToken()
      }

      const resp = await this.instance.request.get(chainstateEndpoint, {
        ...this.instance.prepareAxiosConfig(options),
      })
      let price = resp.data.currentPrice ?? FALLBACK_PRICE
      if (price === "0") {
        // for development
        price = FALLBACK_PRICE
      }
      this.lateBytePrice = price
      return price
    } catch (error) {
      throwSdkError(error)
    }
  }
}
