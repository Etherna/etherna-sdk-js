import { CreditBalance, CreditLog } from "./types"
import { throwSdkError } from "@/classes"
import { RequestOptions } from "@/types/clients"

import type { EthernaCreditClient } from "."

export class CreditUser {
  constructor(private instance: EthernaCreditClient) {}

  /**
   * Get current credit balance
   */
  async fetchBalance(opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.get<CreditBalance>(`/user/credit`, {
        ...(await this.instance.prepareAxiosConfig(opts)),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get current user logs
   */
  async fetchLogs(page = 0, take = 25, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.get<CreditLog[]>(`/user/logs`, {
        ...(await this.instance.prepareAxiosConfig(opts)),
        params: { page, take },
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
