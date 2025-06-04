import { EthernaIndexClient, IIndexClientInterface, PaginatedResult } from "../index"
import { IndexAggregatorComments } from "./comments"
import { IndexAggregatorModeration } from "./moderation"
import { IndexAggregatorSearch } from "./search"
import { IndexAggregatorSystem } from "./system"
import { AggregatedPaginatedResult, IndexAggregatorRequestOptions } from "./types"
import { IndexAggregatorUsers } from "./users"
import { IndexAggregatorVideos } from "./videos"
import { EthernaSdkError } from "@/classes"

export interface IndexAggregatorClientOptions {
  indexes: {
    url: string
    apiPath: string
  }[]
  accessToken?: string
}

export class EthernaIndexAggregatorClient implements IIndexClientInterface {
  public indexClients: EthernaIndexClient[]
  comments: IndexAggregatorComments
  moderation: IndexAggregatorModeration
  search: IndexAggregatorSearch
  system: IndexAggregatorSystem
  videos: IndexAggregatorVideos
  users: IndexAggregatorUsers

  /**
   * Init an index client
   * @param options Client options
   */
  constructor(options: IndexAggregatorClientOptions) {
    this.indexClients = options.indexes.map(
      (index) =>
        new EthernaIndexClient(index.url, {
          apiPath: index.apiPath,
          accessToken: options.accessToken,
        }),
    )
    this.comments = new IndexAggregatorComments(this)
    this.moderation = new IndexAggregatorModeration(this)
    this.search = new IndexAggregatorSearch(this)
    this.system = new IndexAggregatorSystem(this)
    this.videos = new IndexAggregatorVideos(this)
    this.users = new IndexAggregatorUsers(this)
  }

  public getIndexClientByRequest(opts: IndexAggregatorRequestOptions) {
    if (!opts.indexUrl) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        "opts.IndexUrl is required to delete a comment.",
      )
    }
    const client = this.indexClients.find((c) => c.baseUrl === opts.indexUrl)
    if (!client) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Index client with baseUrl ${opts.indexUrl} not found.`,
      )
    }
    return client
  }

  public fetchAggregatedPaginatedData = async <T>(
    page: number,
    take: number,
    fetcher: (client: EthernaIndexClient, relativeTake: number) => Promise<PaginatedResult<T>>,
    opts?: IndexAggregatorRequestOptions,
  ): Promise<AggregatedPaginatedResult<T>> => {
    const clients = opts?.indexUrl ? [this.getIndexClientByRequest(opts)] : this.indexClients
    const relativeTake = Math.ceil(take / clients.length)
    const results = await Promise.allSettled(clients.map((client) => fetcher(client, relativeTake)))
    const elements = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value.elements)
    const totalElements = results.reduce((acc, result) => {
      if (result.status === "fulfilled") {
        return acc + result.value.totalElements
      }
      return acc
    }, 0)
    const maxPage = Math.max(
      ...results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value.maxPage),
    )

    const shouldContinue =
      elements.length < (page + 1) * relativeTake &&
      results.some((res) => res.status === "fulfilled" && res.value.maxPage > page)

    return {
      elements,
      totalElements,
      maxPage,
      currentPage: page,
      pageSize: relativeTake,
      shouldContinue,
    } satisfies AggregatedPaginatedResult<T>
  }
}
