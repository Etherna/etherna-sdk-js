import { throwSdkError } from "@/classes"
import { axiosHeadersToPlainObject } from "@/utils/axios"

import type {
  IndexVideo,
  IndexVideoComment,
  IndexVideoManifest,
  IndexVideoPreview,
  IndexVideoValidation,
  PaginatedResult,
  VoteValue,
} from "./types"
import type { EthernaIndexClient } from "."
import type { RequestOptions } from "@/types/clients"

export interface IIndexVideosInterface {
  createVideo(hash: string, batchId: string, opts?: RequestOptions): Promise<string>
  fetchVideoFromId(id: string, opts?: RequestOptions): Promise<IndexVideo>
  fetchVideoFromHash(hash: string, opts?: RequestOptions): Promise<IndexVideo>
  fetchLatestVideos(
    page?: number,
    take?: number,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<IndexVideoPreview>>
  fetchValidations(id: string, opts?: RequestOptions): Promise<IndexVideoValidation[]>
  fetchHashValidation(hash: string, opts?: RequestOptions): Promise<IndexVideoValidation>
  fetchBulkValidationById(ids: string[], opts?: RequestOptions): Promise<IndexVideoValidation[]>
  fetchBulkValidationByHash(
    hashes: string[],
    opts?: RequestOptions,
  ): Promise<IndexVideoValidation[]>
  updateVideo(id: string, newHash: string, opts?: RequestOptions): Promise<IndexVideoManifest>
  deleteVideo(id: string, opts?: RequestOptions): Promise<boolean>
  fetchComments(
    id: string,
    page?: number,
    take?: number,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<IndexVideoComment>>
  postComment(id: string, message: string, opts?: RequestOptions): Promise<IndexVideoComment>
  vote(id: string, vote: VoteValue, opts?: RequestOptions): Promise<IndexVideoComment>
  reportVideo(
    id: string,
    manifestReference: string,
    code: string,
    opts?: RequestOptions,
  ): Promise<void>
}

export class IndexVideos implements IIndexVideosInterface {
  abortController?: AbortController

  constructor(private instance: EthernaIndexClient) {}

  /**
   * Create a new video on the index
   *
   * @param hash Hash of the manifest/feed with the video metadata
   * @param encryptionKey Encryption key
   * @param opts Request options
   * @returns Video id
   */
  async createVideo(hash: string, batchId: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.post<string>(
        `/videos/create2`,
        {
          manifestReference: hash,
          batchId,
        },
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get video information by id
   *
   * @param id Video id on Index
   * @param opts Request options
   * @returns The video object
   */
  async fetchVideoFromId(id: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.get<IndexVideo>(`/videos/${id}/find2`, {
        ...(await this.instance.prepareAxiosConfig(opts)),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get video information
   *
   * @param hash Video hash on Swarm
   * @param opts Request options
   * @returns Video information
   */
  async fetchVideoFromHash(hash: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.get<IndexVideo>(`/videos/manifest2/${hash}`, {
        ...(await this.instance.prepareAxiosConfig(opts)),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get a list of recent videos uploaded on the platform
   *
   * @param page Page offset (default = 0)
   * @param take Number of videos to fetch (default = 25)
   * @param opts Request options
   * @returns The list of videos
   */
  async fetchLatestVideos(page = 0, take = 25, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.get<PaginatedResult<IndexVideoPreview>>(
        `/videos/latest3`,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
          params: { page, take },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get video validations list
   *
   * @param id Video id on Index
   * @param opts Request options
   * @returns List of validations
   */
  async fetchValidations(id: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.get<IndexVideoValidation[]>(
        `/videos/${id}/validation2`,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get video hash validation status
   *
   * @param hash Video hash on Swarm
   * @param opts Request options
   * @returns Validation status
   */
  async fetchHashValidation(hash: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.get<IndexVideoValidation>(
        `/videos/manifest/${hash}/validation`,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get videos validation status
   *
   * @param hashes Video hash on Swarm
   * @param opts Request options
   * @returns Validation status
   */
  async fetchBulkValidationByHash(hashes: string[], opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.put<IndexVideoValidation[]>(
        `/videos/manifest/bulkvalidation`,
        hashes,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get videos validation status
   *
   * @param ids Video id on Index
   * @param opts Request options
   * @returns Validation status
   */
  async fetchBulkValidationById(ids: string[], opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.put<IndexVideoValidation[]>(
        `/videos/bulkvalidation2`,
        ids,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Update a video information
   *
   * @param id Id of the video on Index
   * @param newHash New manifest hash with video metadata
   * @param opts Request options
   * @returns Video id
   */
  async updateVideo(id: string, newHash: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.put<IndexVideoManifest>(
        `/videos/${id}/update2`,
        null,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
          params: { newHash },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Delete a video from the index
   *
   * @param id Id of the video
   * @param opts Request options
   * @returns Success state
   */
  async deleteVideo(id: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      await this.instance.apiRequest.delete(`/videos/${id}`, {
        ...(await this.instance.prepareAxiosConfig(opts)),
      })

      return true
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Fetch the video comments
   *
   * @param id Id of the video
   * @param page Page offset (default = 0)
   * @param take Number of comments to fetch (default = 25)
   * @param opts Request options
   * @returns The list of comments
   */
  async fetchComments(id: string, page = 0, take = 25, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      const resp = await this.instance.apiRequest.get<PaginatedResult<IndexVideoComment>>(
        `/videos/${id}/comments3`,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
          params: { page, take },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Post a new comment to a video
   *
   * @param id Id of the video
   * @param message Message string with markdown
   * @param opts Request options
   * @returns The comment object
   */
  async postComment(id: string, message: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const config = await this.instance.prepareAxiosConfig(opts)
      const resp = await this.instance.apiRequest.post<IndexVideoComment>(
        `/videos/${id}/comments2`,
        JSON.stringify(message),
        {
          ...config,
          headers: {
            ...axiosHeadersToPlainObject(config.headers),
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
   * Give a up/down vote to the video
   *
   * @param id Id of the video
   * @param vote Up / Down / Neutral vote
   * @param opts Request options
   */
  async vote(id: string, vote: VoteValue, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.post<IndexVideoComment>(
        `/videos/${id}/votes`,
        null,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
          params: { value: vote },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Report a video
   *
   * @param id Id of the video
   * @param manifestReference Reference of the manifest to report
   * @param description Report description
   * @param opts Request options
   */
  async reportVideo(
    id: string,
    manifestReference: string,
    description: string,
    opts?: RequestOptions,
  ) {
    try {
      await this.instance.autoLoadApiPath()

      const _resp = await this.instance.apiRequest.post(
        `/videos/${id}/manifest/${manifestReference}/reports`,
        null,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
          params: { description },
        },
      )
    } catch (error) {
      throwSdkError(error)
    }
  }
}
