import { throwSdkError } from "@/classes"

import type { EthernaIndexClient } from "."
import type { IndexVideoPreview, PaginatedResult } from "./types"
import type { RequestOptions } from "@/types/clients"

export class IndexSearch {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Search videos
   * @param query Search query
   * @param page Page offset (default = 0)
   * @param take Count of users to get (default = 25)
   * @param opts Request options
   */
  async fetchVideos(query: string, page = 0, take = 25, opts?: RequestOptions) {
    try {
      const resp = await this.instance.apiRequest.get<PaginatedResult<IndexVideoPreview>>(
        "/search/query2",
        {
          ...this.instance.prepareAxiosConfig(opts),
          params: { query, page, take },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
