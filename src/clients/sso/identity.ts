import { throwSdkError } from "@/classes"

import type { SSOIdentity as Identity } from "./types"
import type { EthernaSSOClient } from "."

export class SSOIdentity {
  constructor(private instance: EthernaSSOClient) {}

  /**
   * Get current SSO user
   */
  async fetchCurrentIdentity() {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.get<Identity>(`/identity`, {
        ...(await this.instance.prepareAxiosConfig()),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
