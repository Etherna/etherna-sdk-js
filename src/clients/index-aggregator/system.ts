import { EthernaIndexAggregatorClient } from "."
import { IIndexSystemInterface } from "../index/system"
import { IndexAggregatorRequestOptions } from "./types"

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
