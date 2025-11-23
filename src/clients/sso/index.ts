import { BaseClient } from "../base-client"
import { SSOAuth } from "./auth"
import { SSOIdentity } from "./identity"

import type { BaseClientOptions } from "../base-client"

export interface SSOClientOptions extends BaseClientOptions {}

export class EthernaSSOClient extends BaseClient {
  auth: SSOAuth
  identity: SSOIdentity

  /**
   * Init an SSO client
   * @param options Client options
   */
  constructor(baseUrl: string, options?: SSOClientOptions) {
    super(baseUrl, options)

    this.auth = new SSOAuth(this)
    this.identity = new SSOIdentity(this)
  }
}
