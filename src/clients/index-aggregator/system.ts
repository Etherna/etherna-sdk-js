import type { IIndexSystemInterface } from "../index/system"
import type { IndexAggregatorRequestOptions } from "./types"
import type { EthernaIndexAggregatorClient } from "."

export class IndexAggregatorSystem implements IIndexSystemInterface {
  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Get a list of parameters and max charater lenghts
   * @param opts Request options
   */
  async fetchParameters(opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.system.fetchParameters(opts)
  }
}
