import { IIndexCommentsInterface } from "../index/comments"
import { IndexAggregatorRequestOptions } from "./types"
import { EthernaSdkError } from "@/classes"

import type { EthernaIndexAggregatorClient } from "."

export class IndexAggregatorComments implements IIndexCommentsInterface {
  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Edit own comment
   * @param id Id of the comment
   * @param newText New text of the comment
   * @param opts Request options
   */
  async editComment(id: string, newText: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.comments.editComment(id, newText, opts)
  }

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
