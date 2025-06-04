import { IIndexCommentsInterface } from "../index/comments"
import { IndexAggregatorRequestOptions } from "./types"
import { EthernaSdkError } from "@/classes"

import type { EthernaIndexAggregatorClient } from "."

export class IndexAggregatorComments implements IIndexCommentsInterface {
  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Delete own comment
   * @param id Id of the comment
   * @param opts Request options
   */
  async deleteComment(id: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.comments.deleteComment(id, opts)
  }
}
