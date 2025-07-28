import { IndexVideoComment } from "./types"
import { throwSdkError } from "@/classes"

import type { EthernaIndexClient } from "."
import type { RequestOptions } from "@/types/clients"

export interface IIndexCommentsInterface {
  editComment(id: string, newText: string, opts?: RequestOptions): Promise<IndexVideoComment>
  deleteComment(id: string, opts?: RequestOptions): Promise<boolean>
}

export class IndexComments implements IIndexCommentsInterface {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Edit own comment
   * @param id Id of the comment
   * @param newText New text of the comment
   * @param opts Request options
   */
  async editComment(id: string, newText: string, opts?: RequestOptions) {
    try {
      await this.instance.awaitAccessToken()
      const resp = await this.instance.apiRequest.put<IndexVideoComment>(
        `/videos/comments/${id}`,
        JSON.stringify(newText),
        {
          ...this.instance.prepareAxiosConfig(opts),
          headers: {
            ...this.instance.prepareAxiosConfig(opts).headers,
            accept: "text/plain",
            "Content-Type": "application/json",
          },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Delete own comment
   * @param id Id of the comment
   * @param opts Request options
   */
  async deleteComment(id: string, opts?: RequestOptions) {
    try {
      await this.instance.awaitAccessToken()

      await this.instance.apiRequest.delete(`/comments/${id}`, {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return true
    } catch (error) {
      throwSdkError(error)
    }
  }
}
