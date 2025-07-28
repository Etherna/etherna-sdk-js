import { ZodError } from "zod"

import { EthernaIndexAggregatorClient } from "."
import { IndexVideo, VoteValue } from "../index/types"
import { IIndexVideosInterface } from "../index/videos"
import { IndexAggregatorRequestOptions } from "./types"
import { ErrorCode, EthernaSdkError } from "@/classes"

export class IndexAggregatorVideos implements IIndexVideosInterface {
  abortController?: AbortController

  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Create a new video on the index
   *
   * @param hash Hash of the manifest/feed with the video metadata
   * @param encryptionKey Encryption key
   * @param opts Request options
   * @returns Video id
   */
  async createVideo(
    hash: string,
    opts: IndexAggregatorRequestOptions & {
      encryptionKey?: string
    },
  ) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.createVideo(hash, opts)
  }

  /**
   * Get video information by id
   *
   * @param id Video id on Index
   * @param opts Request options
   * @returns The video object
   */
  async fetchVideoFromId(id: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.fetchVideoFromId(id, opts)
  }

  /**
   * Get video information
   *
   * @param hash Video hash on Swarm
   * @param opts Request options
   * @returns Video information
   */
  async fetchVideoFromHash(hash: string, opts?: IndexAggregatorRequestOptions) {
    const clients = opts?.indexUrl
      ? [this.instance.getIndexClientByRequest(opts)]
      : this.instance.indexClients
    const results = await Promise.allSettled(
      clients.map((client) =>
        client.videos.fetchVideoFromHash(hash, opts).then((res) => ({
          ...res,
          indexUrl: client.baseUrl,
        })),
      ),
    )

    const firstVideo = results
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .find((video) => video !== null)

    if (!firstVideo) {
      throw new EthernaSdkError("NOT_FOUND", "Video not found")
    }

    const currentVoteValue =
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value.currentVoteValue)
        .find((value) => value !== null) ?? null
    const totUpvotes = results
      .filter((result) => result.status === "fulfilled")
      .reduce((acc, result) => acc + result.value.totUpvotes, 0)
    const totDownvotes = results
      .filter((result) => result.status === "fulfilled")
      .reduce((acc, result) => acc + result.value.totDownvotes, 0)
    const lastValidManifest =
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value.lastValidManifest)
        .find((manifest) => manifest !== null) ?? firstVideo.lastValidManifest
    const ownerAddress =
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value.ownerAddress)
        .find((address) => address !== null) ?? firstVideo.ownerAddress

    return {
      id: firstVideo.id,
      creationDateTime: firstVideo.creationDateTime,
      ownerAddress,
      lastValidManifest,
      currentVoteValue,
      totDownvotes,
      totUpvotes,
      aggregatedResult: results.map((result, i) =>
        result.status === "fulfilled"
          ? result.value
          : {
              indexUrl: clients[i]?.baseUrl ?? null,
              code: result.reason instanceof EthernaSdkError ? result.reason.code : null,
              message:
                result.reason instanceof Error ? result.reason.message : String(result.reason),
              zodError: result.reason instanceof EthernaSdkError ? result.reason.zodError : null,
            },
      ),
    } satisfies IndexVideo & {
      aggregatedResult: (
        | IndexVideo
        | {
            indexUrl: string | null
            code: ErrorCode | null
            message: string
            zodError: ZodError | null | undefined
          }
      )[]
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
  async fetchLatestVideos(page = 0, take = 25, opts?: IndexAggregatorRequestOptions) {
    const result = await this.instance.fetchAggregatedPaginatedData(
      page,
      take,
      (client, relativeTake) =>
        client.videos.fetchLatestVideos(page, relativeTake, opts).then((res) => ({
          ...res,
          elements: res.elements.map((element) => ({
            ...element,
            indexUrl: client.baseUrl,
          })),
        })),
      opts,
    )
    return result
  }

  /**
   * Get video validations list
   *
   * @param id Video id on Index
   * @param opts Request options
   * @returns List of validations
   */
  async fetchValidations(id: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.fetchValidations(id, opts)
  }

  /**
   * Get video hash validation status
   *
   * @param hash Video hash on Swarm
   * @param opts Request options
   * @returns Validation status
   */
  async fetchHashValidation(hash: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.fetchHashValidation(hash, opts)
  }

  /**
   * Get videos validation status
   *
   * @param hashes Video hash on Swarm
   * @param opts Request options
   * @returns Validation status
   */
  async fetchBulkValidationByHash(hashes: string[], opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.fetchBulkValidationByHash(hashes, opts)
  }

  /**
   * Get videos validation status
   *
   * @param ids Video id on Index
   * @param opts Request options
   * @returns Validation status
   */
  async fetchBulkValidationById(ids: string[], opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.fetchBulkValidationById(ids, opts)
  }

  /**
   * Update a video information
   *
   * @param id Id of the video on Index
   * @param newHash New manifest hash with video metadata
   * @param opts Request options
   * @returns Video id
   */
  async updateVideo(id: string, newHash: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.updateVideo(id, newHash, opts)
  }

  /**
   * Delete a video from the index
   *
   * @param id Id of the video
   * @param opts Request options
   * @returns Success state
   */
  async deleteVideo(id: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.deleteVideo(id, opts)
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
  async fetchComments(id: string, page = 0, take = 25, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.fetchComments(id, page, take, opts)
  }

  /**
   * Post a new comment to a video
   *
   * @param id Id of the video
   * @param message Message string with markdown
   * @param opts Request options
   * @returns The comment object
   */
  async postComment(id: string, message: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.postComment(id, message, opts)
  }

  /**
   * Give a up/down vote to the video
   *
   * @param id Id of the video
   * @param vote Up / Down / Neutral vote
   * @param opts Request options
   */
  async vote(id: string, vote: VoteValue, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.vote(id, vote, opts)
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
    opts: IndexAggregatorRequestOptions,
  ) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.videos.reportVideo(id, manifestReference, description, opts)
  }
}
