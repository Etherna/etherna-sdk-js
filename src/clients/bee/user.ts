import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { EthernaGatewayCredit, EthernaGatewayCurrentUser } from "./types"
import type { RequestOptions } from "@/types/clients"

export class User {
  constructor(private instance: BeeClient) {}

  /**
   * Get the current logged user's info
   * @returns Gateway current user
   */
  async downloadCurrentUser(opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          const resp = await this.instance.apiRequest.get<EthernaGatewayCurrentUser>(
            `/users/current`,
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
}
