import { throwSdkError } from "@/classes"

import type { EthernaIndexClient } from "."
import type { RequestOptions } from "@/types/clients"

export class IndexModeration {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Delete any comment
   * @param id Id of the comment
   * @param opts Request options
   */
  async deleteComment(id: string, opts?: RequestOptions) {
    try {
      await this.instance.apiRequest.delete(`/moderation/comments/${id}`, {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return true
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Delete any video
   * @param id Id of the video
   * @param opts Request options
   */
  async deleteVideo(id: string, opts?: RequestOptions) {
    try {
      await this.instance.apiRequest.delete(`/moderation/videos/${id}`, {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return true
    } catch (error) {
      throwSdkError(error)
    }
  }
}
