import { throwSdkError } from "@/classes"

import type { EthernaSSOClient } from "."
import type { SSOIdentity as Identity } from "./types"

export class SSOIdentity {
  constructor(private instance: EthernaSSOClient) {}

  /**
   * Get current SSO user
   */
  async fetchCurrentIdentity() {
    try {
      const resp = await this.instance.apiRequest.get<Identity>(`/identity`, {
        ...this.instance.prepareAxiosConfig(),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
