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
          const resp = await this.instance.request.get<EthernaGatewayCurrentUser>(
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

  /**
   * Get current user's credits
   *
   * @returns User's credits amount
   */
  async downloadCredits(opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          const resp = await this.instance.request.get<EthernaGatewayCredit>(
            `/users/current/credit`,
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
