import { EthernaIndexAggregatorClient } from "."
import { IIndexUsersInterface } from "../index/users"
import { IndexAggregatorRequestOptions } from "./types"

export class IndexAggregatorUsers implements IIndexUsersInterface {
  constructor(private instance: EthernaIndexAggregatorClient) {}

  /**
   * Get a list of recent users
   * @param page Page offset (default = 0)
   * @param take Count of users to get (default = 25)
   * @param opts Request options
   */
  async fetchUsers(page = 0, take = 25, opts?: IndexAggregatorRequestOptions) {
    const result = await this.instance.fetchAggregatedPaginatedData(
      page,
      take,
      (client, relativeTake) => client.users.fetchUsers(page, relativeTake, opts),
      opts,
    )
    return result
  }

  /**
   * Get a user info
   * @param address User's address
   * @param opts Request options
   */
  async fetchUser(address: string, opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.users.fetchUser(address, opts)
  }

  /**
   * Fetch user's videos
   * @param address User's address
   * @param page Page offset (default = 0)
   * @param take Count of users to get (default = 25)
   * @param opts Request options
   */
  async fetchVideos(address: string, page = 0, take = 25, opts?: IndexAggregatorRequestOptions) {
    const result = await this.instance.fetchAggregatedPaginatedData(
      page,
      take,
      (client, relativeTake) =>
        client.users.fetchVideos(address, page, relativeTake, opts).then((res) => ({
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
   * Get the current logged user's info
   * @param opts Request options
   */
  async fetchCurrentUser(opts: IndexAggregatorRequestOptions) {
    const client = this.instance.getIndexClientByRequest(opts)
    return await client.users.fetchCurrentUser(opts)
  }
}
