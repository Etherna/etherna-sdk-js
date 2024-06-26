import type { EthernaIndexClient } from "."
import type { RequestOptions } from ".."
import type { IndexParameters } from "./types"

export class IndexSystem {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Get a list of parameters and max charater lenghts
   * @param opts Request options
   */
  async fetchParameters(opts?: RequestOptions) {
    const resp = await this.instance.request.get<IndexParameters>("/system/parameters", {
      ...this.instance.prepareAxiosConfig(opts),
    })

    if (typeof resp.data !== "object") {
      throw new Error("Cannot fetch parameters")
    }

    return resp.data
  }
}
