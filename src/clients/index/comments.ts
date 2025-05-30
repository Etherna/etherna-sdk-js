import { throwSdkError } from "@/classes"

import type { EthernaIndexClient } from "."
import type { RequestOptions } from "@/types/clients"

export class IndexComments {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Delete own comment
   * @param id Id of the comment
   * @param opts Request options
   */
  async deleteComment(id: string, opts?: RequestOptions) {
    try {
      await this.instance.apiRequest.delete(`/comments/${id}`, {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return true
    } catch (error) {
      throwSdkError(error)
    }
  }
}
