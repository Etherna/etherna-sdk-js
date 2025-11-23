import { IIndexSearchInterface } from "../index/search"
import { IndexVideo, IndexVideoPreview, PaginatedResult } from "../index/types"
import { AggregatedPaginatedResult, IndexAggregatorRequestOptions } from "./types"

import type { EthernaIndexAggregatorClient } from "."

export class IndexAggregatorSearch implements IIndexSearchInterface {
  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Search videos
   * @param query Search query
   * @param page Page offset (default = 0)
   * @param take Count of users to get (default = 25)
   * @param opts Request options
   */
  async fetchVideos(query: string, page = 0, take = 25, opts?: IndexAggregatorRequestOptions) {
    const result = await this.instance.fetchAggregatedPaginatedData(
      page,
      take,
      (client, relativeTake) => client.search.fetchVideos(query, page, relativeTake, opts),
      opts,
    )
    return result
  }
}
