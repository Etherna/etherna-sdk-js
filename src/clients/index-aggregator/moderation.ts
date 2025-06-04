import { IIndexModerationInterface } from "../index/moderation"
import { IndexAggregatorRequestOptions } from "./types"

import type { EthernaIndexAggregatorClient } from "."

export class IndexAggregatorModeration implements IIndexModerationInterface {
  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Delete any comment
   * @param id Id of the comment
   * @param opts Request options
   */
  async deleteComment(id: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.moderation.deleteComment(id, opts)
  }

  /**
   * Delete any video
   * @param id Id of the video
   * @param opts Request options
   */
  async deleteVideo(id: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.moderation.deleteVideo(id, opts)
  }
}
