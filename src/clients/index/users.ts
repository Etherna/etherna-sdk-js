import { throwSdkError } from "@/classes"

import type { EthernaIndexClient } from "."
import type { IndexCurrentUser, IndexUser, IndexVideo, PaginatedResult } from "./types"
import type { RequestOptions } from "@/types/clients"

export interface IIndexUsersInterface {
  fetchUsers(
    page?: number,
    take?: number,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<IndexUser>>
  fetchUser(address: string, opts?: RequestOptions): Promise<IndexUser>
  fetchVideos(
    address: string,
    page?: number,
    take?: number,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<IndexVideo>>
  fetchCurrentUser(opts?: RequestOptions): Promise<IndexCurrentUser>
}

export class IndexUsers implements IIndexUsersInterface {
  constructor(private instance: EthernaIndexClient) {}

  /**
   * Get a list of recent users
   * @param page Page offset (default = 0)
   * @param take Count of users to get (default = 25)
   * @param opts Request options
   */
  async fetchUsers(page = 0, take = 25, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()

      const resp = await this.instance.apiRequest.get<PaginatedResult<IndexUser>>("/users/list2", {
        ...this.instance.prepareAxiosConfig(opts),
        params: { page, take },
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get a user info
   * @param address User's address
   * @param opts Request options
   */
  async fetchUser(address: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()

      const resp = await this.instance.apiRequest.get<IndexUser>(`/users/${address}`, {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Fetch user's videos
   * @param address User's address
   * @param page Page offset (default = 0)
   * @param take Count of users to get (default = 25)
   * @param opts Request options
   */
  async fetchVideos(address: string, page = 0, take = 25, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()

      const resp = await this.instance.apiRequest.get<PaginatedResult<IndexVideo>>(
        `/users/${address}/videos3`,
        {
          ...this.instance.prepareAxiosConfig(opts),
          params: { page, take },
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get the current logged user's info
   * @param opts Request options
   */
  async fetchCurrentUser(opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()

      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.get<IndexCurrentUser>(`/users/current`, {
        ...this.instance.prepareAxiosConfig(opts),
      })

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
