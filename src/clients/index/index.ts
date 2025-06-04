import { BaseClient } from "../base-client"
import { IIndexCommentsInterface, IndexComments } from "./comments"
import { IIndexModerationInterface, IndexModeration } from "./moderation"
import { IIndexSearchInterface, IndexSearch } from "./search"
import { IIndexSystemInterface, IndexSystem } from "./system"
import { IIndexUsersInterface, IndexUsers } from "./users"
import { IIndexVideosInterface, IndexVideos } from "./videos"

import type { BaseClientOptions } from "../base-client"

export interface IndexClientOptions extends BaseClientOptions {}

export interface IIndexClientInterface {
  comments: IIndexCommentsInterface
  moderation: IIndexModerationInterface
  search: IIndexSearchInterface
  system: IIndexSystemInterface
  videos: IIndexVideosInterface
  users: IIndexUsersInterface
}

export class EthernaIndexClient extends BaseClient implements IIndexClientInterface {
  comments: IndexComments
  moderation: IndexModeration
  search: IndexSearch
  system: IndexSystem
  videos: IndexVideos
  users: IndexUsers

  /**
   * Init an index client
   * @param options Client options
   */
  constructor(baseUrl: string, options?: IndexClientOptions) {
    super(baseUrl, options)

    this.comments = new IndexComments(this)
    this.moderation = new IndexModeration(this)
    this.search = new IndexSearch(this)
    this.system = new IndexSystem(this)
    this.videos = new IndexVideos(this)
    this.users = new IndexUsers(this)
  }
}
