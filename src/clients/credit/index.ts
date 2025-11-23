import { BaseClient } from "../base-client"
import { CreditUser } from "./user"

import type { BaseClientOptions } from "../base-client"

export interface CreditClientOptions extends BaseClientOptions {}

export class EthernaCreditClient extends BaseClient {
  user: CreditUser

  /**
   * Init a credit client
   * @param options Client options
   */
  constructor(baseUrl: string, options?: CreditClientOptions) {
    super(baseUrl, options)

    this.user = new CreditUser(this)
  }
}
