import { throwSdkError } from "@/classes"

import type { EthernaIndexClient } from "."
import type { IndexParameters } from "./types"
import type { RequestOptions } from "@/types/clients"

export class IndexSystem {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Get a list of parameters and max charater lenghts
   * @param opts Request options
   */
  async fetchParameters(opts?: RequestOptions) {
    try {
      const resp = await this.instance.apiRequest.get<IndexParameters>("/system/parameters", {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
